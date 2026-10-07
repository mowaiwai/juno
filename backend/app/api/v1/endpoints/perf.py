"""绩效评价模块端点（P1 绩效内生 + P? 绩效标准库）。"""
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import Principal, err, require_perm, require_perm_user
from app.database import get_db
from app.models.employee import Employee
from app.models.perf import PerfIndicator
from app.models.user import User
from app.schemas.perf import (
    CalibrationRulesUpdate,
    ConstantsUpdate,
    IndicatorCreate,
    IndicatorOut,
    IndicatorUpdate,
    PerfStandardsOut,
)
from app.services.perf_rules import (
    resolve_calibration_rules,
    resolve_constants,
    resolve_grade_definitions,
    update_calibration_rules,
    update_constants,
)

router = APIRouter(prefix="/perf", tags=["perf"])

_manage = require_perm_user("perf.standard.manage")
_view = require_perm(
    "perf.standard.manage", "perf.plan.manage", "perf.result.entry", "perf.pip.manage"
)


def _actor_id(db: Session, user: User) -> uuid.UUID | None:
    return db.scalar(select(Employee.id).where(Employee.user_id == user.id))


# ---------- SABC 常量 ----------

@router.get("/constants")
def get_perf_constants(
    db: Session = Depends(get_db),
    principal: Principal = Depends(_view),
):
    """当前租户生效的 SABC 常量（平台默认 ← 租户覆盖）。"""
    return resolve_constants(db, principal.user.tenant_id)


@router.put("/constants")
def put_perf_constants(
    body: ConstantsUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_perm_user("perf.plan.manage")),
):
    """维护 SABC 常量租户覆盖（COE·绩效 / 租户管理员），变更留痕。"""
    patch = body.patch_dict()
    if not patch:
        raise err(422, "invalid_request", "未提供任何配置项")
    actor_id = _actor_id(db, user)
    try:
        constants = update_constants(db, user.tenant_id, actor_id, patch)
    except ValueError as exc:
        raise err(422, "invalid_config", str(exc))
    db.commit()
    return constants


# ---------- 绩效标准库聚合视图 ----------

@router.get("/standards", response_model=PerfStandardsOut)
def get_perf_standards(
    db: Session = Depends(get_db),
    principal: Principal = Depends(_view),
):
    """绩效标准库聚合：考核指标 + 等级定义 + 校准规则。"""
    tenant_id = principal.user.tenant_id
    indicators = db.scalars(
        select(PerfIndicator)
        .where(PerfIndicator.tenant_id == tenant_id)
        .order_by(PerfIndicator.sort_order, PerfIndicator.created_at)
    ).all()
    return PerfStandardsOut(
        indicators=[IndicatorOut.model_validate(i) for i in indicators],
        grades=resolve_grade_definitions(db, tenant_id),
        calibration_rules=resolve_calibration_rules(db, tenant_id),
    )


# ---------- 考核指标 CRUD ----------

@router.get("/standards/indicators", response_model=list[IndicatorOut])
def list_indicators(
    type: str | None = None,
    db: Session = Depends(get_db),
    principal: Principal = Depends(_view),
):
    q = select(PerfIndicator).where(
        PerfIndicator.tenant_id == principal.user.tenant_id
    )
    if type:
        q = q.where(PerfIndicator.type == type)
    rows = db.scalars(q.order_by(PerfIndicator.sort_order, PerfIndicator.created_at)).all()
    return [IndicatorOut.model_validate(r) for r in rows]


@router.post("/standards/indicators", response_model=IndicatorOut, status_code=201)
def create_indicator(
    body: IndicatorCreate,
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    ind = PerfIndicator(
        tenant_id=user.tenant_id,
        name=body.name,
        type=body.type,
        sequence_codes=body.sequence_codes,
        weight_min=body.weight_min,
        weight_max=body.weight_max,
        data_source=body.data_source,
        sort_order=body.sort_order,
        created_by=user.id,
    )
    db.add(ind)
    db.commit()
    db.refresh(ind)
    return IndicatorOut.model_validate(ind)


def _get_owned_indicator(db: Session, ind_id, tenant_id) -> PerfIndicator:
    row = db.scalar(
        select(PerfIndicator).where(
            PerfIndicator.id == ind_id, PerfIndicator.tenant_id == tenant_id
        )
    )
    if row is None:
        raise err(404, "not_found", "考核指标不存在")
    return row


@router.put("/standards/indicators/{ind_id}", response_model=IndicatorOut)
def update_indicator(
    ind_id: uuid.UUID,
    body: IndicatorUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    ind = _get_owned_indicator(db, ind_id, user.tenant_id)
    patch = body.model_dump(exclude_unset=True)
    for key, value in patch.items():
        setattr(ind, key, value)
    db.commit()
    db.refresh(ind)
    return IndicatorOut.model_validate(ind)


@router.delete("/standards/indicators/{ind_id}", status_code=204)
def delete_indicator(
    ind_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    ind = _get_owned_indicator(db, ind_id, user.tenant_id)
    db.delete(ind)
    db.commit()
    return None


# ---------- 校准规则 ----------

@router.get("/standards/calibration-rules")
def get_calibration_rules(
    db: Session = Depends(get_db),
    principal: Principal = Depends(_view),
):
    return resolve_calibration_rules(db, principal.user.tenant_id)


@router.put("/standards/calibration-rules")
def put_calibration_rules(
    body: CalibrationRulesUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    actor_id = _actor_id(db, user)
    rules = [r.model_dump() for r in body.rules]
    result = update_calibration_rules(db, user.tenant_id, actor_id, rules)
    db.commit()
    return result
