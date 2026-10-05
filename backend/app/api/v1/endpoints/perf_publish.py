"""校准分布、发布/撤回端点（P1 绩效内生）。"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.endpoints.perf_plans import get_owned_plan, plan_out
from app.core.deps import Principal, err, require_perm
from app.database import get_db
from app.models.employee import Employee
from app.schemas.perf import DistributionOut, PlanOut, PublishIn
from app.services.perf_publish_service import (
    PublishError,
    compute_distribution,
    publish,
    unpublish,
)

router = APIRouter(tags=["perf"])


@router.get(
    "/perf/plans/{plan_id}/distribution", response_model=DistributionOut
)
def get_distribution(
    plan_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_perm("perf.plan.manage")),
):
    plan = get_owned_plan(db, principal, plan_id)
    dist = compute_distribution(db, plan)
    ungraded_rows = db.scalars(
        select(Employee).where(
            Employee.tenant_id == plan.tenant_id,
            Employee.id.in_(dist["ungraded_ids"]),
        )
    ).all()
    by_id = {e.id: e for e in ungraded_rows}
    return DistributionOut(
        roster_size=dist["roster_size"],
        graded_count=dist["graded_count"],
        counts=dist["counts"],
        ratios=dist["ratios"],
        cd_ratio=dist["cd_ratio"],
        ungraded=[
            {
                "employee_id": eid,
                "employee_no": by_id[eid].employee_no,
                "name": by_id[eid].name,
            }
            for eid in dist["ungraded_ids"]
            if eid in by_id
        ],
        violations=dist["violations"],
        small_roster=dist["small_roster"],
    )


@router.post("/perf/plans/{plan_id}/publish", response_model=PlanOut)
def publish_plan(
    plan_id: uuid.UUID,
    body: PublishIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_perm("perf.plan.manage")),
):
    plan = get_owned_plan(db, principal, plan_id)
    try:
        publish(db, principal, plan, body.override_reason)
    except PublishError as exc:
        raise err(
            exc.status, exc.code, exc.message, details=exc.details
        )
    db.commit()
    return plan_out(db, plan, principal)


@router.post("/perf/plans/{plan_id}/unpublish", response_model=PlanOut)
def unpublish_plan(
    plan_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_perm("perf.plan.manage")),
):
    plan = get_owned_plan(db, principal, plan_id)
    try:
        unpublish(db, principal, plan)
    except PublishError as exc:
        raise err(exc.status, exc.code, exc.message)
    db.commit()
    return plan_out(db, plan, principal)
