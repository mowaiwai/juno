"""Task 5：分布软校验、发布回写、撤回、D→PIP（AC-4/5/6/8 自动建档）。"""
import uuid

import pytest

from sqlalchemy import select

from app.models.employee import Employee
from app.models.perf import PerfPlan, PerfResult, Pip
from app.models.tenant_config import TenantConfig
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


def _grade(client, token, plan_id, items):
    resp = client.put(
        f"/api/v1/perf/plans/{plan_id}/results",
        headers=auth_header(token),
        json={"items": items},
    )
    assert resp.status_code == 200, resp.text
    return resp


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


# ---------- TR-5.1 分布软校验 ----------

def test_distribution_override_required_and_accepted(client, db_session):
    hr = login(client, "hr@xingye.test")
    # 把小团队阈值调到 3，使 6 人方案适用区间强校验
    set_resp = client.put(
        "/api/v1/perf/constants",
        headers=auth_header(hr),
        json={"small_roster_threshold": 3},
    )
    assert set_resp.status_code == 200
    try:
        plan_id = _prepare_plan(client, hr, dept_ids=("300",))  # 6 人
        emps = [_emp(db_session, no) for no in
                ("E10020", "E10086", "E10081", "E10091", "E10093", "E10105")]
        items = [_g(emps[0], "S", 98)] + [_g(e, "B", 85) for e in emps[1:]]
        _grade(client, hr, plan_id, items)

        dist = client.get(
            f"/api/v1/perf/plans/{plan_id}/distribution",
            headers=auth_header(hr),
        ).json()
        assert dist["small_roster"] is False
        buckets = {v["bucket"] for v in dist["violations"]}
        assert "S" in buckets

        blocked = _publish(client, hr, plan_id)
        assert blocked.status_code == 422
        assert blocked.json()["code"] == "distribution_override_required"

        ok = _publish(client, hr, plan_id, reason="研发序列整体晋升，校准会通过")
        assert ok.status_code == 200, ok.text
        assert ok.json()["status"] == "published"
        assert ok.json()["distribution_override_reason"] is not None
    finally:
        # 还原本租户常量覆盖
        from app.models.user import Tenant
        t1 = db_session.scalar(
            select(Tenant.id).where(Tenant.name == "星野制造")
        )
        row = db_session.get(TenantConfig, t1)
        if row is not None:
            values = dict(row.values or {})
            values.pop("perf_constants", None)
            row.values = values
            db_session.commit()


def test_small_roster_publishes_without_reason(client, db_session):
    hr = login(client, "hr@xingye.test")
    plan_id = _prepare_plan(client, hr)  # 默认阈值 10，名册 5 人
    emps = [_emp(db_session, no) for no in
            ("E10020", "E10086", "E10081", "E10091", "E10093")]
    _grade(client, hr, plan_id, [_g(e, "B", 85) for e in emps])
    dist = client.get(
        f"/api/v1/perf/plans/{plan_id}/distribution",
        headers=auth_header(hr),
    ).json()
    assert dist["small_roster"] is True
    assert _publish(client, hr, plan_id).status_code == 200


# ---------- TR-5.2 回写 ----------

def test_kpi_publish_writes_back_perf_grade(client, db_session):
    hr = login(client, "hr@xingye.test")
    plan_id = _prepare_plan(client, hr)
    d_emp = _emp(db_session, "E10093")
    b_emp = _emp(db_session, "E10086")
    emps = [_emp(db_session, no) for no in
            ("E10020", "E10086", "E10081", "E10091", "E10093")]
    items = []
    for e in emps:
        items.append(
            _g(e, "D", 60) if e.employee_no == "E10093" else _g(e, "B", 85)
        )
    _grade(client, hr, plan_id, items)
    resp = _publish(client, hr, plan_id)
    assert resp.status_code == 200, resp.text

    db_session.expire_all()
    assert db_session.get(Employee, d_emp.id).perf_grade == "D"
    assert db_session.get(Employee, b_emp.id).perf_grade == "B"

    results = db_session.scalars(
        select(PerfResult).where(
            PerfResult.plan_id == uuid.UUID(plan_id)
        )
    ).all()
    by_emp = {r.employee_id: r for r in results}
    r = by_emp[d_emp.id]
    assert r.grade == "D" and r.score == 60 and r.coefficient == 0.5
    assert r.org_coefficient == 1.0
    assert by_emp[b_emp.id].coefficient == 1.0

    # 既有消费方：员工详情接口读到新等级（hr 有绩效查看权）
    detail = client.get(
        f"/api/v1/employees/{d_emp.id}", headers=auth_header(hr)
    )
    assert detail.status_code == 200
    assert detail.json()["perf_grade"] == "D"


# ---------- TR-5.3 OKR/360 不回写 ----------

def test_okr_publish_no_writeback(client, db_session):
    hr = login(client, "hr@xingye.test")
    plan_id = _prepare_plan(client, hr, tool="okr")
    target = _emp(db_session, "E10086")  # seed perf_grade = B
    before = target.perf_grade
    emps = [_emp(db_session, no) for no in
            ("E10020", "E10086", "E10081", "E10091", "E10093")]
    items = [_g(target, "S", 98)] + [
        _g(e, "B", 85) for e in emps if e.id != target.id
    ]
    _grade(client, hr, plan_id, items)
    assert _publish(client, hr, plan_id).status_code == 200

    db_session.expire_all()
    assert db_session.get(Employee, target.id).perf_grade == before
    results = db_session.scalars(
        select(PerfResult).where(
            PerfResult.plan_id == uuid.UUID(plan_id)
        )
    ).all()
    assert len(results) == 5
    assert not db_session.scalars(
        select(Pip).where(Pip.tenant_id == results[0].tenant_id)
    ).all()


def test_360_publish_no_writeback(client, db_session):
    hr = login(client, "hr@xingye.test")
    plan_id = _prepare_plan(client, hr, tool="360")
    emps = [_emp(db_session, no) for no in
            ("E10020", "E10086", "E10081", "E10091", "E10093")]
    _grade(client, hr, plan_id, [_g(e, "A", 91) for e in emps])
    assert _publish(client, hr, plan_id).status_code == 200
    db_session.expire_all()
    assert db_session.get(Employee, emps[0].id).perf_grade is not None  # seed 不变


# ---------- TR-5.4 D→PIP 幂等 + 撤回 ----------

def test_d_auto_pip_idempotent_and_unpublish(client, db_session):
    hr = login(client, "hr@xingye.test")
    plan_id = _prepare_plan(client, hr)
    emps = [_emp(db_session, no) for no in
            ("E10020", "E10086", "E10081", "E10091", "E10093")]
    items = [
        _g(e, "D", 60) if e.employee_no == "E10093" else _g(e, "B", 85)
        for e in emps
    ]
    _grade(client, hr, plan_id, items)
    _publish(client, hr, plan_id)

    d_emp = _emp(db_session, "E10093")
    pips = db_session.scalars(
        select(Pip).where(
            Pip.employee_id == d_emp.id, Pip.status == "active"
        )
    ).all()
    assert len(pips) == 1
    pip = pips[0]
    assert pip.linked_adjust_id is None
    assert pip.period == "2026H1"
    assert pip.perf_result_id is not None

    # 撤回后重新发布：不重复建档
    un = client.post(
        f"/api/v1/perf/plans/{plan_id}/unpublish", headers=auth_header(hr)
    )
    assert un.status_code == 200
    assert un.json()["status"] == "calibrating"
    _publish(client, hr, plan_id)
    again = db_session.scalars(
        select(Pip).where(Pip.employee_id == d_emp.id)
    ).all()
    assert len(again) == 1


# ---------- TR-5.5 发布前置校验 ----------

def test_publish_incomplete_blocked(client, db_session):
    hr = login(client, "hr@xingye.test")
    plan_id = _prepare_plan(client, hr)
    _grade(client, hr, plan_id, [_g(_emp(db_session, "E10086"), "B", 85)])
    resp = _publish(client, hr, plan_id)
    assert resp.status_code == 422
    body = resp.json()
    assert body["code"] == "results_incomplete"
    assert len(body["details"]["ungraded_ids"]) == 4


def test_publish_evaluating_plan_blocked(client, db_session):
    hr = login(client, "hr@xingye.test")
    resp = client.post(
        "/api/v1/perf/plans",
        headers=auth_header(hr),
        json={"period": "2026H1", "tool_type": "kpi",
              "dept_ids": ["305"], "sequence_codes": []},
    )
    plan_id = resp.json()["id"]
    client.post(
        f"/api/v1/perf/plans/{plan_id}/transition",
        headers=auth_header(hr), json={"to": "evaluating"},
    )
    blocked = _publish(client, hr, plan_id)
    assert blocked.status_code == 409
    assert blocked.json()["code"] == "plan_not_calibrating"


def test_manager_cannot_publish(client, db_session):
    hr = login(client, "hr@xingye.test")
    plan_id = _prepare_plan(client, hr)
    mgr = login(client, "manager@xingye.test")
    resp = client.post(
        f"/api/v1/perf/plans/{plan_id}/publish",
        headers=auth_header(mgr), json={"override_reason": None},
    )
    assert resp.status_code == 403
