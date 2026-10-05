"""绩效评价模块端点（P1 绩效内生，ADR-0015/0016）。"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import Principal, err, require_perm
from app.database import get_db
from app.models.employee import Employee
from app.schemas.perf import ConstantsUpdate
from app.services.perf_rules import resolve_constants, update_constants

router = APIRouter(tags=["perf"])


@router.get("/perf/constants")
def get_perf_constants(
    db: Session = Depends(get_db),
    principal: Principal = Depends(
        require_perm(
            "perf.plan.manage", "perf.result.entry", "perf.pip.manage"
        )
    ),
):
    """当前租户生效的 SABC 常量（平台默认 ← 租户覆盖）。"""
    return resolve_constants(db, principal.user.tenant_id)


@router.put("/perf/constants")
def put_perf_constants(
    body: ConstantsUpdate,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_perm("perf.plan.manage")),
):
    """维护 SABC 常量租户覆盖（COE·绩效 / 租户管理员），变更留痕。"""
    patch = body.patch_dict()
    if not patch:
        raise err(422, "invalid_request", "未提供任何配置项")
    actor_id = db.scalar(
        select(Employee.id).where(Employee.user_id == principal.user.id)
    )
    try:
        constants = update_constants(
            db, principal.user.tenant_id, actor_id, patch
        )
    except ValueError as exc:
        raise err(422, "invalid_config", str(exc))
    db.commit()
    return constants
