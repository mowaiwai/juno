import uuid

import pytest

from app.models.standard import StandardSnapshot
from tests.conftest import auth_header, login

MAX_EVIDENCE = 10 * 1024 * 1024


def item(code, weight, sort_order):
    return {
        "code": code,
        "name": f"标准项 {code}",
        "description": "能力描述",
        "requirement": "达标要求说明",
        "weight": weight,
        "sort_order": sort_order,
    }


def standard_set_payload(sequence, grade):
    return {
        "sequence": sequence,
        "target_grade": grade,
        "items": [
            item(f"{sequence}-{grade}-01", 40, 1),
            item(f"{sequence}-{grade}-02", 30, 2),
            item(f"{sequence}-{grade}-03", 30, 3),
        ],
    }


@pytest.fixture(scope="module")
def hr_headers(client):
    return auth_header(login(client, "hr@xingye.test"))


@pytest.fixture(scope="module")
def employee_headers(client):
    return auth_header(login(client, "employee@xingye.test"))


@pytest.fixture(scope="module")
def junior_headers(client):
    return auth_header(login(client, "junior@xingye.test"))


@pytest.fixture(scope="module")
def lowperf_headers(client):
    return auth_header(login(client, "lowperf@xingye.test"))


@pytest.fixture(scope="module")
def t2_headers(client):
    return auth_header(login(client, "employee@linyuan.test"))


@pytest.fixture(scope="module")
def sw_p4_set(client, hr_headers):
    # module 级准备：SW/P4 已发布标准集
    resp = client.post(
        "/api/v1/standard-sets", headers=hr_headers, json=standard_set_payload("SW", "P4")
    )
    assert resp.status_code == 201, resp.text
    set_id = resp.json()["id"]
    published = client.post(
        f"/api/v1/standard-sets/{set_id}/publish", headers=hr_headers
    )
    assert published.status_code == 200, published.text
    return published.json()


def create_draft(client, headers, sequence="SW", grade="P4"):
    return client.post(
        "/api/v1/applications",
        headers=headers,
        json={"target_sequence": sequence, "target_grade": grade},
    )


# ---- 创建草稿 / 门槛 ----

def test_create_draft_success(client, employee_headers, sw_p4_set):
    resp = create_draft(client, employee_headers)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["status"] == "draft"
    assert body["standard_set_id"] == sw_p4_set["id"]
    assert body["target_grade"] == "P4"
    assert body["submitted_at"] is None


def test_create_draft_without_published_standard(client, employee_headers):
    resp = create_draft(client, employee_headers, "ENG", "P5")
    assert resp.status_code == 422
    assert resp.json()["code"] == "standard_not_published"


def test_junior_blocked_by_tenure(client, junior_headers):
    resp = create_draft(client, junior_headers)
    assert resp.status_code == 422
    body = resp.json()
    assert body["code"] == "eligibility_failed"
    assert "years" in str(body["details"]).lower()


def test_low_perf_blocked(client, lowperf_headers):
    resp = create_draft(client, lowperf_headers)
    assert resp.status_code == 422
    assert resp.json()["code"] == "eligibility_failed"


def test_manager_cannot_self_start(client):
    # Q7：仅员工自助发起
    token = login(client, "manager@xingye.test")
    resp = create_draft(client, auth_header(token))
    assert resp.status_code == 403


# ---- 列表 / 详情 ----

def test_mine_lists_own_applications(client, employee_headers, sw_p4_set):
    # 自建草稿，避免依赖其他测试的顺序副作用
    assert create_draft(client, employee_headers).status_code == 201
    resp = client.get("/api/v1/applications/mine", headers=employee_headers)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


def test_detail_contains_assessment_and_evidence_slots(
    client, employee_headers, sw_p4_set
):
    draft_id = create_draft(client, employee_headers).json()["id"]
    resp = client.get(f"/api/v1/applications/{draft_id}", headers=employee_headers)
    assert resp.status_code == 200
    body = resp.json()
    # 前端渲染履职表所需的标准项清单
    assert {i["code"] for i in body["standard_items"]} == {
        "SW-P4-01", "SW-P4-02", "SW-P4-03"
    }
    assert body["self_assessments"] == []
    assert body["evidences"] == []


def test_other_employee_gets_404(client, employee_headers, junior_headers):
    draft_id = create_draft(client, employee_headers).json()["id"]
    resp = client.get(f"/api/v1/applications/{draft_id}", headers=junior_headers)
    assert resp.status_code == 404


def test_hr_can_view_detail(client, employee_headers, hr_headers):
    draft_id = create_draft(client, employee_headers).json()["id"]
    resp = client.get(f"/api/v1/applications/{draft_id}", headers=hr_headers)
    assert resp.status_code == 200


# ---- 履职表自评 ----

def assessment_payload():
    return {
        "items": [
            {"standard_item_code": "SW-P4-01", "self_level": "met",
             "self_comment": "独立负责过两个模块"},
            {"standard_item_code": "SW-P4-02", "self_level": "partially_met",
             "self_comment": "还需加强"},
            {"standard_item_code": "SW-P4-03", "self_level": "not_met",
             "self_comment": None},
        ]
    }


def test_put_self_assessment(client, employee_headers):
    draft_id = create_draft(client, employee_headers).json()["id"]
    resp = client.put(
        f"/api/v1/applications/{draft_id}/self-assessment",
        headers=employee_headers,
        json=assessment_payload(),
    )
    assert resp.status_code == 200
    detail = client.get(
        f"/api/v1/applications/{draft_id}", headers=employee_headers
    ).json()
    assert len(detail["self_assessments"]) == 3

    # 再次 PUT：upsert，不产生重复行
    client.put(
        f"/api/v1/applications/{draft_id}/self-assessment",
        headers=employee_headers,
        json=assessment_payload(),
    )
    detail = client.get(
        f"/api/v1/applications/{draft_id}", headers=employee_headers
    ).json()
    assert len(detail["self_assessments"]) == 3


def test_self_assessment_rejects_unknown_code(client, employee_headers):
    draft_id = create_draft(client, employee_headers).json()["id"]
    resp = client.put(
        f"/api/v1/applications/{draft_id}/self-assessment",
        headers=employee_headers,
        json={"items": [
            {"standard_item_code": "NO-SUCH", "self_level": "met"}
        ]},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "unknown_standard_item"


# ---- 举证 ----

def upload(client, draft_id, headers, filename, content, content_type):
    return client.post(
        f"/api/v1/applications/{draft_id}/evidences",
        headers=headers,
        files={"file": (filename, content, content_type)},
        data={"standard_item_code": "SW-P4-01"},
    )


def test_upload_png_and_pdf(client, employee_headers):
    draft_id = create_draft(client, employee_headers).json()["id"]
    r1 = upload(client, draft_id, employee_headers, "a.png",
                b"\x89PNG\r\n\x1a\nfake", "image/png")
    assert r1.status_code == 201, r1.text
    r2 = upload(client, draft_id, employee_headers, "a.pdf",
                b"%PDF-1.4 fake", "application/pdf")
    assert r2.status_code == 201, r2.text


def test_upload_rejects_wrong_type(client, employee_headers):
    draft_id = create_draft(client, employee_headers).json()["id"]
    resp = upload(client, draft_id, employee_headers, "a.txt",
                  b"hello", "text/plain")
    assert resp.status_code == 422
    assert resp.json()["code"] == "invalid_file_type"


def test_upload_rejects_oversized(client, employee_headers):
    draft_id = create_draft(client, employee_headers).json()["id"]
    resp = upload(client, draft_id, employee_headers, "big.png",
                  b"x" * (MAX_EVIDENCE + 1), "image/png")
    assert resp.status_code == 422
    assert resp.json()["code"] == "file_too_large"


def test_upload_limited_to_three_per_item(client, employee_headers):
    draft_id = create_draft(client, employee_headers).json()["id"]
    for i in range(3):
        ok = upload(client, draft_id, employee_headers, f"a{i}.png",
                    b"img", "image/png")
        assert ok.status_code == 201
    blocked = upload(client, draft_id, employee_headers, "a3.png",
                     b"img", "image/png")
    assert blocked.status_code == 422
    assert blocked.json()["code"] == "evidence_limit_exceeded"


def test_delete_evidence_in_draft(client, employee_headers):
    draft_id = create_draft(client, employee_headers).json()["id"]
    up = upload(client, draft_id, employee_headers, "a.png",
                b"img", "image/png").json()
    resp = client.delete(f"/api/v1/evidences/{up['id']}", headers=employee_headers)
    assert resp.status_code == 204


# ---- 提交 ----

def test_submit_requires_full_assessment(client, employee_headers):
    draft_id = create_draft(client, employee_headers).json()["id"]
    resp = client.post(
        f"/api/v1/applications/{draft_id}/submit", headers=employee_headers
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "assessment_incomplete"


def test_submit_generates_snapshot(client, employee_headers, db_session):
    draft_id = create_draft(client, employee_headers).json()["id"]
    client.put(
        f"/api/v1/applications/{draft_id}/self-assessment",
        headers=employee_headers,
        json=assessment_payload(),
    )
    resp = client.post(
        f"/api/v1/applications/{draft_id}/submit", headers=employee_headers
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "submitted"
    assert body["submitted_at"]

    # 标准整版快照已生成
    snap = db_session.query(StandardSnapshot).filter_by(
        application_id=uuid.UUID(draft_id)
    ).one()
    assert len(snap.payload["items"]) == 3
    assert snap.payload["set"]["target_grade"] == "P4"


def test_double_submit_rejected(client, employee_headers):
    draft_id = create_draft(client, employee_headers).json()["id"]
    client.put(
        f"/api/v1/applications/{draft_id}/self-assessment",
        headers=employee_headers,
        json=assessment_payload(),
    )
    client.post(f"/api/v1/applications/{draft_id}/submit",
                headers=employee_headers)
    again = client.post(
        f"/api/v1/applications/{draft_id}/submit", headers=employee_headers
    )
    assert again.status_code == 409
    assert again.json()["code"] == "not_draft"


def test_submit_blocked_when_standard_superseded(
    client, employee_headers, hr_headers
):
    # v1 发布 → 员工建草稿 → v2 发布（v1 转 archived）→ 提交应被拒
    v1 = client.post(
        "/api/v1/standard-sets",
        headers=hr_headers,
        json=standard_set_payload("ENG", "P4"),
    ).json()
    client.post(f"/api/v1/standard-sets/{v1['id']}/publish", headers=hr_headers)

    draft_id = create_draft(client, employee_headers, "ENG", "P4").json()["id"]

    v2 = client.post(
        "/api/v1/standard-sets",
        headers=hr_headers,
        json=standard_set_payload("ENG", "P4"),
    ).json()
    client.post(f"/api/v1/standard-sets/{v2['id']}/publish", headers=hr_headers)

    resp = client.post(
        f"/api/v1/applications/{draft_id}/submit", headers=employee_headers
    )
    assert resp.status_code == 409
    assert resp.json()["code"] == "standard_superseded"


# ---- 租户隔离 ----

def test_other_tenant_cannot_see_application(client, employee_headers, t2_headers):
    draft_id = create_draft(client, employee_headers).json()["id"]
    resp = client.get(f"/api/v1/applications/{draft_id}", headers=t2_headers)
    assert resp.status_code == 404
