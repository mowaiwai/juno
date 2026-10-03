import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.models.application import Application, ApplicationStatus
from tests.conftest import auth_header, login

PANEL_NAMES = {"lead": "江予舟", "rev1": "苏望知", "rev2": "顾言溪"}

_counter = {"n": 0}


def next_key():
    _counter["n"] += 1
    n = _counter["n"]
    return f"N{n:02d}", f"V{n:02d}"


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


def my_notifications(client, headers):
    resp = client.get("/api/v1/notifications", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


def notifications_for(notifications, app_id):
    return [n for n in notifications if n["payload"].get("application_id") == app_id]


def setup_standard_and_panel(client, h, panel, seq, grade):
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


def draft_and_submit(client, emp_h, seq, grade):
    app_id = client.post(
        "/api/v1/applications", headers=emp_h,
        json={"target_sequence": seq, "target_grade": grade},
    ).json()["id"]
    client.put(f"/api/v1/applications/{app_id}/self-assessment",
               headers=emp_h, json=assessment(seq, grade))
    assert client.post(
        f"/api/v1/applications/{app_id}/submit", headers=emp_h
    ).status_code == 200
    return app_id


def lead_task_id(client, lead_h, app_id):
    task = next(
        t for t in client.get("/api/v1/review/tasks", headers=lead_h).json()
        if t["application_id"] == app_id
    )
    return task["id"]


# ---- 通知触发 ----

def test_submit_notifies_manager(client, h, mgr_h, emp_h, panel):
    seq, grade = next_key()
    setup_standard_and_panel(client, h, panel, seq, grade)
    app_id = draft_and_submit(client, emp_h, seq, grade)

    manager_notes = notifications_for(
        my_notifications(client, mgr_h), app_id
    )
    types = {n["type"] for n in manager_notes}
    assert "task_assigned" in types

    note = next(n for n in manager_notes if n["type"] == "task_assigned")
    # 通知含行动指引与目标职级（吸收经验：状态+下一步明确）
    assert note["payload"]["target_grade"] == grade
    assert note["payload"]["action"] == "manager_review"


def test_manager_approval_notifies_employee(client, h, mgr_h, emp_h, panel):
    seq, grade = next_key()
    setup_standard_and_panel(client, h, panel, seq, grade)
    app_id = draft_and_submit(client, emp_h, seq, grade)

    assert client.post(
        f"/api/v1/applications/{app_id}/manager-review",
        headers=mgr_h, json={"decision": "approved"},
    ).status_code == 200

    emp_notes = notifications_for(my_notifications(client, emp_h), app_id)
    assert {n["type"] for n in emp_notes} == {"manager_review_approved"}


def test_manager_rejection_notifies_employee_with_reason(
    client, h, mgr_h, emp_h, panel
):
    seq, grade = next_key()
    setup_standard_and_panel(client, h, panel, seq, grade)
    app_id = draft_and_submit(client, emp_h, seq, grade)

    client.post(
        f"/api/v1/applications/{app_id}/manager-review",
        headers=mgr_h,
        json={"decision": "rejected",
              "reject_category": "evidence_insufficient",
              "comment": "缺少可验证案例"},
    )

    note = next(
        n for n in notifications_for(my_notifications(client, emp_h), app_id)
        if n["type"] == "manager_review_rejected"
    )
    assert note["payload"]["reject_category"] == "evidence_insufficient"
    assert "可验证案例" in note["payload"]["comment"]


def test_lead_decision_notifies_employee(client, h, mgr_h, emp_h, panel, lead_h):
    seq, grade = next_key()
    setup_standard_and_panel(client, h, panel, seq, grade)
    app_id = draft_and_submit(client, emp_h, seq, grade)
    client.post(
        f"/api/v1/applications/{app_id}/manager-review",
        headers=mgr_h, json={"decision": "approved"},
    )

    task_id = lead_task_id(client, lead_h, app_id)
    client.post(f"/api/v1/review/tasks/{task_id}/claim", headers=lead_h)
    assert client.post(
        f"/api/v1/applications/{app_id}/decision",
        headers=lead_h, json={"decision": "approved", "comment": "达标"},
    ).status_code == 200

    types = {
        n["type"]
        for n in notifications_for(my_notifications(client, emp_h), app_id)
    }
    assert "decision_approved" in types


def test_lead_rejection_notifies_employee(client, h, mgr_h, emp_h, panel, lead_h):
    seq, grade = next_key()
    setup_standard_and_panel(client, h, panel, seq, grade)
    app_id = draft_and_submit(client, emp_h, seq, grade)
    client.post(
        f"/api/v1/applications/{app_id}/manager-review",
        headers=mgr_h, json={"decision": "approved"},
    )

    task_id = lead_task_id(client, lead_h, app_id)
    client.post(f"/api/v1/review/tasks/{task_id}/claim", headers=lead_h)
    client.post(
        f"/api/v1/applications/{app_id}/decision",
        headers=lead_h, json={"decision": "rejected", "comment": "差距明显"},
    )

    assert any(
        n["type"] == "decision_rejected"
        for n in notifications_for(my_notifications(client, emp_h), app_id)
    )


def test_publish_notifies_employee(client, h, mgr_h, emp_h, panel, lead_h):
    seq, grade = next_key()
    setup_standard_and_panel(client, h, panel, seq, grade)
    app_id = draft_and_submit(client, emp_h, seq, grade)
    client.post(
        f"/api/v1/applications/{app_id}/manager-review",
        headers=mgr_h, json={"decision": "approved"},
    )
    task_id = lead_task_id(client, lead_h, app_id)
    client.post(f"/api/v1/review/tasks/{task_id}/claim", headers=lead_h)
    client.post(
        f"/api/v1/applications/{app_id}/decision",
        headers=lead_h, json={"decision": "approved", "comment": "达标"},
    )
    assert client.post(
        f"/api/v1/applications/{app_id}/publish", headers=h
    ).status_code == 200

    published = [
        n for n in notifications_for(my_notifications(client, emp_h), app_id)
        if n["type"] == "decision_published"
    ]
    assert published
    assert published[0]["payload"]["new_grade"] == grade


# ---- 列表/已读/未读 ----

def test_notifications_scoped_to_recipient(client, h, mgr_h, emp_h, panel):
    seq, grade = next_key()
    setup_standard_and_panel(client, h, panel, seq, grade)
    app_id = draft_and_submit(client, emp_h, seq, grade)

    # 经理能看到这条，员工在初审前看不到 task_assigned
    assert notifications_for(my_notifications(client, mgr_h), app_id)
    assert not notifications_for(my_notifications(client, emp_h), app_id)


def test_mark_read_and_unread_count(client, h, mgr_h, emp_h, panel):
    seq, grade = next_key()
    setup_standard_and_panel(client, h, panel, seq, grade)
    draft_and_submit(client, emp_h, seq, grade)

    resp = client.get("/api/v1/notifications/unread-count", headers=mgr_h)
    assert resp.status_code == 200
    assert resp.json()["count"] >= 1

    note_id = my_notifications(client, mgr_h)[0]["id"]
    marked = client.post(
        f"/api/v1/notifications/{note_id}/read", headers=mgr_h
    )
    assert marked.status_code == 200
    assert marked.json()["read_at"]

    # 他人不能标记
    assert client.post(
        f"/api/v1/notifications/{note_id}/read", headers=emp_h
    ).status_code == 404


# ---- 催办 ----

def test_reminders_day3_day6_with_dedup(
    client, h, mgr_h, emp_h, panel, db_session
):
    seq, grade = next_key()
    setup_standard_and_panel(client, h, panel, seq, grade)
    app_id = draft_and_submit(client, emp_h, seq, grade)

    # 模拟提交于 6 天前
    app = db_session.get(Application, uuid.UUID(app_id))
    six_days_ago = datetime.now(timezone.utc) - timedelta(days=6)
    app.submitted_at = six_days_ago
    db_session.commit()

    # 首次扫描：3 日、6 日两条催办各发一次
    first = client.post("/api/internal/manager-review-reminders", headers=h)
    assert first.status_code == 200
    reminders = [
        n for n in notifications_for(my_notifications(client, mgr_h), app_id)
        if n["type"] == "review_reminder"
    ]
    assert len(reminders) == 2
    assert {n["payload"]["day"] for n in reminders} == {3, 6}

    # 再次扫描：去重，不重复发
    client.post("/api/internal/manager-review-reminders", headers=h)
    reminders = [
        n for n in notifications_for(my_notifications(client, mgr_h), app_id)
        if n["type"] == "review_reminder"
    ]
    assert len(reminders) == 2


def test_no_reminder_before_day3(client, h, mgr_h, emp_h, panel):
    seq, grade = next_key()
    setup_standard_and_panel(client, h, panel, seq, grade)
    draft_and_submit(client, emp_h, seq, grade)

    client.post("/api/internal/manager-review-reminders", headers=h)
    assert not any(
        n["type"] == "review_reminder"
        for n in my_notifications(client, mgr_h)
    )


# ---- 审计日志 ----

def test_audit_log_for_submit(client, h, emp_h, panel):
    seq, grade = next_key()
    setup_standard_and_panel(client, h, panel, seq, grade)
    app_id = draft_and_submit(client, emp_h, seq, grade)

    resp = client.get(
        f"/api/v1/audit-logs?entity_id={app_id}", headers=h
    )
    assert resp.status_code == 200, resp.text
    actions = {log["action"] for log in resp.json()}
    assert "application.submit" in actions


def test_audit_log_has_actor_and_before_after(
    client, h, mgr_h, emp_h, panel, lead_h
):
    seq, grade = next_key()
    setup_standard_and_panel(client, h, panel, seq, grade)
    app_id = draft_and_submit(client, emp_h, seq, grade)
    client.post(
        f"/api/v1/applications/{app_id}/manager-review",
        headers=mgr_h, json={"decision": "approved"},
    )

    logs = client.get(
        f"/api/v1/audit-logs?entity_id={app_id}&action=manager_review.submit",
        headers=h,
    ).json()
    assert len(logs) == 1
    log = logs[0]
    assert log["actor_id"]
    assert log["before"]["status"] == "submitted"
    assert log["after"]["status"] == "in_committee_review"


def test_audit_covers_claim_release_opinion_decision_publish(
    client, h, mgr_h, emp_h, panel, lead_h
):
    seq, grade = next_key()
    setup_standard_and_panel(client, h, panel, seq, grade)
    app_id = draft_and_submit(client, emp_h, seq, grade)
    client.post(
        f"/api/v1/applications/{app_id}/manager-review",
        headers=mgr_h, json={"decision": "approved"},
    )

    task_id = lead_task_id(client, lead_h, app_id)
    client.post(f"/api/v1/review/tasks/{task_id}/claim", headers=lead_h)
    client.post(f"/api/v1/review/tasks/{task_id}/release", headers=lead_h)
    client.post(f"/api/v1/review/tasks/{task_id}/claim", headers=lead_h)
    client.post(
        f"/api/v1/review/tasks/{task_id}/opinion",
        headers=lead_h, json={"opinion": "达标"},
    )

    # 组长意见即终裁意见场景：直接终裁（需重新持锁——opinion 已释放锁）
    client.post(f"/api/v1/review/tasks/{task_id}/claim", headers=lead_h)
    client.post(
        f"/api/v1/applications/{app_id}/decision",
        headers=lead_h, json={"decision": "approved", "comment": "终裁通过"},
    )
    client.post(f"/api/v1/applications/{app_id}/publish", headers=h)

    actions = {
        log["action"]
        for log in client.get(
            f"/api/v1/audit-logs?entity_id={app_id}", headers=h
        ).json()
    }
    assert "review.claim" in actions
    assert "review.release" in actions
    assert "review.opinion" in actions
    assert "decision.final" in actions
    assert "publish" in actions


def test_audit_logs_hr_and_admin_only(client, h, emp_h):
    assert client.get(
        "/api/v1/audit-logs", headers=emp_h
    ).status_code == 403


def test_audit_evidence_upload(client, h, emp_h, panel):
    seq, grade = next_key()
    setup_standard_and_panel(client, h, panel, seq, grade)
    app_id = client.post(
        "/api/v1/applications", headers=emp_h,
        json={"target_sequence": seq, "target_grade": grade},
    ).json()["id"]

    up = client.post(
        f"/api/v1/applications/{app_id}/evidences",
        headers=emp_h,
        files={"file": ("a.png", b"img", "image/png")},
        data={"standard_item_code": f"{seq}-{grade}-01"},
    )
    assert up.status_code == 201, up.text

    actions = {
        log["action"]
        for log in client.get(
            f"/api/v1/audit-logs?entity_id={app_id}", headers=h
        ).json()
    }
    assert "evidence.upload" in actions


# ---- 邮件 ----

def test_email_sent_when_smtp_configured(
    client, h, mgr_h, emp_h, panel, db_session
):
    from app.models.tenant_config import TenantConfig
    from app.models.user import User
    from sqlalchemy import select

    from tests.fake_email import clear_sent

    clear_sent()

    hr_user = db_session.scalar(
        select(User).where(User.email == "hr@xingye.test")
    )
    tenant_id = hr_user.tenant_id
    cfg = db_session.get(TenantConfig, tenant_id)
    existed = cfg is not None
    old_values = dict(cfg.values) if existed else None
    if not existed:
        cfg = TenantConfig(tenant_id=tenant_id, values={})
        db_session.add(cfg)

    cfg.values = {
        **(old_values or {}),
        "smtp_host": "smtp.example.com",
        "smtp_from": "juno@example.com",
    }
    db_session.commit()

    seq, grade = next_key()
    setup_standard_and_panel(client, h, panel, seq, grade)
    app_id = draft_and_submit(client, emp_h, seq, grade)

    # 经理收到 task_assigned，且同事件外发邮件
    from tests.fake_email import RecordingEmailSender

    assert RecordingEmailSender.sent
    assert any(
        mail["to"] == "manager@xingye.test"
        or app_id in str(mail["text"])
        for mail in RecordingEmailSender.sent
    )

    # 还原租户配置
    if existed:
        cfg.values = old_values
    else:
        db_session.delete(cfg)
    db_session.commit()


def test_no_email_without_smtp(client, h, emp_h, panel):
    from tests.fake_email import RecordingEmailSender, clear_sent

    clear_sent()

    seq, grade = next_key()
    setup_standard_and_panel(client, h, panel, seq, grade)
    draft_and_submit(client, emp_h, seq, grade)

    assert RecordingEmailSender.sent == []


# ---- 租户隔离 ----

def test_notifications_cross_tenant_404(client, h, mgr_h, emp_h, panel):
    seq, grade = next_key()
    setup_standard_and_panel(client, h, panel, seq, grade)
    draft_and_submit(client, emp_h, seq, grade)

    note_id = my_notifications(client, mgr_h)[0]["id"]
    t2_hr = auth_header(login(client, "hr@linyuan.test"))
    assert client.post(
        f"/api/v1/notifications/{note_id}/read", headers=t2_hr
    ).status_code == 404

    # 审计按租户隔离
    assert client.get("/api/v1/audit-logs", headers=t2_hr).json() == []
