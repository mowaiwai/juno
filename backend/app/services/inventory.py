"""人才盘点服务（spec talent-matching §3）。

潜力由校准人逐人显式评定；系统只做确定性初排与落格。
"""

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import err
from app.models.employee import Employee
from app.models.inventory import (
    BatchStatus,
    InventoryBatch,
    InventoryPurpose,
    InventoryResult,
    Potential,
)
from app.models.profile import DimensionStatus
from app.models.user import Role, User
from app.services.audit import audit_as
from app.services.profile import (
    latest_profile,
    subordinate_ids,
    writeback_on_inventory_publish,
)

# 九宫格合法格码
GRID_CODES = {
    "9A1": ("明星", "重点培养：纳入梯队、给核心项目、加速晋升通道"),
    "9A2": ("核心骨干", "保留激励：调薪倾斜、关键岗位匹配、避免倦怠"),
    "9A3": ("业绩之星", "留用激励：保持业绩、补能力短板、转专家路线"),
    "9B1": ("潜力股", "培养辅导：补业绩、给挑战任务、配导师"),
    "9B2": ("中坚力量", "稳定发展：维持节奏、横向拓展、阶梯晋升"),
    "9B3": ("待改进", "绩效改进：设 PIP、3 个月复盘、不行转岗/降级"),
    "9C1": ("问题员工", "意愿干预：面谈找原因、调岗激发、保留观察"),
    "9C2": ("待发展", "补知识：IDP 聚焦能力短板、培训+实践"),
    "9C3": ("淘汰区", "退出：转岗/降薪/协商解除，严控占比"),
}


def _now():
    return datetime.now().astimezone()


# ---------------------------------------------------------------------------
# 落格
# ---------------------------------------------------------------------------

def _perf_column(perf_label: str | None) -> str | None:
    if not perf_label:
        return None
    if perf_label in ("S", "A"):
        return "A"
    if perf_label == "B":
        return "B"
    return "C"


def _potential_row(potential: Potential | None) -> str | None:
    if potential is None:
        return None
    return {"high": "1", "mid": "2", "low": "3"}[potential.value]


def locate_grid(perf_label, potential) -> str | None:
    col = _perf_column(perf_label)
    row = _potential_row(potential)
    if col is None or row is None:
        return None
    return f"9{col}{row}"


# ---------------------------------------------------------------------------
# 批次创建与初排
# ---------------------------------------------------------------------------

def create_batch(
    db: Session,
    tenant_id,
    actor: User,
    *,
    name: str,
    purpose: str,
    scope_employee_ids: list | None = None,
) -> InventoryBatch:
    if not name or not name.strip():
        raise err(422, "invalid_request", "盘点名称不能为空")
    if purpose not in {p.value for p in InventoryPurpose}:
        raise err(422, "invalid_request", "盘点目的取值不合法")

    batch = InventoryBatch(
        tenant_id=tenant_id,
        name=name.strip(),
        purpose=InventoryPurpose(purpose),
        status=BatchStatus.DRAFT,
        owner_id=actor.id,
        scope_employee_ids=(
            [str(i) for i in scope_employee_ids]
            if scope_employee_ids else None
        ),
        created_at=_now(),
    )
    db.add(batch)
    db.flush()

    audit_as(
        db, actor,
        "inventory_created", "inventory_batch", batch.id,
        None,
        {"name": batch.name, "purpose": purpose},
    )
    db.flush()
    return batch


def _scope_employees(db: Session, batch: InventoryBatch) -> list[Employee]:
    if batch.scope_employee_ids:
        ids = [
            i if isinstance(i, uuid.UUID) else uuid.UUID(str(i))
            for i in batch.scope_employee_ids
        ]
        return [
            e for e in (db.get(Employee, i) for i in ids)
            if e is not None and e.tenant_id == batch.tenant_id
        ]
    return db.scalars(
        select(Employee).where(
            Employee.tenant_id == batch.tenant_id,
            Employee.is_active.is_(True),
        )
    ).all()


def _duty_score(db: Session, employee: Employee):
    profile = latest_profile(db, employee.id)
    if profile is None:
        return None
    dim = next(
        (d for d in profile.dimensions if d.dimension_key == "duty"), None
    )
    if dim is None or dim.status != DimensionStatus.MEASURED:
        return None
    return dim.score


def start_batch(db: Session, batch_id, actor: User) -> InventoryBatch:
    batch = db.get(InventoryBatch, batch_id)
    if batch is None or batch.tenant_id != actor.tenant_id:
        raise err(404, "inventory_not_found", "盘点批次不存在")
    if batch.status != BatchStatus.DRAFT:
        raise err(
            409, "invalid_inventory_transition",
            f"当前状态 {batch.status.value} 不可启动初排",
        )

    for employee in _scope_employees(db, batch):
        db.add(
            InventoryResult(
                batch_id=batch.id,
                employee_id=employee.id,
                perf_label=employee.perf_grade,
                ability_score=_duty_score(db, employee),
                potential=None,
                located=False,
            )
        )

    batch.status = BatchStatus.CALIBRATING
    db.flush()
    return batch


# ---------------------------------------------------------------------------
# 校准
# ---------------------------------------------------------------------------

def _get_result(db: Session, batch_id, employee_id) -> InventoryResult:
    result = db.scalar(
        select(InventoryResult).where(
            InventoryResult.batch_id == batch_id,
            InventoryResult.employee_id == employee_id,
        )
    )
    if result is None:
        raise err(404, "result_not_found", "该员工不在本批次范围内")
    return result


def save_calibration(
    db: Session,
    batch_id,
    employee_id,
    actor: User,
    *,
    potential: Potential | None = None,
    grid_code: str | None = None,
    note: str | None = None,
) -> InventoryResult:
    batch = db.get(InventoryBatch, batch_id)
    if batch is None or batch.tenant_id != actor.tenant_id:
        raise err(404, "inventory_not_found", "盘点批次不存在")
    if batch.status != BatchStatus.CALIBRATING:
        raise err(
            409, "invalid_inventory_transition",
            f"当前状态 {batch.status.value} 不可校准",
        )

    result = _get_result(db, batch_id, employee_id)

    if potential is not None:
        if not isinstance(potential, Potential):
            raise err(422, "invalid_potential", "潜力取值必须为 high/mid/low")
        if result.potential != potential:
            result.potential = potential
            result.potential_by = actor.id
            result.potential_at = _now()
            audit_as(
                db, actor,
                "potential_rated", "inventory_result", result.id,
                {"potential": result.potential.value if result.potential else None},
                {"potential": potential.value},
            )

    suggested = locate_grid(result.perf_label, result.potential)

    if grid_code is not None and grid_code != suggested:
        if grid_code not in GRID_CODES:
            raise err(422, "invalid_grid_code", "九宫格码不合法")
        if not note or not note.strip():
            raise err(
                422, "calibration_note_required",
                "人工调整格位必须填写校准理由",
            )
        before_code = result.grid_code
        result.grid_code = grid_code
        result.located = True
        result.calibrate_note = note.strip()
        audit_as(
            db, actor,
            "calibrated", "inventory_result", result.id,
            {"grid_code": before_code},
            {"grid_code": grid_code, "note": note.strip()},
        )
    else:
        result.grid_code = suggested
        result.located = suggested is not None
        if note is not None:
            result.calibrate_note = note.strip() or None

    db.flush()
    return result


def submit_calibration(db: Session, batch_id, actor: User) -> InventoryBatch:
    batch = db.get(InventoryBatch, batch_id)
    if batch is None or batch.tenant_id != actor.tenant_id:
        raise err(404, "inventory_not_found", "盘点批次不存在")
    if batch.status != BatchStatus.CALIBRATING:
        raise err(
            409, "invalid_inventory_transition",
            f"当前状态 {batch.status.value} 不可提交校准",
        )
    batch.status = BatchStatus.CONFIRMING
    db.flush()
    return batch


def confirm_batch(db: Session, batch_id, actor: User) -> InventoryBatch:
    batch = db.get(InventoryBatch, batch_id)
    if batch is None or batch.tenant_id != actor.tenant_id:
        raise err(404, "inventory_not_found", "盘点批次不存在")
    if batch.status != BatchStatus.CONFIRMING:
        raise err(
            409, "invalid_inventory_transition",
            f"当前状态 {batch.status.value} 不可确认发布",
        )

    batch.status = BatchStatus.PUBLISHED
    batch.published_at = _now()

    audit_as(
        db, actor,
        "executive_confirmed", "inventory_batch", batch.id,
        {"status": "confirming"}, {"status": "published"},
    )
    audit_as(
        db, actor,
        "inventory_published", "inventory_batch", batch.id,
        None, {"published_at": batch.published_at.isoformat()},
    )
    # 数据飞轮：盘点发布回写画像（已定位员工各生成 inventory_writeback 新版）
    writebacked = writeback_on_inventory_publish(db, batch)
    audit_as(
        db, actor,
        "profile_writeback", "inventory_batch", batch.id,
        None, {"source": "inventory_writeback", "count": writebacked},
    )
    db.flush()
    return batch


def reject_batch(db: Session, batch_id, actor: User) -> InventoryBatch:
    batch = db.get(InventoryBatch, batch_id)
    if batch is None or batch.tenant_id != actor.tenant_id:
        raise err(404, "inventory_not_found", "盘点批次不存在")
    if batch.status != BatchStatus.CONFIRMING:
        raise err(
            409, "invalid_inventory_transition",
            f"当前状态 {batch.status.value} 不可退回",
        )
    batch.status = BatchStatus.CALIBRATING
    db.flush()
    return batch


# ---------------------------------------------------------------------------
# 读取与分布
# ---------------------------------------------------------------------------

def list_batches(db: Session, tenant_id) -> list[InventoryBatch]:
    return db.scalars(
        select(InventoryBatch)
        .where(InventoryBatch.tenant_id == tenant_id)
        .order_by(InventoryBatch.created_at.desc())
    ).all()


def list_results(
    db: Session, batch_id, *, employee_filter: set | None = None
) -> list[InventoryResult]:
    stmt = select(InventoryResult).where(InventoryResult.batch_id == batch_id)
    if employee_filter is not None:
        stmt = stmt.where(InventoryResult.employee_id.in_(employee_filter or {-1}))
    return db.scalars(stmt).all()


def distribution(db: Session, batch_id) -> dict:
    results = db.scalars(
        select(InventoryResult).where(InventoryResult.batch_id == batch_id)
    ).all()
    grids: dict[str, int] = {code: 0 for code in GRID_CODES}
    unlocated = 0
    for r in results:
        if r.located and r.grid_code in grids:
            grids[r.grid_code] += 1
        else:
            unlocated += 1
    total = len(results)
    percentages = {
        code: round(count * 100 / total) if total else 0
        for code, count in grids.items()
    }
    return {
        "total": total,
        "unlocated": unlocated,
        "grids": grids,
        "percentages": percentages,
    }


def grid_track(db: Session, employee_id) -> list[dict]:
    """员工跨批次九宫格轨迹（仅已发布批次，按发布时间升序）。"""
    rows = db.execute(
        select(InventoryResult, InventoryBatch)
        .join(InventoryBatch, InventoryResult.batch_id == InventoryBatch.id)
        .where(
            InventoryResult.employee_id == employee_id,
            InventoryBatch.status == BatchStatus.PUBLISHED,
        )
        .order_by(InventoryBatch.published_at, InventoryBatch.created_at)
    ).all()
    return [
        {
            "batch_id": batch.id,
            "batch_name": batch.name,
            "published_at": batch.published_at,
            "grid_code": result.grid_code if result.located else None,
            "potential": result.potential.value if result.potential else None,
            "perf_label": result.perf_label,
        }
        for result, batch in rows
    ]


def visible_to_manager(db: Session, user: User, batch: InventoryBatch) -> bool:
    """经理：批次范围与汇报链有交集即可读。"""
    own = db.scalar(select(Employee).where(Employee.user_id == user.id))
    if own is None:
        return False
    sub_ids = subordinate_ids(db, own.id)
    if batch.scope_employee_ids:
        scope = {
            i if isinstance(i, uuid.UUID) else uuid.UUID(str(i))
            for i in batch.scope_employee_ids
        }
        return bool(scope & sub_ids)
    return bool(sub_ids)
