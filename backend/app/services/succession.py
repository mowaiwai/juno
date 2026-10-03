"""核心岗位 / 继任 / 梯队池 服务（spec talent-matching §4）。

风险与覆盖率只基于确定性数据；匹配信息逐维展示，不造总分。
"""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import err
from app.models.employee import Employee
from app.models.profile import DimensionStatus
from app.models.succession import (
    CandidateOrigin,
    CorePosition,
    PoolLevel,
    PoolStatus,
    SuccessionCandidate,
    TalentPool,
    Willingness,
)
from app.models.user import User
from app.services.audit import audit_as
from app.services.profile import latest_profile

_VALID_PERF = {"S", "A", "B"}


def _now():
    return datetime.now().astimezone()


# ---------------------------------------------------------------------------
# 核心岗位 CRUD
# ---------------------------------------------------------------------------

def create_position(
    db: Session,
    actor: User,
    *,
    name: str,
    grade: str,
    sequence: str,
    headcount: int = 1,
    dept_id: str | None = None,
    incumbent_employee_id=None,
) -> CorePosition:
    if not name or not name.strip():
        raise err(422, "invalid_request", "岗位名称不能为空")
    if headcount < 1:
        raise err(422, "invalid_headcount", "编制数必须 ≥ 1")

    position = CorePosition(
        tenant_id=actor.tenant_id,
        name=name.strip(),
        dept_id=dept_id,
        sequence=sequence,
        grade=grade,
        headcount=headcount,
        incumbent_employee_id=incumbent_employee_id,
        created_by=actor.id,
        created_at=_now(),
    )
    db.add(position)
    db.flush()

    audit_as(
        db, actor,
        "core_position_created", "core_position", position.id,
        None,
        {"name": position.name, "grade": grade,
         "headcount": headcount},
    )
    db.flush()
    return position


def update_position(
    db: Session, position: CorePosition, actor: User, **fields
) -> CorePosition:
    if "headcount" in fields and fields["headcount"] is not None:
        if fields["headcount"] < 1:
            raise err(422, "invalid_headcount", "编制数必须 ≥ 1")
    before = {}
    for key, value in fields.items():
        if value is None:
            continue
        if hasattr(position, key):
            before[key] = getattr(position, key)
            setattr(position, key, value)

    if before:
        audit_as(
            db, actor,
            "core_position_updated", "core_position", position.id,
            before,
            {k: getattr(position, k) for k in before},
        )
    db.flush()
    return position


def delete_position(db: Session, position: CorePosition, actor: User) -> None:
    # 级联删除候选（无 ORM relationship，手动清理）
    db.query(SuccessionCandidate).filter(
        SuccessionCandidate.core_position_id == position.id
    ).delete(synchronize_session=False)
    db.delete(position)
    audit_as(
        db, actor,
        "core_position_deleted", "core_position", position.id,
        {"name": position.name}, None,
    )
    db.flush()


def list_positions(db: Session, tenant_id) -> list[CorePosition]:
    return db.scalars(
        select(CorePosition)
        .where(CorePosition.tenant_id == tenant_id)
        .order_by(CorePosition.created_at.desc())
    ).all()


def get_position(db: Session, position_id, tenant_id) -> CorePosition:
    position = db.get(CorePosition, position_id)
    if position is None or position.tenant_id != tenant_id:
        raise err(404, "core_position_not_found", "核心岗位不存在")
    return position


# ---------------------------------------------------------------------------
# 风险等级 / 覆盖率 / 匹配信息
# ---------------------------------------------------------------------------

def _duty_score(db: Session, employee_id) -> int | None:
    profile = latest_profile(db, employee_id)
    if profile is None:
        return None
    dim = next(
        (d for d in profile.dimensions if d.dimension_key == "duty"), None
    )
    if dim is None or dim.status != DimensionStatus.MEASURED:
        return None
    return dim.score


def candidate_payload(db: Session, candidate: SuccessionCandidate) -> dict:
    employee = db.get(Employee, candidate.employee_id)
    return {
        "id": candidate.id,
        "core_position_id": candidate.core_position_id,
        "employee_id": candidate.employee_id,
        "origin": candidate.origin.value,
        "willingness": candidate.willingness.value,
        "perf_label": employee.perf_grade if employee else None,
        "duty_score": _duty_score(db, candidate.employee_id),
    }


def position_view(db: Session, position: CorePosition) -> dict:
    candidates = list_candidates(db, position)
    candidate_count = len(candidates)
    coverage = min(100, round(candidate_count / position.headcount * 100))

    if position.incumbent_employee_id is None:
        risk = "HIGH"
        reason = "岗位空缺，需立即补位"
    elif candidate_count == 0:
        risk = "HIGH"
        reason = "无继任候选人，存在断档风险"
    elif coverage < 100:
        risk = "MID"
        reason = "继任候选不足"
    else:
        risk = "LOW"
        reason = "继任候选充足"

    return {
        "id": position.id,
        "name": position.name,
        "dept_id": position.dept_id,
        "sequence": position.sequence,
        "grade": position.grade,
        "headcount": position.headcount,
        "incumbent_employee_id": position.incumbent_employee_id,
        "created_by": position.created_by,
        "created_at": position.created_at,
        "risk": risk,
        "risk_reason": reason,
        "coverage": coverage,
        "candidate_count": candidate_count,
        "candidates": [candidate_payload(db, c) for c in candidates],
    }


# ---------------------------------------------------------------------------
# 继任候选
# ---------------------------------------------------------------------------

def list_candidates(
    db: Session, position: CorePosition
) -> list[SuccessionCandidate]:
    return db.scalars(
        select(SuccessionCandidate).where(
            SuccessionCandidate.core_position_id == position.id
        )
    ).all()


def _get_candidate(
    db: Session, position: CorePosition, employee_id
) -> SuccessionCandidate | None:
    return db.scalar(
        select(SuccessionCandidate).where(
            SuccessionCandidate.core_position_id == position.id,
            SuccessionCandidate.employee_id == employee_id,
        )
    )


def auto_screen(db: Session, position: CorePosition, actor: User) -> None:
    """刷新自动初筛：同序列 + 绩效 S/A/B + 排除在岗人。

    移除既有 AUTO 候选后重新生成；保留 MANUAL 提名。
    """
    existing = list_candidates(db, position)
    manual_ids = {
        c.employee_id for c in existing if c.origin == CandidateOrigin.MANUAL
    }
    for c in existing:
        if c.origin == CandidateOrigin.AUTO:
            db.delete(c)
    db.flush()

    eligible = db.scalars(
        select(Employee).where(
            Employee.tenant_id == position.tenant_id,
            Employee.sequence == position.sequence,
            Employee.perf_grade.in_(_VALID_PERF),
            Employee.is_active.is_(True),
        )
    ).all()

    for emp in eligible:
        if emp.id == position.incumbent_employee_id:
            continue
        if emp.id in manual_ids:
            continue
        if _get_candidate(db, position, emp.id) is not None:
            continue
        db.add(
            SuccessionCandidate(
                core_position_id=position.id,
                employee_id=emp.id,
                origin=CandidateOrigin.AUTO,
            )
        )
    db.flush()


def nominee(
    db: Session, position: CorePosition, employee: Employee, actor: User
) -> SuccessionCandidate:
    if employee.id == position.incumbent_employee_id:
        raise err(
            422, "nominate_incumbent", "在岗人不可作为继任候选人"
        )
    if _get_candidate(db, position, employee.id) is not None:
        raise err(
            409, "candidate_exists", "该员工已是继任候选人"
        )
    candidate = SuccessionCandidate(
        core_position_id=position.id,
        employee_id=employee.id,
        origin=CandidateOrigin.MANUAL,
    )
    db.add(candidate)
    db.flush()
    audit_as(
        db, actor,
        "succession_nominated", "succession_candidate", candidate.id,
        None,
        {"employee_id": str(employee.id),
         "position_id": str(position.id)},
    )
    db.flush()
    return candidate


def remove_candidate(
    db: Session, position: CorePosition, employee: Employee, actor: User
) -> None:
    candidate = _get_candidate(db, position, employee.id)
    if candidate is None:
        raise err(404, "candidate_not_found", "该员工非继任候选人")
    db.delete(candidate)
    audit_as(
        db, actor,
        "succession_removed", "succession_candidate", candidate.id,
        {"employee_id": str(employee.id)}, None,
    )
    db.flush()


def set_willingness(
    db: Session,
    position: CorePosition,
    employee: Employee,
    actor: User,
    willingness: Willingness,
) -> SuccessionCandidate:
    if not isinstance(willingness, Willingness):
        raise err(422, "invalid_willingness", "意愿取值不合法")
    candidate = _get_candidate(db, position, employee.id)
    if candidate is None:
        raise err(404, "candidate_not_found", "该员工非继任候选人")
    before = candidate.willingness.value
    candidate.willingness = willingness
    candidate.willingness_confirmed_by = actor.id
    candidate.willingness_at = _now()
    audit_as(
        db, actor,
        "willingness_confirmed", "succession_candidate", candidate.id,
        {"willingness": before},
        {"willingness": willingness.value},
    )
    db.flush()
    return candidate


# ---------------------------------------------------------------------------
# 梯队池
# ---------------------------------------------------------------------------

def list_pools(db: Session, tenant_id) -> list[TalentPool]:
    return db.scalars(
        select(TalentPool)
        .where(TalentPool.tenant_id == tenant_id)
        .order_by(TalentPool.joined_at.desc())
    ).all()


# 端点使用单数命名
list_pool = list_pools


def join_pool(
    db: Session,
    actor: User,
    employee: Employee,
    *,
    level: PoolLevel,
    reason: str,
) -> TalentPool:
    existing = db.scalar(
        select(TalentPool).where(
            TalentPool.tenant_id == actor.tenant_id,
            TalentPool.employee_id == employee.id,
            TalentPool.pool_level == level,
        )
    )
    if existing is not None:
        raise err(409, "pool_member_exists", "该员工已在此梯队中")
    member = TalentPool(
        tenant_id=actor.tenant_id,
        employee_id=employee.id,
        pool_level=level,
        reason=reason,
        joined_by=actor.id,
        joined_at=_now(),
    )
    db.add(member)
    db.flush()
    audit_as(
        db, actor,
        "pool_joined", "talent_pool", member.id,
        None,
        {"employee_id": str(employee.id), "pool_level": level.value},
    )
    db.flush()
    return member


def update_pool(
    db: Session, member: TalentPool, actor: User, **fields
) -> TalentPool:
    # 端点传 level=，映射到 pool_level
    if "level" in fields and fields["level"] is not None:
        fields["pool_level"] = fields.pop("level")
    before = {}
    for key, value in fields.items():
        if value is None:
            continue
        if hasattr(member, key):
            before[key] = getattr(member, key)
            setattr(member, key, value)
    if before:
        audit_as(
            db, actor,
            "pool_updated", "talent_pool", member.id,
            {k: (v.value if hasattr(v, "value") else v)
             for k, v in before.items()},
            {k: (getattr(member, k).value
                 if hasattr(getattr(member, k), "value")
                 else getattr(member, k))
             for k in before},
        )
    db.flush()
    return member


def leave_pool(db: Session, member: TalentPool, actor: User) -> TalentPool:
    before = member.status.value
    member.status = PoolStatus.EXITED
    audit_as(
        db, actor,
        "pool_left", "talent_pool", member.id,
        {"status": before}, {"status": PoolStatus.EXITED.value},
    )
    db.flush()
    return member
