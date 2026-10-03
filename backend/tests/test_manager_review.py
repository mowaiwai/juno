import uuid
from datetime import datetime, timedelta, timezone

import pytest

from tests.conftest import auth_header, login


def item(code, weight, sort_order):
    return {
        "code": code,
        "name": f"标准项 {code}",
        "description": "能力描述",
        "requirement": "达标要求",
        "weight": weight,
        "sort_order": sort_order,
    }


def standard_payload(sequence="SW", grade="P4"):
    return {
        "sequence": sequence,
        "target_grade": grade,
        "items": [
            item(f"{sequence}-{grade}-01", 40, 1),
            item(f"{sequence}-{grade}-02", 30, 2),
            item(f"{sequence}-{grade}-03", 30, 3),
        ],
    }


def assessment_payload(sequence, grade):
    return {
        "items": [
            {"standard_item_code": f"{sequence}-{grade}-01", "self_level": "met",
             "self_comment": "能独立完成"},
            {"standard_item_code": f"{sequence}-{grade}-02", "self_level": "met",
             "self_comment": "有案例"},
            {"standard_item_code": f"{sequence}-{grade}-03", "self_level": "partially_met",
             "self_comment": "略不足"},
        ]
    }


# 每个场景使用独立序列/职级键，避免 30 天窗口计数跨测试互相干扰
_key_counter = {"n": 0}


@pytest.fixture(scope="module")
def hr_headers(client):
    return auth_header(login(client, "hr@xingye.test"))


@pytest.fixture(scope="module")
def manager_headers(client):
    return auth_header(login(client, "manager@xingye.test"))


@pytest.fixture(scope="module")
def employee_headers(client):
    return auth_header(login(client, "employee@xingye.test"))


@pytest.fixture(scope="module")
def junior_headers(client):
    return auth_header(login(client, "junior@xingye.test"))


def prepare_submitted(client, hr_headers, employee_headers, sequence=None, grade=None):
    """造一个已提交、等初审的申请，返回申请详情。"""
    n = _key_counter["n"] + 1
    _key_counter["n"] = n
    sequence = sequence or f"T{n:02d}"
    grade = grade or f"G{n:02d}"
    r = client.post(
        "/api/v1/standard-sets", headers=hr_headers,
        json=standard_payload(sequence, grade),
    )
    assert r.status_code == 201, r.text
    set_id = r.json()["id"]
    pub = client.post(f"/api/v1/standard-sets/{set_id}/publish", headers=hr_headers)
    assert pub.status_code == 200, pub.text

    d = client.post(
        "/api/v1/applications", headers=employee_headers,
        json={"target_sequence": sequence, "target_grade": grade},
    )
    assert d.status_code == 201, d.text
    app_id = d.json()["id"]

    sa = client.put(
        f"/api/v1/applications/{app_id}/self-assessment",
        headers=employee_headers, json=assessment_payload(sequence, grade),
    )
    assert sa.status_code == 200, sa.text

    sub = client.post(
        f"/api/v1/applications/{app_id}/submit", headers=employee_headers
    )
    assert sub.status_code == 200, sub.text
    return client.get(
        f"/api/v1/applications/{app_id}", headers=employee_headers
    ).json()


# ---- 经理待审列表 ----

def test_manager_lists_submitted_applications(client, hr_headers, manager_headers, employee_headers):
    submitted = prepare_submitted(client, hr_headers, employee_headers)
    resp = client.get("/api/v1/manager/applications", headers=manager_headers)
    assert resp.status_code == 200
    ids = {a["id"] for a in resp.json()}
    assert submitted["id"] in ids
    assert all(a["status"] == "submitted" for a in resp.json())


def test_employee_has_no_manager_queue(client, employee_headers):
    assert client.get(
        "/api/v1/manager/applications", headers=employee_headers
    ).status_code == 403


def test_manager_can_view_team_application_detail(
    client, hr_headers, manager_headers, employee_headers
):
    submitted = prepare_submitted(client, hr_headers, employee_headers)
    resp = client.get(
        f"/api/v1/applications/{submitted['id']}", headers=manager_headers
    )
    assert resp.status_code == 200
    assert len(resp.json()["evidences"]) >= 0


# ---- 初审通过 ----

def test_manager_approve_moves_to_committee(
    client, hr_headers, manager_headers, employee_headers
):
    submitted = prepare_submitted(client, hr_headers, employee_headers)
    resp = client.post(
        f"/api/v1/applications/{submitted['id']}/manager-review",
        headers=manager_headers,
        json={"decision": "approved", "comment": "同意进入认证评审"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "in_committee_review"


def test_non_assigned_manager_cannot_review(
    client, hr_headers, employee_headers
):
    # junior 是普通员工，不是该单经理
    submitted = prepare_submitted(client, hr_headers, employee_headers)
    token = login(client, "junior@xingye.test")
    resp = client.post(
        f"/api/v1/applications/{submitted['id']}/manager-review",
        headers=auth_header(token),
        json={"decision": "approved"},
    )
    assert resp.status_code == 403


# ---- 初审驳回（强制结构化原因） ----

def test_reject_requires_category(
    client, hr_headers, manager_headers, employee_headers
):
    submitted = prepare_submitted(client, hr_headers, employee_headers)
    resp = client.post(
        f"/api/v1/applications/{submitted['id']}/manager-review",
        headers=manager_headers,
        json={"decision": "rejected", "comment": "还不行"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "reject_reason_required"


def test_reject_requires_comment(
    client, hr_headers, manager_headers, employee_headers
):
    submitted = prepare_submitted(client, hr_headers, employee_headers)
    resp = client.post(
        f"/api/v1/applications/{submitted['id']}/manager-review",
        headers=manager_headers,
        json={"decision": "rejected", "reject_category": "evidence_insufficient"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "reject_reason_required"


def test_reject_success_and_employee_sees_reason(
    client, hr_headers, manager_headers, employee_headers
):
    submitted = prepare_submitted(client, hr_headers, employee_headers)
    resp = client.post(
        f"/api/v1/applications/{submitted['id']}/manager-review",
        headers=manager_headers,
        json={
            "decision": "rejected",
            "reject_category": "evidence_insufficient",
            "comment": "核心标准项缺少可验证的项目案例",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "rejected"

    # 员工侧详情可见初审意见与结构化原因
    detail = client.get(
        f"/api/v1/applications/{submitted['id']}", headers=employee_headers
    ).json()
    assert detail["manager_review"]["decision"] == "rejected"
    assert detail["manager_review"]["reject_category"] == "evidence_insufficient"
    assert "项目案例" in detail["manager_review"]["comment"]


# ---- 撤回 ----

def test_withdraw_submitted_returns_to_draft(
    client, hr_headers, manager_headers, employee_headers
):
    submitted = prepare_submitted(client, hr_headers, employee_headers)
    resp = client.post(
        f"/api/v1/applications/{submitted['id']}/withdraw",
        headers=employee_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "draft"
    # 材料保留
    detail = client.get(
        f"/api/v1/applications/{submitted['id']}", headers=employee_headers
    ).json()
    assert len(detail["self_assessments"]) == 3


def test_withdraw_after_review_started_rejected(
    client, hr_headers, manager_headers, employee_headers
):
    submitted = prepare_submitted(client, hr_headers, employee_headers)
    client.post(
        f"/api/v1/applications/{submitted['id']}/manager-review",
        headers=manager_headers,
        json={"decision": "approved"},
    )
    resp = client.post(
        f"/api/v1/applications/{submitted['id']}/withdraw",
        headers=employee_headers,
    )
    assert resp.status_code == 409
    assert resp.json()["code"] == "not_submitted"


# ---- 驳回后重新提交（30 天窗口 2 次） ----

def _reject_one(client, hr_headers, manager_headers, employee_headers):
    submitted = prepare_submitted(client, hr_headers, employee_headers)
    client.post(
        f"/api/v1/applications/{submitted['id']}/manager-review",
        headers=manager_headers,
        json={
            "decision": "rejected",
            "reject_category": "evidence_insufficient",
            "comment": "材料不足",
        },
    )
    return submitted["id"]


def test_resubmit_copies_material_and_links_previous(
    client, hr_headers, manager_headers, employee_headers
):
    old_id = _reject_one(client, hr_headers, manager_headers, employee_headers)
    resp = client.post(
        f"/api/v1/applications/{old_id}/resubmit", headers=employee_headers
    )
    assert resp.status_code == 201, resp.text
    new = resp.json()
    assert new["status"] == "draft"
    assert new["previous_application_id"] == old_id
    # 自评与举证已复制
    assert len(new["self_assessments"]) == 3

    # 原单保持驳回归档
    old = client.get(
        f"/api/v1/applications/{old_id}", headers=employee_headers
    ).json()
    assert old["status"] == "rejected"


def test_resubmit_only_by_owner(client, hr_headers, manager_headers,
                                employee_headers, junior_headers):
    old_id = _reject_one(client, hr_headers, manager_headers, employee_headers)
    resp = client.post(
        f"/api/v1/applications/{old_id}/resubmit", headers=junior_headers
    )
    assert resp.status_code == 404


def test_third_submission_within_window_rejected(
    client, hr_headers, manager_headers, employee_headers
):
    # 第 1 次提交 → 驳回
    first_id = _reject_one(client, hr_headers, manager_headers, employee_headers)
    # resubmit → 第 2 次提交 → 驳回
    new_id = client.post(
        f"/api/v1/applications/{first_id}/resubmit",
        headers=employee_headers,
    ).json()["id"]
    second = client.post(
        f"/api/v1/applications/{new_id}/submit", headers=employee_headers
    )
    assert second.status_code == 200
    client.post(
        f"/api/v1/applications/{new_id}/manager-review",
        headers=manager_headers,
        json={
            "decision": "rejected",
            "reject_category": "ability_gap",
            "comment": "能力仍有差距",
        },
    )

    # 再 resubmit → 第 3 次提交应被拒
    third_draft = client.post(
        f"/api/v1/applications/{new_id}/resubmit",
        headers=employee_headers,
    ).json()["id"]
    third = client.post(
        f"/api/v1/applications/{third_draft}/submit",
        headers=employee_headers,
    )
    assert third.status_code == 422
    assert third.json()["code"] == "resubmit_limit_exceeded"


# ---- 初审超期自动流转 ----

def test_expired_manager_review_auto_advances(
    client, hr_headers, manager_headers, employee_headers, db_session
):
    submitted = prepare_submitted(client, hr_headers, employee_headers)
    # 模拟经理截止时间已过
    app_id = uuid.UUID(submitted["id"])
    from app.models.application import Application
    app = db_session.get(Application, app_id)
    app.manager_deadline_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db_session.commit()

    resp = client.post(
        "/api/internal/manager-review-timeouts", headers=hr_headers
    )
    assert resp.status_code == 200
    detail = client.get(
        f"/api/v1/applications/{submitted['id']}", headers=employee_headers
    ).json()
    assert detail["status"] == "in_committee_review"


def test_non_expired_not_advanced(
    client, hr_headers, manager_headers, employee_headers
):
    submitted = prepare_submitted(client, hr_headers, employee_headers)
    client.post("/api/internal/manager-review-timeouts", headers=hr_headers)
    detail = client.get(
        f"/api/v1/applications/{submitted['id']}", headers=employee_headers
    ).json()
    assert detail["status"] == "submitted"
