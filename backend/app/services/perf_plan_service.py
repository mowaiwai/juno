"""考核方案领域服务：名册圈定、状态机、克隆。"""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import Principal
from app.models.employee import Employee
from app.models.org import Department
from app.models.perf import PerfPlan, PerfPlanStatus, PerfResult
from app.services.audit import audit_as
from app.services.scope import apply_employee_scope, dept_subtree

# 合法单向迁移（published 仅由发布动作进入；撤回由发布服务处理）
PLAN_TRANSITIONS: dict[str, set[str]] = {
    PerfPlanStatus.DRAFT.value: {PerfPlanStatus.EVALUATING.value},
    PerfPlanStatus.EVALUATING.value: {PerfPlanStatus.CALIBRATING.value},
    PerfPlanStatus.CALIBRATING.value: set(),
    PerfPlanStatus.PUBLISHED.value: set(),
}

TOOL_TYPES = {"pbc", "kpi", "okr", "360"}


class PlanError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def expand_roster(
    db: Session,
    principal: Principal,
    dept_ids: list[str],
    sequence_codes: list[str],
) -> list[Employee]:
    """按部门子树 ∪ 序列展开在职员工；非 GLOBAL 角色与本人数据范围相交。"""
    tenant_id = principal.user.tenant_id
    if dept_ids:
        existing = {
            d.id
            for d in db.scalars(
                select(Department).where(
                    Department.tenant_id == tenant_id,
                    Department.id.in_(dept_ids),
                )
            ).all()
        }
        missing = set(dept_ids) - existing
        if missing:
            raise PlanError(
                404, "dept_not_found", f"部门不存在: {sorted(missing)}"
            )
        dept_set = dept_subtree(db, tenant_id, dept_ids)
    else:
        dept_set = set()

    if not dept_ids and not sequence_codes:
        raise PlanError(422, "empty_scope", "圈定范围不能为空")

    stmt = select(Employee).where(
        Employee.tenant_id == tenant_id,
        Employee.is_active.is_(True),
    )
    conditions = []
    if dept_set:
        conditions.append(Employee.dept_id.in_(dept_set))
    if sequence_codes:
        conditions.append(Employee.sequence.in_(sequence_codes))
    stmt = stmt.where(_or_all(conditions))
    stmt = apply_employee_scope(stmt, db, principal)
    stmt = stmt.order_by(Employee.employee_no)
    employees = db.scalars(stmt).unique().all()
    return list(employees)


def _or_all(conditions):
    from sqlalchemy import or_

    return or_(*conditions)


def create_plan(
    db: Session,
    principal: Principal,
    *,
    period: str,
    tool_type: str,
    dept_ids: list[str],
    sequence_codes: list[str],
    exclude_ids: list[uuid.UUID],
) -> PerfPlan:
    if tool_type not in TOOL_TYPES:
        raise PlanError(422, "invalid_tool", "未知考核工具")
    candidates = expand_roster(db, principal, dept_ids, sequence_codes)
    if not candidates:
        raise PlanError(422, "empty_roster", "圈定范围内没有可考核的在职员工")
    excluded = set(exclude_ids)
    roster = [e.id for e in candidates if e.id not in excluded]
    if not roster:
        raise PlanError(422, "empty_roster", "名册不能全部剔除")

    plan = PerfPlan(
        tenant_id=principal.user.tenant_id,
        period=period.strip(),
        tool_type=tool_type,
        status=PerfPlanStatus.DRAFT.value,
        roster=roster,
        scope_depts=list(dept_ids),
        scope_sequences=list(sequence_codes),
    )
    db.add(plan)
    db.flush()
    audit_as(
        db, principal.user,
        "perf_plan_created", "perf_plan", plan.id,
        after={"period": plan.period, "tool_type": tool_type,
               "roster_size": len(roster)},
    )
    return plan


def update_plan(
    db: Session,
    principal: Principal,
    plan: PerfPlan,
    *,
    period: str | None,
    tool_type: str | None,
    dept_ids: list[str] | None,
    sequence_codes: list[str] | None,
) -> PerfPlan:
    _require_draft(plan)
    if tool_type is not None and tool_type not in TOOL_TYPES:
        raise PlanError(422, "invalid_tool", "未知考核工具")

    new_depts = plan.scope_depts if dept_ids is None else dept_ids
    new_seqs = plan.scope_sequences if sequence_codes is None else sequence_codes
    before = {
        "period": plan.period, "tool_type": plan.tool_type,
        "dept_ids": list(plan.scope_depts),
        "sequence_codes": list(plan.scope_sequences),
        "roster_size": len(plan.roster),
    }

    if period is not None:
        plan.period = period.strip()
    if tool_type is not None:
        plan.tool_type = tool_type

    if dept_ids is not None or sequence_codes is not None:
        candidates = expand_roster(db, principal, new_depts, new_seqs)
        if not candidates:
            raise PlanError(
                422, "empty_roster", "圈定范围内没有可考核的在职员工"
            )
        candidate_ids = {e.id for e in candidates}
        # 保留既有剔除：旧候选中、不在新名册里的成员仍排除
        kept_roster = [eid for eid in plan.roster if eid in candidate_ids]
        plan.roster = kept_roster or [e.id for e in candidates]
        plan.scope_depts = list(new_depts)
        plan.scope_sequences = list(new_seqs)

    audit_as(
        db, principal.user,
        "perf_plan_updated", "perf_plan", plan.id,
        before=before,
        after={"period": plan.period, "tool_type": plan.tool_type,
               "dept_ids": list(plan.scope_depts),
               "sequence_codes": list(plan.scope_sequences),
               "roster_size": len(plan.roster)},
    )
    db.flush()
    return plan


def replace_roster(
    db: Session,
    principal: Principal,
    plan: PerfPlan,
    member_ids: list[uuid.UUID],
) -> PerfPlan:
    _require_draft(plan)
    candidates = {
        e.id
        for e in expand_roster(
            db, principal, plan.scope_depts, plan.scope_sequences
        )
    }
    ids = list(dict.fromkeys(member_ids))  # 去重保序
    outside = [i for i in ids if i not in candidates]
    if outside:
        raise PlanError(
            422, "member_out_of_scope", "存在不在圈定候选范围内的名册成员"
        )
    if not ids:
        raise PlanError(422, "empty_roster", "名册不能为空")
    before = len(plan.roster)
    plan.roster = ids
    audit_as(
        db, principal.user,
        "perf_plan_roster_replaced", "perf_plan", plan.id,
        before={"roster_size": before},
        after={"roster_size": len(ids)},
    )
    db.flush()
    return plan


def transition(
    db: Session, principal: Principal, plan: PerfPlan, to_status: str
) -> PerfPlan:
    allowed = PLAN_TRANSITIONS.get(plan.status, set())
    if to_status not in allowed:
        raise PlanError(
            409,
            "invalid_transition",
            f"方案不能从 {plan.status} 迁移到 {to_status}",
        )
    before = plan.status
    plan.status = to_status
    audit_as(
        db, principal.user,
        "perf_plan_transitioned", "perf_plan", plan.id,
        before={"status": before}, after={"status": to_status},
    )
    db.flush()
    return plan


def clone_plan(db: Session, principal: Principal, plan: PerfPlan) -> PerfPlan:
    clone = PerfPlan(
        tenant_id=plan.tenant_id,
        period=plan.period,
        tool_type=plan.tool_type,
        status=PerfPlanStatus.DRAFT.value,
        roster=list(plan.roster),
        scope_depts=list(plan.scope_depts),
        scope_sequences=list(plan.scope_sequences),
    )
    db.add(clone)
    db.flush()
    audit_as(
        db, principal.user,
        "perf_plan_cloned", "perf_plan", clone.id,
        after={"source_plan_id": str(plan.id), "period": clone.period},
    )
    return clone


def result_count(db: Session, plan_id: uuid.UUID) -> int:
    return len(
        db.scalars(
            select(PerfResult.id).where(PerfResult.plan_id == plan_id)
        ).all()
    )


def _require_draft(plan: PerfPlan) -> None:
    if plan.status != PerfPlanStatus.DRAFT.value:
        raise PlanError(
            409, "plan_not_editable", "仅草稿状态方案可编辑"
        )
