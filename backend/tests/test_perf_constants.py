"""Task 1：绩效权限点目录 + SABC 常量服务与端点。"""
import pytest
from sqlalchemy import select

from app.core.permissions import (
    BUILTIN_TEMPLATES,
    PERMISSION_GROUPS,
    PERMISSION_POINTS,
)
from app.models.audit import AuditLog
from app.models.tenant_config import TenantConfig
from app.services.perf_rules import (
    PLATFORM_PERF_CONSTANTS,
    coefficient_for,
    grade_for_score,
    resolve_constants,
    update_constants,
)
from tests.conftest import auth_header, login

NEW_POINTS = ("perf.plan.manage", "perf.result.entry", "perf.pip.manage")


# ---------- TR-1.1 目录与模板 ----------

def test_perf_points_registered_in_catalog():
    for code in NEW_POINTS:
        assert code in PERMISSION_POINTS
    group_codes = {
        code
        for _, _, points in PERMISSION_GROUPS
        for code, _ in points
    }
    for code in NEW_POINTS:
        assert code in group_codes


def test_template_grants_per_spec():
    coe_perf = BUILTIN_TEMPLATES["hr_coe_perf"].permissions
    assert "perf.plan.manage" in coe_perf
    assert "perf.pip.manage" in coe_perf
    # 仅 COE·绩效持有方案/PIP 管理点
    for other in ("hr_coe_cadre", "hr_coe_otd", "hr_coe_recruit",
                  "hr_coe_comp", "manager", "hrbp", "exec", "employee"):
        perms = BUILTIN_TEMPLATES[other].permissions
        assert "perf.plan.manage" not in perms
        assert "perf.pip.manage" not in perms
    # 主管初评点：manager/hrbp 有，employee/exec 没有
    assert "perf.result.entry" in BUILTIN_TEMPLATES["manager"].permissions
    assert "perf.result.entry" in BUILTIN_TEMPLATES["hrbp"].permissions
    assert "perf.result.entry" not in BUILTIN_TEMPLATES["employee"].permissions
    assert "perf.result.entry" not in BUILTIN_TEMPLATES["exec"].permissions
    # 旧点保留（OQ-2：P2 再清理）
    assert "employee.field.perf.edit" in coe_perf


def test_preset_all_hr_includes_new_points():
    # 综合 HR 预设为七模板并集，自动获得 COE·绩效的新点
    from app.core.permissions import PRESET_ALL_HR_PERMS

    assert "perf.plan.manage" in PRESET_ALL_HR_PERMS
    assert "perf.pip.manage" in PRESET_ALL_HR_PERMS


# ---------- TR-1.2 常量解析与双租户隔离 ----------

def test_default_constants_when_unconfigured(db_session):
    t1_id = _tenant_id(db_session, "星野制造")
    constants = resolve_constants(db_session, t1_id)
    assert constants == PLATFORM_PERF_CONSTANTS


def test_tenant_overrides_constants(db_session):
    t1_id = _tenant_id(db_session, "星野制造")
    t2_id = _tenant_id(db_session, "临渊科技")
    try:
        update_constants(
            db_session, t1_id, None,
            {"score_cutoffs": {"S": 92}, "coefficients": {"S": 1.4}},
        )
        db_session.commit()

        t1 = resolve_constants(db_session, t1_id)
        t2 = resolve_constants(db_session, t2_id)
        assert t1["score_cutoffs"]["S"] == 92
        assert t1["coefficients"]["S"] == 1.4
        # 未覆盖项保持平台默认
        assert t1["score_cutoffs"]["A"] == 90
        # 另一租户不受影响
        assert t2["score_cutoffs"]["S"] == 95
        assert t2["coefficients"]["S"] == 1.5
    finally:
        db_session.query(TenantConfig).filter(
            TenantConfig.tenant_id == t1_id
        ).delete()
        db_session.commit()


def test_update_constants_rejects_unknown_key(db_session):
    t1_id = _tenant_id(db_session, "星野制造")
    with pytest.raises(ValueError):
        update_constants(db_session, t1_id, None, {"unknown_key": 1})


# ---------- TR-1.2 定档与系数 ----------

def test_grade_for_score_bands(db_session):
    t1_id = _tenant_id(db_session, "星野制造")
    c = resolve_constants(db_session, t1_id)
    assert grade_for_score(c, 98) == "S"
    assert grade_for_score(c, 95) == "S"
    assert grade_for_score(c, 92) == "A"
    assert grade_for_score(c, 90) == "A"
    assert grade_for_score(c, 85) == "B"
    assert grade_for_score(c, 80) == "B"
    assert grade_for_score(c, 72) == "C"
    assert grade_for_score(c, 65) == "C"
    assert grade_for_score(c, 60) == "D"


def test_coefficient_for_each_grade(db_session):
    c = resolve_constants(db_session, _tenant_id(db_session, "星野制造"))
    assert coefficient_for(c, "S") == 1.5
    assert coefficient_for(c, "A") == 1.2
    assert coefficient_for(c, "B") == 1.0
    assert coefficient_for(c, "D") == 0.5
    assert coefficient_for(c, "C", 72) == pytest.approx(0.9, abs=0.001)
    with pytest.raises(ValueError):
        coefficient_for(c, "C")  # C 必须有分数
    with pytest.raises(ValueError):
        coefficient_for(c, "X", 80)


# ---------- TR-1.3 审计 ----------

def test_update_constants_writes_audit(db_session):
    from app.models.user import Tenant

    t1_id = _tenant_id(db_session, "星野制造")
    try:
        before = {
            a.id for a in db_session.scalars(select(AuditLog)).all()
        }
        update_constants(
            db_session, t1_id, None, {"c_divisor": 100}
        )
        db_session.commit()
        rows = [
            a for a in db_session.scalars(select(AuditLog)).all()
            if a.id not in before and a.action == "perf_constants_updated"
        ]
        assert len(rows) == 1
        assert rows[0].after["c_divisor"] == 100
    finally:
        db_session.query(TenantConfig).filter(
            TenantConfig.tenant_id == t1_id
        ).delete()
        db_session.commit()


# ---------- 端点 ----------

def test_get_constants_as_preset_hr(client):
    token = login(client, "hr@xingye.test")
    resp = client.get(
        "/api/v1/perf/constants", headers=auth_header(token)
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["score_cutoffs"]["S"] == 95
    assert body["small_roster_threshold"] == 10


def test_get_constants_allowed_for_manager(client):
    token = login(client, "manager@xingye.test")
    resp = client.get(
        "/api/v1/perf/constants", headers=auth_header(token)
    )
    assert resp.status_code == 200


def test_get_constants_forbidden_for_employee(client):
    token = login(client, "employee@xingye.test")
    resp = client.get(
        "/api/v1/perf/constants", headers=auth_header(token)
    )
    assert resp.status_code == 403


def test_put_constants_as_hr_takes_effect(client, db_session):
    from app.models.user import Tenant

    t1_id = _tenant_id(db_session, "星野制造")
    try:
        token = login(client, "hr@xingye.test")
        resp = client.put(
            "/api/v1/perf/constants",
            headers=auth_header(token),
            json={"score_cutoffs": {"S": 92}, "coefficients": {"S": 1.4}},
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["score_cutoffs"]["S"] == 92
        assert resp.json()["coefficients"]["S"] == 1.4
    finally:
        db_session.query(TenantConfig).filter(
            TenantConfig.tenant_id == t1_id
        ).delete()
        db_session.commit()


def test_put_constants_forbidden_for_manager(client):
    token = login(client, "manager@xingye.test")
    resp = client.put(
        "/api/v1/perf/constants",
        headers=auth_header(token),
        json={"c_divisor": 100},
    )
    assert resp.status_code == 403


def _tenant_id(db_session, name):
    from app.models.user import Tenant

    return db_session.scalar(select(Tenant.id).where(Tenant.name == name))
