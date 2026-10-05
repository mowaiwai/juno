"""考核方案端点：CRUD、显式名册、状态机、克隆（P1 绩效内生）。"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import Principal, err, require_perm
from app.database import get_db
from app.models.employee import Employee
from app.models.perf import PerfPlan
from app.schemas.perf import (
    PlanCreate,
    PlanOut,
    PlanSummary,
    PlanTransition,
    PlanUpdate,
    RosterMember,
    RosterUpdate,
)
from app.services.perf_plan_service import (
    PlanError,
    clone_plan,
    create_plan,
    expand_roster,
    replace_roster,
    result_count,
    transition,
    update_plan,
)
from app.services.scope import apply_employee_scope, can_access_employee

router = APIRouter(tags=["perf"])


def _raise_plan_error(exc: PlanError):
    raise err(exc.status, exc.code, exc.message)


def get_owned_plan(
    db: Session, principal: Principal, plan_id: uuid.UUID
) -> PerfPlan:
    plan = db.get(PerfPlan, plan_id)
    if plan is None or plan.tenant_id != principal.user.tenant_id:
        raise err(404, "plan_not_found", "考核方案不存在")
    return plan


def _member(db: Session, emp: Employee) -> RosterMember:
    return RosterMember(
        id=emp.id,
        employee_no=emp.employee_no,
        name=emp.name,
        dept_id=emp.dept_id,
        position=emp.position,
        sequence=emp.sequence,
    )


def plan_out(
    db: Session,
    plan: PerfPlan,
    principal: Principal,
    scope_filter: bool = False,
) -> PlanOut:
    candidates = expand_roster(
        db, principal, plan.scope_depts, plan.scope_sequences
    )
    by_id = {e.id: e for e in candidates}
    roster_ids = list(plan.roster)
    # 名册为快照：圈定条件变化后可能有成员已不在候选集，仍需回显（直接查档）
    missing_ids = [i for i in roster_ids if i not in by_id]
    if missing_ids:
        rows = db.scalars(
            select(Employee).where(
                Employee.tenant_id == plan.tenant_id,
                Employee.id.in_(missing_ids),
            )
        ).all()
        by_id.update({e.id: e for e in rows})

    def _visible(emp: Employee) -> bool:
        if not scope_filter:
            return True
        return can_access_employee(db, principal, emp)

    roster_members = [
        _member(db, by_id[i])
        for i in roster_ids
        if i in by_id and _visible(by_id[i])
    ]
    excluded_members = [
        _member(db, e)
        for e in candidates
        if e.id not in set(roster_ids)
    ]
    return PlanOut(
        id=plan.id,
        period=plan.period,
        tool_type=plan.tool_type,
        status=plan.status,
        scope_depts=list(plan.scope_depts),
        scope_sequences=list(plan.scope_sequences),
        roster_members=roster_members,
        excluded_members=excluded_members,
        distribution_override_reason=plan.distribution_override_reason,
        published_at=plan.published_at,
        result_count=result_count(db, plan.id),
    )


@router.post("/perf/plans", response_model=PlanOut, status_code=201)
def create_perf_plan(
    body: PlanCreate,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_perm("perf.plan.manage")),
):
    try:
        plan = create_plan(
            db, principal,
            period=body.period,
            tool_type=body.tool_type,
            dept_ids=body.dept_ids,
            sequence_codes=body.sequence_codes,
            exclude_ids=body.exclude_ids,
        )
    except PlanError as exc:
        _raise_plan_error(exc)
    db.commit()
    return plan_out(db, plan, principal)


@router.get("/perf/plans", response_model=list[PlanSummary])
def list_perf_plans(
    db: Session = Depends(get_db),
    principal: Principal = Depends(
        require_perm("perf.plan.manage", "perf.result.entry")
    ),
):
    plans = db.scalars(
        select(PerfPlan)
        .where(PerfPlan.tenant_id == principal.user.tenant_id)
        .order_by(PerfPlan.created_at.desc())
    ).all()
    if not principal.can("perf.plan.manage"):
        # 主管初评视角：只列名册与其数据范围有交集的方案
        scoped_ids = set(
            db.scalars(apply_employee_scope(select(Employee.id), db, principal)).all()
        )
        plans = [p for p in plans if scoped_ids and set(p.roster) & scoped_ids]
    return [
        PlanSummary(
            id=p.id,
            period=p.period,
            tool_type=p.tool_type,
            status=p.status,
            roster_size=len(p.roster),
            result_count=result_count(db, p.id),
            published_at=p.published_at,
        )
        for p in plans
    ]


@router.get("/perf/plans/{plan_id}", response_model=PlanOut)
def get_perf_plan(
    plan_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(
        require_perm("perf.plan.manage", "perf.result.entry")
    ),
):
    plan = get_owned_plan(db, principal, plan_id)
    # 主管初评视角：只回显本人数据范围内的名册成员
    scope_filter = not principal.can("perf.plan.manage")
    return plan_out(db, plan, principal, scope_filter=scope_filter)


@router.put("/perf/plans/{plan_id}", response_model=PlanOut)
def update_perf_plan(
    plan_id: uuid.UUID,
    body: PlanUpdate,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_perm("perf.plan.manage")),
):
    plan = get_owned_plan(db, principal, plan_id)
    try:
        update_plan(
            db, principal, plan,
            period=body.period,
            tool_type=body.tool_type,
            dept_ids=body.dept_ids,
            sequence_codes=body.sequence_codes,
        )
    except PlanError as exc:
        _raise_plan_error(exc)
    db.commit()
    return plan_out(db, plan, principal)


@router.put("/perf/plans/{plan_id}/roster", response_model=PlanOut)
def replace_perf_roster(
    plan_id: uuid.UUID,
    body: RosterUpdate,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_perm("perf.plan.manage")),
):
    plan = get_owned_plan(db, principal, plan_id)
    try:
        replace_roster(db, principal, plan, body.member_ids)
    except PlanError as exc:
        _raise_plan_error(exc)
    db.commit()
    return plan_out(db, plan, principal)


@router.post("/perf/plans/{plan_id}/transition", response_model=PlanOut)
def transition_perf_plan(
    plan_id: uuid.UUID,
    body: PlanTransition,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_perm("perf.plan.manage")),
):
    plan = get_owned_plan(db, principal, plan_id)
    try:
        transition(db, principal, plan, body.to)
    except PlanError as exc:
        _raise_plan_error(exc)
    db.commit()
    return plan_out(db, plan, principal)


@router.post(
    "/perf/plans/{plan_id}/clone", response_model=PlanOut, status_code=201
)
def clone_perf_plan(
    plan_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_perm("perf.plan.manage")),
):
    plan = get_owned_plan(db, principal, plan_id)
    clone = clone_plan(db, principal, plan)
    db.commit()
    return plan_out(db, clone, principal)
