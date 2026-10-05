"""绩效结果录入端点：主管初评 / COE 校准（P1 绩效内生）。"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import Principal, err, require_perm
from app.database import get_db
from app.models.employee import Employee
from app.models.perf import PerfPlan, PerfResult
from app.schemas.perf import (
    PlanImportIn,
    PlanImportOut,
    ResultBatchIn,
    ResultItemIn,
    ResultOut,
)
from app.api.v1.endpoints.perf_plans import get_owned_plan
from app.services.perf_result_service import (
    ResultError,
    import_draft_results,
    upsert_result,
)
from app.services.scope import can_access_employee

router = APIRouter(tags=["perf"])


def _result_out(emp: Employee, result: PerfResult) -> ResultOut:
    return ResultOut(
        plan_id=result.plan_id,
        employee_id=emp.id,
        employee_no=emp.employee_no,
        name=emp.name,
        grade=result.grade,
        score=result.score,
        coefficient=result.coefficient,
        org_coefficient=result.org_coefficient,
        evidence=list(result.evidence or []),
    )


def _put_one(db, principal, plan, item: ResultItemIn) -> ResultOut:
    try:
        result = upsert_result(
            db, principal, plan,
            item.employee_id, item.grade, item.score, item.evidence,
        )
    except ResultError as exc:
        raise err(exc.status, exc.code, exc.message)
    emp = db.get(Employee, item.employee_id)
    return _result_out(emp, result)


@router.put("/perf/plans/{plan_id}/results", response_model=list[ResultOut])
def put_results_batch(
    plan_id: uuid.UUID,
    body: ResultBatchIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(
        require_perm("perf.plan.manage", "perf.result.entry")
    ),
):
    """批量录入/覆盖结果：逐项校验，任一非法整批不落库。"""
    plan = get_owned_plan(db, principal, plan_id)
    try:
        outputs = [
            _put_one(db, principal, plan, item) for item in body.items
        ]
    except Exception:
        # 任一非法整批不落库（flush 已发生，必须显式回滚）
        db.rollback()
        raise
    db.commit()
    return outputs


@router.put(
    "/perf/plans/{plan_id}/results/{employee_id}", response_model=ResultOut
)
def put_result_one(
    plan_id: uuid.UUID,
    employee_id: uuid.UUID,
    body: ResultItemIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(
        require_perm("perf.plan.manage", "perf.result.entry")
    ),
):
    plan = get_owned_plan(db, principal, plan_id)
    if body.employee_id != employee_id:
        raise err(422, "employee_mismatch", "路径与请求体员工不一致")
    out = _put_one(db, principal, plan, body)
    db.commit()
    return out


@router.get("/perf/plans/{plan_id}/results", response_model=list[ResultOut])
def list_results(
    plan_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(
        require_perm("perf.plan.manage", "perf.result.entry")
    ),
):
    """方案结果表：COE 全量，主管仅本人数据范围内成员。"""
    plan = get_owned_plan(db, principal, plan_id)
    results = db.scalars(
        select(PerfResult).where(PerfResult.plan_id == plan.id)
    ).all()
    by_employee = {r.employee_id: r for r in results}
    scope_filter = not principal.can("perf.plan.manage")
    outputs: list[ResultOut] = []
    for employee_id in plan.roster:
        result = by_employee.get(employee_id)
        if result is None:
            continue
        emp = db.get(Employee, employee_id)
        if emp is None:
            continue
        if scope_filter and not can_access_employee(db, principal, emp):
            continue
        outputs.append(_result_out(emp, result))
    return outputs


@router.post("/perf/plans/{plan_id}/import", response_model=PlanImportOut)
def import_results_to_draft(
    plan_id: uuid.UUID,
    body: PlanImportIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_perm("perf.plan.manage")),
):
    """CSV/批量导入进草稿方案：合法行写方案结果，不回写档案 perf_grade。"""
    plan = get_owned_plan(db, principal, plan_id)
    try:
        imported, errors = import_draft_results(
            db, principal, plan, body.items
        )
    except ResultError as exc:
        raise err(exc.status, exc.code, exc.message)
    db.commit()
    return PlanImportOut(
        imported=imported,
        errors=[
            {"employee_no": no, "reason": reason} for no, reason in errors
        ],
    )
