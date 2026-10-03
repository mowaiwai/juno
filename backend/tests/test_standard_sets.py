import pytest

from tests.conftest import auth_header, login


def item(code, weight, sort_order):
    return {
        "code": code,
        "name": f"标准项 {code}",
        "description": "能够独立完成核心任务",
        "requirement": "近一年有 2 个以上可验证案例",
        "weight": weight,
        "sort_order": sort_order,
    }


def make_set(sequence, grade, weights):
    return {
        "sequence": sequence,
        "target_grade": grade,
        "items": [
            item(f"{sequence}-{grade}-{i+1:02d}", w, i + 1)
            for i, w in enumerate(weights)
        ],
    }


@pytest.fixture(scope="module")
def hr_headers(client):
    return auth_header(login(client, "hr@xingye.test"))


@pytest.fixture(scope="module")
def other_hr_headers(client):
    return auth_header(login(client, "hr@linyuan.test"))


def create(client, headers, sequence, grade, weights=(60, 40)):
    return client.post(
        "/api/v1/standard-sets",
        headers=headers,
        json=make_set(sequence, grade, weights),
    )


# ---- 创建 ----

def test_hr_creates_draft_set_v1(client, hr_headers):
    resp = create(client, hr_headers, "SW", "P4")
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "draft"
    assert body["version"] >= 1
    assert body["published_at"] is None
    assert len(body["items"]) == 2


def test_employee_cannot_create_set(client):
    token = login(client, "employee@xingye.test")
    resp = create(client, auth_header(token), "SW", "P3")
    assert resp.status_code == 403


def test_duplicate_draft_same_key_rejected(client, hr_headers):
    # SW/P4 已有一个 draft（上面创建，未发布）
    resp = create(client, hr_headers, "SW", "P4")
    assert resp.status_code == 409
    assert resp.json()["code"] == "draft_exists"


# ---- 列表 / 详情 ----

def test_list_filters_by_sequence(client, hr_headers):
    create(client, hr_headers, "ENG", "P4")
    resp = client.get(
        "/api/v1/standard-sets?sequence=ENG", headers=hr_headers
    )
    assert resp.status_code == 200
    rows = resp.json()
    assert rows and all(r["sequence"] == "ENG" for r in rows)


def test_get_detail_includes_items(client, hr_headers):
    resp = create(client, hr_headers, "ENG", "P3")
    set_id = resp.json()["id"]
    detail = client.get(f"/api/v1/standard-sets/{set_id}", headers=hr_headers)
    assert detail.status_code == 200
    assert len(detail.json()["items"]) == 2


# ---- 修改 ----

def test_update_draft(client, hr_headers):
    set_id = create(client, hr_headers, "OP", "T3").json()["id"]
    updated = make_set("OP", "T3", [50, 30, 20])
    resp = client.put(f"/api/v1/standard-sets/{set_id}", headers=hr_headers, json=updated)
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 3


def test_update_published_set_rejected(client, hr_headers):
    set_id = create(client, hr_headers, "SAL", "S3").json()["id"]
    client.post(f"/api/v1/standard-sets/{set_id}/publish", headers=hr_headers)
    resp = client.put(
        f"/api/v1/standard-sets/{set_id}",
        headers=hr_headers,
        json=make_set("SAL", "S3", [70, 30]),
    )
    assert resp.status_code == 409
    assert resp.json()["code"] == "already_published"


# ---- 发布 ----

def test_publish_success(client, hr_headers):
    set_id = create(client, hr_headers, "QA", "T4").json()["id"]
    resp = client.post(f"/api/v1/standard-sets/{set_id}/publish", headers=hr_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "published"
    assert body["published_at"]


def test_publish_weights_must_sum_100(client, hr_headers):
    set_id = create(client, hr_headers, "FIN", "O2", weights=(60, 30)).json()["id"]
    resp = client.post(f"/api/v1/standard-sets/{set_id}/publish", headers=hr_headers)
    assert resp.status_code == 422
    assert resp.json()["code"] == "invalid_weights"


def test_publish_new_version_archives_old(client, hr_headers):
    # v1 发布
    v1 = create(client, hr_headers, "PUR", "O3").json()
    client.post(f"/api/v1/standard-sets/{v1['id']}/publish", headers=hr_headers)

    # v2 草稿（旧版已发布，应允许创建）
    v2_resp = create(client, hr_headers, "PUR", "O3")
    assert v2_resp.status_code == 201
    assert v2_resp.json()["version"] == 2
    client.post(f"/api/v1/standard-sets/{v2_resp.json()['id']}/publish", headers=hr_headers)

    old = client.get(f"/api/v1/standard-sets/{v1['id']}", headers=hr_headers).json()
    assert old["status"] == "archived"


def test_only_one_published_per_key(client, hr_headers):
    resp = client.get(
        "/api/v1/standard-sets?sequence=PUR&target_grade=O3&status=published",
        headers=hr_headers,
    )
    assert len(resp.json()) == 1


# ---- 非 HR 只读 ----

def test_employee_can_list_but_not_see_drafts(client, hr_headers):
    # HR 创建一个草稿（INT/Q1）与一个已发布（INT/Q2）
    draft_id = create(client, hr_headers, "INT", "Q1").json()["id"]
    pub_id = create(client, hr_headers, "INT", "Q2").json()["id"]
    client.post(f"/api/v1/standard-sets/{pub_id}/publish", headers=hr_headers)

    emp = auth_header(login(client, "employee@xingye.test"))
    resp = client.get("/api/v1/standard-sets", headers=emp)
    assert resp.status_code == 200
    ids = {r["id"] for r in resp.json()}
    assert pub_id in ids
    assert draft_id not in ids

    # 草稿详情对非 HR 返回 404，已发布可读
    assert client.get(f"/api/v1/standard-sets/{draft_id}", headers=emp).status_code == 404
    assert client.get(f"/api/v1/standard-sets/{pub_id}", headers=emp).status_code == 200


# ---- 租户隔离 ----

def test_sets_tenant_isolated(client, hr_headers, other_hr_headers):
    create(client, other_hr_headers, "MGT", "M2")
    resp = client.get("/api/v1/standard-sets", headers=hr_headers)
    keys = {(r["sequence"], r["target_grade"]) for r in resp.json()}
    assert ("MGT", "M2") not in keys

    other = client.get("/api/v1/standard-sets", headers=other_hr_headers)
    keys = {(r["sequence"], r["target_grade"]) for r in other.json()}
    assert keys == {("MGT", "M2")}


def test_cannot_publish_other_tenant_set(client, hr_headers, other_hr_headers):
    set_id = create(client, hr_headers, "MKT", "O3").json()["id"]
    resp = client.post(
        f"/api/v1/standard-sets/{set_id}/publish", headers=other_hr_headers
    )
    assert resp.status_code == 404
