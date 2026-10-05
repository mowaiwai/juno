"""Task 3：考核方案 CRUD、名册圈定、状态机（AC-1 及 AC-2 范围展示部分）。"""
from sqlalchemy import select

from app.models.audit import AuditLog
from app.models.employee import Employee
from app.models.user import Tenant
from tests.conftest import auth_header, login


def _tenant_id(db_session, name="星野制造"):
    return db_session.scalar(select(Tenant.id).where(Tenant.name == name))


def _emp(db_session, no, tenant_name="星野制造"):
    return db_session.scalar(
        select(Employee).where(Employee.employee_no == no)
    )


def _create_plan(client, token, **over):
    payload = {
        "period": "2026H1",
        "tool_type": "kpi",
        "dept_ids": ["305"],
        "sequence_codes": [],
    }
    payload.update(over)
    return client.post(
        "/api/v1/perf/plans", headers=auth_header(token), json=payload
    )


# ---------- TR-3.1 圈定与剔除 ----------

def test_create_plan_dept_subtree_with_exclusion(client, db_session):
    token = login(client, "hr@xingye.test")
    mgr = _emp(db_session, "E10020")
    resp = _create_plan(
        client, token, dept_ids=["300"], exclude_ids=[str(mgr.id)]
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    roster_nos = {m["employee_no"] for m in body["roster_members"]}
    # 研发中心 300 = 305 五人 + 306 一人，剔除经理后 5 人
    assert roster_nos == {
        "E10086", "E10081", "E10091", "E10093", "E10105"
    }
    assert {m["employee_no"] for m in body["excluded_members"]} == {"E10020"}
    assert body["status"] == "draft"
    assert body["scope_depts"] == ["300"]


def test_create_plan_by_sequence(client):
    token = login(client, "hr@xingye.test")
    resp = _create_plan(
        client, token, dept_ids=[], sequence_codes=["SW"]
    )
    assert resp.status_code == 201, resp.text
    assert {m["employee_no"] for m in resp.json()["roster_members"]} == {
        "E10086", "E10081", "E10091", "E10093"
    }


def test_create_plan_union_dept_and_sequence(client):
    token = login(client, "hr@xingye.test")
    resp = _create_plan(
        client, token, dept_ids=["306"], sequence_codes=["SW"]
    )
    assert resp.status_code == 201, resp.text
    assert {m["employee_no"] for m in resp.json()["roster_members"]} == {
        "E10105", "E10086", "E10081", "E10091", "E10093"
    }


def test_create_plan_unknown_dept_404(client):
    token = login(client, "hr@xingye.test")
    resp = _create_plan(client, token, dept_ids=["999"])
    assert resp.status_code == 404
    assert resp.json()["code"] == "dept_not_found"


def test_create_plan_empty_scope_and_empty_roster(client):
    token = login(client, "hr@xingye.test")
    resp = _create_plan(client, token, dept_ids=[], sequence_codes=[])
    assert resp.status_code == 422
    assert resp.json()["code"] == "empty_scope"
    # 401 机加车间无在职员工
    resp2 = _create_plan(client, token, dept_ids=["401"])
    assert resp2.status_code == 422
    assert resp2.json()["code"] == "empty_roster"


def test_create_plan_cross_tenant_dept_404(client):
    # 部门 id 在两租户种子中相同；t2 HR 圈 305 时展开的是 t2 的 305（无人）
    token = login(client, "hr@linyuan.test")
    resp = _create_plan(client, token, dept_ids=["305"])
    assert resp.status_code == 422
    assert resp.json()["code"] == "empty_roster"


# ---------- TR-3.2 状态机 ----------

def test_plan_status_transitions_and_editing_lock(client):
    token = login(client, "hr@xingye.test")
    plan_id = _create_plan(client, token).json()["id"]

    # 非法跳跃 draft → calibrating
    resp = client.post(
        f"/api/v1/perf/plans/{plan_id}/transition",
        headers=auth_header(token),
        json={"to": "calibrating"},
    )
    assert resp.status_code == 409
    assert resp.json()["code"] == "invalid_transition"

    for to in ("evaluating", "calibrating"):
        resp = client.post(
            f"/api/v1/perf/plans/{plan_id}/transition",
            headers=auth_header(token),
            json={"to": to},
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == to

    # 非草稿不可改名册
    resp = client.put(
        f"/api/v1/perf/plans/{plan_id}/roster",
        headers=auth_header(token),
        json={"member_ids": []},
    )
    assert resp.status_code == 409
    assert resp.json()["code"] == "plan_not_editable"

    resp = client.put(
        f"/api/v1/perf/plans/{plan_id}",
        headers=auth_header(token),
        json={"period": "2026H2"},
    )
    assert resp.status_code == 409


def test_roster_replace_draft(client, db_session):
    token = login(client, "hr@xingye.test")
    body = _create_plan(client, token, dept_ids=["300"]).json()
    plan_id = body["id"]
    keep = [
        m["id"] for m in body["roster_members"]
        if m["employee_no"] in ("E10086", "E10105")
    ]
    resp = client.put(
        f"/api/v1/perf/plans/{plan_id}/roster",
        headers=auth_header(token),
        json={"member_ids": keep},
    )
    assert resp.status_code == 200, resp.text
    assert {m["employee_no"] for m in resp.json()["roster_members"]} == {
        "E10086", "E10105"
    }

    # 候选范围外成员（t2 大客户经理）
    outsider = str(_emp(db_session, "E20011").id)
    resp = client.put(
        f"/api/v1/perf/plans/{plan_id}/roster",
        headers=auth_header(token),
        json={"member_ids": keep + [outsider]},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "member_out_of_scope"


def test_clone_plan_creates_draft_copy(client):
    token = login(client, "hr@xingye.test")
    body = _create_plan(client, token, dept_ids=["300"]).json()
    plan_id = body["id"]
    client.post(
        f"/api/v1/perf/plans/{plan_id}/transition",
        headers=auth_header(token), json={"to": "evaluating"},
    )
    resp = client.post(
        f"/api/v1/perf/plans/{plan_id}/clone",
        headers=auth_header(token),
    )
    assert resp.status_code == 201, resp.text
    clone = resp.json()
    assert clone["id"] != plan_id
    assert clone["status"] == "draft"
    roster = {m["employee_no"] for m in clone["roster_members"]}
    assert roster == {m["employee_no"] for m in body["roster_members"]}
    assert clone["result_count"] == 0


# ---------- TR-3.3 权限与跨租户 ----------

def test_manager_and_employee_cannot_manage_plans(client):
    for email in ("manager@xingye.test", "employee@xingye.test"):
        token = login(client, email)
        resp = _create_plan(client, token)
        assert resp.status_code == 403, email


def test_manager_get_detail_is_scope_filtered(client):
    hr = login(client, "hr@xingye.test")
    plan_id = _create_plan(client, hr, dept_ids=["300"]).json()["id"]

    mgr = login(client, "manager@xingye.test")
    resp = client.get(
        f"/api/v1/perf/plans/{plan_id}", headers=auth_header(mgr)
    )
    assert resp.status_code == 200, resp.text
    nos = {m["employee_no"] for m in resp.json()["roster_members"]}
    # 部门领导 305：可见 305 五人，306 的 E10105 不可见
    assert nos == {"E10020", "E10086", "E10081", "E10091", "E10093"}


def test_employee_cannot_get_plan_detail(client):
    hr = login(client, "hr@xingye.test")
    plan_id = _create_plan(client, hr).json()["id"]
    token = login(client, "employee@xingye.test")
    resp = client.get(
        f"/api/v1/perf/plans/{plan_id}", headers=auth_header(token)
    )
    assert resp.status_code == 403


def test_cross_tenant_plan_404(client):
    t1 = login(client, "hr@xingye.test")
    plan_id = _create_plan(client, t1).json()["id"]
    t2 = login(client, "hr@linyuan.test")
    resp = client.get(
        f"/api/v1/perf/plans/{plan_id}", headers=auth_header(t2)
    )
    assert resp.status_code == 404


def test_list_plans_and_audit(client, db_session):
    token = login(client, "hr@xingye.test")
    _create_plan(client, token)
    resp = client.get("/api/v1/perf/plans", headers=auth_header(token))
    assert resp.status_code == 200
    assert any(p["period"] == "2026H1" and p["roster_size"] == 5
               for p in resp.json())

    audits = db_session.scalars(
        select(AuditLog).where(AuditLog.action == "perf_plan_created")
    ).all()
    assert audits and audits[0].after["tool_type"] == "kpi"
