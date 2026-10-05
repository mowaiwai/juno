"""Task 10：权限点与金额掩码（AC-12）。"""
from datetime import datetime

from sqlalchemy import select

from app.models.employee import Employee
from app.models.perf import (
    PerfPlan,
    PerfPlanStatus,
    PerfResult,
    PerfToolType,
)
from app.core.security import hash_password
from app.models.user import Role, Tenant, User
from tests.conftest import TEST_PASSWORD, auth_header, login


def _tenant_id(db_session, name="星野制造"):
    return db_session.scalar(select(Tenant.id).where(Tenant.name == name))


def _emp_by_no(db_session, tenant_id, no):
    return db_session.scalar(
        select(Employee).where(
            Employee.tenant_id == tenant_id, Employee.employee_no == no
        )
    )


def _make_exec_user(db_session, tenant_id):
    u = User(
        tenant_id=tenant_id, email="exec@xingye.test", name="高管线",
        role=Role.EXECUTIVE, roles=["exec"],
        hashed_password=hash_password(TEST_PASSWORD),
    )
    db_session.add(u)
    db_session.flush()
    return u


def test_manager_without_bonus_manage_403(client, db_session):
    tid = _tenant_id(db_session)
    emp = _emp_by_no(db_session, tid, "E10086")
    emp.base_salary = 10000
    db_session.flush()
    plan = PerfPlan(
        tenant_id=tid, period="2026H1", tool_type=PerfToolType.KPI.value,
        status=PerfPlanStatus.PUBLISHED.value, published_at=datetime(2026, 7, 1),
        roster=[emp.id],
    )
    db_session.add(plan)
    db_session.flush()
    db_session.add(PerfResult(
        tenant_id=tid, plan_id=plan.id, employee_id=emp.id,
        grade="A", coefficient=1.2,
    ))
    db_session.flush()

    hr_token = login(client, "hr@xingye.test")
    resp = client.post(
        "/api/v1/comp/bonus-plans", headers=auth_header(hr_token),
        json={"perf_plan_id": str(plan.id), "plan_name": "t", "scope_depts": []},
    )
    bp_id = resp.json()["id"]
    client.post(f"/api/v1/comp/bonus-plans/{bp_id}/calculate", headers=auth_header(hr_token))

    # manager 无 bonus.manage → 403
    mgr_token = login(client, "manager@xingye.test")
    resp = client.get(
        f"/api/v1/comp/bonus-plans/{bp_id}", headers=auth_header(mgr_token)
    )
    assert resp.status_code == 403


def test_exec_sees_masked_amounts(client, db_session):
    tid = _tenant_id(db_session)
    emp = _emp_by_no(db_session, tid, "E10086")
    emp.base_salary = 10000
    db_session.flush()
    plan = PerfPlan(
        tenant_id=tid, period="2026H1", tool_type=PerfToolType.KPI.value,
        status=PerfPlanStatus.PUBLISHED.value, published_at=datetime(2026, 7, 1),
        roster=[emp.id],
    )
    db_session.add(plan)
    db_session.flush()
    db_session.add(PerfResult(
        tenant_id=tid, plan_id=plan.id, employee_id=emp.id,
        grade="A", coefficient=1.2,
    ))
    db_session.commit()

    _make_exec_user(db_session, tid)
    db_session.commit()

    hr_token = login(client, "hr@xingye.test")
    resp = client.post(
        "/api/v1/comp/bonus-plans", headers=auth_header(hr_token),
        json={"perf_plan_id": str(plan.id), "plan_name": "t", "scope_depts": []},
    )
    bp_id = resp.json()["id"]
    client.post(f"/api/v1/comp/bonus-plans/{bp_id}/calculate", headers=auth_header(hr_token))

    exec_token = login(client, "exec@xingye.test")
    # exec 可访问列表（审批入口），manager 403 覆盖于另一条用例
    resp_list = client.get(
        "/api/v1/comp/bonus-plans", headers=auth_header(exec_token)
    )
    assert resp_list.status_code == 200
    assert any(p["id"] == bp_id for p in resp_list.json())

    resp = client.get(
        f"/api/v1/comp/bonus-plans/{bp_id}", headers=auth_header(exec_token)
    )
    assert resp.status_code == 200
    body = resp.json()
    # 汇总可见
    assert body["bonus_pool_total"] > 0
    # 个人金额掩码，但姓名/系数保留
    assert body["items"][0]["final_amount"] is None
    assert body["items"][0]["formula_amount"] is None
    assert body["items"][0]["name"] == "许星遥"
    assert body["items"][0]["perf_coefficient"] == 1.2


def test_tenant_admin_wildcard_sees_masked_amounts(client, db_session):
    """通配管理员能审批，但不精确持薪酬权限点时个人金额必须掩码。"""
    tid = _tenant_id(db_session)
    emp = _emp_by_no(db_session, tid, "E10086")
    emp.base_salary = 10000
    db_session.flush()
    plan = PerfPlan(
        tenant_id=tid, period="2026H1", tool_type=PerfToolType.KPI.value,
        status=PerfPlanStatus.PUBLISHED.value, published_at=datetime(2026, 7, 1),
        roster=[emp.id],
    )
    db_session.add(plan)
    db_session.flush()
    db_session.add(PerfResult(
        tenant_id=tid, plan_id=plan.id, employee_id=emp.id,
        grade="A", coefficient=1.2,
    ))
    db_session.commit()

    hr_token = login(client, "hr@xingye.test")
    bp_id = client.post(
        "/api/v1/comp/bonus-plans", headers=auth_header(hr_token),
        json={"perf_plan_id": str(plan.id), "plan_name": "t", "scope_depts": []},
    ).json()["id"]
    client.post(f"/api/v1/comp/bonus-plans/{bp_id}/calculate", headers=auth_header(hr_token))

    admin_token = login(client, "admin@xingye.test")
    resp = client.get(
        f"/api/v1/comp/bonus-plans/{bp_id}", headers=auth_header(admin_token)
    )
    assert resp.status_code == 200
    item = resp.json()["items"][0]
    assert item["target_bonus"] is None
    assert item["formula_amount"] is None
    assert item["final_amount"] is None
    # 非金额字段保留
    assert item["name"] == "许星遥"
    assert item["perf_coefficient"] == 1.2
