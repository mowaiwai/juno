"""Task 5：调薪方案端点与审批写薪（AC-5）。"""
from sqlalchemy import select

from app.models.compensation import AdjustmentPlan, SalaryAdjustmentHistory
from app.models.employee import Employee
from app.models.user import Tenant, User
from tests.conftest import auth_header, login


def _tenant_id(db_session, name="星野制造"):
    return db_session.scalar(select(Tenant.id).where(Tenant.name == name))


def _emp_by_no(db_session, tenant_id, no):
    return db_session.scalar(
        select(Employee).where(
            Employee.tenant_id == tenant_id, Employee.employee_no == no
        )
    )


def _create_plan(client, token, items):
    resp = client.post(
        "/api/v1/comp/adjustment-plans",
        headers=auth_header(token),
        json={"plan_name": "2026 调薪", "scope_depts": ["305"], "items": items},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_approve_writes_salary_and_history(client, db_session):
    tid = _tenant_id(db_session)
    hr_token = login(client, "hr@xingye.test")
    exec_token = login(client, "admin@xingye.test")

    e1 = _emp_by_no(db_session, tid, "E10086")
    e2 = _emp_by_no(db_session, tid, "E10091")
    e1.base_salary = 10000
    e2.base_salary = 12000
    db_session.flush()

    items = [
        {"employee_id": str(e1.id), "current_salary": 10000,
         "suggested_pct": 8.0, "suggested_salary": 10800},
        {"employee_id": str(e2.id), "current_salary": 12000,
         "suggested_pct": 5.0, "suggested_salary": 12600},
    ]
    plan = _create_plan(client, hr_token, items)
    plan_id = plan["id"]

    # 微调 e1 涨薪 8% → 10%
    resp = client.patch(
        f"/api/v1/comp/adjustment-plans/{plan_id}",
        headers=auth_header(hr_token),
        json={"employee_id": str(e1.id), "new_pct": 10.0},
    )
    assert resp.status_code == 200
    tuned = resp.json()
    assert tuned["adjustments"] and tuned["adjustments"][0]["old_pct"] == 8.0
    e1_item = next(i for i in tuned["items"] if i["employee_id"] == str(e1.id))
    assert e1_item["suggested_pct"] == 10.0
    assert e1_item["suggested_salary"] == round(10000 * 1.10)

    # 提交审批
    resp = client.post(
        f"/api/v1/comp/adjustment-plans/{plan_id}/submit",
        headers=auth_header(hr_token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "approving"

    # 高管批准
    resp = client.post(
        f"/api/v1/comp/adjustment-plans/{plan_id}/approve",
        headers=auth_header(exec_token),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "approved"

    # base_salary 已更新
    db_session.refresh(e1)
    db_session.refresh(e2)
    assert e1.base_salary == round(10000 * 1.10)
    assert e2.base_salary == 12600

    # 调薪历史留痕
    histories = db_session.scalars(
        select(SalaryAdjustmentHistory).where(
            SalaryAdjustmentHistory.tenant_id == tid
        )
    ).all()
    assert len(histories) == 2
    by_emp = {h.employee_id: h for h in histories}
    assert by_emp[e1.id].old_salary == 10000
    assert by_emp[e1.id].new_salary == round(10000 * 1.10)
    assert by_emp[e1.id].source_type == "adjustment"
    # 回归：operator_id 外键指向 users.id，必须是审批人用户而非员工
    approver = db_session.scalar(select(User).where(User.email == "admin@xingye.test"))
    assert by_emp[e1.id].operator_id == approver.id


def test_reject_returns_to_draft_with_reason(client, db_session):
    tid = _tenant_id(db_session)
    hr_token = login(client, "hr@xingye.test")
    exec_token = login(client, "admin@xingye.test")

    e1 = _emp_by_no(db_session, tid, "E10086")
    e1.base_salary = 10000
    db_session.flush()

    items = [
        {"employee_id": str(e1.id), "current_salary": 10000,
         "suggested_pct": 8.0, "suggested_salary": 10800},
    ]
    plan = _create_plan(client, hr_token, items)
    plan_id = plan["id"]

    client.post(
        f"/api/v1/comp/adjustment-plans/{plan_id}/submit",
        headers=auth_header(hr_token),
    )

    # 过短理由（<5 字）后端拒绝
    bad = client.post(
        f"/api/v1/comp/adjustment-plans/{plan_id}/reject",
        headers=auth_header(exec_token),
        json={"reason": "太短"},
    )
    assert bad.status_code == 422

    resp = client.post(
        f"/api/v1/comp/adjustment-plans/{plan_id}/reject",
        headers=auth_header(exec_token),
        json={"reason": "预算超标，请重测"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "draft"
    assert resp.json()["reject_reason"] == "预算超标，请重测"

    # 驳回后 base_salary 不变
    db_session.refresh(e1)
    assert e1.base_salary == 10000


def test_non_exec_cannot_approve(client, db_session):
    tid = _tenant_id(db_session)
    hr_token = login(client, "hr@xingye.test")

    e1 = _emp_by_no(db_session, tid, "E10086")
    e1.base_salary = 10000
    db_session.flush()

    items = [
        {"employee_id": str(e1.id), "current_salary": 10000,
         "suggested_pct": 8.0, "suggested_salary": 10800},
    ]
    plan = _create_plan(client, hr_token, items)
    plan_id = plan["id"]
    client.post(
        f"/api/v1/comp/adjustment-plans/{plan_id}/submit",
        headers=auth_header(hr_token),
    )

    # HR 无 exec 角色，不能批准
    resp = client.post(
        f"/api/v1/comp/adjustment-plans/{plan_id}/approve",
        headers=auth_header(hr_token),
    )
    assert resp.status_code == 403
