"""Task 7：PIP 生命周期/看板范围、辅导记录、我的绩效（AC-8/9/10）。"""
from sqlalchemy import select

from app.models.employee import Employee
from tests.conftest import auth_header, login


def _emp(db_session, no):
    return db_session.scalar(
        select(Employee).where(Employee.employee_no == no)
    )


def _prepare_plan(client, token, tool="kpi", dept_ids=("305",)):
    resp = client.post(
        "/api/v1/perf/plans",
        headers=auth_header(token),
        json={"period": "2026H1", "tool_type": tool,
              "dept_ids": list(dept_ids), "sequence_codes": []},
    )
    assert resp.status_code == 201, resp.text
    plan_id = resp.json()["id"]
    client.post(
        f"/api/v1/perf/plans/{plan_id}/transition",
        headers=auth_header(token), json={"to": "evaluating"},
    )
    client.post(
        f"/api/v1/perf/plans/{plan_id}/transition",
        headers=auth_header(token), json={"to": "calibrating"},
    )
    return plan_id


def _g(emp, grade, score=None):
    return {
        "employee_id": str(emp.id), "grade": grade, "score": score,
        "evidence": ["重点项目交付"] if grade in ("S", "A") else [],
    }


def _publish(client, token, plan_id, reason=None):
    return client.post(
        f"/api/v1/perf/plans/{plan_id}/publish",
        headers=auth_header(token),
        json={"override_reason": reason},
    )


# ---------- AC-8：PIP 生命周期与终结不可改 ----------

def test_pip_lifecycle_conclude_locks(client, db_session):
    hr = login(client, "hr@xingye.test")
    target = _emp(db_session, "E10086")
    create = client.post(
        "/api/v1/perf/pips",
        headers=auth_header(hr),
        json={"employee_id": str(target.id), "period": "2026H1",
              "goals": ["补齐交付质量"], "deadline": "2026-09-30"},
    )
    assert create.status_code == 201, create.text
    pip = create.json()
    assert pip["status"] == "active"
    assert pip["linked_adjust_id"] is None
    pip_id = pip["id"]

    upd = client.put(
        f"/api/v1/perf/pips/{pip_id}",
        headers=auth_header(hr),
        json={"goals": ["补齐交付质量", "月度复盘"]},
    )
    assert upd.status_code == 200
    assert len(upd.json()["goals"]) == 2

    conclude = client.post(
        f"/api/v1/perf/pips/{pip_id}/conclusion",
        headers=auth_header(hr),
        json={"result": "failed", "note": "改进期内未达标"},
    )
    assert conclude.status_code == 200
    body = conclude.json()
    assert body["status"] == "failed"
    assert body["concluded_at"] is not None

    again = client.post(
        f"/api/v1/perf/pips/{pip_id}/conclusion",
        headers=auth_header(hr), json={"result": "passed"},
    )
    assert again.status_code == 409
    assert again.json()["code"] == "pip_closed"

    edit_after = client.put(
        f"/api/v1/perf/pips/{pip_id}",
        headers=auth_header(hr), json={"goals": ["x"]},
    )
    assert edit_after.status_code == 409


def test_pip_permissions_and_validation(client, db_session):
    mgr = login(client, "manager@xingye.test")
    target = _emp(db_session, "E10086")
    resp = client.post(
        "/api/v1/perf/pips",
        headers=auth_header(mgr),
        json={"employee_id": str(target.id), "period": "2026H1"},
    )
    assert resp.status_code == 403

    hr = login(client, "hr@xingye.test")
    bad = client.post(
        "/api/v1/perf/pips",
        headers=auth_header(hr),
        json={"employee_id": "00000000-0000-0000-0000-000000000000",
              "period": "2026H1"},
    )
    assert bad.status_code == 404

    # 跨租户员工
    other = _emp(db_session, "E20011")
    cross = client.post(
        "/api/v1/perf/pips",
        headers=auth_header(hr),
        json={"employee_id": str(other.id), "period": "2026H1"},
    )
    assert cross.status_code == 404


def test_pip_board_scope_filter(client, db_session):
    hr = login(client, "hr@xingye.test")
    plan_id = _prepare_plan(client, hr)
    emps = [_emp(db_session, no) for no in
            ("E10020", "E10086", "E10081", "E10091", "E10093")]
    items = [
        _g(e, "D", 60) if e.employee_no == "E10093" else _g(e, "B", 85)
        for e in emps
    ]
    client.put(
        f"/api/v1/perf/plans/{plan_id}/results",
        headers=auth_header(hr), json={"items": items},
    )
    assert _publish(client, hr, plan_id).status_code == 200

    # COE 看板：全租户
    hr_list = client.get("/api/v1/perf/pips", headers=auth_header(hr))
    assert hr_list.status_code == 200
    assert any(p["employee_no"] == "E10093" for p in hr_list.json())

    # 主管看板：只含 305 子树（E10093 在册）
    mgr = login(client, "manager@xingye.test")
    mgr_list = client.get("/api/v1/perf/pips", headers=auth_header(mgr))
    assert mgr_list.status_code == 200
    nos = {p["employee_no"] for p in mgr_list.json()}
    assert "E10093" in nos

    # 普通员工无看板权限
    emp = login(client, "employee@xingye.test")
    denied = client.get("/api/v1/perf/pips", headers=auth_header(emp))
    assert denied.status_code == 403


# ---------- AC-9：辅导记录 ----------

def test_coaching_write_and_read_scope(client, db_session):
    mgr = login(client, "manager@xingye.test")
    sub = _emp(db_session, "E10086")
    out = _emp(db_session, "E10105")  # 306，主管范围外

    ok = client.post(
        "/api/v1/perf/coaching",
        headers=auth_header(mgr),
        json={"employee_id": str(sub.id),
              "content": "本周一对一：聚焦代码评审质量",
              "happened_at": "2026-03-10"},
    )
    assert ok.status_code == 201, ok.text

    no_access = client.post(
        "/api/v1/perf/coaching",
        headers=auth_header(mgr),
        json={"employee_id": str(out.id), "content": "x",
              "happened_at": "2026-03-10"},
    )
    assert no_access.status_code == 404

    # 员工本人只读，不可登记
    emp = login(client, "employee@xingye.test")
    write = client.post(
        "/api/v1/perf/coaching",
        headers=auth_header(emp),
        json={"employee_id": str(sub.id), "content": "x",
              "happened_at": "2026-03-10"},
    )
    assert write.status_code == 403

    mine = client.get(
        f"/api/v1/perf/coaching?employee_id={sub.id}",
        headers=auth_header(emp),
    )
    assert mine.status_code == 200
    assert len(mine.json()) == 1

    other = _emp(db_session, "E10091")
    peek = client.get(
        f"/api/v1/perf/coaching?employee_id={other.id}",
        headers=auth_header(emp),
    )
    assert peek.status_code == 404

    # COE 可读
    hr = login(client, "hr@xingye.test")
    all_rec = client.get(
        f"/api/v1/perf/coaching?employee_id={sub.id}",
        headers=auth_header(hr),
    )
    assert all_rec.status_code == 200
    assert len(all_rec.json()) == 1


# ---------- AC-10：我的绩效 ----------

def test_my_perf_published_only_with_pip(client, db_session):
    hr = login(client, "hr@xingye.test")
    me = _emp(db_session, "E10086")
    others = [_emp(db_session, no) for no in
              ("E10020", "E10081", "E10091", "E10093")]
    plan_id = _prepare_plan(client, hr)
    items = [_g(me, "B", 85)] + [_g(e, "B", 85) for e in others]
    client.put(
        f"/api/v1/perf/plans/{plan_id}/results",
        headers=auth_header(hr), json={"items": items},
    )
    assert _publish(client, hr, plan_id).status_code == 200

    # 草稿方案结果不应出现在我的绩效
    draft = client.post(
        "/api/v1/perf/plans",
        headers=auth_header(hr),
        json={"period": "2026H2", "tool_type": "kpi",
              "dept_ids": ["305"], "sequence_codes": []},
    ).json()["id"]
    client.post(
        f"/api/v1/perf/plans/{draft}/import",
        headers=auth_header(hr),
        json={"items": [{"employee_no": "E10086", "grade": "B", "score": 82}]},
    )

    # OKR 已发布：出现在我的结果，但无 PIP
    okr = _prepare_plan(client, hr, tool="okr")
    okr_items = [_g(me, "S", 98)] + [_g(e, "B", 85) for e in others]
    client.put(
        f"/api/v1/perf/plans/{okr}/results",
        headers=auth_header(hr), json={"items": okr_items},
    )
    assert _publish(client, hr, okr).status_code == 200

    # COE 为本人手建 PIP
    client.post(
        "/api/v1/perf/pips",
        headers=auth_header(hr),
        json={"employee_id": str(me.id), "period": "2026H1",
              "goals": ["持续跟进"]},
    )

    emp = login(client, "employee@xingye.test")
    resp = client.get("/api/v1/perf/me", headers=auth_header(emp))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    periods = {r["period"] for r in body["results"]}
    assert periods == {"2026H1"}  # 只有已发布；OKR 同周期 2026H1
    assert len(body["results"]) == 2
    by_tool = {r["tool_type"]: r for r in body["results"]}
    assert by_tool["kpi"]["grade"] == "B"
    assert by_tool["okr"]["grade"] == "S"
    assert all(r["published_at"] for r in body["results"])
    assert len(body["pips"]) == 1 and body["pips"][0]["status"] == "active"
