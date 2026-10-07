"""平台运营模块 API 测试：租户管理 + 运营看板（仅 platform_admin）。"""
import uuid

from sqlalchemy import select

from app.models.saas import PlatformMonthlyMetric
from app.models.user import Tenant
from tests.conftest import auth_header, login


def _xingye_id(db):
    return db.scalar(select(Tenant.id).where(Tenant.name == "星野制造"))


def _seed_metrics(db):
    rows = [
        PlatformMonthlyMetric(month="2026-04", mrr=426000, new_tenants=2),
        PlatformMonthlyMetric(month="2026-05", mrr=488000, new_tenants=3),
        PlatformMonthlyMetric(month="2026-06", mrr=542000, new_tenants=1),
        PlatformMonthlyMetric(month="2026-07", mrr=610000, new_tenants=4),
        PlatformMonthlyMetric(month="2026-08", mrr=651000, new_tenants=2),
        PlatformMonthlyMetric(month="2026-09", mrr=682000, new_tenants=3),
    ]
    db.add_all(rows)
    db.commit()


def test_platform_tenants_forbidden_for_non_platform(client, db_session):
    hr = login(client, "hr@xingye.test")
    resp = client.get("/api/v1/platform/tenants", headers=auth_header(hr))
    assert resp.status_code == 403


def test_list_platform_tenants(client, db_session):
    pa = login(client, "admin@platform.test")
    resp = client.get("/api/v1/platform/tenants", headers=auth_header(pa))
    assert resp.status_code == 200
    data = resp.json()
    names = {t["name"] for t in data}
    assert "星野制造" in names
    assert "临渊科技" in names
    # 每个租户都带平台字段
    for t in data:
        assert "status" in t
        assert "seats" in t
        assert "mrr" in t


def test_list_platform_tenants_filter_status(client, db_session):
    pa = login(client, "admin@platform.test")
    resp = client.get("/api/v1/platform/tenants?status=active", headers=auth_header(pa))
    assert resp.status_code == 200
    assert all(t["status"] == "active" for t in resp.json())


def test_update_platform_tenant(client, db_session):
    pa = login(client, "admin@platform.test")
    tid = _xingye_id(db_session)
    resp = client.put(
        f"/api/v1/platform/tenants/{tid}",
        json={"plan_name": "专业版", "seats": 50, "health": 85},
        headers=auth_header(pa),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["plan_name"] == "专业版"
    assert body["seats"] == 50
    assert body["health"] == 85


def test_suspend_and_restore_tenant(client, db_session):
    pa = login(client, "admin@platform.test")
    tid = _xingye_id(db_session)

    resp = client.post(f"/api/v1/platform/tenants/{tid}/suspend", headers=auth_header(pa))
    assert resp.status_code == 200
    assert resp.json()["status"] == "suspended"

    resp = client.post(f"/api/v1/platform/tenants/{tid}/restore", headers=auth_header(pa))
    assert resp.status_code == 200
    assert resp.json()["status"] == "active"


def test_suspend_nonexistent_tenant_404(client, db_session):
    pa = login(client, "admin@platform.test")
    fake = str(uuid.uuid4())
    resp = client.post(f"/api/v1/platform/tenants/{fake}/suspend", headers=auth_header(pa))
    assert resp.status_code == 404


def test_platform_dashboard(client, db_session):
    pa = login(client, "admin@platform.test")
    _seed_metrics(db_session)

    resp = client.get("/api/v1/platform/dashboard", headers=auth_header(pa))
    assert resp.status_code == 200
    d = resp.json()
    assert d["total_tenants"] == 2
    assert d["paying_tenants"] == 2  # 默认 active
    assert d["trial_tenants"] == 0
    assert d["mrr"] >= 0
    assert d["paid_seats"] >= 0
    assert d["new_tenants_this_month"] == 3
    assert d["trial_conversion"] == 100
    assert len(d["mrr_trend"]) == 6
    assert d["mrr_trend"][-1]["mrr"] == 682000
    assert len(d["industry_dist"]) >= 1
    assert len(d["plan_dist"]) >= 1
    assert len(d["risky_tenants"]) <= 4
