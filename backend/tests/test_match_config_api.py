"""/match/config 端点测试（spec match-engine AC-5、AC-11 配置侧）。"""

from sqlalchemy import select

from app.models.audit import AuditLog
from app.services.match import (
    DEFAULT_GOOD,
    DEFAULT_REQUIRED,
    DEFAULT_WARN,
    DEFAULT_WEIGHTS,
    MATCH_DIMENSIONS,
)
from tests.conftest import auth_header, login


def _valid_payload(**overrides):
    payload = {
        "weights": dict(DEFAULT_WEIGHTS),
        "required": dict(DEFAULT_REQUIRED),
        "good_threshold": DEFAULT_GOOD,
        "warn_threshold": DEFAULT_WARN,
    }
    payload.update(overrides)
    return payload


# --- TR-3.1 持权读写 + 审计 ---------------------------------------------------

def test_hr_get_default_config(client):
    token = login(client, "hr@xingye.test")
    resp = client.get("/api/v1/match/config", headers=auth_header(token))
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["is_default"] is True
    assert data["weights"] == DEFAULT_WEIGHTS
    assert data["required"] == DEFAULT_REQUIRED
    assert data["good_threshold"] == 80
    assert data["warn_threshold"] == 60


def test_hr_put_then_get_persists_and_audits(client, db_session):
    token = login(client, "hr@xingye.test")
    headers = auth_header(token)
    payload = _valid_payload(
        weights={**dict(DEFAULT_WEIGHTS), "perf": 0.3, "knowledge": 0.1},
        required={**dict(DEFAULT_REQUIRED), "ability": 75},
        good_threshold=85,
        warn_threshold=65,
    )
    resp = client.put("/api/v1/match/config", json=payload, headers=headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["is_default"] is False
    assert data["weights"]["perf"] == 0.3
    assert data["required"]["ability"] == 75
    assert data["good_threshold"] == 85

    # 再次 GET 持久生效
    again = client.get("/api/v1/match/config", headers=headers).json()
    assert again["is_default"] is False
    assert again["warn_threshold"] == 65

    # 审计留痕：before/after 全量快照（Minor-10），可回溯旧配置
    logs = db_session.scalars(
        select(AuditLog).where(AuditLog.action == "match_config_updated")
    ).all()
    assert len(logs) == 1
    assert logs[0].entity_type == "match_tenant_config"
    before = logs[0].before
    assert before["is_default"] is True  # 首次修改前为平台默认
    assert before["weights"] == DEFAULT_WEIGHTS
    assert before["required"] == DEFAULT_REQUIRED
    assert before["good_threshold"] == DEFAULT_GOOD
    after = logs[0].after
    assert after["weights"]["perf"] == 0.3
    assert after["required"]["ability"] == 75
    assert after["good_threshold"] == 85
    assert after["warn_threshold"] == 65


# --- TR-3.2 无权限 403 --------------------------------------------------------

def test_employee_forbidden(client):
    token = login(client, "employee@xingye.test")
    headers = auth_header(token)
    assert client.get("/api/v1/match/config", headers=headers).status_code == 403
    resp = client.put(
        "/api/v1/match/config", json=_valid_payload(), headers=headers
    )
    assert resp.status_code == 403


# --- TR-3.3 非法入参 422 ------------------------------------------------------

def test_invalid_payload_returns_422(client):
    token = login(client, "hr@xingye.test")
    headers = auth_header(token)
    bad = _valid_payload(good_threshold=50, warn_threshold=60)  # warn >= good
    resp = client.put("/api/v1/match/config", json=bad, headers=headers)
    assert resp.status_code == 422


# --- TR-3.4 租户隔离 ----------------------------------------------------------

def test_config_is_tenant_scoped(client):
    t1 = login(client, "hr@xingye.test")
    t2 = login(client, "hr@linyuan.test")
    client.put(
        "/api/v1/match/config",
        json=_valid_payload(good_threshold=85, warn_threshold=65),
        headers=auth_header(t1),
    )
    t2_view = client.get(
        "/api/v1/match/config", headers=auth_header(t2)
    ).json()
    assert t2_view["is_default"] is True
    assert t2_view["good_threshold"] == DEFAULT_GOOD
