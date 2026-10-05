"""Task 4：年度调薪测算服务（矩阵 + 市场分位停涨 + PIP 降薪联动）。"""
from datetime import date, datetime

from sqlalchemy import select

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
from app.models.user import Tenant
from app.services.adjustment import calculate_adjustments


def _tenant_id(db_session, name="星野制造"):
    return db_session.scalar(select(Tenant.id).where(Tenant.name == name))


def _emp_by_no(db_session, tenant_id, no):
    return db_session.scalar(
        select(Employee).where(
            Employee.tenant_id == tenant_id, Employee.employee_no == no
        )
    )


def _published_plan_with_results(db_session, tenant_id, results: list[tuple]):
    """results: [(employee, grade), ...]"""
    plan = PerfPlan(
        tenant_id=tenant_id,
        period="2026H1",
        tool_type=PerfToolType.KPI.value,
        status=PerfPlanStatus.PUBLISHED.value,
        published_at=datetime(2026, 7, 1),
        roster=[e.id for e, _ in results],
    )
    db_session.add(plan)
    db_session.flush()
    for emp, grade in results:
        db_session.add(PerfResult(
            tenant_id=tenant_id, plan_id=plan.id, employee_id=emp.id,
            grade=grade, coefficient=1.0,
        ))
    db_session.flush()
    return plan


def test_matrix_lookup_and_market_stop(db_session):
    tid = _tenant_id(db_session)
    emp_s = _emp_by_no(db_session, tid, "E10086")  # P3
    emp_a = _emp_by_no(db_session, tid, "E10091")  # P2

    # P3 带宽 [16000, 28000]，市场 P75=25000；现薪 19600 → 渗透率 0.30
    # P2 带宽 [8000, 14000]，市场 P75=13000
    db_session.add(TenantSalaryBand(
        tenant_id=tid, grade="P3",
        min_value=16000, max_value=28000,
        p25=15200, p50=22000, p75=25000, p90=29400,
        market_source_year=2026,
    ))
    db_session.add(TenantSalaryBand(
        tenant_id=tid, grade="P2",
        min_value=8000, max_value=14000,
        p25=9000, p50=11000, p75=13000, p90=13800,
        market_source_year=2026,
    ))
    emp_s.base_salary = 19600
    # 渗透率 0.75（旧规则会误停涨）但现薪 12500 < 市场 P75 13000 → 不停涨
    emp_a.base_salary = 12500
    db_session.flush()

    _published_plan_with_results(
        db_session, tid, [(emp_s, "S"), (emp_a, "A")]
    )

    result = calculate_adjustments(db_session, tid, ["305"])
    items = {i["employee_no"]: i for i in result["items"]}

    # S 档 <0.40 → 矩阵 S[0]=8%
    assert items["E10086"]["perf_grade"] == "S"
    assert items["E10086"]["penetration"] == 0.3
    assert items["E10086"]["adjust_pct"] == 8.0
    assert items["E10086"]["new_salary"] == 21168
    assert items["E10086"]["mark"] is None

    # A 档渗透率 0.75 但未达市场 P75 → 落 0.70–0.90 档 → 8%，不停涨
    assert items["E10091"]["perf_grade"] == "A"
    assert items["E10091"]["adjust_pct"] == 8.0
    assert items["E10091"]["mark"] is None

    # 现薪提到 13700（≥ P75 13000）→ 硬覆写 0% + market_stop 标记
    emp_a.base_salary = 13700
    db_session.flush()
    result2 = calculate_adjustments(db_session, tid, ["305"])
    items2 = {i["employee_no"]: i for i in result2["items"]}
    assert items2["E10091"]["adjust_pct"] == 0.0
    assert items2["E10091"]["mark"] == "market_stop"


def test_no_market_data_means_no_stop(db_session):
    """无租户市场分位数据时，即使渗透率高也不停涨（不误伤）。"""
    tid = _tenant_id(db_session)
    emp_a = _emp_by_no(db_session, tid, "E10091")  # P2，无 TenantSalaryBand
    emp_a.base_salary = 13700  # 渗透率 0.95
    db_session.flush()
    _published_plan_with_results(db_session, tid, [(emp_a, "A")])
    result = calculate_adjustments(db_session, tid, ["305"])
    item = next(i for i in result["items"] if i["employee_no"] == "E10091")
    assert item["adjust_pct"] == 10.0  # A 档 ≥0.90 → 10%
    assert item["mark"] is None


def test_d_pip_fail_pay_cut_vs_d_no_pip(db_session):
    tid = _tenant_id(db_session)
    emp_d_fail = _emp_by_no(db_session, tid, "E10086")  # P3
    emp_d_pass = _emp_by_no(db_session, tid, "E10091")  # P2

    emp_d_fail.base_salary = 20000
    emp_d_pass.base_salary = 10000
    db_session.flush()

    plan = _published_plan_with_results(
        db_session, tid, [(emp_d_fail, "D"), (emp_d_pass, "D")]
    )

    # D + PIP 不通过
    db_session.add(Pip(
        tenant_id=tid, employee_id=emp_d_fail.id,
        perf_result_id=None, period="2026H1",
        status=PipStatus.FAILED.value, conclusion="不通过",
    ))
    db_session.flush()

    result = calculate_adjustments(db_session, tid, ["305"])
    items = {i["employee_no"]: i for i in result["items"]}

    # D + PIP 不通过 → -10%
    assert items["E10086"]["perf_grade"] == "D"
    assert items["E10086"]["adjust_pct"] == -10.0
    assert items["E10086"]["mark"] == "pip_fail"
    assert items["E10086"]["new_salary"] == round(20000 * 0.9)

    # D 无 PIP → 0% 冻结
    assert items["E10091"]["perf_grade"] == "D"
    assert items["E10091"]["adjust_pct"] == 0.0
    assert items["E10091"]["mark"] is None


def test_stale_period_failed_pip_not_triggered(db_session):
    """历史周期的 failed PIP 不对本期 D 永久触发降薪。"""
    tid = _tenant_id(db_session)
    emp = _emp_by_no(db_session, tid, "E10086")  # P3
    emp.base_salary = 20000
    db_session.flush()
    _published_plan_with_results(db_session, tid, [(emp, "D")])
    db_session.add(Pip(
        tenant_id=tid, employee_id=emp.id,
        perf_result_id=None, period="2025H2",
        status=PipStatus.FAILED.value, conclusion="不通过",
    ))
    db_session.flush()

    result = calculate_adjustments(db_session, tid, ["305"])
    item = next(i for i in result["items"] if i["employee_no"] == "E10086")
    assert item["adjust_pct"] == 0.0
    assert item["mark"] is None


def test_budget_total_and_skip_no_perf_result(db_session):
    tid = _tenant_id(db_session)
    emp = _emp_by_no(db_session, tid, "E10086")
    emp.base_salary = 19600
    db_session.flush()

    # 只给一名员工建已发布结果
    _published_plan_with_results(db_session, tid, [(emp, "S")])

    result = calculate_adjustments(db_session, tid, ["305"])
    # E10086 涨 8%：19600*0.08 = 1568
    assert result["headcount"] >= 1
    s_item = next(i for i in result["items"] if i["employee_no"] == "E10086")
    assert s_item["delta"] == round(19600 * 0.08)
    # 总预算为各行 delta 之和
    assert result["budget_total"] == sum(i["delta"] for i in result["items"])
