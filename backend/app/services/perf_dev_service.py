"""PIP 与辅导记录服务（P1 绩效内生，spec AS-5/AS-6）。"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import Principal
from app.models.employee import Employee
from app.models.perf import (
    CoachingRecord,
    PerfPlan,
    PerfPlanStatus,
    PerfResult,
    Pip,
    PipStatus,
)
from app.services.audit import audit_as
from app.services.scope import can_access_employee


class DevError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


# ---------- PIP ----------

def get_owned_pip(db: Session, principal: Principal, pip_id) -> Pip:
    """取本租户 PIP；跨租户/不存在统一 404。"""
    pip = db.get(Pip, pip_id)
    if pip is None or pip.tenant_id != principal.user.tenant_id:
        raise DevError(404, "pip_not_found", "改进计划不存在")
    return pip


def create_pip(
    db: Session,
    principal: Principal,
    employee_id,
    period: str,
    goals: list,
    deadline,
    perf_result_id,
) -> Pip:
    emp = db.get(Employee, employee_id)
    if emp is None or emp.tenant_id != principal.user.tenant_id:
        raise DevError(404, "employee_not_found", "员工不存在")
    if not can_access_employee(db, principal, emp):
        raise DevError(404, "employee_not_found", "员工不存在")

    if perf_result_id is not None:
        result = db.get(PerfResult, perf_result_id)
        if (
            result is None
            or result.tenant_id != principal.user.tenant_id
            or result.employee_id != emp.id
        ):
            raise DevError(
                422, "invalid_perf_result", "绩效结果不存在或不属于该员工"
            )

    pip = Pip(
        tenant_id=principal.user.tenant_id,
        employee_id=emp.id,
        period=period,
        goals=list(goals or []),
        deadline=deadline,
        perf_result_id=perf_result_id,
        status=PipStatus.ACTIVE.value,
    )
    db.add(pip)
    db.flush()
    audit_as(
        db, principal.user,
        "pip_created", "pip", pip.id,
        after={"employee_id": str(emp.id), "period": period},
    )
    return pip


def update_pip(
    db: Session, principal: Principal, pip: Pip, goals, deadline
) -> Pip:
    if pip.status != PipStatus.ACTIVE.value:
        raise DevError(409, "pip_closed", "已终结的改进计划不可修改")
    before = {"goals": list(pip.goals or []), "deadline": str(pip.deadline)}
    if goals is not None:
        pip.goals = list(goals)
    if deadline is not None:
        pip.deadline = deadline
    db.flush()
    audit_as(
        db, principal.user,
        "pip_updated", "pip", pip.id,
        before=before,
        after={"goals": list(pip.goals or []), "deadline": str(pip.deadline)},
    )
    return pip


def conclude_pip(
    db: Session, principal: Principal, pip: Pip, result: str, note: str | None
) -> Pip:
    if pip.status != PipStatus.ACTIVE.value:
        raise DevError(409, "pip_closed", "改进计划已终结，结论不可修改")
    pip.status = result
    pip.conclusion = note
    pip.concluded_by = principal.user.id
    pip.concluded_at = datetime.now(timezone.utc)
    db.flush()
    audit_as(
        db, principal.user,
        "pip_concluded", "pip", pip.id,
        after={"result": result, "note": note},
    )
    return pip


# ---------- 辅导记录 ----------

def create_coaching(
    db: Session,
    principal: Principal,
    employee_id,
    content: str,
    happened_at,
    plan_id,
) -> CoachingRecord:
    emp = db.get(Employee, employee_id)
    if emp is None or emp.tenant_id != principal.user.tenant_id:
        raise DevError(404, "employee_not_found", "员工不存在")
    if not can_access_employee(db, principal, emp):
        raise DevError(404, "employee_not_found", "员工不存在")

    if plan_id is not None:
        plan = db.get(PerfPlan, plan_id)
        if plan is None or plan.tenant_id != principal.user.tenant_id:
            raise DevError(404, "plan_not_found", "考核方案不存在")

    record = CoachingRecord(
        tenant_id=principal.user.tenant_id,
        employee_id=emp.id,
        plan_id=plan_id,
        content=content.strip(),
        happened_at=happened_at,
        created_by=principal.user.id,
    )
    db.add(record)
    db.flush()
    audit_as(
        db, principal.user,
        "coaching_created", "coaching_record", record.id,
        after={"employee_id": str(emp.id)},
    )
    return record


def visible_employee(db: Session, principal: Principal, employee_id) -> Employee:
    """辅导/我的绩效视角的员工可见性：本人或数据范围内。"""
    emp = db.get(Employee, employee_id)
    if emp is None or emp.tenant_id != principal.user.tenant_id:
        raise DevError(404, "employee_not_found", "员工不存在")
    is_self = emp.user_id == principal.user.id
    if not is_self and not can_access_employee(db, principal, emp):
        raise DevError(404, "employee_not_found", "员工不存在")
    return emp


def list_published_results(db: Session, employee_id):
    """员工在【已发布】方案中的结果（含 OKR/360，只看不回写）。"""
    stmt = (
        select(PerfResult, PerfPlan)
        .join(PerfPlan, PerfPlan.id == PerfResult.plan_id)
        .where(
            PerfResult.employee_id == employee_id,
            PerfPlan.status == PerfPlanStatus.PUBLISHED.value,
        )
        .order_by(PerfPlan.published_at.desc())
    )
    return [(r, p) for r, p in db.execute(stmt).all()]
