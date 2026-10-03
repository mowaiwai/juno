import uuid
from datetime import date

import pytest

from app.models.ai import AISuggestion
from app.models.application import Application, ApplicationStatus
from tests.conftest import auth_header, login

PANEL_NAMES = {"lead": "江予舟", "rev1": "苏望知", "rev2": "顾言溪"}

_counter = {"n": 0}


def next_key():
    _counter["n"] += 1
    n = _counter["n"]
    return f"D{n:02d}", f"F{n:02d}"


def std_payload(seq, grade):
    return {
        "sequence": seq,
        "target_grade": grade,
        "items": [
            {"code": f"{seq}-{grade}-01", "name": "系统设计",
             "description": "独立完成模块设计", "requirement": "2 个案例",
             "weight": 50, "sort_order": 1},
            {"code": f"{seq}-{grade}-02", "name": "协同推进",
             "description": "跨角色协调", "requirement": "跨部门项目",
             "weight": 50, "sort_order": 2},
        ],
    }


def assessment(seq, grade):
    return {"items": [
        {"standard_item_code": f"{seq}-{grade}-0{i}", "self_level": "met",
         "self_comment": "说明"}
        for i in (1, 2)
    ]}


@pytest.fixture(scope="module")
def h(client):
    return auth_header(login(client, "hr@xingye.test"))


@pytest.fixture(scope="module")
def mgr_h(client):
    return auth_header(login(client, "manager@xingye.test"))


@pytest.fixture(scope="module")
def emp_h(client):
    return auth_header(login(client, "employee@xingye.test"))


@pytest.fixture(scope="module")
def junior_h(client):
    return auth_header(login(client, "junior@xingye.test"))


@pytest.fixture(scope="module")
def lead_h(client):
    return auth_header(login(client, "lead@xingye.test"))


@pytest.fixture(scope="module")
def rev1_h(client):
    return auth_header(login(client, "rev1@xingye.test"))


@pytest.fixture(scope="module")
def panel(client, h):
    rows = client.get("/api/v1/employees", headers=h).json()
    by_name = {r["name"]: r["id"] for r in rows}
    return {k: by_name[v] for k, v in PANEL_NAMES.items()}


def to_committee(client, h, mgr_h, emp_h, panel, seq=None, grade=None):
    """完整链路推到评审中（AI 异步生成也在此期间完成）。"""
    if seq is None:
        seq, grade = next_key()

    std = client.post("/api/v1/standard-sets", headers=h,
                      json=std_payload(seq, grade)).json()
    assert client.post(
        f"/api/v1/standard-sets/{std['id']}/publish", headers=h
    ).status_code == 200

    assert client.post(
        "/api/v1/review-panel-templates", headers=h,
        json={"sequence": seq, "lead_reviewer_id": panel["lead"],
              "reviewer_ids": [panel["rev1"], panel["rev2"]]},
    ).status_code == 201

    app_id = client.post(
        "/api/v1/applications", headers=emp_h,
        json={"target_sequence": seq, "target_grade": grade},
    ).json()["id"]
    client.put(f"/api/v1/applications/{app_id}/self-assessment",
               headers=emp_h, json=assessment(seq, grade))
    assert client.post(
        f"/api/v1/applications/{app_id}/submit", headers=emp_h
    ).status_code == 200
    assert client.post(
        f"/api/v1/applications/{app_id}/manager-review",
        headers=mgr_h, json={"decision": "approved"},
    ).status_code == 200
    return app_id, seq, grade


def lead_task_id(client, lead_h, app_id):
    tasks = client.get("/api/v1/review/tasks", headers=lead_h).json()
    task = next(t for t in tasks if t["application_id"] == app_id)
    return task["id"]


def lead_claim(client, lead_h, app_id):
    task_id = lead_task_id(client, lead_h, app_id)
    resp = client.post(f"/api/v1/review/tasks/{task_id}/claim",
                       headers=lead_h)
    assert resp.status_code == 200, resp.text
    return task_id


def decide(client, app_id, lead_h, decision, comment="综合材料与面试，达标",
           interview_notes=None, ai_suggestion_id=None):
    payload = {"decision": decision, "comment": comment}
    if interview_notes is not None:
        payload["interview_notes"] = interview_notes
    if ai_suggestion_id is not None:
        payload["ai_suggestion_id"] = ai_suggestion_id
    return client.post(
        f"/api/v1/applications/{app_id}/decision",
        headers=lead_h, json=payload,
    )


# ---- 终裁 ----

def test_lead_approve(client, h, mgr_h, emp_h, panel, lead_h):
    app_id, _, grade = to_committee(client, h, mgr_h, emp_h, panel)
    lead_claim(client, lead_h, app_id)

    resp = decide(client, app_id, lead_h, "approved")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "approved"
    assert body["decided_at"]


def test_lead_reject(client, h, mgr_h, emp_h, panel, lead_h):
    app_id, _, _ = to_committee(client, h, mgr_h, emp_h, panel)
    lead_claim(client, lead_h, app_id)

    resp = decide(client, app_id, lead_h, "rejected",
                  comment="系统设计深度仍不达标",
                  interview_notes="面试未能讲清权衡过程")
    assert resp.status_code == 200
    assert resp.json()["status"] == "rejected"


def test_non_lead_cannot_decide(client, h, mgr_h, emp_h, panel,
                                rev1_h, junior_h):
    app_id, _, _ = to_committee(client, h, mgr_h, emp_h, panel)
    # 评委、员工、HR 均不可终裁
    assert client.post(
        f"/api/v1/applications/{app_id}/decision",
        headers=rev1_h, json={"decision": "approved", "comment": "x"},
    ).status_code == 403
    assert client.post(
        f"/api/v1/applications/{app_id}/decision",
        headers=junior_h, json={"decision": "approved", "comment": "x"},
    ).status_code == 403
    assert client.post(
        f"/api/v1/applications/{app_id}/decision",
        headers=h, json={"decision": "approved", "comment": "x"},
    ).status_code == 403


def test_decision_requires_lock(client, h, mgr_h, emp_h, panel, lead_h):
    app_id, _, _ = to_committee(client, h, mgr_h, emp_h, panel)
    # 未认领直接终裁
    resp = decide(client, app_id, lead_h, "approved")
    assert resp.status_code == 409
    assert resp.json()["code"] == "not_lock_holder"


def test_decision_requires_comment(client, h, mgr_h, emp_h, panel, lead_h):
    app_id, _, _ = to_committee(client, h, mgr_h, emp_h, panel)
    lead_claim(client, lead_h, app_id)
    resp = client.post(
        f"/api/v1/applications/{app_id}/decision",
        headers=lead_h, json={"decision": "approved", "comment": "   "},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "comment_required"


def test_decision_can_reference_ai_suggestion(
    client, h, mgr_h, emp_h, panel, lead_h, db_session
):
    app_id, _, _ = to_committee(client, h, mgr_h, emp_h, panel)
    lead_claim(client, lead_h, app_id)

    ai_row = db_session.query(AISuggestion).filter_by(
        application_id=uuid.UUID(app_id)
    ).one()
    assert ai_row.status == "completed"

    # 引用本单真实 AI 产出：成功
    resp = client.post(
        f"/api/v1/applications/{app_id}/decision",
        headers=lead_h,
        json={"decision": "approved", "comment": "达标",
              "ai_suggestion_id": str(ai_row.id)},
    )
    assert resp.status_code == 200, resp.text

    # 伪造他人/不存在的 AI id：422（在终裁前的场景由另一单验证）


def test_decision_with_fake_ai_id_rejected(
    client, h, mgr_h, emp_h, panel, lead_h
):
    app_id, _, _ = to_committee(client, h, mgr_h, emp_h, panel)
    lead_claim(client, lead_h, app_id)
    resp = client.post(
        f"/api/v1/applications/{app_id}/decision",
        headers=lead_h,
        json={"decision": "approved", "comment": "达标",
              "ai_suggestion_id": str(uuid.uuid4())},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "ai_suggestion_not_found"


def test_lead_can_decide_without_all_reviewer_opinions(
    client, h, mgr_h, emp_h, panel, lead_h
):
    # 评委意见不强制齐：lead 认领后直接终裁（评委缺席场景）
    app_id, _, _ = to_committee(client, h, mgr_h, emp_h, panel)
    lead_claim(client, lead_h, app_id)
    assert decide(client, app_id, lead_h, "approved").status_code == 200


def test_double_decision_conflict(client, h, mgr_h, emp_h, panel, lead_h):
    app_id, _, _ = to_committee(client, h, mgr_h, emp_h, panel)
    lead_claim(client, lead_h, app_id)
    decide(client, app_id, lead_h, "approved")
    again = decide(client, app_id, lead_h, "approved")
    assert again.status_code == 409
    assert again.json()["code"] == "not_in_review"


def test_decision_releases_lock(client, h, mgr_h, emp_h, panel, lead_h,
                                db_session):
    app_id, _, _ = to_committee(client, h, mgr_h, emp_h, panel)
    lead_claim(client, lead_h, app_id)
    decide(client, app_id, lead_h, "rejected", comment="仍需历练")

    # 终裁后锁清空（直接查库；/review/tasks 已过滤非评审中单）
    application = db_session.get(Application, uuid.UUID(app_id))
    assert application.review_locked_by is None
    assert application.review_locked_until is None
    assert application.status == ApplicationStatus.REJECTED


# ---- HR 列表与发布 ----

def test_hr_lists_approved_applications(client, h, mgr_h, emp_h, panel, lead_h):
    app_id, _, _ = to_committee(client, h, mgr_h, emp_h, panel)
    lead_claim(client, lead_h, app_id)
    decide(client, app_id, lead_h, "approved")

    resp = client.get("/api/v1/applications?status=approved", headers=h)
    assert resp.status_code == 200
    assert any(a["id"] == app_id for a in resp.json())


def test_employee_lacks_global_application_list(client, emp_h):
    assert client.get(
        "/api/v1/applications", headers=emp_h
    ).status_code == 403


def test_hr_publish_updates_grade(client, h, mgr_h, emp_h, panel, lead_h,
                                  db_session):
    app_id, seq, grade = to_committee(client, h, mgr_h, emp_h, panel)
    lead_claim(client, lead_h, app_id)
    decide(client, app_id, lead_h, "approved")

    resp = client.post(
        f"/api/v1/applications/{app_id}/publish", headers=h
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "published"
    assert resp.json()["published_at"]

    # 员工职级更新到目标职级，起算日为今天
    from app.models.application import Application
    from app.models.employee import Employee

    application = db_session.get(Application, uuid.UUID(app_id))
    employee = db_session.get(Employee, application.employee_id)
    assert employee.grade == grade
    assert employee.grade_since == date.today()


def test_publish_hr_only(client, h, mgr_h, emp_h, panel, lead_h):
    app_id, _, _ = to_committee(client, h, mgr_h, emp_h, panel)
    lead_claim(client, lead_h, app_id)
    decide(client, app_id, lead_h, "approved")

    assert client.post(
        f"/api/v1/applications/{app_id}/publish", headers=emp_h
    ).status_code == 403


def test_publish_rejected_application_blocked(
    client, h, mgr_h, emp_h, panel, lead_h
):
    app_id, _, _ = to_committee(client, h, mgr_h, emp_h, panel)
    lead_claim(client, lead_h, app_id)
    decide(client, app_id, lead_h, "rejected", comment="差距明显")

    resp = client.post(
        f"/api/v1/applications/{app_id}/publish", headers=h
    )
    assert resp.status_code == 409
    assert resp.json()["code"] == "not_approved"


def test_double_publish_blocked(client, h, mgr_h, emp_h, panel, lead_h):
    app_id, _, _ = to_committee(client, h, mgr_h, emp_h, panel)
    lead_claim(client, lead_h, app_id)
    decide(client, app_id, lead_h, "approved")

    client.post(f"/api/v1/applications/{app_id}/publish", headers=h)
    again = client.post(
        f"/api/v1/applications/{app_id}/publish", headers=h
    )
    assert again.status_code == 409
    assert again.json()["code"] == "not_approved"


def test_published_application_is_readonly(
    client, h, mgr_h, emp_h, panel, lead_h
):
    app_id, _, _ = to_committee(client, h, mgr_h, emp_h, panel)
    lead_claim(client, lead_h, app_id)
    decide(client, app_id, lead_h, "approved")
    client.post(f"/api/v1/applications/{app_id}/publish", headers=h)

    # 归档后只只读：自评/举证/意见全部拒绝
    sa = client.put(
        f"/api/v1/applications/{app_id}/self-assessment",
        headers=emp_h, json=assessment("XX", "YY"),
    )
    assert sa.status_code == 409

    up = client.post(
        f"/api/v1/applications/{app_id}/evidences",
        headers=emp_h,
        files={"file": ("a.png", b"img", "image/png")},
        data={"standard_item_code": "x"},
    )
    assert up.status_code == 409


def test_employee_sees_final_decision_but_not_review_comments(
    client, h, mgr_h, emp_h, panel, lead_h
):
    app_id, _, _ = to_committee(client, h, mgr_h, emp_h, panel)
    lead_claim(client, lead_h, app_id)
    decide(client, app_id, lead_h, "approved",
           comment="这是组长内部意见，不应外泄")

    detail = client.get(
        f"/api/v1/applications/{app_id}", headers=emp_h
    ).json()
    # 员工只看到终裁结果，不看到组长意见原文
    assert detail["final_decision"] == "approved"
    assert "内部意见" not in str(detail)


# ---- 租户隔离 ----

def test_cross_tenant_publish_404(client, h, mgr_h, emp_h, panel, lead_h):
    app_id, _, _ = to_committee(client, h, mgr_h, emp_h, panel)
    lead_claim(client, lead_h, app_id)
    decide(client, app_id, lead_h, "approved")

    t2_hr = auth_header(login(client, "hr@linyuan.test"))
    assert client.post(
        f"/api/v1/applications/{app_id}/publish", headers=t2_hr
    ).status_code == 404
