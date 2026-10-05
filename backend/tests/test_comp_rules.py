"""Task 2：薪酬规则配置（矩阵/固浮比/停涨）服务与端点。"""
import pytest
from sqlalchemy import select

from app.core.permissions import BUILTIN_TEMPLATES, PERMISSION_POINTS
from app.models.audit import AuditLog
from app.models.tenant_config import TenantConfig
from app.services.comp_rules import (
    PLATFORM_COMP_RULES,
    hits_market_stop,
    pay_mix_months,
    resolve_comp_rules,
    suggest_adjust_pct,
    update_comp_rules,
)
from tests.conftest import auth_header, login

NEW_POINTS = ("comp.rule.manage", "bonus.manage")


# ---------- 权限点目录与模板 ----------

def test_comp_points_registered():
    for code in NEW_POINTS:
        assert code in PERMISSION_POINTS


def test_hr_coe_comp_has_comp_points():
    perms = BUILTIN_TEMPLATES["hr_coe_comp"].permissions
    assert "comp.rule.manage" in perms
    assert "bonus.manage" in perms
    # manager 不应持有
    assert "bonus.manage" not in BUILTIN_TEMPLATES["manager"].permissions
    assert "comp.rule.manage" not in BUILTIN_TEMPLATES["manager"].permissions


# ---------- TR-2.1 默认回落 ----------

def test_default_comp_rules_when_unconfigured(db_session):
    t1_id = _tenant_id(db_session, "星野制造")
    rules = resolve_comp_rules(db_session, t1_id)
    assert rules == PLATFORM_COMP_RULES
    assert rules["adjust_matrix"]["S"] == [8, 10, 12, 15]
    assert rules["market_stop"] == "p75"
    assert rules["pay_mix"]["SW"] == 3
    assert rules["pay_mix"]["default"] == 3
    assert rules["pip_fail_adjust_pct"] == -10


# ---------- TR-2.2 租户覆盖与留痕 ----------

def test_tenant_overrides_comp_rules(db_session):
    t1_id = _tenant_id(db_session, "星野制造")
    t2_id = _tenant_id(db_session, "临渊科技")
    try:
        update_comp_rules(
            db_session, t1_id, None,
            {"adjust_matrix": {"S": [12, 10, 12, 15]}, "market_stop": "p90"},
        )
        db_session.commit()

        t1 = resolve_comp_rules(db_session, t1_id)
        t2 = resolve_comp_rules(db_session, t2_id)
        # 覆盖生效
        assert t1["adjust_matrix"]["S"] == [12, 10, 12, 15]
        assert t1["market_stop"] == "p90"
        # 未覆盖项保持默认
        assert t1["adjust_matrix"]["A"] == [5, 6, 8, 10]
        assert t1["pay_mix"]["SW"] == 3
        # 另一租户不受影响
        assert t2["adjust_matrix"]["S"] == [8, 10, 12, 15]
        assert t2["market_stop"] == "p75"
    finally:
        db_session.query(TenantConfig).filter(
            TenantConfig.tenant_id == t1_id
        ).delete()
        db_session.commit()


def test_update_comp_rules_rejects_unknown_key(db_session):
    t1_id = _tenant_id(db_session, "星野制造")
    with pytest.raises(ValueError):
        update_comp_rules(db_session, t1_id, None, {"unknown": 1})


def test_update_comp_rules_rejects_legacy_numeric_market_stop(db_session):
    """停涨线为市场分位键（p25/p50/p75/p90），旧的渗透率数值不再合法。"""
    t1_id = _tenant_id(db_session, "星野制造")
    with pytest.raises(ValueError):
        update_comp_rules(db_session, t1_id, None, {"market_stop": 0.80})


def test_update_comp_rules_writes_audit(db_session):
    t1_id = _tenant_id(db_session, "星野制造")
    try:
        before = {a.id for a in db_session.scalars(select(AuditLog)).all()}
        update_comp_rules(db_session, t1_id, None, {"market_stop": "p90"})
        db_session.commit()
        rows = [
            a for a in db_session.scalars(select(AuditLog)).all()
            if a.id not in before and a.action == "comp_rules_updated"
        ]
        assert len(rows) == 1
        assert rows[0].after["market_stop"] == "p90"
    finally:
        db_session.query(TenantConfig).filter(
            TenantConfig.tenant_id == t1_id
        ).delete()
        db_session.commit()


# ---------- 辅助函数：矩阵建议 ----------

def test_suggest_adjust_pct_matrix_lookup(db_session):
    rules = resolve_comp_rules(db_session, _tenant_id(db_session, "星野制造"))
    # S 档 <0.40 → 8%
    pct, mark = suggest_adjust_pct(rules, "S", 0.30, False)
    assert pct == 8.0
    assert mark is None
    # A 档 0.40–0.70 → 6%
    pct, _ = suggest_adjust_pct(rules, "A", 0.50, False)
    assert pct == 6.0
    # B 档 0.70–0.75（未触停涨）→ 3%
    pct, _ = suggest_adjust_pct(rules, "B", 0.72, False)
    assert pct == 3.0
    # C 档任意 → 0%
    pct, _ = suggest_adjust_pct(rules, "C", 0.30, False)
    assert pct == 0.0


def test_suggest_adjust_pct_uses_matrix_not_penetration_stop(db_session):
    """停涨不再按渗透率判定：渗透率高但未达市场 P75 薪点时仍给矩阵建议。"""
    rules = resolve_comp_rules(db_session, _tenant_id(db_session, "星野制造"))
    # S 档 0.70–0.90 → 12%（旧规则会因 ≥0.75 误停涨）
    pct, mark = suggest_adjust_pct(rules, "S", 0.80, False)
    assert pct == 12.0
    assert mark is None


def test_hits_market_stop_compares_salary_to_market_point(db_session):
    # 现薪 ≥ 市场 P75 薪点 → 停涨
    assert hits_market_stop(25000, 25000) is True
    assert hits_market_stop(26000, "25000") is True
    assert hits_market_stop(24999, 25000) is False
    # 无市场分位数据 → 不触发
    assert hits_market_stop(26000, None) is False


def test_suggest_adjust_pct_pip_fail_override(db_session):
    rules = resolve_comp_rules(db_session, _tenant_id(db_session, "星野制造"))
    # D + PIP 不通过 → -10%，优先于停涨
    pct, mark = suggest_adjust_pct(rules, "D", 0.80, True)
    assert pct == -10.0
    assert mark == "pip_fail"


def test_pay_mix_months(db_session):
    rules = resolve_comp_rules(db_session, _tenant_id(db_session, "星野制造"))
    assert pay_mix_months(rules, "SW") == 3.0
    assert pay_mix_months(rules, "MGT") == 4.0
    assert pay_mix_months(rules, "SALES") == 6.0
    # 未配置序列回落 default
    assert pay_mix_months(rules, "UNKNOWN") == 3.0


# ---------- 端点 ----------

def test_get_comp_rules_as_hr(client):
    token = login(client, "hr@xingye.test")
    resp = client.get("/api/v1/comp/rules", headers=auth_header(token))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["adjust_matrix"]["S"] == [8, 10, 12, 15]
    assert body["market_stop"] == "p75"


def test_get_comp_rules_forbidden_for_employee(client):
    token = login(client, "employee@xingye.test")
    resp = client.get("/api/v1/comp/rules", headers=auth_header(token))
    assert resp.status_code == 403


def test_put_comp_rules_as_hr(client, db_session):
    t1_id = _tenant_id(db_session, "星野制造")
    try:
        token = login(client, "hr@xingye.test")
        resp = client.put(
            "/api/v1/comp/rules",
            headers=auth_header(token),
            json={"market_stop": "p90", "pay_mix": {"SW": 4}},
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["market_stop"] == "p90"
        assert resp.json()["pay_mix"]["SW"] == 4
        # 未覆盖项保持
        assert resp.json()["adjust_matrix"]["S"] == [8, 10, 12, 15]
    finally:
        db_session.query(TenantConfig).filter(
            TenantConfig.tenant_id == t1_id
        ).delete()
        db_session.commit()


def test_put_comp_rules_forbidden_for_manager(client):
    token = login(client, "manager@xingye.test")
    resp = client.put(
        "/api/v1/comp/rules",
        headers=auth_header(token),
        json={"market_stop": "p90"},
    )
    assert resp.status_code == 403


def _tenant_id(db_session, name):
    from app.models.user import Tenant

    return db_session.scalar(select(Tenant.id).where(Tenant.name == name))
