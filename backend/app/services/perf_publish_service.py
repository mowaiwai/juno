"""考核方案发布服务：强制分布软校验、权威回写 perf_grade、D→PIP 自动建档。"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import Principal
from app.models.employee import Employee
from app.models.perf import (
    WRITEBACK_TOOLS,
    PerfPlan,
    PerfPlanStatus,
    PerfResult,
    Pip,
    PipStatus,
)
from app.services.audit import audit_as
from app.services.perf_rules import resolve_constants

_GRADES = ("S", "A", "B", "C", "D")


class PublishError(Exception):
    def __init__(self, status: int, code: str, message: str, details=None):
        super().__init__(message)
        self.status = status
        self.status_code = status
        self.code = code
        self.message = message
        self.details = details


def compute_distribution(db: Session, plan: PerfPlan) -> dict:
    """按名册内已评级人数统计五档占比与区间越界项。"""
    constants = resolve_constants(db, plan.tenant_id)
    bands = constants["distribution"]
    results = db.scalars(
        select(PerfResult).where(PerfResult.plan_id == plan.id)
    ).all()
    by_employee = {r.employee_id: r for r in results}
    roster = list(plan.roster)
    graded = [by_employee[e] for e in roster if e in by_employee]
    graded_count = len(graded)

    counts = {g: 0 for g in _GRADES}
    for r in graded:
        counts[r.grade] = counts.get(r.grade, 0) + 1
    ratios = {
        g: round(counts[g] / graded_count, 4) if graded_count else 0.0
        for g in _GRADES}
    cd_ratio = round((counts["C"] + counts["D"]) / graded_count, 4) \
        if graded_count else 0.0

    ungraded_ids = [e for e in roster if e not in by_employee]

    bucket_ratio = {
        "S": ratios["S"], "A": ratios["A"], "B": ratios["B"], "CD": cd_ratio
    }
    violations = []
    for bucket, r in bucket_ratio.items():
        low, high = bands[bucket]
        if r < low or r > high:
            violations.append(
                {"bucket": bucket, "ratio": r, "low": low, "high": high}
            )

    threshold = constants["small_roster_threshold"]
    return {
        "roster_size": len(roster),
        "graded_count": graded_count,
        "counts": counts,
        "ratios": ratios,
        "cd_ratio": cd_ratio,
        "ungraded_ids": ungraded_ids,
        "violations": violations,
        "small_roster": len(roster) < threshold,
    }


def publish(
    db: Session,
    principal: Principal,
    plan: PerfPlan,
    override_reason: str | None,
) -> PerfPlan:
    if plan.status != PerfPlanStatus.CALIBRATING.value:
        raise PublishError(
            409, "plan_not_calibrating", "仅校准中的方案可发布"
        )
    dist = compute_distribution(db, plan)
    if dist["ungraded_ids"]:
        raise PublishError(
            422,
            "results_incomplete",
            "名册内仍有成员无结果，不能发布",
            details={"ungraded_ids": [str(i) for i in dist["ungraded_ids"]]},
        )
    # 防御性校验（录入端点已拦截）：C 有分、S/A 有举证
    invalid = []
    results = db.scalars(
        select(PerfResult).where(PerfResult.plan_id == plan.id)
    ).all()
    by_employee = {r.employee_id: r for r in results}
    for r in results:
        if r.grade == "C" and r.score is None:
            invalid.append(str(r.employee_id))
        if r.grade in ("S", "A") and not (r.evidence or []):
            invalid.append(str(r.employee_id))
    if invalid:
        raise PublishError(
            422, "results_invalid",
            "存在缺分数的 C 档或缺举证的 S/A 档结果",
            details={"employee_ids": sorted(set(invalid))},
        )

    reason = (override_reason or "").strip() or None
    if dist["violations"] and not dist["small_roster"] and not reason:
        raise PublishError(
            422,
            "distribution_override_required",
            "分布超出建议区间，发布必须填写覆盖理由",
            details={"violations": dist["violations"]},
        )

    writeback = plan.tool_type in WRITEBACK_TOOLS
    plan.distribution_override_reason = reason
    plan.status = PerfPlanStatus.PUBLISHED.value
    plan.published_at = datetime.now(timezone.utc)

    for employee_id, result in by_employee.items():
        emp = db.get(Employee, employee_id)
        if emp is None:
            continue
        if writeback:
            before = emp.perf_grade
            emp.perf_grade = result.grade
            audit_as(
                db, principal.user,
                "perf_result_published", "employee", emp.id,
                before={"perf_grade": before},
                after={"perf_grade": result.grade,
                       "plan_id": str(plan.id),
                       "grade": result.grade,
                       "coefficient": result.coefficient,
                       "writeback": True},
            )
        else:
            audit_as(
                db, principal.user,
                "perf_result_published", "perf_result", result.id,
                after={"plan_id": str(plan.id),
                       "grade": result.grade,
                       "tool_type": plan.tool_type,
                       "writeback": False},
            )

    # D → PIP 自动建档（仅回写工具），幂等（同结果不重复建）
    if writeback:
        for employee_id, result in by_employee.items():
            if result.grade != "D":
                continue
            exists = db.scalar(
                select(Pip.id).where(
                    Pip.perf_result_id == result.id,
                    Pip.tenant_id == plan.tenant_id,
                )
            )
            if exists:
                continue
            db.add(Pip(
                tenant_id=plan.tenant_id,
                perf_result_id=result.id,
                employee_id=employee_id,
                period=plan.period,
                goals=[],
                status=PipStatus.ACTIVE.value,
            ))
            db.flush()
            audit_as(
                db, principal.user,
                "pip_auto_created", "perf_result", result.id,
                after={"employee_id": str(employee_id),
                       "plan_id": str(plan.id)},
            )

    audit_as(
        db, principal.user,
        "perf_plan_published", "perf_plan", plan.id,
        before={"status": PerfPlanStatus.CALIBRATING.value},
        after={"status": plan.status, "writeback": writeback,
               "override_reason": reason,
               "violations": dist["violations"]},
    )
    db.flush()
    return plan


def unpublish(
    db: Session, principal: Principal, plan: PerfPlan
) -> PerfPlan:
    if plan.status != PerfPlanStatus.PUBLISHED.value:
        raise PublishError(
            409, "plan_not_published", "仅已发布方案可撤回"
        )
    before = plan.status
    plan.status = PerfPlanStatus.CALIBRATING.value
    plan.published_at = None
    # 不回滚 perf_grade：等级快照已被下游消费，重新发布会以新结果覆盖
    audit_as(
        db, principal.user,
        "perf_plan_unpublished", "perf_plan", plan.id,
        before={"status": before},
        after={"status": plan.status},
    )
    db.flush()
    return plan
