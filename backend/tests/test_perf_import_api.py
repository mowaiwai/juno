"""Task 6：导入进方案草稿、旧直写通道下线（AC-7）。"""
import uuid

from sqlalchemy import select

from app.models.employee import Employee
from app.models.perf import PerfResult
from tests.conftest import auth_header, login


def _draft_plan(client, token, dept_ids=("305",)):
    resp = client.post(
        "/api/v1/perf/plans",
        headers=auth_header(token),
        json={"period": "2026H1", "tool_type": "kpi",
              "dept_ids": list(dept_ids), "sequence_codes": []},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_import_to_draft_with_row_errors(client, db_session):
    hr = login(client, "hr@xingye.test")
    plan_id = _draft_plan(client, hr)
    target = db_session.scalar(
        select(Employee).where(Employee.employee_no == "E10086")
    )
    before_grade = target.perf_grade

    resp = client.post(
        f"/api/v1/perf/plans/{plan_id}/import",
        headers=auth_header(hr),
        json={"items": [
            {"employee_no": "E10086", "grade": "B", "score": 85},
            {"employee_no": "E10091", "grade": "C"},          # C 无分
            {"employee_no": "E99999", "grade": "B"},          # 不存在
            {"employee_no": "E20011", "grade": "B"},          # 跨租户/不在名册
            {"employee_no": "E10086", "grade": "A", "score": 91},  # 重复
        ]},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["imported"] == 1
    reasons = {e["employee_no"]: e["reason"] for e in body["errors"]}
    assert set(reasons) == {"E10091", "E99999", "E20011", "E10086"}
    assert "分数" in reasons["E10091"]
    assert "重复" in reasons["E10086"]

    # 合法行进方案结果，档案等级未被改动
    result = db_session.scalar(
        select(PerfResult).where(
            PerfResult.plan_id == uuid.UUID(plan_id)
        )
    )
    assert result is not None and result.grade == "B"
    db_session.expire_all()
    assert db_session.get(Employee, target.id).perf_grade == before_grade


def test_import_grade_score_mismatch_is_row_error(client, db_session):
    hr = login(client, "hr@xingye.test")
    plan_id = _draft_plan(client, hr)
    resp = client.post(
        f"/api/v1/perf/plans/{plan_id}/import",
        headers=auth_header(hr),
        json={"items": [{"employee_no": "E10086", "grade": "S", "score": 80}]},
    )
    assert resp.status_code == 200
    assert resp.json()["imported"] == 0
    assert "矛盾" in resp.json()["errors"][0]["reason"]


def test_import_requires_draft_status(client):
    hr = login(client, "hr@xingye.test")
    plan_id = _draft_plan(client, hr)
    client.post(
        f"/api/v1/perf/plans/{plan_id}/transition",
        headers=auth_header(hr), json={"to": "evaluating"},
    )
    resp = client.post(
        f"/api/v1/perf/plans/{plan_id}/import",
        headers=auth_header(hr),
        json={"items": [{"employee_no": "E10086", "grade": "B", "score": 85}]},
    )
    assert resp.status_code == 409
    assert resp.json()["code"] == "plan_not_draft"


def test_import_forbidden_for_manager(client):
    hr = login(client, "hr@xingye.test")
    plan_id = _draft_plan(client, hr)
    mgr = login(client, "manager@xingye.test")
    resp = client.post(
        f"/api/v1/perf/plans/{plan_id}/import",
        headers=auth_header(mgr),
        json={"items": [{"employee_no": "E10086", "grade": "B"}]},
    )
    assert resp.status_code == 403


def test_legacy_direct_perf_endpoint_removed(client):
    hr = login(client, "hr@xingye.test")
    resp = client.put(
        "/api/v1/employees/perf",
        headers=auth_header(hr),
        json={"items": [{"employee_no": "E10086", "perf_grade": "S"}]},
    )
    # 路由已删除：FastAPI 返回 405（路径被 /employees/{id} 占用时方法不允许）或 404
    assert resp.status_code in (404, 405)
