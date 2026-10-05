"""绩效奖金测算服务（目标奖金 / 公式 / 折算 / 部门包缩放）。"""

import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.compensation import TenantSalaryBand
from app.models.employee import Employee
from app.models.perf import PerfPlan, PerfResult
from app.services.comp_rules import pay_mix_months, resolve_comp_rules
from app.services.money import money, ratio4
from app.services.scope import dept_subtree


def _period_bounds(period: str) -> tuple[int, int, int]:
    """返回 (year, start_month, end_month)。"""
    p = period.upper()
    try:
        year = int(period[:4])
    except (ValueError, IndexError):
        return 2026, 1, 12
    if "H1" in p:
        return year, 1, 6
    if "H2" in p:
        return year, 7, 12
    if "Q1" in p:
        return year, 1, 3
    if "Q2" in p:
        return year, 4, 6
    if "Q3" in p:
        return year, 7, 9
    if "Q4" in p:
        return year, 10, 12
    return year, 1, 12


def period_months(period: str) -> int:
    """解析周期字符串为月数：2026H1→6、2026Q1→3、2026→12。"""
    _, s, e = _period_bounds(period)
    return e - s + 1


def _service_months(grade_since, period: str, period_months: int) -> float:
    """员工在周期内的在职月数（含起始月），截断到 [0, period_months]。"""
    if grade_since is None:
        return float(period_months)
    year, start_m, end_m = _period_bounds(period)
    # 在职起始月：若入职早于周期开始，取周期开始月
    if grade_since.year < year or (
        grade_since.year == year and grade_since.month < start_m
    ):
        from_m = start_m
        from_y = year
    else:
        from_m = grade_since.month
        from_y = grade_since.year
    months = (year - from_y) * 12 + (end_m - from_m) + 1
    return max(0.0, min(float(period_months), float(months)))


def calculate_bonus_items(
    db: Session,
    tenant_id,
    perf_plan_id,
    scope_depts: list[str],
    rules: dict | None = None,
    proration_enabled: bool = True,
) -> dict:
    """生成奖金测算明细（未缩放）。

    返回:
      {
        "items": [{employee_id, name, employee_no, dept_id, sequence,
                   target_bonus, perf_coefficient, org_coefficient,
                   service_months, formula_amount}],
        "excluded": [{employee_id, name, employee_no, reason}],
        "dept_pools": {dept_id: {target_sum, formula_sum, headcount}},
      }
    """
    if rules is None:
        rules = resolve_comp_rules(db, tenant_id)

    plan = db.scalar(
        select(PerfPlan).where(
            PerfPlan.id == perf_plan_id, PerfPlan.tenant_id == tenant_id
        )
    )
    if plan is None:
        return {"items": [], "excluded": [], "dept_pools": {}}

    period_months_total = period_months(plan.period)

    # 取该方案的绩效结果
    results = {
        r.employee_id: r
        for r in db.scalars(select(PerfResult).where(PerfResult.plan_id == plan.id)).all()
    }

    visible_depts = dept_subtree(db, tenant_id, scope_depts) if scope_depts else None
    stmt = select(Employee).where(
        Employee.tenant_id == tenant_id,
        Employee.is_active.is_(True),
        Employee.base_salary.isnot(None),
    )
    if visible_depts is not None:
        stmt = stmt.where(Employee.dept_id.in_(visible_depts))
    employees = db.scalars(stmt).all()

    items = []
    excluded = []
    dept_pools: dict = {}

    for emp in employees:
        result = results.get(emp.id)
        if result is None:
            excluded.append({
                "employee_id": str(emp.id), "name": emp.name,
                "employee_no": emp.employee_no, "reason": "no_kpi_pbc_result",
            })
            continue
        target = float(pay_mix_months(rules, emp.sequence)) * float(emp.base_salary)
        perf_coef = float(result.coefficient)
        org_coef = float(result.org_coefficient or 1.0)
        if proration_enabled:
            svc = _service_months(emp.grade_since, plan.period, period_months_total)
            proration = svc / period_months_total if period_months_total > 0 else 1.0
        else:
            svc = None
            proration = 1.0
        formula = target * perf_coef * org_coef * proration
        item = {
            "employee_id": str(emp.id),
            "name": emp.name,
            "employee_no": emp.employee_no,
            "dept_id": emp.dept_id,
            "sequence": emp.sequence,
            "target_bonus": money(target),
            "perf_coefficient": perf_coef,
            "org_coefficient": org_coef,
            "service_months": svc,
            "formula_amount": money(formula),
        }
        items.append(item)
        pool = dept_pools.setdefault(
            emp.dept_id, {"target_sum": Decimal("0"), "formula_sum": Decimal("0"), "headcount": 0}
        )
        pool["target_sum"] += Decimal(str(target))
        pool["formula_sum"] += Decimal(str(formula))
        pool["headcount"] += 1

    # 合计在 Decimal 上一次性四舍五入到分，避免逐行累加误差
    for pool in dept_pools.values():
        pool["target_sum"] = money(pool["target_sum"])
        pool["formula_sum"] = money(pool["formula_sum"])

    return {"items": items, "excluded": excluded, "dept_pools": dept_pools}


def apply_dept_pool_scaling(items: list[dict], dept_pools: dict) -> list[dict]:
    """按部门包额等比缩放，回填 scale_ratio + final_amount。

    dept_pools: {dept_id: {pool_amount, formula_sum}}
    """
    for it in items:
        pool = dept_pools.get(it["dept_id"])
        if pool and pool.get("formula_sum", 0) > 0:
            ratio = float(pool["pool_amount"]) / float(pool["formula_sum"])
        else:
            ratio = 1.0
        it["scale_ratio"] = ratio4(ratio)
        it["final_amount"] = money(Decimal(str(it["formula_amount"])) * Decimal(str(ratio)))
    return items
