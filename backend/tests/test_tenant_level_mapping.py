"""层级框架 L3：租户职级映射合并视图与整表提交。"""

from sqlalchemy import select

from app.framework_content import DEFAULT_GRADE_LEVELS
from app.models.audit import AuditLog
from tests.conftest import auth_header, login


def _default_items(**overrides):
    items = [
        {"grade_code": g, "level_order": lv}
        for g, lv in DEFAULT_GRADE_LEVELS.items()
    ]
    for item in items:
        if item["grade_code"] in overrides:
            item["level_order"] = overrides[item["grade_code"]]
    return items


def _current_framework_id(client, token):
    resp = client.get(
        "/api/v1/level-framework/latest", headers=auth_header(token)
    )
    assert resp.status_code == 200
    return resp.json()["id"]


def test_get_mapping_forbidden_for_employee(client):
    token = login(client, "employee@xingye.test")
    resp = client.get(
        "/api/v1/tenant-level-mapping", headers=auth_header(token)
    )
    assert resp.status_code == 403


def test_get_default_mapping_view(client):
    token = login(client, "hr@xingye.test")
    resp = client.get(
        "/api/v1/tenant-level-mapping", headers=auth_header(token)
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["framework_version"] == 1
    grades = {it["grade_code"]: it for it in data["items"]}
    # 默认职级 + 本租户员工档案职级（M2/P2/P3/P4 均已在默认表）
    assert set(grades) == set(DEFAULT_GRADE_LEVELS)
    assert grades["P4"]["level_order"] == 3
    assert grades["P4"]["level_name"] == "骨干层"
    assert grades["P4"]["source"] == "default"
    assert grades["M3"]["level_name"] == "精英层"


def test_put_override_p4_to_elite(client):
    token = login(client, "hr@xingye.test")
    fw_id = _current_framework_id(client, token)
    body = {
        "framework_version_id": fw_id,
        "items": _default_items(P4=4),
    }
    resp = client.put(
        "/api/v1/tenant-level-mapping",
        headers=auth_header(token),
        json=body,
    )
    assert resp.status_code == 200, resp.text
    grades = {it["grade_code"]: it for it in resp.json()["items"]}
    assert grades["P4"]["level_order"] == 4
    assert grades["P4"]["level_name"] == "精英层"
    assert grades["P4"]["source"] == "override"
    assert grades["P3"]["source"] == "default"

    # 解析端点经覆盖返回精英层
    resolve = client.get(
        "/api/v1/level-framework/resolve?grade=P4",
        headers=auth_header(token),
    )
    assert resolve.json()["level"]["name"] == "精英层"
    assert resolve.json()["source"] == "override"


def test_put_allowed_for_tenant_admin(client):
    token = login(client, "admin@xingye.test")
    fw_id = _current_framework_id(client, token)
    resp = client.put(
        "/api/v1/tenant-level-mapping",
        headers=auth_header(token),
        json={"framework_version_id": fw_id, "items": _default_items()},
    )
    assert resp.status_code == 200, resp.text


def test_put_rejects_inversion(client):
    token = login(client, "hr@xingye.test")
    fw_id = _current_framework_id(client, token)
    # P3 提到骨干层，P4 压到基础层 → 倒挂
    items = _default_items(P3=3, P4=1)
    resp = client.put(
        "/api/v1/tenant-level-mapping",
        headers=auth_header(token),
        json={"framework_version_id": fw_id, "items": items},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "mapping_not_monotonic"

    # 原映射不变
    view = client.get(
        "/api/v1/tenant-level-mapping", headers=auth_header(token)
    ).json()
    assert next(i for i in view["items"] if i["grade_code"] == "P4")[
        "level_order"
    ] == 3


def test_put_rejects_missing_required_grade(client):
    token = login(client, "hr@xingye.test")
    fw_id = _current_framework_id(client, token)
    items = [i for i in _default_items() if i["grade_code"] != "M2"]
    resp = client.put(
        "/api/v1/tenant-level-mapping",
        headers=auth_header(token),
        json={"framework_version_id": fw_id, "items": items},
    )
    assert resp.status_code == 422
    body = resp.json()
    assert body["code"] == "mapping_incomplete"
    assert "M2" in body["details"]


def test_put_rejects_unknown_framework_version(client):
    token = login(client, "hr@xingye.test")
    resp = client.put(
        "/api/v1/tenant-level-mapping",
        headers=auth_header(token),
        json={
            "framework_version_id": "00000000-0000-0000-0000-000000000000",
            "items": _default_items(),
        },
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "framework_version_not_found"


def test_put_rejects_bad_level_order(client):
    token = login(client, "hr@xingye.test")
    fw_id = _current_framework_id(client, token)
    resp = client.put(
        "/api/v1/tenant-level-mapping",
        headers=auth_header(token),
        json={
            "framework_version_id": fw_id,
            "items": _default_items(P4=9),
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "invalid_level_order"


def test_other_tenant_unaffected(client):
    # t1 改 P4 → 精英层
    token1 = login(client, "hr@xingye.test")
    fw_id = _current_framework_id(client, token1)
    ok = client.put(
        "/api/v1/tenant-level-mapping",
        headers=auth_header(token1),
        json={"framework_version_id": fw_id, "items": _default_items(P4=4)},
    )
    assert ok.status_code == 200

    # t2 视图与解析仍为默认骨干层
    token2 = login(client, "hr@linyuan.test")
    view = client.get(
        "/api/v1/tenant-level-mapping", headers=auth_header(token2)
    ).json()
    p4 = next(i for i in view["items"] if i["grade_code"] == "P4")
    assert p4["source"] == "default"
    assert p4["level_order"] == 3


def test_mapping_update_audited(client, db_session):
    token = login(client, "hr@xingye.test")
    fw_id = _current_framework_id(client, token)
    client.put(
        "/api/v1/tenant-level-mapping",
        headers=auth_header(token),
        json={"framework_version_id": fw_id, "items": _default_items(P4=4)},
    )

    log = db_session.scalar(
        select(AuditLog).where(
            AuditLog.action == "tenant_level_mapping_update"
        )
    )
    assert log is not None
    assert log.entity_type == "tenant_level_mapping"
    after_rows = log.after["items"]
    assert next(i for i in after_rows if i["grade_code"] == "P4")[
        "level_order"
    ] == 4
    assert log.actor_id is not None
