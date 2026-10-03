"""人才盘点端点（spec talent-matching §5.2）。"""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import err, get_current_user, require_roles
from app.database import get_db
from app.models.employee import Employee
from app.models.inventory import (
    InventoryBatch,
    Potential,
)
from app.models.user import Role, User
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
    visible_to_manager,
)
from app.services.profile import subordinate_ids

router = APIRouter(tags=["inventory"])

_hr = require_roles(Role.HR)
_executive = require_roles(Role.TENANT_ADMIN)


def _get_owned_batch(db: Session, batch_id, user: User) -> InventoryBatch:
    batch = db.get(InventoryBatch, batch_id)
    if batch is None:
        raise err(404, "inventory_not_found", "盘点批次不存在")
    if batch.tenant_id != user.tenant_id:
        raise err(403, "forbidden", "无权访问该盘点批次")
    return batch


def _require_read(db: Session, user: User, batch_id) -> InventoryBatch:
    batch = _get_owned_batch(db, batch_id, user)
    if user.has_any(Role.HR, Role.TENANT_ADMIN):
        return batch
    if user.has_any(Role.MANAGER) and visible_to_manager(db, user, batch):
        return batch
    raise err(403, "forbidden", "无权查看该盘点批次")


def _manager_filter(db: Session, user: User) -> set | None:
    """经理读结果时限制在汇报链内。"""
    if user.has_any(Role.HR, Role.TENANT_ADMIN):
        return None
    own = db.scalar(select(Employee).where(Employee.user_id == user.id))
    if own is None:
        return set()
    return subordinate_ids(db, own.id)


@router.post("/inventory-batches", response_model=BatchOut, status_code=201)
def create_batch_endpoint(
    body: BatchIn,
    db: Session = Depends(get_db),
    user: User = Depends(_hr),
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
    user: User = Depends(get_current_user),
):
    if user.has_any(Role.HR, Role.TENANT_ADMIN):
        batches = list_batches(db, user.tenant_id)
    elif user.has_any(Role.MANAGER):
        batches = [
            b for b in list_batches(db, user.tenant_id)
            if visible_to_manager(db, user, b)
        ]
    else:
        raise err(403, "forbidden", "无权查看盘点批次")
    return batches


@router.get("/inventory-batches/{batch_id}", response_model=BatchOut)
def detail_batch_endpoint(
    batch_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return _require_read(db, user, batch_id)


@router.post("/inventory-batches/{batch_id}/start", response_model=BatchOut)
def start_endpoint(
    batch_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(_hr),
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
    user: User = Depends(get_current_user),
):
    batch = _require_read(db, user, batch_id)
    return list_results(
        db, batch.id, employee_filter=_manager_filter(db, user)
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
    user: User = Depends(_hr),
):
    _get_owned_batch(db, batch_id, user)
    potential = Potential(body.potential) if body.potential else None
    result = save_calibration(
        db, batch_id, employee_id, user,
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
    user: User = Depends(_hr),
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
    user: User = Depends(_executive),
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
    user: User = Depends(_executive),
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
    user: User = Depends(get_current_user),
):
    batch = _require_read(db, user, batch_id)
    return distribution(db, batch.id)


@router.get(
    "/inventory-tracks/{employee_id}",
    response_model=list[TrackPointOut],
)
def track_endpoint(
    employee_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """员工跨批次九宫格轨迹（仅已发布批次）。

    数据范围：HR/高管/租户管理员全员；经理限汇报链内（含本人）。
    """
    emp = db.get(Employee, employee_id)
    if emp is None or emp.tenant_id != user.tenant_id:
        raise err(404, "employee_not_found", "员工不存在")
    if not user.has_any(Role.HR, Role.TENANT_ADMIN, Role.EXECUTIVE):
        if not user.has_any(Role.MANAGER):
            raise err(403, "forbidden", "无权查看该员工的盘点轨迹")
        own = db.scalar(select(Employee).where(Employee.user_id == user.id))
        allowed = ({own.id} | subordinate_ids(db, own.id)) if own else set()
        if employee_id not in allowed:
            raise err(403, "forbidden", "无权查看该员工的盘点轨迹")
    return grid_track(db, employee_id)
