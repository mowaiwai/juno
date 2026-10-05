"""Task 3：等级工资表增强（市场分位 + 渗透率）。"""
from sqlalchemy import select

from app.models.compensation import TenantSalaryBand
from app.models.user import Tenant
from app.services.comp_rules import penetration_rate
from tests.conftest import auth_header, login


def test_put_salary_band_with_market_percentiles(client, db_session):
    t1_id = db_session.scalar(select(Tenant.id).where(Tenant.name == "星野制造"))
    try:
        token = login(client, "hr@xingye.test")
        resp = client.put(
            "/api/v1/org/salary-bands",
            headers=auth_header(token),
            json={
                "grade": "P3",
                "min_value": 16000,
                "max_value": 28000,
                "p25": 15000,
                "p50": 20000,
                "p75": 25000,
                "p90": 30000,
                "market_source_year": 2025,
            },
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["p50"] == 20000
        assert body["p75"] == 25000
        assert body["market_source_year"] == 2025
        # 落库
        row = db_session.scalar(
            select(TenantSalaryBand).where(
                TenantSalaryBand.tenant_id == t1_id,
                TenantSalaryBand.grade == "P3",
            )
        )
        assert row is not None
        assert row.p50 == 20000
        assert row.p90 == 30000
    finally:
        db_session.query(TenantSalaryBand).filter(
            TenantSalaryBand.tenant_id == t1_id
        ).delete()
        db_session.commit()


def test_get_channels_returns_market_percentiles(client, db_session):
    t1_id = db_session.scalar(select(Tenant.id).where(Tenant.name == "星野制造"))
    try:
        db_session.add(TenantSalaryBand(
            tenant_id=t1_id, grade="M2",
            min_value=30000, max_value=58000,
            p25=28000, p50=42000, p75=52000, p90=60000,
            market_source_year=2025,
        ))
        db_session.commit()

        token = login(client, "hr@xingye.test")
        resp = client.get("/api/v1/org/channels", headers=auth_header(token))
        assert resp.status_code == 200
        m2 = next(
            g for c in resp.json() for g in c["grades"] if g["grade"] == "M2"
        )
        assert m2["p50"] == 42000
        assert m2["p75"] == 52000
        assert m2["market_source_year"] == 2025
    finally:
        db_session.query(TenantSalaryBand).filter(
            TenantSalaryBand.tenant_id == t1_id
        ).delete()
        db_session.commit()


def test_penetration_rate_normal_case():
    # 带宽 8000-16000，现薪 12000 → (12000-8000)/(16000-8000) = 0.5
    assert penetration_rate(12000, 8000, 16000) == 0.5


def test_penetration_rate_clamped():
    # 低于下限 → 0，高于上限 → 1
    assert penetration_rate(5000, 8000, 16000) == 0.0
    assert penetration_rate(20000, 8000, 16000) == 1.0


def test_penetration_rate_invalid_band():
    assert penetration_rate(10000, 16000, 8000) == 0.0
