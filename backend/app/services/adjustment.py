"""年度调薪测算服务（矩阵 × 渗透率 + 市场分位停涨 + PIP 降薪联动）。"""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.compensation import TenantSalaryBand
from app.models.employee import Employee
from app.models.perf import (
    PerfPlan,
    PerfPlanStatus,
    PerfResult,
    PerfToolType,
    Pip,
    PipStatus,
)
from app.services.comp_rules import (
    hits_market_stop,
    penetration_rate,
    resolve_comp_rules,
    suggest_adjust_pct,
)
from app.services.grade_catalog import DEFAULT_BANDS
from app.services.money import yuan
from app.services.scope import dept_subtree

# 仅 KPI/PBC 方案的发布结果回写为绩效等级（P1 WRITEBACK_TOOLS）
_WRITEBACK_TOOLS = (PerfToolType.KPI.value, PerfToolType.PBC.value)


def latest_published_plan_grades(db: Session, tenant_id) -> tuple[dict, set[str]]:
    """取最新已发布 KPI/PBC 方案的结果。

    返回 ({employee_id: perf_grade}, 提供结果的方案周期集合)。
    """
    plans = db.scalars(
        select(PerfPlan).where(
            PerfPlan.tenant_id == tenant_id,
            PerfPlan.status == PerfPlanStatus.PUBLISHED.value,
            PerfPlan.tool_type.in_(_WRITEBACK_TOOLS),
        ).order_by(PerfPlan.published_at.desc())
    ).all()
    if not plans:
        return {}, set()
    # 最新方案优先；同一员工只取最新方案的结果
    result: dict = {}
    seen_emps: set = set()
    periods: set[str] = set()
    for plan in plans:
        rows = db.scalars(
            select(PerfResult).where(PerfResult.plan_id == plan.id)
        ).all()
        used = False
        for r in rows:
            if r.employee_id not in seen_emps:
                result[r.employee_id] = r.grade
                seen_emps.add(r.employee_id)
                used = True
        if used:
            periods.add(plan.period)
    return result, periods


def failed_pip_employees(db: Session, tenant_id, periods: set[str]) -> set:
    """本期有 PIP 结论为不通过（failed）的员工 id 集合。

    仅统计测算消费周期内的 PIP，历史周期旧 PIP 不永久触发降薪。
    """
    if not periods:
        return set()
    rows = db.scalars(
        select(Pip).where(
            Pip.tenant_id == tenant_id,
            Pip.status == PipStatus.FAILED.value,
            Pip.period.in_(periods),
        )
    ).all()
    return {r.employee_id for r in rows}


def _band_for_grade(db: Session, tenant_id, grade: str):
    """返回 (band_row|None, min, max, market_values)。

    租户职级带宽行优先（含市场分位）；缺失时回落平台默认带宽（无市场数据）。
    """
    row = db.scalar(
        select(TenantSalaryBand).where(
            TenantSalaryBand.tenant_id == tenant_id,
            TenantSalaryBand.grade == grade,
        )
    )
    if row is not None:
        return row, row.min_value, row.max_value, row
    band = DEFAULT_BANDS.get(grade)
    if band:
        return None, band[0], band[1], None
    return None, None, None, None


def calculate_adjustments(
    db: Session,
    tenant_id,
    scope_dept_ids: list[str],
    rules: dict | None = None,
) -> dict:
    """生成调薪建议清单。

    返回:
      {
        "items": [{employee_id, name, employee_no, grade, sequence,
                   base_salary, perf_grade, penetration, adjust_pct,
                   new_salary, delta, mark}],
        "budget_total": 总调薪金额（元）,
        "headcount": 涉及人数,
      }
    """
    if rules is None:
        rules = resolve_comp_rules(db, tenant_id)
    stop_key = rules.get("market_stop", "p75")

    visible_depts = dept_subtree(db, tenant_id, scope_dept_ids) if scope_dept_ids else None

    stmt = select(Employee).where(
        Employee.tenant_id == tenant_id,
        Employee.is_active.is_(True),
        Employee.base_salary.isnot(None),
    )
    if visible_depts is not None:
        stmt = stmt.where(Employee.dept_id.in_(visible_depts))
    employees = db.scalars(stmt).all()

    grades, periods = latest_published_plan_grades(db, tenant_id)
    failed_pips = failed_pip_employees(db, tenant_id, periods)

    items = []
    budget = Decimal("0")
    for emp in employees:
        perf_grade = grades.get(emp.id)
        if perf_grade is None:
            # 无已发布绩效结果的员工不纳入调薪建议
            continue
        _, min_v, max_v, market = _band_for_grade(db, tenant_id, emp.grade)
        if min_v is None:
            continue
        penetration = penetration_rate(emp.base_salary, min_v, max_v)
        pip_failed = perf_grade == "D" and emp.id in failed_pips
        pct, mark = suggest_adjust_pct(rules, perf_grade, penetration, pip_failed)
        # 75 市场分位停涨：矩阵计算之后的硬覆写（ADR-0016 §4）
        stop_value = getattr(market, stop_key, None) if market is not None else None
        if not pip_failed and hits_market_stop(emp.base_salary, stop_value):
            pct, mark = 0.0, "market_stop"
        new_salary = yuan(emp.base_salary * (1 + pct / 100))
        delta = new_salary - emp.base_salary
        budget += Decimal(delta)
        items.append({
            "employee_id": str(emp.id),
            "name": emp.name,
            "employee_no": emp.employee_no,
            "grade": emp.grade,
            "sequence": emp.sequence,
            "dept_id": emp.dept_id,
            "base_salary": emp.base_salary,
            "perf_grade": perf_grade,
            "penetration": round(penetration, 4),
            "adjust_pct": pct,
            "new_salary": new_salary,
            "delta": delta,
            "mark": mark,
        })

    return {
        "items": items,
        "budget_total": float(budget),
        "headcount": len(items),
    }
