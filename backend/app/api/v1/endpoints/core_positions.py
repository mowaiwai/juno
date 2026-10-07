"""核心岗位/继任/梯队端点（spec talent-matching §5.3）。"""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import (
    Principal,
    err,
    get_principal,
    require_perm_user,
)
from app.core.permissions import ScopeType
from app.database import get_db
from app.models.employee import Employee
from app.models.succession import (
    CorePosition,
    PoolLevel,
    PoolStatus,
    TalentPool,
    Willingness,
)
from app.models.user import User
from app.schemas.succession import (
    CandidateIn,
    CandidateOut,
    CorePositionIn,
    CorePositionOut,
    CorePositionUpdate,
    RecommendationOut,
    SuccessionMapOut,
    TalentPoolIn,
    TalentPoolOut,
    TalentPoolUpdate,
    WillingnessIn,
    WillingnessOut,
)
from app.services.scope import apply_employee_scope
from app.services.succession import (
    auto_screen,
    build_succession_map,
    candidate_payload,
    create_position,
    delete_position,
    join_pool,
    list_candidates,
    list_positions,
    list_pools,
    nominee,
    position_view,
    recommend_for_position,
    remove_candidate,
    set_willingness,
    update_pool,
    update_position,
    leave_pool,
)
from sqlalchemy import select

router = APIRouter(tags=["succession"])

# 干部管理 COE：核心岗位/继任/梯队全量维护
_hr = require_perm_user("succession.manage")


def _require_reader(principal: Principal):
    if not principal.can("succession.manage", "succession.nominate"):
        raise err(403, "forbidden", "无权查看核心岗位信息")


def _scoped(principal: Principal) -> bool:
    """非 GLOBAL 数据范围（HRBP/部门领导）需要按范围收窄候选人明细。"""
    return principal.scope_type != ScopeType.GLOBAL


def _visible_employee_ids(db: Session, principal: Principal) -> set:
    stmt = apply_employee_scope(select(Employee.id), db, principal)
    return set(db.scalars(stmt).all())


def _load(db: Session, position_id, user: User) -> CorePosition:
    """不存在 → 404；存在但跨租户 → 403。"""
    position = db.get(CorePosition, position_id)
    if position is None:
        raise err(404, "core_position_not_found", "核心岗位不存在")
    if position.tenant_id != user.tenant_id:
        raise err(403, "forbidden", "无权访问该核心岗位")
    return position


# ---------------------------------------------------------------------------
# 核心岗位
# ---------------------------------------------------------------------------

@router.post("/core-positions", response_model=CorePositionOut, status_code=201)
def create_position_endpoint(
    body: CorePositionIn,
    db: Session = Depends(get_db),
    user: User = Depends(_hr),
):
    position = create_position(
        db, user,
        name=body.name, dept_id=body.dept_id, grade=body.grade,
        sequence=body.sequence, headcount=body.headcount,
        incumbent_employee_id=body.incumbent_employee_id,
    )
    db.commit()
    return position_view(db, position)


@router.get("/core-positions", response_model=list[CorePositionOut])
def list_positions_endpoint(
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    _require_reader(principal)
    user = principal.user
    views = [position_view(db, p) for p in list_positions(db, user.tenant_id)]
    if _scoped(principal):
        # 范围受限角色列表只看风险，不展开候选人明细（明细限数据范围内）
        for view in views:
            view["candidates"] = []
    return views


@router.get("/core-positions/{position_id}", response_model=CorePositionOut)
def detail_position_endpoint(
    position_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    _require_reader(principal)
    user = principal.user
    position = _load(db, position_id, user)
    view = position_view(db, position)
    if _scoped(principal):
        allowed = _visible_employee_ids(db, principal)
        view["candidates"] = [
            c for c in view["candidates"] if c["employee_id"] in allowed
        ]
    return view


@router.put("/core-positions/{position_id}", response_model=CorePositionOut)
def update_position_endpoint(
    position_id: uuid.UUID,
    body: CorePositionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(_hr),
):
    position = _load(db, position_id, user)
    fields = body.model_dump(exclude_unset=True)
    if fields:
        update_position(db, position, user, **fields)
    db.commit()
    return position_view(db, position)


@router.delete("/core-positions/{position_id}", status_code=204)
def delete_position_endpoint(
    position_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(_hr),
):
    position = _load(db, position_id, user)
    delete_position(db, position, user)
    db.commit()


# ---------------------------------------------------------------------------
# 继任候选
# ---------------------------------------------------------------------------

@router.post(
    "/core-positions/{position_id}/auto-screen",
    response_model=CorePositionOut,
)
def auto_screen_endpoint(
    position_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(_hr),
):
    position = _load(db, position_id, user)
    auto_screen(db, position, user)
    db.commit()
    return position_view(db, position)


@router.get(
    "/core-positions/{position_id}/candidates",
    response_model=list[CandidateOut],
)
def candidates_endpoint(
    position_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    _require_reader(principal)
    position = _load(db, position_id, principal.user)
    candidates = list_candidates(db, position)
    if _scoped(principal):
        allowed = _visible_employee_ids(db, principal)
        candidates = [c for c in candidates if c.employee_id in allowed]
    return [candidate_payload(db, c) for c in candidates]


@router.post(
    "/core-positions/{position_id}/candidates",
    response_model=CandidateOut,
    status_code=201,
)
def nominee_endpoint(
    position_id: uuid.UUID,
    body: CandidateIn,
    db: Session = Depends(get_db),
    user: User = Depends(_hr),
):
    position = _load(db, position_id, user)
    employee = db.get(Employee, body.employee_id)
    if employee is None:
        raise err(404, "employee_not_found", "员工不存在")
    candidate = nominee(db, position, employee, user)
    db.commit()
    return candidate_payload(db, candidate)


@router.delete(
    "/core-positions/{position_id}/candidates",
    status_code=204,
)
def remove_candidate_endpoint(
    position_id: uuid.UUID,
    body: CandidateIn,
    db: Session = Depends(get_db),
    user: User = Depends(_hr),
):
    position = _load(db, position_id, user)
    employee = db.get(Employee, body.employee_id)
    if employee is None:
        raise err(404, "employee_not_found", "员工不存在")
    remove_candidate(db, position, employee, user)
    db.commit()


@router.put(
    "/core-positions/{position_id}/candidates/{employee_id}/willingness",
    response_model=WillingnessOut,
)
def willingness_endpoint(
    position_id: uuid.UUID,
    employee_id: uuid.UUID,
    body: WillingnessIn,
    db: Session = Depends(get_db),
    user: User = Depends(_hr),
):
    position = _load(db, position_id, user)
    employee = db.get(Employee, employee_id)
    if employee is None:
        raise err(404, "employee_not_found", "员工不存在")
    candidate = set_willingness(
        db, position, employee, user, Willingness(body.willingness)
    )
    db.commit()
    return {
        "id": candidate.id,
        "employee_id": candidate.employee_id,
        "willingness": candidate.willingness.value,
    }


# ---------------------------------------------------------------------------
# 模块六 P3：继任推荐 / 继任地图
# ---------------------------------------------------------------------------

@router.get(
    "/core-positions/{position_id}/recommendations",
    response_model=list[RecommendationOut],
)
def recommendations_endpoint(
    position_id: uuid.UUID,
    limit: int = 10,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    """单岗位继任推荐：统一匹配引擎打分 + 就绪度三档，按分排序取 Top N。"""
    _require_reader(principal)
    position = _load(db, position_id, principal.user)
    recs = recommend_for_position(db, position, principal, limit=limit)
    return recs


@router.get("/succession/map", response_model=SuccessionMapOut)
def succession_map_endpoint(
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    """继任地图：核心岗位 × 就绪度分桶（聚合计数，不含个人明细）。"""
    _require_reader(principal)
    return build_succession_map(db, principal.user.tenant_id)


# ---------------------------------------------------------------------------
# 梯队池
# ---------------------------------------------------------------------------

@router.get("/talent-pools", response_model=list[TalentPoolOut])
def list_pool_endpoint(
    db: Session = Depends(get_db),
    user: User = Depends(require_perm_user("succession.manage")),
):
    return list_pools(db, user.tenant_id)


@router.post("/talent-pools", response_model=TalentPoolOut, status_code=201)
def join_pool_endpoint(
    body: TalentPoolIn,
    db: Session = Depends(get_db),
    user: User = Depends(_hr),
):
    employee = db.get(Employee, body.employee_id)
    if employee is None or employee.tenant_id != user.tenant_id:
        raise err(404, "employee_not_found", "员工不存在")
    member = join_pool(
        db, user, employee,
        level=PoolLevel(body.pool_level), reason=body.reason,
    )
    db.commit()
    return member


@router.put("/talent-pools/{member_id}", response_model=TalentPoolOut)
def update_pool_endpoint(
    member_id: uuid.UUID,
    body: TalentPoolUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(_hr),
):
    member = db.get(TalentPool, member_id)
    if member is None or member.tenant_id != user.tenant_id:
        raise err(404, "pool_member_not_found", "梯队成员不存在")
    fields = body.model_dump(exclude_unset=True)
    mapped = {}
    if "pool_level" in fields:
        mapped["pool_level"] = PoolLevel(fields["pool_level"])
    if "status" in fields:
        mapped["status"] = PoolStatus(fields["status"])
    if "reason" in fields:
        mapped["reason"] = fields["reason"]
    if mapped:
        update_pool(db, member, user, **mapped)
    db.commit()
    return member
