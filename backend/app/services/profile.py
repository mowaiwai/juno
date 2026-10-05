"""人才画像服务（spec talent-matching §2）。

绝不造分：无源维度 no_data + score=null。
"""

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import Principal, err
from app.framework_content import EDUCATION_OPTIONS
from app.models.application import (
    Application,
    ApplicationStatus,
    SelfAssessment,
)
from app.models.employee import Employee
from app.models.profile import (
    DIMENSION_KEYS,
    DimensionStatus,
    ProfileDimension,
    ProfileSnapshot,
    ProfileSource,
)
from app.models.user import User
from app.services.audit import audit_as
from app.services.level_framework import resolve_for_tenant
from app.services.scope import can_access_employee

_SELF_LEVEL_VALUES = {"met": 1.0, "partially_met": 0.5, "not_met": 0.0}


def _now():
    return datetime.now().astimezone()


# ---------------------------------------------------------------------------
# 维度计算
# ---------------------------------------------------------------------------

def _latest_published_application(db: Session, employee_id):
    return db.scalar(
        select(Application)
        .where(
            Application.employee_id == employee_id,
            Application.status == ApplicationStatus.PUBLISHED,
        )
        .order_by(Application.published_at.desc(), Application.id.desc())
    )


def _duty_dimension(db: Session, employee: Employee):
    app = _latest_published_application(db, employee.id)
    if app is None:
        return ProfileDimension(
            dimension_key="duty",
            status=DimensionStatus.NO_DATA,
            score=None,
            note="暂无已发布认证结果，职责履行待认证数据回写",
        )
    rows = db.scalars(
        select(SelfAssessment).where(
            SelfAssessment.application_id == app.id
        )
    ).all()
    values = [_SELF_LEVEL_VALUES[r.self_level.value] for r in rows]
    score = round(sum(values) / len(values) * 100) if values else None
    return ProfileDimension(
        dimension_key="duty",
        status=DimensionStatus.MEASURED if values else DimensionStatus.NO_DATA,
        score=score,
        note=(
            f"来源：{app.target_grade} 认证（{app.published_at.date()} 发布）"
            if app.published_at
            else f"来源：{app.target_grade} 认证"
        ),
        source_ref=app.id,
    )


def _perf_dimension(employee: Employee):
    return ProfileDimension(
        dimension_key="perf",
        status=DimensionStatus.MEASURED,
        score=None,
        grade_label=employee.perf_grade,
        note="来自员工档案最近一期绩效结果（字母等级，不换算分数）",
    )


def _required_education(db: Session, employee: Employee) -> str | None:
    result = resolve_for_tenant(db, employee.tenant_id, employee.grade)
    if result is None:
        return None
    fw, level, _ = result
    cond = next(
        (c for c in fw.conditions if c.level_order == level.level_order), None
    )
    return cond.education_min if cond else None


def _basic_dimension(db: Session, employee: Employee):
    if not employee.education:
        return ProfileDimension(
            dimension_key="basic",
            status=DimensionStatus.NO_DATA,
            score=None,
            note="学历与证书尚未补录，待 HR 核验",
        )

    required = _required_education(db, employee)
    if required and required != "不限":
        meets = (
            EDUCATION_OPTIONS.index(employee.education)
            >= EDUCATION_OPTIONS.index(required)
        )
    else:
        meets = True

    cert_count = len(employee.certificates or [])
    base = 70 if meets else 50
    score = min(100, base + 5 * cert_count)
    cert_text = "、".join(employee.certificates) if cert_count else "无登记证书"
    verb = "满足" if meets else "暂不满足"
    return ProfileDimension(
        dimension_key="basic",
        status=DimensionStatus.MEASURED,
        score=score,
        note=(
            f"学历 {employee.education}（{verb} {employee.grade} 要求"
            + (f" {required}" if required else "")
            + f"）；证书：{cert_text}"
        ),
    )


def _no_data_dimension(key: str, waiting: str):
    return ProfileDimension(
        dimension_key=key,
        status=DimensionStatus.NO_DATA,
        score=None,
        note=f"暂无数据源：{waiting}",
    )


def build_dimensions(db: Session, employee: Employee) -> list[ProfileDimension]:
    made = {
        "basic": _basic_dimension(db, employee),
        "duty": _duty_dimension(db, employee),
        "perf": _perf_dimension(employee),
        "biz": _no_data_dimension("biz", "业绩中心尚未接入"),
        "contribution": _no_data_dimension(
            "contribution", "团队贡献记录尚未接入"
        ),
        "knowledge": _no_data_dimension(
            "knowledge", "考试/测评成绩尚未落库"
        ),
        "ability": _no_data_dimension(
            "ability", "能力测评数据尚未接入"
        ),
    }
    return [made[key] for key in DIMENSION_KEYS]


def _overall(dimensions: list[ProfileDimension]):
    scored = [
        d.score
        for d in dimensions
        if d.status == DimensionStatus.MEASURED and d.score is not None
    ]
    if len(scored) < 3:
        return None
    return round(sum(scored) / len(scored))


# ---------------------------------------------------------------------------
# 生成与版本
# ---------------------------------------------------------------------------

def _next_version_seq(db: Session, employee_id) -> int:
    current = db.scalar(
        select(func.max(ProfileSnapshot.version_seq)).where(
            ProfileSnapshot.employee_id == employee_id
        )
    )
    return (current or 0) + 1


def generate_profile(
    db: Session,
    employee_id,
    *,
    actor: User | None = None,
    source: ProfileSource = ProfileSource.MANUAL,
) -> ProfileSnapshot:
    employee = db.get(Employee, employee_id)
    if employee is None:
        raise err(404, "employee_not_found", "员工不存在")

    dimensions = build_dimensions(db, employee)
    snapshot = ProfileSnapshot(
        tenant_id=employee.tenant_id,
        employee_id=employee.id,
        version_seq=_next_version_seq(db, employee.id),
        source=source,
        overall=_overall(dimensions),
        generated_by=actor.id if actor else None,
        generated_at=_now(),
        dimensions=dimensions,
    )
    db.add(snapshot)
    db.flush()
    return snapshot


def generate_all(db: Session, tenant_id, actor: User) -> list[ProfileSnapshot]:
    employees = db.scalars(
        select(Employee).where(
            Employee.tenant_id == tenant_id,
            Employee.is_active.is_(True),
        )
    ).all()
    return [
        generate_profile(db, e.id, actor=actor) for e in employees
    ]


def writeback_on_publish(db: Session, application: Application) -> ProfileSnapshot:
    """认证发布事件：汇聚完整新版画像（cert_writeback）。"""
    return generate_profile(
        db,
        application.employee_id,
        actor=None,
        source=ProfileSource.CERT_WRITEBACK,
    )


def writeback_on_inventory_publish(db: Session, batch) -> int:
    """盘点发布事件（数据飞轮）：为批次内已定位员工各生成一版
    inventory_writeback 画像——绩效维度随员工档案最新绩效刷新，
    版本时间线记录本次盘点回写。返回回写份数。
    """
    from app.models.inventory import InventoryResult

    employee_ids = db.scalars(
        select(InventoryResult.employee_id).where(
            InventoryResult.batch_id == batch.id,
            InventoryResult.located.is_(True),
        )
    ).all()
    for employee_id in employee_ids:
        generate_profile(
            db, employee_id, actor=None,
            source=ProfileSource.INVENTORY_WRITEBACK,
        )
    return len(employee_ids)


def latest_profile(db: Session, employee_id) -> ProfileSnapshot | None:
    return db.scalar(
        select(ProfileSnapshot)
        .where(ProfileSnapshot.employee_id == employee_id)
        .order_by(ProfileSnapshot.version_seq.desc())
    )


def profile_versions(db: Session, employee_id) -> list[ProfileSnapshot]:
    return db.scalars(
        select(ProfileSnapshot)
        .where(ProfileSnapshot.employee_id == employee_id)
        .order_by(ProfileSnapshot.version_seq)
    ).all()


def get_version(
    db: Session, employee_id, version_seq: int
) -> ProfileSnapshot | None:
    return db.scalar(
        select(ProfileSnapshot).where(
            ProfileSnapshot.employee_id == employee_id,
            ProfileSnapshot.version_seq == version_seq,
        )
    )


# ---------------------------------------------------------------------------
# 数据范围授权
# ---------------------------------------------------------------------------

def subordinate_ids(db: Session, employee_id) -> set:
    """沿 manager_id 递归收集全部下级（含间接下级）。"""
    result: set = set()
    frontier = [employee_id]
    while frontier:
        rows = db.scalars(
            select(Employee.id).where(Employee.manager_id.in_(frontier))
        ).all()
        new = [r for r in rows if r not in result]
        result.update(new)
        frontier = new
    return result


def can_view_profile(db: Session, principal: Principal, employee_id) -> bool:
    """画像可见 = 持有 profile.view 且员工落在激活角色数据范围内；本人始终可见。"""
    employee = db.get(Employee, employee_id)
    if employee is None or employee.tenant_id != principal.user.tenant_id:
        return False
    if employee.user_id == principal.user.id:
        return True
    if not principal.can("profile.view"):
        return False
    return can_access_employee(db, principal, employee)


# ---------------------------------------------------------------------------
# 学历/证书补录
# ---------------------------------------------------------------------------

def update_basic(
    db: Session,
    employee: Employee,
    actor: User,
    *,
    education: str,
    certificates: list[str],
) -> Employee:
    before = {
        "education": employee.education,
        "certificates": list(employee.certificates or []),
    }
    employee.education = education
    employee.certificates = list(certificates)
    employee.basic_updated_by = actor.id
    employee.basic_updated_at = _now()

    audit_as(
        db, actor,
        "profile_basic_updated", "employee", employee.id,
        before,
        {"education": education, "certificates": list(certificates)},
    )
    db.flush()
    return employee
