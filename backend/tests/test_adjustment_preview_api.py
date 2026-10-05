"""Task A1：调薪测算预览端点 + exec 可见性/掩码 + manager 403。"""
from datetime import datetime

from sqlalchemy import select

from app.core.security import hash_password
from app.models.employee import Employee
from app.models.perf import (
    PerfPlan,
    PerfPlanStatus,
    PerfResult,
    PerfToolType,
)
from app.models.user import Role, Tenant, User
from tests.conftest import TEST_PASSWORD, auth_header, login


def _tenant_id(db_session, name="星野制造"):
    from app.models.user import Tenant
    return db_session.scalar(select(Tenant.id).where(Tenant.name == name))


def _emp_by_no(db_session, tenant_id, no):
    return db_session.scalar(
        select(Employee).where(
            Employee.tenant_id == tenant_id, Employee.employee_no == no
        )
    )


def _setup_published(db_session, tid):
    emp = _emp_by_no(db_session, tid, "E10086")  # SW P3
    emp.base_salary = 19600  # 渗透率 0.30
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
        grade="S", coefficient=1.5,
    ))
    db_session.flush()
    return emp


def test_preview_returns_matrix_suggestions(client, db_session):
    tid = _tenant_id(db_session)
    _setup_published(db_session, tid)
    db_session.commit()

    token = login(client, "hr@xingye.test")
    resp = client.post(
        "/api/v1/comp/adjustment-plans/preview",
        headers=auth_header(token),
        json={"scope_depts": ["305"]},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["headcount"] >= 1
    item = next(i for i in body["items"] if i["employee_no"] == "E10086")
    assert item["perf_grade"] == "S"
    assert item["adjust_pct"] == 8.0
    assert item["new_salary"] == round(19600 * 1.08)
    assert item["delta"] == round(19600 * 0.08)
    assert body["budget_total"] == sum(i["delta"] for i in body["items"])


def test_preview_forbidden_for_manager(client):
    token = login(client, "manager@xingye.test")
    resp = client.post(
        "/api/v1/comp/adjustment-plans/preview",
        headers=auth_header(token),
        json={"scope_depts": []},
    )
    assert resp.status_code == 403


def test_exec_sees_adjustment_plan_with_masked_amounts(client, db_session):
    tid = _tenant_id(db_session)
    emp = _setup_published(db_session, tid)

    u = User(
        tenant_id=tid, email="exec2@xingye.test", name="高管线2",
        role=Role.EXECUTIVE, roles=["exec"],
        hashed_password=hash_password(TEST_PASSWORD),
    )
    db_session.add(u)
    db_session.commit()

    hr_token = login(client, "hr@xingye.test")
    # 用预览结果建方案
    preview = client.post(
        "/api/v1/comp/adjustment-plans/preview",
        headers=auth_header(hr_token), json={"scope_depts": ["305"]},
    ).json()
    item = next(i for i in preview["items"] if i["employee_no"] == "E10086")
    created = client.post(
        "/api/v1/comp/adjustment-plans",
        headers=auth_header(hr_token),
        json={
            "plan_name": "2026 调薪",
            "scope_depts": ["305"],
            "items": [{
                "employee_id": item["employee_id"],
                "current_salary": item["base_salary"],
                "suggested_pct": item["adjust_pct"],
                "suggested_salary": item["new_salary"],
                "mark": item["mark"],
                "name": item["name"],
                "employee_no": item["employee_no"],
                "grade": item["grade"],
                "perf_grade": item["perf_grade"],
                "penetration": item["penetration"],
                "delta": item["delta"],
            }],
        },
    )
    assert created.status_code == 200
    plan_id = created.json()["id"]

    # exec 列表可见，含汇总预算
    exec_token = login(client, "exec2@xingye.test")
    resp = client.get("/api/v1/comp/adjustment-plans", headers=auth_header(exec_token))
    assert resp.status_code == 200
    listed = next(p for p in resp.json() if p["id"] == plan_id)
    assert listed["budget_total"] == item["delta"]

    # exec 详情：个人金额掩码，百分比/姓名保留
    resp = client.get(
        f"/api/v1/comp/adjustment-plans/{plan_id}", headers=auth_header(exec_token)
    )
    assert resp.status_code == 200
    detail = resp.json()
    row = next(i for i in detail["items"] if i["employee_id"] == str(emp.id))
    assert row["current_salary"] is None
    assert row["suggested_salary"] is None
    assert row["delta"] is None
    assert row["suggested_pct"] == 8.0
    assert row["name"] == "许星遥"

    # HR 看得到金额
    resp = client.get(
        f"/api/v1/comp/adjustment-plans/{plan_id}", headers=auth_header(hr_token)
    )
    row = next(i for i in resp.json()["items"] if i["employee_id"] == str(emp.id))
    assert row["current_salary"] == 19600
