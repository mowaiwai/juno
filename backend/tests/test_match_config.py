"""租户匹配配置：实体/读取服务/schema 校验测试（spec match-engine TR-2.1、TR-2.2）。"""

import pytest
from pydantic import ValidationError
from sqlalchemy import select

from app.models.match import MatchTenantConfig
from app.models.user import Tenant
from app.schemas.match import MatchConfigIn
from app.services.match import (
    DEFAULT_GOOD,
    DEFAULT_REQUIRED,
    DEFAULT_WARN,
    DEFAULT_WEIGHTS,
    MATCH_DIMENSIONS,
)
from app.services.match_config import get_match_config, upsert_match_config


def _tenant(db_session, name="星野制造") -> Tenant:
    return db_session.scalar(select(Tenant).where(Tenant.name == name))


# --- TR-2.1 配置读取服务 ------------------------------------------------------

def test_get_config_returns_platform_defaults(db_session):
    t1 = _tenant(db_session)
    cfg = get_match_config(db_session, t1.id)
    assert cfg.is_default is True
    assert cfg.weights == DEFAULT_WEIGHTS
    assert cfg.required == DEFAULT_REQUIRED
    assert cfg.good == DEFAULT_GOOD and cfg.warn == DEFAULT_WARN


def test_upsert_persists_and_get_returns_custom(db_session):
    t1 = _tenant(db_session)
    weights = {k: 0.2 for k in MATCH_DIMENSIONS}
    weights["perf"] = 0.3
    weights["knowledge"] = 0.1
    required = {**DEFAULT_REQUIRED, "ability": 75}
    upsert_match_config(
        db_session, t1.id,
        weights=weights, required=required,
        good=85, warn=65, updated_by=None,
    )
    db_session.commit()

    cfg = get_match_config(db_session, t1.id)
    assert cfg.is_default is False
    assert cfg.weights["perf"] == 0.3
    assert cfg.weights["knowledge"] == 0.1
    assert cfg.required["ability"] == 75
    assert cfg.good == 85 and cfg.warn == 65

    # 每租户仅一行：再次 upsert 不新增
    rows = db_session.scalars(
        select(MatchTenantConfig).where(MatchTenantConfig.tenant_id == t1.id)
    ).all()
    assert len(rows) == 1


def test_tenant_isolation_of_config(db_session):
    t1 = _tenant(db_session, "星野制造")
    t2 = _tenant(db_session, "临渊科技")
    upsert_match_config(
        db_session, t1.id,
        weights=dict(DEFAULT_WEIGHTS), required=dict(DEFAULT_REQUIRED),
        good=85, warn=65, updated_by=None,
    )
    db_session.commit()
    assert get_match_config(db_session, t2.id).is_default is True
    assert get_match_config(db_session, t1.id).good == 85


# --- TR-2.2 schema 校验 -------------------------------------------------------

def _valid_payload(**overrides):
    payload = {
        "weights": dict(DEFAULT_WEIGHTS),
        "required": dict(DEFAULT_REQUIRED),
        "good_threshold": 80,
        "warn_threshold": 60,
    }
    payload.update(overrides)
    return payload


def test_schema_accepts_valid_payload():
    cfg = MatchConfigIn(**_valid_payload())
    assert cfg.good_threshold == 80


@pytest.mark.parametrize(
    "mutate",
    [
        # 权重总和为 0
        lambda p: p.update({"weights": {k: 0.0 for k in MATCH_DIMENSIONS}}),
        # 负权重
        lambda p: p["weights"].update({"perf": -0.1}),
        # 权重缺维
        lambda p: p.update({"weights": {k: 0.25 for k in MATCH_DIMENSIONS
                                        if k != "perf"}}),
        # 权重多未知维
        lambda p: p["weights"].update({"biz": 0.2}),
        # 要求分 0
        lambda p: p["required"].update({"duty": 0}),
        # 要求分 >100
        lambda p: p["required"].update({"duty": 101}),
        # 要求分缺维
        lambda p: p.update({"required": {k: 70 for k in MATCH_DIMENSIONS
                                         if k != "duty"}}),
        # warn >= good
        lambda p: p.update({"good_threshold": 60, "warn_threshold": 60}),
        # 阈值越界
        lambda p: p.update({"good_threshold": 101, "warn_threshold": 60}),
        lambda p: p.update({"good_threshold": 80, "warn_threshold": -1}),
    ],
)
def test_schema_rejects_invalid_payloads(mutate):
    payload = _valid_payload()
    mutate(payload)
    with pytest.raises(ValidationError):
        MatchConfigIn(**payload)
