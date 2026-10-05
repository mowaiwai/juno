"""Task 4：两段式结果录入、SABC 校验、系数计算（AC-2/AC-3）。"""
import pytest

from sqlalchemy import select

from app.models.audit import AuditLog
from app.models.employee import Employee
from tests.conftest import auth_header, login


def _emp_id(db_session, no):
    return str(
        db_session.scalar(
            select(Employee.id).where(Employee.employee_no == no)
        )
    )


def _make_plan(client, token, dept_ids=("300",), status="evaluating"):
    resp = client.post(
        "/api/v1/perf/plans",
        headers=auth_header(token),
        json={
            "period": "2026H1", "tool_type": "kpi",
            "dept_ids": list(dept_ids), "sequence_codes": [],
        },
    )
    assert resp.status_code == 201, resp.text
    plan_id = resp.json()["id"]
    if status in ("evaluating", "calibrating"):
        client.post(
            f"/api/v1/perf/plans/{plan_id}/transition",
            headers=auth_header(token), json={"to": "evaluating"},
        )
    if status == "calibrating":
        client.post(
            f"/api/v1/perf/plans/{plan_id}/transition",
            headers=auth_header(token), json={"to": "calibrating"},
        )
    return plan_id


def _put(client, token, plan_id, emp_id, grade, score=None, evidence=None):
    return client.put(
        f"/api/v1/perf/plans/{plan_id}/results/{emp_id}",
        headers=auth_header(token),
        json={
            "employee_id": emp_id, "grade": grade, "score": score,
            "evidence": evidence or [],
        },
    )


# ---------- TR-4.1 系数与校验 ----------

@pytest.mark.parametrize(
    "grade,score,expected",
    [("S", 98, 1.5), ("A", 92, 1.2), ("B", 85, 1.0),
     ("C", 72, 0.9), ("D", 60, 0.5)],
)
def test_coefficients_per_grade(client, db_session, grade, score, expected):
    hr = login(client, "hr@xingye.test")
    plan_id = _make_plan(client, hr)
    emp = _emp_id(db_session, "E10086")
    resp = _put(
        client, hr, plan_id, emp, grade, score,
        evidence=["举证"] if grade in ("S", "A") else None,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["coefficient"] == pytest.approx(expected, abs=0.001)
    assert resp.json()["org_coefficient"] == 1.0


def test_c_requires_score(client, db_session):
    hr = login(client, "hr@xingye.test")
    plan_id = _make_plan(client, hr)
    resp = _put(client, hr, plan_id, _emp_id(db_session, "E10086"), "C")
    assert resp.status_code == 422
    assert resp.json()["code"] == "score_required_for_c"


def test_score_grade_mismatch_rejected(client, db_session):
    hr = login(client, "hr@xingye.test")
    plan_id = _make_plan(client, hr)
    resp = _put(client, hr, plan_id, _emp_id(db_session, "E10086"), "B", 95)
    assert resp.status_code == 422
    assert resp.json()["code"] == "score_grade_mismatch"
    assert "S" in resp.json()["message"]


def test_sa_requires_evidence(client, db_session):
    hr = login(client, "hr@xingye.test")
    plan_id = _make_plan(client, hr)
    resp = _put(client, hr, plan_id, _emp_id(db_session, "E10086"), "S", 98)
    assert resp.status_code == 422
    assert resp.json()["code"] == "evidence_required"


# ---------- TR-4.2 两段式与数据范围 ----------

def test_manager_entry_scope_and_lock(client, db_session):
    hr = login(client, "hr@xingye.test")
    plan_id = _make_plan(client, hr)  # evaluating，300 子树
    mgr = login(client, "manager@xingye.test")

    # 下属（汇报链）
    ok = _put(client, mgr, plan_id, _emp_id(db_session, "E10086"), "B", 85)
    assert ok.status_code == 200, ok.text
    # 同部门但无汇报链 → 部门领导子树可见（305）
    ok2 = _put(client, mgr, plan_id, _emp_id(db_session, "E10081"), "A", 91,
               evidence=["评审贡献"])
    assert ok2.status_code == 200, ok2.text
    # 306 员工不在范围 → 404 口径
    blocked = _put(client, mgr, plan_id, _emp_id(db_session, "E10105"),
                   "B", 85)
    assert blocked.status_code == 404

    # 进入校准：主管锁定，COE 可写
    client.post(
        f"/api/v1/perf/plans/{plan_id}/transition",
        headers=auth_header(hr), json={"to": "calibrating"},
    )
    locked = _put(client, mgr, plan_id, _emp_id(db_session, "E10086"),
                  "A", 90, evidence=["复核"])
    assert locked.status_code == 409
    assert locked.json()["code"] == "entry_locked"
    coe = _put(client, hr, plan_id, _emp_id(db_session, "E10086"),
               "A", 90, evidence=["复核"])
    assert coe.status_code == 200


def test_entry_on_draft_plan_rejected(client, db_session):
    hr = login(client, "hr@xingye.test")
    plan_id = _make_plan(client, hr, status="draft")
    resp = _put(client, hr, plan_id, _emp_id(db_session, "E10086"), "B", 85)
    assert resp.status_code == 409
    assert resp.json()["code"] == "plan_not_open"


def test_employee_role_forbidden(client, db_session):
    hr = login(client, "hr@xingye.test")
    plan_id = _make_plan(client, hr)
    emp_token = login(client, "employee@xingye.test")
    resp = _put(client, emp_token, plan_id,
                _emp_id(db_session, "E10086"), "B", 85)
    assert resp.status_code == 403


def test_non_roster_employee_404(client, db_session):
    hr = login(client, "hr@xingye.test")
    plan_id = _make_plan(client, hr, dept_ids=("306",))  # 仅 E10105
    resp = _put(client, hr, plan_id, _emp_id(db_session, "E10086"), "B", 85)
    assert resp.status_code == 404
    assert resp.json()["code"] == "not_in_roster"


# ---------- 批量与查询 ----------

def test_batch_atomicity(client, db_session):
    hr = login(client, "hr@xingye.test")
    plan_id = _make_plan(client, hr)
    resp = client.put(
        f"/api/v1/perf/plans/{plan_id}/results",
        headers=auth_header(hr),
        json={
            "items": [
                {"employee_id": _emp_id(db_session, "E10086"),
                 "grade": "B", "score": 85},
                {"employee_id": _emp_id(db_session, "E10091"),
                 "grade": "C"},  # 非法：C 无分
            ]
        },
    )
    assert resp.status_code == 422
    got = client.get(
        f"/api/v1/perf/plans/{plan_id}/results", headers=auth_header(hr)
    ).json()
    assert got == []  # 整批不落库


def test_get_results_scoped_for_manager(client, db_session):
    hr = login(client, "hr@xingye.test")
    plan_id = _make_plan(client, hr)
    _put(client, hr, plan_id, _emp_id(db_session, "E10086"), "B", 85)
    _put(client, hr, plan_id, _emp_id(db_session, "E10105"), "B", 84)

    mgr = login(client, "manager@xingye.test")
    resp = client.get(
        f"/api/v1/perf/plans/{plan_id}/results", headers=auth_header(mgr)
    )
    assert resp.status_code == 200
    nos = {r["employee_no"] for r in resp.json()}
    assert nos == {"E10086"}  # 306 的 E10105 对主管不可见


def test_result_entry_audited(client, db_session):
    hr = login(client, "hr@xingye.test")
    plan_id = _make_plan(client, hr)
    _put(client, hr, plan_id, _emp_id(db_session, "E10086"), "B", 85)
    rows = db_session.scalars(
        select(AuditLog).where(AuditLog.action == "perf_result_entered")
    ).all()
    assert len(rows) == 1
    assert rows[0].after["grade"] == "B"
