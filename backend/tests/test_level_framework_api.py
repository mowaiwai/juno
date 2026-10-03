"""层级框架 L2：框架读取与职级解析 API。"""

from app.framework_content import DEFAULT_GRADE_LEVELS
from tests.conftest import auth_header, login


def test_latest_requires_login(client):
    resp = client.get("/api/v1/level-framework/latest")
    assert resp.status_code == 401


def test_latest_returns_v1_full_framework(client):
    token = login(client, "employee@xingye.test")
    resp = client.get(
        "/api/v1/level-framework/latest", headers=auth_header(token)
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["version"] == 1
    assert data["status"] == "published"
    assert len(data["levels"]) == 6
    assert [lv["level_order"] for lv in data["levels"]] == [1, 2, 3, 4, 5, 6]
    assert data["levels"][2]["name"] == "骨干层"
    assert data["levels"][3]["key_behaviors"] == [
        "创新", "引领", "建立长效机制"
    ]
    assert len(data["anchors"]) == 3
    assert [a["code"] for a in data["anchors"]] == ["L1", "L2", "L3"]
    assert len(data["conditions"]) == 6
    assert len(data["bonus_items"]) == 5
    assert data["published_at"] is not None


def test_resolve_default_backbone_p4(client):
    token = login(client, "employee@xingye.test")
    resp = client.get(
        "/api/v1/level-framework/resolve?grade=P4",
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["grade"] == "P4"
    assert data["source"] == "default"
    assert data["required_anchor"] == "L3"
    assert data["level"]["level_order"] == 3
    assert data["level"]["name"] == "骨干层"
    assert data["level"]["target_anchor"] == "L3"


def test_resolve_default_basic_p2(client):
    token = login(client, "junior@xingye.test")
    resp = client.get(
        "/api/v1/level-framework/resolve?grade=P2",
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["level"]["name"] == "基础层"
    assert data["required_anchor"] == "L1"
    assert data["source"] == "default"


def test_resolve_unmapped_grade_404(client):
    token = login(client, "employee@xingye.test")
    resp = client.get(
        "/api/v1/level-framework/resolve?grade=P5",
        headers=auth_header(token),
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "grade_not_mapped"


def test_resolve_m3_elite(client):
    token = login(client, "hr@xingye.test")
    resp = client.get(
        "/api/v1/level-framework/resolve?grade=M3",
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["level"]["name"] == "精英层"
    assert data["level"]["level_order"] == 4


# ---------------------------------------------------------------------------
# L4：平台草稿管理
# ---------------------------------------------------------------------------

def test_draft_endpoints_forbidden_for_hr(client):
    token = login(client, "hr@xingye.test")
    resp = client.post(
        "/api/v1/level-framework/drafts",
        headers=auth_header(token),
    )
    assert resp.status_code == 403


def test_get_draft_404(client):
    token = login(client, "admin@platform.test")
    resp = client.get(
        "/api/v1/level-framework/drafts/current",
        headers=auth_header(token),
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "draft_not_found"


def test_create_draft_copies_latest(client):
    token = login(client, "admin@platform.test")
    resp = client.post(
        "/api/v1/level-framework/drafts",
        headers=auth_header(token),
    )
    assert resp.status_code == 201, resp.text
    draft = resp.json()
    assert draft["status"] == "draft"
    assert draft["version"] == 2
    assert draft["published_at"] is None
    assert len(draft["levels"]) == 6
    assert len(draft["anchors"]) == 3
    assert len(draft["conditions"]) == 6
    assert len(draft["bonus_items"]) == 5
    assert draft["levels"][2]["name"] == "骨干层"

    # 已有草稿 → 409
    again = client.post(
        "/api/v1/level-framework/drafts",
        headers=auth_header(token),
    )
    assert again.status_code == 409
    assert again.json()["code"] == "draft_exists"


def test_update_draft_content(client):
    token = login(client, "admin@platform.test")
    client.post(
        "/api/v1/level-framework/drafts", headers=auth_header(token)
    )

    latest = client.get(
        "/api/v1/level-framework/drafts/current",
        headers=auth_header(token),
    ).json()
    latest["levels"][3]["name"] = "精英层（修订）"
    latest["levels"][3]["role_definition"] = "修订后的角色定义文案"

    resp = client.put(
        "/api/v1/level-framework/drafts/current",
        headers=auth_header(token),
        json={
            "levels": latest["levels"],
            "anchors": latest["anchors"],
            "conditions": latest["conditions"],
            "bonus_items": latest["bonus_items"],
        },
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["levels"][3]["name"] == "精英层（修订）"
    assert data["levels"][3]["role_definition"] == "修订后的角色定义文案"
    assert len(data["levels"]) == 6


def test_publish_invalid_framework_rejected(client):
    token = login(client, "admin@platform.test")
    client.post(
        "/api/v1/level-framework/drafts", headers=auth_header(token)
    )
    draft = client.get(
        "/api/v1/level-framework/drafts/current",
        headers=auth_header(token),
    ).json()
    # 删除一层 → 六层不齐
    draft["levels"] = draft["levels"][:5]

    client.put(
        "/api/v1/level-framework/drafts/current",
        headers=auth_header(token),
        json={
            "levels": draft["levels"],
            "anchors": draft["anchors"],
            "conditions": draft["conditions"],
            "bonus_items": draft["bonus_items"],
        },
    )
    resp = client.post(
        "/api/v1/level-framework/drafts/current/publish",
        headers=auth_header(token),
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "invalid_framework"

    # latest 仍为 v1
    latest = client.get(
        "/api/v1/level-framework/latest",
        headers=auth_header(token),
    ).json()
    assert latest["version"] == 1


def test_publish_draft_switches_latest_and_archives_old(client):
    token = login(client, "admin@platform.test")

    # 先捕获 v1 id（发布后即归档）
    v1_id = client.get(
        "/api/v1/level-framework/latest",
        headers=auth_header(token),
    ).json()["id"]

    client.post(
        "/api/v1/level-framework/drafts", headers=auth_header(token)
    )
    draft = client.get(
        "/api/v1/level-framework/drafts/current",
        headers=auth_header(token),
    ).json()
    draft["levels"][3]["name"] = "精英层（v2）"

    client.put(
        "/api/v1/level-framework/drafts/current",
        headers=auth_header(token),
        json={
            "levels": draft["levels"],
            "anchors": draft["anchors"],
            "conditions": draft["conditions"],
            "bonus_items": draft["bonus_items"],
        },
    )
    resp = client.post(
        "/api/v1/level-framework/drafts/current/publish",
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["version"] == 2

    # latest 切到 v2
    emp_token = login(client, "employee@xingye.test")
    latest = client.get(
        "/api/v1/level-framework/latest",
        headers=auth_header(emp_token),
    ).json()
    assert latest["version"] == 2
    assert latest["levels"][3]["name"] == "精英层（v2）"

    # 映射视图绑定 v2
    hr_token = login(client, "hr@xingye.test")
    view = client.get(
        "/api/v1/tenant-level-mapping", headers=auth_header(hr_token)
    ).json()
    assert view["framework_version"] == 2

    # 绑定已归档的 v1 提交映射 → 409
    stale = client.put(
        "/api/v1/tenant-level-mapping",
        headers=auth_header(hr_token),
        json={"framework_version_id": v1_id,
              "items": [
                  {"grade_code": g, "level_order": lv}
                  for g, lv in DEFAULT_GRADE_LEVELS.items()
              ]},
    )
    assert stale.status_code == 409
    assert stale.json()["code"] == "framework_version_stale"
