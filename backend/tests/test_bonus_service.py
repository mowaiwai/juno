"""Task 6 & 7：奖金测算服务 + 部门包缩放（AC-6/7/8/9）。"""
from datetime import datetime

from sqlalchemy import select

from app.models.employee import Employee
from app.models.perf import (
    PerfPlan,
    PerfPlanStatus,
    PerfResult,
    PerfToolType,
)
from app.models.user import Tenant
from app.services.bonus import apply_dept_pool_scaling, calculate_bonus_items


def _tenant_id(db_session, name="星野制造"):
    return db_session.scalar(select(Tenant.id).where(Tenant.name == name))


def _emp_by_no(db_session, tenant_id, no):
    return db_session.scalar(
        select(Employee).where(
            Employee.tenant_id == tenant_id, Employee.employee_no == no
        )
    )


def _make_plan(db_session, tenant_id, period, results):
    plan = PerfPlan(
        tenant_id=tenant_id, period=period,
        tool_type=PerfToolType.KPI.value,
        status=PerfPlanStatus.PUBLISHED.value,
        published_at=datetime(2026, 7, 1),
        roster=[e.id for e, _ in results],
    )
    db_session.add(plan)
    db_session.flush()
    for emp, (grade, coef) in results:
        db_session.add(PerfResult(
            tenant_id=tenant_id, plan_id=plan.id, employee_id=emp.id,
            grade=grade, coefficient=coef, org_coefficient=1.0,
        ))
    db_session.flush()
    return plan


def test_target_bonus_equals_months_times_salary(db_session):
    tid = _tenant_id(db_session)
    sw = _emp_by_no(db_session, tid, "E10086")  # SW P3
    mgt = _emp_by_no(db_session, tid, "E10002")  # MGT M3
    sw.base_salary = 10000
    mgt.base_salary = 20000
    db_session.flush()

    plan = _make_plan(db_session, tid, "2026H1", [
        (sw, ("S", 1.5)), (mgt, ("A", 1.2)),
    ])

    result = calculate_bonus_items(db_session, tid, plan.id, [])
    items = {i["employee_no"]: i for i in result["items"]}

    # SW 固浮比 3 月 → 10000×3=30000
    assert items["E10086"]["sequence"] == "SW"
    assert items["E10086"]["target_bonus"] == 30000.0
    # MGT 固浮比 4 月 → 20000×4=80000
    assert items["E10002"]["sequence"] == "MGT"
    assert items["E10002"]["target_bonus"] == 80000.0


def test_formula_amount_with_proration(db_session):
    tid = _tenant_id(db_session)
    emp = _emp_by_no(db_session, tid, "E10086")
    emp.base_salary = 10000
    emp.grade_since = datetime(2026, 4, 1).date()  # 在职 3/6 月
    db_session.flush()

    plan = _make_plan(db_session, tid, "2026H1", [(emp, ("S", 1.5))])

    result = calculate_bonus_items(db_session, tid, plan.id, [], proration_enabled=True)
    item = result["items"][0]
    # 目标=30000，系数=1.5，org=1.0，折算=3/6=0.5 → 30000×1.5×0.5=22500
    assert item["service_months"] == 3.0
    assert item["formula_amount"] == 22500.0


def test_formula_amount_without_proration(db_session):
    tid = _tenant_id(db_session)
    emp = _emp_by_no(db_session, tid, "E10086")
    emp.base_salary = 10000
    emp.grade_since = datetime(2026, 4, 1).date()
    db_session.flush()

    plan = _make_plan(db_session, tid, "2026H1", [(emp, ("S", 1.5))])

    result = calculate_bonus_items(db_session, tid, plan.id, [], proration_enabled=False)
    item = result["items"][0]
    # 折算关闭：30000×1.5×1.0=45000
    assert item["service_months"] is None
    assert item["formula_amount"] == 45000.0


def test_excluded_without_kpi_pbc_result(db_session):
    tid = _tenant_id(db_session)
    emp_in = _emp_by_no(db_session, tid, "E10086")
    emp_out = _emp_by_no(db_session, tid, "E10091")  # 不在方案名册
    emp_in.base_salary = 10000
    emp_out.base_salary = 12000
    db_session.flush()

    plan = _make_plan(db_session, tid, "2026H1", [(emp_in, ("A", 1.2))])

    result = calculate_bonus_items(db_session, tid, plan.id, [])
    in_nos = {i["employee_no"] for i in result["items"]}
    out_nos = {e["employee_no"] for e in result["excluded"]}
    assert "E10086" in in_nos
    assert "E10091" in out_nos
    assert result["excluded"][0]["reason"] == "no_kpi_pbc_result"


def test_dept_pool_scaling(db_session):
    tid = _tenant_id(db_session)
    emp = _emp_by_no(db_session, tid, "E10086")
    emp.base_salary = 10000
    db_session.flush()

    plan = _make_plan(db_session, tid, "2026H1", [(emp, ("S", 1.5))])
    result = calculate_bonus_items(db_session, tid, plan.id, [])
    items = result["items"]
    dept_id = items[0]["dept_id"]
    formula_sum = result["dept_pools"][dept_id]["formula_sum"]

    # 部门包 50000，公式合计 60000 → 缩放比 50000/60000
    scaled = apply_dept_pool_scaling(items, {dept_id: {"pool_amount": 50000, "formula_sum": 60000}})
    assert scaled[0]["scale_ratio"] == round(50000 / 60000, 4)
    assert scaled[0]["final_amount"] == round(scaled[0]["formula_amount"] * (50000 / 60000), 2)
