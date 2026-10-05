"""人才盘点端点（spec talent-matching §5.2）。

ADR-0014 权限：
- inventory.manage（COE·组织与人才发展）：批次创建/启动/校准提交/发布全流程；
- inventory.calibrate（干部/绩效 COE、HRBP、部门领导、高管）：按激活角色数据范围查看与校准；
- 批次确认/驳回仍为租户管理员动作。
"""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import (
    Principal,
    err,
    get_principal,
    require_active_roles,
    require_perm_user,
)
from app.core.permissions import ScopeType
from app.database import get_db
from app.models.employee import Employee
from app.models.inventory import (
    InventoryBatch,
    Potential,
)
from app.models.user import User
from app.schemas.inventory import (
    BatchIn,
    BatchOut,
    DistributionOut,
    ResultIn,
    ResultOut,
    TrackPointOut,
)
from app.services.inventory import (
    confirm_batch,
    create_batch,
    distribution,
    grid_track,
    list_batches,
    list_results,
    reject_batch,
    save_calibration,
    start_batch,
    submit_calibration,
)
from app.services.scope import apply_employee_scope, can_access_employee

router = APIRouter(tags=["inventory"])

_manage = require_perm_user("inventory.manage")


def _admin_user(
    principal: Principal = Depends(require_active_roles()),
) -> User:
    # require_active_roles() 无角色参数时仅通配管理员可通过
    return principal.user


def _get_owned_batch(db: Session, batch_id, user: User) -> InventoryBatch:
    batch = db.get(InventoryBatch, batch_id)
    if batch is None:
        raise err(404, "inventory_not_found", "盘点批次不存在")
    if batch.tenant_id != user.tenant_id:
        raise err(403, "forbidden", "无权访问该盘点批次")
    return batch


def _visible(db: Session, principal: Principal, batch: InventoryBatch) -> bool:
    """非 GLOBAL 角色：批次范围内至少一名员工落在本人数据范围才可见。"""
    if principal.scope_type == ScopeType.GLOBAL:
        return True
    if batch.scope_employee_ids:
        emp_ids = [
            i if isinstance(i, uuid.UUID) else uuid.UUID(str(i))
            for i in batch.scope_employee_ids
        ]
        emps = db.scalars(
            select(Employee).where(Employee.id.in_(emp_ids))
        ).all()
        return any(can_access_employee(db, principal, e) for e in emps)
    # 全租户范围批次：本人范围内只要有在职员工即可见
    stmt = apply_employee_scope(select(Employee.id), db, principal)
    return db.scalar(stmt.limit(1)) is not None


def _require_read(
    db: Session, principal: Principal, batch_id
) -> InventoryBatch:
    batch = _get_owned_batch(db, batch_id, principal.user)
    if not principal.can("inventory.manage", "inventory.calibrate"):
        raise err(403, "forbidden", "无权查看该盘点批次")
    if not _visible(db, principal, batch):
        raise err(403, "forbidden", "无权查看该盘点批次")
    return batch


def _scope_employee_filter(db: Session, principal: Principal) -> set | None:
    """结果列表的员工范围过滤；None 表示不限。"""
    if principal.scope_type == ScopeType.GLOBAL:
        return None
    stmt = apply_employee_scope(select(Employee.id), db, principal)
    return set(db.scalars(stmt).all())


@router.post("/inventory-batches", response_model=BatchOut, status_code=201)
def create_batch_endpoint(
    body: BatchIn,
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    batch = create_batch(
        db, user.tenant_id, user,
        name=body.name, purpose=body.purpose,
        scope_employee_ids=body.scope_employee_ids,
    )
    db.commit()
    db.refresh(batch)
    return batch


@router.get("/inventory-batches", response_model=list[BatchOut])
def list_batches_endpoint(
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    if not principal.can("inventory.manage", "inventory.calibrate"):
        raise err(403, "forbidden", "无权查看盘点批次")
    batches = list_batches(db, principal.user.tenant_id)
    if principal.scope_type != ScopeType.GLOBAL:
        batches = [b for b in batches if _visible(db, principal, b)]
    return batches


@router.get("/inventory-batches/{batch_id}", response_model=BatchOut)
def detail_batch_endpoint(
    batch_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    return _require_read(db, principal, batch_id)


@router.post("/inventory-batches/{batch_id}/start", response_model=BatchOut)
def start_endpoint(
    batch_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    batch = _get_owned_batch(db, batch_id, user)
    start_batch(db, batch.id, user)
    db.commit()
    db.refresh(batch)
    return batch


@router.get(
    "/inventory-batches/{batch_id}/results",
    response_model=list[ResultOut],
)
def results_endpoint(
    batch_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    batch = _require_read(db, principal, batch_id)
    return list_results(
        db, batch.id, employee_filter=_scope_employee_filter(db, principal)
    )


@router.put(
    "/inventory-batches/{batch_id}/results/{employee_id}",
    response_model=ResultOut,
)
def calibration_endpoint(
    batch_id: uuid.UUID,
    employee_id: uuid.UUID,
    body: ResultIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    if not principal.can("inventory.manage", "inventory.calibrate"):
        raise err(403, "forbidden", "当前角色无权校准盘点结果")
    batch = _require_read(db, principal, batch_id)
    emp = db.get(Employee, employee_id)
    if (
        emp is None
        or emp.tenant_id != principal.user.tenant_id
        or not can_access_employee(db, principal, emp)
    ):
        raise err(404, "employee_not_found", "员工不存在")
    potential = Potential(body.potential) if body.potential else None
    result = save_calibration(
        db, batch.id, employee_id, principal.user,
        potential=potential,
        grid_code=body.grid_code,
        note=body.note,
    )
    db.commit()
    db.refresh(result)
    return result


@router.post(
    "/inventory-batches/{batch_id}/submit-calibration",
    response_model=BatchOut,
)
def submit_endpoint(
    batch_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    _get_owned_batch(db, batch_id, user)
    batch = submit_calibration(db, batch_id, user)
    db.commit()
    db.refresh(batch)
    return batch


@router.post("/inventory-batches/{batch_id}/confirm", response_model=BatchOut)
def confirm_endpoint(
    batch_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(_admin_user),
):
    _get_owned_batch(db, batch_id, user)
    batch = confirm_batch(db, batch_id, user)
    db.commit()
    db.refresh(batch)
    return batch


@router.post("/inventory-batches/{batch_id}/reject", response_model=BatchOut)
def reject_endpoint(
    batch_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(_admin_user),
):
    _get_owned_batch(db, batch_id, user)
    batch = reject_batch(db, batch_id, user)
    db.commit()
    db.refresh(batch)
    return batch


@router.get(
    "/inventory-batches/{batch_id}/distribution",
    response_model=DistributionOut,
)
def distribution_endpoint(
    batch_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    batch = _require_read(db, principal, batch_id)
    return distribution(db, batch.id)


@router.get(
    "/inventory-tracks/{employee_id}",
    response_model=list[TrackPointOut],
)
def track_endpoint(
    employee_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    """员工跨批次九宫格轨迹（仅已发布批次），按激活角色数据范围收窄。"""
    if not principal.can("inventory.manage", "inventory.calibrate"):
        raise err(403, "forbidden", "无权查看该员工的盘点轨迹")
    emp = db.get(Employee, employee_id)
    if emp is None or emp.tenant_id != principal.user.tenant_id:
        raise err(404, "employee_not_found", "员工不存在")
    if not can_access_employee(db, principal, emp):
        raise err(404, "employee_not_found", "员工不存在")
    return grid_track(db, employee_id)
