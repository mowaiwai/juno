"""IDP 个人发展计划端点。

状态流转：draft → confirmed → reviewing → closed。
ADR-0014 权限：
- 本人始终可见/可创建自己的 IDP；
- idp.coach（干部/绩效 COE、OTD、HRBP、部门领导）在激活角色数据范围内辅导；
- AI 生成同辅导权限。
"""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import (
    Principal,
    err,
    get_principal,
    require_perm_user,
)
from app.database import get_db
from app.models.employee import Employee
from app.models.idp import IDP, IDPStatus
from app.models.profile import DIMENSION_KEYS, ProfileSnapshot
from app.models.user import User
from app.schemas.idp import (
    IDPCreateIn,
    IDPGenerateIn,
    IDPOut,
    IDPUpdateIn,
    KeyBehaviorUpdateIn,
)
from app.services.audit import audit_as
from app.services.scope import apply_employee_scope, can_access_employee

router = APIRouter(tags=["idp"])

_coach = require_perm_user("idp.coach")


def _employee(db: Session, employee_id: uuid.UUID) -> Employee | None:
    return db.get(Employee, employee_id)


def _can_view(db: Session, principal: Principal, employee_id: uuid.UUID) -> bool:
    """本人或落在辅导角色数据范围内的员工。"""
    employee = _employee(db, employee_id)
    if employee is None or employee.tenant_id != principal.user.tenant_id:
        return False
    if employee.user_id == principal.user.id:
        return True
    return principal.can("idp.coach") and can_access_employee(
        db, principal, employee
    )


def _visible_employee_ids(db: Session, principal: Principal) -> set[uuid.UUID]:
    """本人 ∪ 激活角色数据范围内员工。"""
    stmt = apply_employee_scope(select(Employee.id), db, principal)
    ids = set(db.scalars(stmt).all())
    own = db.scalar(
        select(Employee.id).where(Employee.user_id == principal.user.id)
    )
    if own is not None:
        ids.add(own)
    return ids


def _get_idp_or_404(db: Session, idp_id: uuid.UUID, tenant_id: uuid.UUID) -> IDP:
    idp = db.get(IDP, idp_id)
    if idp is None or idp.tenant_id != tenant_id:
        raise err(404, "idp_not_found", "IDP 不存在")
    return idp


@router.get("/idps", response_model=list[IDPOut])
def list_idps(
    employee_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    """查询 IDP 列表，可按 employee_id 过滤；默认按激活角色数据范围收窄。"""
    user = principal.user
    stmt = select(IDP).where(IDP.tenant_id == user.tenant_id)
    if employee_id is not None:
        if not _can_view(db, principal, employee_id):
            raise err(404, "employee_not_found", "员工不存在")
        stmt = stmt.where(IDP.employee_id == employee_id)
    else:
        stmt = stmt.where(
            IDP.employee_id.in_(_visible_employee_ids(db, principal))
        )
    stmt = stmt.order_by(IDP.period.desc())
    return [IDPOut.model_validate(i) for i in db.scalars(stmt).all()]


@router.get("/idps/{idp_id}", response_model=IDPOut)
def get_idp(
    idp_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    user = principal.user
    idp = _get_idp_or_404(db, idp_id, user.tenant_id)
    if not _can_view(db, principal, idp.employee_id):
        raise err(404, "idp_not_found", "IDP 不存在")
    return IDPOut.model_validate(idp)


@router.post("/idps", response_model=IDPOut, status_code=201)
def create_idp(
    body: IDPCreateIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    user = principal.user
    if not _can_view(db, principal, body.employee_id):
        raise err(403, "forbidden", "无权为该员工创建 IDP")
    idp = IDP(
        tenant_id=user.tenant_id,
        employee_id=body.employee_id,
        period=body.period,
        period_type=body.period_type,
        status=IDPStatus.DRAFT,
        goals=[g.model_dump() for g in body.goals],
        key_behaviors=[k.model_dump() for k in body.key_behaviors],
        created_by=user.id,
    )
    db.add(idp)
    audit_as(db, user, "idp_created", "idp", idp.id, None, {"period": body.period})
    db.commit()
    db.refresh(idp)
    return IDPOut.model_validate(idp)


@router.put("/idps/{idp_id}", response_model=IDPOut)
def update_idp(
    idp_id: uuid.UUID,
    body: IDPUpdateIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    user = principal.user
    idp = _get_idp_or_404(db, idp_id, user.tenant_id)
    if not _can_view(db, principal, idp.employee_id):
        raise err(404, "idp_not_found", "IDP 不存在")
    if idp.status not in (IDPStatus.DRAFT,):
        raise err(409, "idp_not_editable", "仅草稿状态可编辑")
    if body.goals is not None:
        idp.goals = [g.model_dump() for g in body.goals]
    if body.key_behaviors is not None:
        idp.key_behaviors = [k.model_dump() for k in body.key_behaviors]
    db.commit()
    db.refresh(idp)
    return IDPOut.model_validate(idp)


@router.put("/idps/{idp_id}/key-behaviors", response_model=IDPOut)
def update_key_behavior_status(
    idp_id: uuid.UUID,
    body: KeyBehaviorUpdateIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    """更新单条关键行为的状态（执行跟踪用）。"""
    user = principal.user
    idp = _get_idp_or_404(db, idp_id, user.tenant_id)
    if not _can_view(db, principal, idp.employee_id):
        raise err(404, "idp_not_found", "IDP 不存在")
    updated = False
    for kb in idp.key_behaviors:
        if kb["behavior"] == body.behavior:
            kb["status"] = body.status
            if body.plan:
                kb["plan"] = body.plan
            updated = True
            break
    if not updated:
        raise err(404, "behavior_not_found", "未找到该关键行为")
    db.commit()
    db.refresh(idp)
    return IDPOut.model_validate(idp)


@router.post("/idps/{idp_id}/confirm", response_model=IDPOut)
def confirm_idp(
    idp_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    user = principal.user
    idp = _get_idp_or_404(db, idp_id, user.tenant_id)
    if not _can_view(db, principal, idp.employee_id):
        raise err(404, "idp_not_found", "IDP 不存在")
    if idp.status != IDPStatus.DRAFT:
        raise err(409, "invalid_state", "仅草稿状态可确认")
    idp.status = IDPStatus.CONFIRMED
    audit_as(db, user, "idp_confirmed", "idp", idp.id, None, {})
    db.commit()
    db.refresh(idp)
    return IDPOut.model_validate(idp)


@router.post("/idps/{idp_id}/review", response_model=IDPOut)
def submit_review(
    idp_id: uuid.UUID,
    body: dict,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    user = principal.user
    idp = _get_idp_or_404(db, idp_id, user.tenant_id)
    if not _can_view(db, principal, idp.employee_id):
        raise err(404, "idp_not_found", "IDP 不存在")
    if idp.status != IDPStatus.CONFIRMED:
        raise err(409, "invalid_state", "仅已确认状态可提交复盘")
    idp.status = IDPStatus.REVIEWING
    idp.review_result = body.get("review_result", "")
    idp.reviewed_by = user.id
    from datetime import timezone, datetime
    idp.reviewed_at = datetime.now(timezone.utc)
    audit_as(db, user, "idp_reviewed", "idp", idp.id, None, {"review_result": idp.review_result})
    db.commit()
    db.refresh(idp)
    return IDPOut.model_validate(idp)


@router.post("/idps/{idp_id}/close", response_model=IDPOut)
def close_idp(
    idp_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(_coach),
):
    idp = _get_idp_or_404(db, idp_id, user.tenant_id)
    if idp.status != IDPStatus.REVIEWING:
        raise err(409, "invalid_state", "仅复盘状态可归档")
    idp.status = IDPStatus.CLOSED
    audit_as(db, user, "idp_closed", "idp", idp.id, None, {})
    db.commit()
    db.refresh(idp)
    return IDPOut.model_validate(idp)


@router.post("/idps/generate", response_model=IDPOut, status_code=201)
def generate_idp(
    body: IDPGenerateIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    """AI 基于画像差距生成 IDP 草稿。

    逻辑：取最新画像七维，找出低分维度（<75），生成对应发展目标与行为计划。
    """
    user = principal.user
    if not _can_view(db, principal, body.employee_id):
        raise err(403, "forbidden", "无权为该员工生成 IDP")

    # 取最新画像
    snapshot = db.scalar(
        select(ProfileSnapshot)
        .where(
            ProfileSnapshot.employee_id == body.employee_id,
            ProfileSnapshot.tenant_id == user.tenant_id,
        )
        .order_by(ProfileSnapshot.version_seq.desc())
        .limit(1)
    )

    goals = []
    key_behaviors = []

    if snapshot:
        dim_scores = {d.dimension_key: d for d in snapshot.dimensions}
        dim_labels = {
            "basic": "基本条件",
            "biz": "业绩",
            "contribution": "团队贡献",
            "duty": "职责履行",
            "knowledge": "知识技能",
            "ability": "能力素质",
            "perf": "绩效",
        }
        for key in DIMENSION_KEYS:
            dim = dim_scores.get(key)
            if dim and dim.score is not None and dim.score < 75:
                label = dim_labels.get(key, key)
                goals.append({
                    "ability": label,
                    "target": f"提升{label}至 75 分以上（当前 {dim.score} 分）",
                })
                key_behaviors.append({
                    "behavior": f"制定{label}提升计划并执行",
                    "plan": f"本周期内完成{label}专项学习与实践",
                    "status": "todo",
                })

    if not goals:
        goals = [{"ability": "综合发展", "target": "保持优势维度，补齐短板"}]
        key_behaviors = [{
            "behavior": "持续学习与复盘",
            "plan": "按月度与上级复盘进展",
            "status": "todo",
        }]

    idp = IDP(
        tenant_id=user.tenant_id,
        employee_id=body.employee_id,
        period=body.period,
        period_type=body.period_type,
        status=IDPStatus.DRAFT,
        goals=goals,
        key_behaviors=key_behaviors,
        created_by=user.id,
    )
    db.add(idp)
    audit_as(
        db, user, "idp_generated", "idp", idp.id, None,
        {"period": body.period, "goals_count": len(goals)},
    )
    db.commit()
    db.refresh(idp)
    return IDPOut.model_validate(idp)
