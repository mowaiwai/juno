"""Task 8：越权与多租户隔离矩阵（AC-15 / TR-8.1）。

- 跨租户访问任何 t1 资源：404（不泄漏存在性）
- 主管跨数据范围枚举他人结果：404 / 列表中不出现
- 无权限点角色：403
- 员工枚举他人 PIP/辅导：404；员工列表无绩效明文
"""
from sqlalchemy import select

from app.models.employee import Employee
from tests.conftest import auth_header, login


def _emp(db_session, no):
    return db_session.scalar(
        select(Employee).where(Employee.employee_no == no)
    )


def _make_plan(client, token, dept_ids=("305",), period="2026H1"):
    resp = client.post(
        "/api/v1/perf/plans",
        headers=auth_header(token),
        json={"period": period, "tool_type": "kpi",
              "dept_ids": list(dept_ids), "sequence_codes": []},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _pip_for(client, hr, emp_no, db_session):
    emp = _emp(db_session, emp_no)
    resp = client.post(
        "/api/v1/perf/pips",
        headers=auth_header(hr),
        json={"employee_id": str(emp.id), "period": "2026H1"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


# ---------- 跨租户：t2 HR 打 t1 资源全部 404 ----------

def test_cross_tenant_all_plan_routes_404(client, db_session):
    hr = login(client, "hr@xingye.test")
    plan_id = _make_plan(client, hr)
    h2 = auth_header(login(client, "hr@linyuan.test"))

    assert client.get(f"/api/v1/perf/plans/{plan_id}", headers=h2).status_code == 404
    assert client.put(
        f"/api/v1/perf/plans/{plan_id}", headers=h2,
        json={"period": "x"},
    ).status_code == 404
    assert client.put(
        f"/api/v1/perf/plans/{plan_id}/roster", headers=h2,
        json={"member_ids": []},
    ).status_code == 404
    assert client.post(
        f"/api/v1/perf/plans/{plan_id}/transition", headers=h2,
        json={"to": "evaluating"},
    ).status_code == 404
    assert client.post(
        f"/api/v1/perf/plans/{plan_id}/clone", headers=h2, json={},
    ).status_code == 404
    assert client.get(
        f"/api/v1/perf/plans/{plan_id}/distribution", headers=h2,
    ).status_code == 404
    assert client.post(
        f"/api/v1/perf/plans/{plan_id}/publish", headers=h2, json={},
    ).status_code == 404
    assert client.post(
        f"/api/v1/perf/plans/{plan_id}/unpublish", headers=h2,
    ).status_code == 404
    assert client.post(
        f"/api/v1/perf/plans/{plan_id}/import", headers=h2,
        json={"items": [{"employee_no": "E10086", "grade": "B", "score": 85}]},
    ).status_code == 404
    assert client.get(
        f"/api/v1/perf/plans/{plan_id}/results", headers=h2,
    ).status_code == 404

    target = _emp(db_session, "E10086")
    assert client.put(
        f"/api/v1/perf/plans/{plan_id}/results/{target.id}", headers=h2,
        json={"employee_id": str(target.id), "grade": "B",
              "score": 85, "evidence": []},
    ).status_code == 404


def test_cross_tenant_pip_and_coaching_404(client, db_session):
    hr = login(client, "hr@xingye.test")
    pip_id = _pip_for(client, hr, "E10086", db_session)
    target = _emp(db_session, "E10086")
    h2 = auth_header(login(client, "hr@linyuan.test"))

    assert client.put(
        f"/api/v1/perf/pips/{pip_id}", headers=h2, json={"goals": ["x"]},
    ).status_code == 404
    assert client.post(
        f"/api/v1/perf/pips/{pip_id}/conclusion", headers=h2,
        json={"result": "passed"},
    ).status_code == 404
    assert client.post(
        "/api/v1/perf/pips", headers=h2,
        json={"employee_id": str(target.id), "period": "2026H1"},
    ).status_code == 404
    assert client.get(
        f"/api/v1/perf/coaching?employee_id={target.id}", headers=h2,
    ).status_code == 404

    # t2 看板为空，枚举不到 t1 PIP
    lst = client.get("/api/v1/perf/pips", headers=h2)
    assert lst.status_code == 200
    assert lst.json() == []


# ---------- 主管跨数据范围：404 / 不出现在列表 ----------

def test_manager_out_of_scope_result_404(client, db_session):
    hr_token = login(client, "hr@xingye.test")
    plan_id = _make_plan(client, hr_token, dept_ids=("300",))  # 含 306 E10105
    other_id = _make_plan(client, hr_token, dept_ids=("306",), period="2026Q3")
    client.post(
        f"/api/v1/perf/plans/{plan_id}/transition",
        headers=auth_header(hr_token), json={"to": "evaluating"},
    )
    mgr = auth_header(login(client, "manager@xingye.test"))

    # 列表：交集方案可见，纯外部门方案不可见
    lst = client.get("/api/v1/perf/plans", headers=mgr)
    assert lst.status_code == 200
    ids = {p["id"] for p in lst.json()}
    assert plan_id in ids and other_id not in ids

    detail = client.get(f"/api/v1/perf/plans/{plan_id}", headers=mgr)
    assert detail.status_code == 200
    member_nos = {m["employee_no"] for m in detail.json()["roster_members"]}
    assert "E10105" not in member_nos
    assert "E10086" in member_nos

    out_emp = _emp(db_session, "E10105")
    put = client.put(
        f"/api/v1/perf/plans/{plan_id}/results/{out_emp.id}", headers=mgr,
        json={"employee_id": str(out_emp.id), "grade": "B",
              "score": 85, "evidence": []},
    )
    assert put.status_code == 404

    got = client.get(f"/api/v1/perf/plans/{plan_id}/results", headers=mgr)
    assert got.status_code == 200
    assert all(r["employee_id"] != str(out_emp.id) for r in got.json())

    # 辅导：306 员工不可写不可枚举
    coach = client.post(
        "/api/v1/perf/coaching", headers=mgr,
        json={"employee_id": str(out_emp.id), "content": "x",
              "happened_at": "2026-03-10"},
    )
    assert coach.status_code == 404


# ---------- 无权限点角色：403 ----------

def test_employee_role_forbidden_matrix(client, db_session):
    emp = auth_header(login(client, "employee@xingye.test"))
    hr = login(client, "hr@xingye.test")
    plan_id = _make_plan(client, hr)
    target = _emp(db_session, "E10086")

    assert client.put(
        "/api/v1/perf/constants", headers=emp,
        json={"s_min_ratio": 0.01},
    ).status_code == 403
    assert client.post(
        "/api/v1/perf/plans", headers=emp,
        json={"period": "x", "tool_type": "kpi", "dept_ids": ["305"]},
    ).status_code == 403
    assert client.get("/api/v1/perf/plans", headers=emp).status_code == 403
    assert client.put(
        f"/api/v1/perf/plans/{plan_id}/results", headers=emp,
        json={"items": [{"employee_id": str(target.id), "grade": "B",
                         "score": 85, "evidence": []}]},
    ).status_code == 403
    assert client.get(
        f"/api/v1/perf/plans/{plan_id}/distribution", headers=emp,
    ).status_code == 403
    assert client.post(
        f"/api/v1/perf/plans/{plan_id}/publish", headers=emp, json={},
    ).status_code == 403
    assert client.post(
        f"/api/v1/perf/plans/{plan_id}/import", headers=emp,
        json={"items": [{"employee_no": "E10086", "grade": "B"}]},
    ).status_code == 403
    assert client.get("/api/v1/perf/pips", headers=emp).status_code == 403
    assert client.post(
        "/api/v1/perf/pips", headers=emp,
        json={"employee_id": str(target.id), "period": "2026H1"},
    ).status_code == 403

    # 自助入口对全员开放
    assert client.get("/api/v1/perf/me", headers=emp).status_code == 200


def test_manager_cannot_coe_actions(client, db_session):
    hr = login(client, "hr@xingye.test")
    plan_id = _make_plan(client, hr)
    pip_id = _pip_for(client, hr, "E10086", db_session)
    mgr = auth_header(login(client, "manager@xingye.test"))

    assert client.put(
        "/api/v1/perf/constants", headers=mgr, json={},
    ).status_code == 403
    assert client.get(
        f"/api/v1/perf/plans/{plan_id}/distribution", headers=mgr,
    ).status_code == 403
    assert client.post(
        f"/api/v1/perf/plans/{plan_id}/publish", headers=mgr, json={},
    ).status_code == 403
    assert client.post(
        f"/api/v1/perf/plans/{plan_id}/import", headers=mgr,
        json={"items": []},
    ).status_code in (403, 422)  # 守卫先于 body 校验时 403
    assert client.put(
        f"/api/v1/perf/pips/{pip_id}", headers=mgr, json={"goals": ["x"]},
    ).status_code == 403


# ---------- 无绩效查看权角色拿不到 perf_grade 明文 ----------

def test_employee_directory_masks_perf_grade(client, db_session):
    """有名册查看权但无 employee.field.perf.view（SSC 式角色）：等级全掩码。"""
    from app.models.role_def import TenantRole
    from app.models.user import User, custom_role_ref
    from app.services.role_service import grant_role, set_active_role

    t1 = db_session.scalar(
        select(User).where(User.email == "junior@xingye.test")
    )
    original_ref = t1.active_role_ref
    original_roles = list(t1.roles or [])
    masked_role = TenantRole(
        tenant_id=t1.tenant_id,
        name="临时只读名册",
        scope_type="global",
        permissions=["employee.view"],
        cloned_from="ssc",
    )
    db_session.add(masked_role)
    db_session.flush()
    ref = custom_role_ref(masked_role.id)
    grant_role(db_session, t1.tenant_id, t1.id, ref)
    set_active_role(db_session, t1.tenant_id, t1.id, ref)
    db_session.commit()

    try:
        token = login(client, "junior@xingye.test")
        resp = client.get("/api/v1/employees", headers=auth_header(token))
        assert resp.status_code == 200
        rows = resp.json()
        assert len(rows) > 1  # global 范围可见全员
        own = db_session.scalar(
            select(Employee).where(Employee.user_id == t1.id)
        )
        # 本人行按「自看自」放行；他人绩效等级一律掩码
        others = [r for r in rows if r["id"] != str(own.id)]
        assert others
        assert all(r["perf_grade"] is None for r in others)
    finally:
        # 还原授角基线（conftest 不清理 users/tenant_roles）
        victim = db_session.scalar(
            select(User).where(User.email == "junior@xingye.test")
        )
        victim.roles = original_roles
        victim.active_role_ref = original_ref
        role = db_session.get(TenantRole, masked_role.id)
        if role is not None:
            db_session.delete(role)
        db_session.commit()
