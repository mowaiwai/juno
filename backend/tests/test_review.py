import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.models.application import Application
from tests.conftest import auth_header, login

PANEL_NAMES = {"lead": "江予舟", "rev1": "苏望知", "rev2": "顾言溪"}


def item(code, weight, sort_order):
    return {
        "code": code,
        "name": f"标准项 {code}",
        "description": "能力描述",
        "requirement": "达标要求",
        "weight": weight,
        "sort_order": sort_order,
    }


def assessment_payload(sequence, grade):
    return {
        "items": [
            {"standard_item_code": f"{sequence}-{grade}-01", "self_level": "met",
             "self_comment": "能独立完成"},
            {"standard_item_code": f"{sequence}-{grade}-02", "self_level": "met",
             "self_comment": "有案例"},
            {"standard_item_code": f"{sequence}-{grade}-03", "self_level":
             "partially_met", "self_comment": "略不足"},
        ]
    }


_counter = {"n": 0}


def next_key():
    _counter["n"] += 1
    n = _counter["n"]
    return f"R{n:02d}", f"H{n:02d}"


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
def rev2_h(client):
    return auth_header(login(client, "rev2@xingye.test"))


@pytest.fixture(scope="module")
def panel(client, h):
    """按名字解析评委的 employee_id。"""
    resp = client.get("/api/v1/employees", headers=h)
    assert resp.status_code == 200, resp.text
    by_name = {row["name"]: row["id"] for row in resp.json()}
    return {k: by_name[v] for k, v in PANEL_NAMES.items()}


def configure_template(client, h, sequence, panel, active=True):
    return client.post(
        "/api/v1/review-panel-templates",
        headers=h,
        json={
            "sequence": sequence,
            "lead_reviewer_id": panel["lead"],
            "reviewer_ids": [panel["rev1"], panel["rev2"]],
            "is_active": active,
        },
    )


def prepare_committee(client, h, mgr_h, emp_h, panel=None, sequence=None, grade=None):
    """端到端把申请推进到 IN_COMMITTEE_REVIEW。"""
    if sequence is None:
        sequence, grade = next_key()

    std = client.post(
        "/api/v1/standard-sets",
        headers=h,
        json={
            "sequence": sequence,
            "target_grade": grade,
            "items": [
                item(f"{sequence}-{grade}-01", 40, 1),
                item(f"{sequence}-{grade}-02", 30, 2),
                item(f"{sequence}-{grade}-03", 30, 3),
            ],
        },
    )
    assert std.status_code == 201, std.text
    pub = client.post(
        f"/api/v1/standard-sets/{std.json()['id']}/publish", headers=h
    )
    assert pub.status_code == 200, pub.text

    if panel is not None:
        tpl = configure_template(client, h, sequence, panel)
        assert tpl.status_code == 201, tpl.text

    draft = client.post(
        "/api/v1/applications",
        headers=emp_h,
        json={"target_sequence": sequence, "target_grade": grade},
    )
    assert draft.status_code == 201, draft.text
    app_id = draft.json()["id"]

    client.put(
        f"/api/v1/applications/{app_id}/self-assessment",
        headers=emp_h,
        json=assessment_payload(sequence, grade),
    )
    submit = client.post(
        f"/api/v1/applications/{app_id}/submit", headers=emp_h
    )
    assert submit.status_code == 200, submit.text

    approve = client.post(
        f"/api/v1/applications/{app_id}/manager-review",
        headers=mgr_h,
        json={"decision": "approved"},
    )
    assert approve.status_code == 200, approve.text
    return app_id, sequence, grade


def my_tasks(client, headers):
    resp = client.get("/api/v1/review/tasks", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


def find_task(tasks, app_id):
    return next(t for t in tasks if t["application_id"] == app_id)


# ---- 模板权限与校验 ----

def test_template_hr_only(client, emp_h):
    seq, grade = next_key()
    resp = client.post(
        "/api/v1/review-panel-templates",
        headers=emp_h,
        json={"sequence": seq, "lead_reviewer_id": str(uuid.uuid4()),
              "reviewer_ids": [str(uuid.uuid4()), str(uuid.uuid4())]},
    )
    assert resp.status_code == 403


def test_template_requires_exactly_two_reviewers(client, h, panel):
    seq, _ = next_key()
    resp = client.post(
        "/api/v1/review-panel-templates",
        headers=h,
        json={"sequence": seq, "lead_reviewer_id": panel["lead"],
              "reviewer_ids": [panel["rev1"]]},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "invalid_panel"


def test_template_members_must_exist_in_tenant(client, h, panel):
    seq, _ = next_key()
    resp = client.post(
        "/api/v1/review-panel-templates",
        headers=h,
        json={"sequence": seq, "lead_reviewer_id": panel["lead"],
              "reviewer_ids": [panel["rev1"], str(uuid.uuid4())]},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "member_not_found"


def test_lead_cannot_be_reviewer(client, h, panel):
    seq, _ = next_key()
    resp = client.post(
        "/api/v1/review-panel-templates",
        headers=h,
        json={"sequence": seq, "lead_reviewer_id": panel["lead"],
              "reviewer_ids": [panel["rev1"], panel["lead"]]},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "invalid_panel"


def test_duplicate_active_template_rejected(client, h, panel):
    seq, _ = next_key()
    first = configure_template(client, h, seq, panel)
    assert first.status_code == 201
    again = configure_template(client, h, seq, panel)
    assert again.status_code == 409
    assert again.json()["code"] == "active_template_exists"


def test_list_and_update_template(client, h, panel):
    seq, _ = next_key()
    tpl_id = configure_template(client, h, seq, panel).json()["id"]

    listed = client.get(
        f"/api/v1/review-panel-templates?sequence={seq}", headers=h
    )
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    updated = client.put(
        f"/api/v1/review-panel-templates/{tpl_id}",
        headers=h,
        json={
            "sequence": seq,
            "lead_reviewer_id": panel["rev1"],
            "reviewer_ids": [panel["lead"], panel["rev2"]],
            "is_active": True,
        },
    )
    assert updated.status_code == 200
    assert updated.json()["lead_reviewer_id"] == panel["rev1"]


# ---- 派单 ----

def test_tasks_auto_created_with_template(client, h, mgr_h, emp_h, panel):
    app_id, _, _ = prepare_committee(client, h, mgr_h, emp_h, panel)

    lead_tasks = my_tasks(client, auth_header(login(client, "lead@xingye.test")))
    r1_tasks = my_tasks(client, auth_header(login(client, "rev1@xingye.test")))
    r2_tasks = my_tasks(client, auth_header(login(client, "rev2@xingye.test")))

    assert find_task(lead_tasks, app_id)["role"] == "lead"
    assert find_task(r1_tasks, app_id)["role"] == "reviewer"
    assert find_task(r2_tasks, app_id)["role"] == "reviewer"


def test_no_template_no_tasks_then_backfill(client, h, mgr_h, emp_h, panel):
    # 先不配置模板：申请进入评审但本单无任务（评委可能持有其他单的任务）
    app_id, sequence, _ = prepare_committee(client, h, mgr_h, emp_h, panel=None)
    rev1_tasks = my_tasks(client, auth_header(login(client, "rev1@xingye.test")))
    assert not any(t["application_id"] == app_id for t in rev1_tasks)

    # HR 事后配置模板 → 在途申请自动补派
    tpl = configure_template(client, h, sequence, panel)
    assert tpl.status_code == 201, tpl.text

    r1_tasks = my_tasks(client, auth_header(login(client, "rev1@xingye.test")))
    assert find_task(r1_tasks, app_id)


def test_review_tasks_scoped_to_assignee(client, h, mgr_h, emp_h, panel, junior_h):
    app_id, _, _ = prepare_committee(client, h, mgr_h, emp_h, panel)
    # 普通员工没有评审任务端点权限
    assert client.get("/api/v1/review/tasks", headers=junior_h).status_code == 403


# ---- 认领 / 释放（申请级悲观锁）----

def test_claim_first_succeeds_second_conflicts(
    client, h, mgr_h, emp_h, panel, rev1_h, rev2_h
):
    app_id, _, _ = prepare_committee(client, h, mgr_h, emp_h, panel)
    r1_task = find_task(my_tasks(client, rev1_h), app_id)

    claim = client.post(f"/api/v1/review/tasks/{r1_task['id']}/claim",
                        headers=rev1_h)
    assert claim.status_code == 200
    assert claim.json()["locked_until"]

    # 评委 2 尝试认领自己的任务，但申请已被评委 1 锁住 → 409
    r2_task = find_task(my_tasks(client, rev2_h), app_id)
    conflict = client.post(f"/api/v1/review/tasks/{r2_task['id']}/claim",
                           headers=rev2_h)
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "review_locked"


def test_release_then_other_can_claim(
    client, h, mgr_h, emp_h, panel, rev1_h, rev2_h
):
    app_id, _, _ = prepare_committee(client, h, mgr_h, emp_h, panel)
    r1_task = find_task(my_tasks(client, rev1_h), app_id)
    client.post(f"/api/v1/review/tasks/{r1_task['id']}/claim", headers=rev1_h)

    release = client.post(
        f"/api/v1/review/tasks/{r1_task['id']}/release", headers=rev1_h
    )
    assert release.status_code == 204

    r2_task = find_task(my_tasks(client, rev2_h), app_id)
    assert client.post(
        f"/api/v1/review/tasks/{r2_task['id']}/claim", headers=rev2_h
    ).status_code == 200


def test_release_requires_hold(
    client, h, mgr_h, emp_h, panel, rev1_h, rev2_h
):
    app_id, _, _ = prepare_committee(client, h, mgr_h, emp_h, panel)
    r1_task = find_task(my_tasks(client, rev1_h), app_id)
    # 未持锁直接释放 → 409
    resp = client.post(
        f"/api/v1/review/tasks/{r1_task['id']}/release", headers=rev1_h
    )
    assert resp.status_code == 409
    assert resp.json()["code"] == "not_lock_holder"


def test_lock_timeout_allows_claim(
    client, h, mgr_h, emp_h, panel, rev1_h, rev2_h, db_session
):
    app_id, _, _ = prepare_committee(client, h, mgr_h, emp_h, panel)
    r1_task = find_task(my_tasks(client, rev1_h), app_id)
    client.post(f"/api/v1/review/tasks/{r1_task['id']}/claim", headers=rev1_h)

    # 直接把锁改到过去
    app = db_session.get(Application, uuid.UUID(app_id))
    app.review_locked_until = datetime.now(timezone.utc) - timedelta(minutes=1)
    db_session.commit()

    r2_task = find_task(my_tasks(client, rev2_h), app_id)
    resp = client.post(
        f"/api/v1/review/tasks/{r2_task['id']}/claim", headers=rev2_h
    )
    assert resp.status_code == 200, resp.text


def test_claim_unknown_task_404(client, rev1_h):
    resp = client.post(
        f"/api/v1/review/tasks/{uuid.uuid4()}/claim", headers=rev1_h
    )
    assert resp.status_code == 404


# ---- 评审意见 ----

def test_opinion_requires_lock(
    client, h, mgr_h, emp_h, panel, rev1_h
):
    app_id, _, _ = prepare_committee(client, h, mgr_h, emp_h, panel)
    r1_task = find_task(my_tasks(client, rev1_h), app_id)
    resp = client.post(
        f"/api/v1/review/tasks/{r1_task['id']}/opinion",
        headers=rev1_h,
        json={"opinion": "材料齐全"},
    )
    assert resp.status_code == 409
    assert resp.json()["code"] == "not_lock_holder"


def test_opinion_submit_saves_and_releases(
    client, h, mgr_h, emp_h, panel, rev1_h, rev2_h
):
    app_id, _, _ = prepare_committee(client, h, mgr_h, emp_h, panel)
    r1_task = find_task(my_tasks(client, rev1_h), app_id)
    client.post(f"/api/v1/review/tasks/{r1_task['id']}/claim", headers=rev1_h)

    resp = client.post(
        f"/api/v1/review/tasks/{r1_task['id']}/opinion",
        headers=rev1_h,
        json={"opinion": "核心标准达标，证据可信"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["opinion"] == "核心标准达标，证据可信"
    assert body["submitted_at"]

    # 提交后锁释放：评委 2 可认领
    r2_task = find_task(my_tasks(client, rev2_h), app_id)
    assert client.post(
        f"/api/v1/review/tasks/{r2_task['id']}/claim", headers=rev2_h
    ).status_code == 200

    # 意见不可重复提交
    again = client.post(
        f"/api/v1/review/tasks/{r1_task['id']}/opinion",
        headers=rev1_h,
        json={"opinion": "改主意了"},
    )
    assert again.status_code == 409
    assert again.json()["code"] == "already_submitted"


# ---- 详情可见性 ----

def test_assigned_panel_can_read_detail(
    client, h, mgr_h, emp_h, panel, rev1_h, lead_h
):
    app_id, _, _ = prepare_committee(client, h, mgr_h, emp_h, panel)
    assert client.get(
        f"/api/v1/applications/{app_id}", headers=rev1_h
    ).status_code == 200
    assert client.get(
        f"/api/v1/applications/{app_id}", headers=lead_h
    ).status_code == 200


def test_unassigned_panel_member_cannot_read(
    client, h, mgr_h, emp_h
):
    # 该场景不配置模板，使用独立的评委账号验证
    app_id, _, _ = prepare_committee(client, h, mgr_h, emp_h, panel=None)
    rev1_h = auth_header(login(client, "rev1@xingye.test"))
    assert client.get(
        f"/api/v1/applications/{app_id}", headers=rev1_h
    ).status_code == 404


def test_regular_employee_cannot_read_other_application(
    client, h, mgr_h, emp_h, panel, junior_h
):
    app_id, _, _ = prepare_committee(client, h, mgr_h, emp_h, panel)
    assert client.get(
        f"/api/v1/applications/{app_id}", headers=junior_h
    ).status_code == 404


# ---- 租户隔离 ----

def test_templates_tasks_tenant_isolated(client, h, panel):
    seq, _ = next_key()
    configure_template(client, h, seq, panel)

    t2_hr = auth_header(login(client, "hr@linyuan.test"))
    resp = client.get(
        f"/api/v1/review-panel-templates?sequence={seq}", headers=t2_hr
    )
    assert resp.json() == []

    # 跨租户更新模板 → 404
    own = client.get(
        f"/api/v1/review-panel-templates?sequence={seq}", headers=h
    ).json()[0]
    cross = client.put(
        f"/api/v1/review-panel-templates/{own['id']}",
        headers=t2_hr,
        json={"sequence": seq, "lead_reviewer_id": panel["lead"],
              "reviewer_ids": [panel["rev1"], panel["rev2"]]},
    )
    assert cross.status_code == 404
