"""Task 9：我的薪酬端点（AC-11）。"""
from datetime import datetime

from sqlalchemy import select

from app.models.compensation import BonusPlan, BonusPlanItem, BonusPlanStatus
from app.models.employee import Employee
from app.models.perf import (
    PerfPlan,
    PerfPlanStatus,
    PerfResult,
    PerfToolType,
)
from app.models.user import Tenant
from tests.conftest import auth_header, login


def _tenant_id(db_session, name="星野制造"):
    return db_session.scalar(select(Tenant.id).where(Tenant.name == name))


def _emp_by_no(db_session, tenant_id, no):
    return db_session.scalar(
        select(Employee).where(
            Employee.tenant_id == tenant_id, Employee.employee_no == no
        )
    )


def test_my_salary_returns_base_salary_and_approved_bonus(client, db_session):
    tid = _tenant_id(db_session)
    emp = _emp_by_no(db_session, tid, "E10086")
    emp.base_salary = 12000
    db_session.flush()

    # 建一个已发布 KPI 方案 + 结果
    plan = PerfPlan(
        tenant_id=tid, period="2026H1", tool_type=PerfToolType.KPI.value,
        status=PerfPlanStatus.PUBLISHED.value, published_at=datetime(2026, 7, 1),
        roster=[emp.id],
    )
    db_session.add(plan)
    db_session.flush()
    db_session.add(PerfResult(
        tenant_id=tid, plan_id=plan.id, employee_id=emp.id,
        grade="A", coefficient=1.2, org_coefficient=1.0,
    ))
    db_session.flush()

    # 建一个 archived 奖金方案 + 本人 item
    bp = BonusPlan(
        tenant_id=tid, perf_plan_id=plan.id, plan_name="2026H1",
        bonus_pool_total=36000, status=BonusPlanStatus.ARCHIVED.value,
    )
    db_session.add(bp)
    db_session.flush()
    db_session.add(BonusPlanItem(
        tenant_id=tid, plan_id=bp.id, employee_id=emp.id,
        target_bonus=36000, perf_coefficient=1.2, org_coefficient=1.0,
        formula_amount=43200, scale_ratio=1.0, final_amount=43200,
    ))
    db_session.commit()

    token = login(client, "employee@xingye.test")
    resp = client.get("/api/v1/comp/my-salary", headers=auth_header(token))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["base_salary"] == 12000
    assert body["approved_bonuses"]
    assert body["approved_bonuses"][0]["final_amount"] == 43200.0
    assert body["approved_bonuses"][0]["plan_name"] == "2026H1"
    # FR-11：奖金发放记录带周期/工具/绩效等级
    assert body["approved_bonuses"][0]["period"] == "2026H1"
    assert body["approved_bonuses"][0]["tool_type"] == PerfToolType.KPI.value
    assert body["approved_bonuses"][0]["perf_grade"] == "A"
