"""SaaS 运营模块 API 测试：套餐/账单/AI 用量/模板市场/配置中心。"""
import uuid

from sqlalchemy import select

from app.models.ai import AIUsage
from app.models.saas import SaasConfigItem, TemplatePack
from app.models.user import Tenant
from tests.conftest import auth_header, login


def _xingye_id(db):
    return db.scalar(select(Tenant.id).where(Tenant.name == "星野制造"))


def test_list_plans(client, db_session):
    hr = login(client, "hr@xingye.test")
    resp = client.get("/api/v1/saas/plans", headers=auth_header(hr))
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_bill_crud_and_pay(client, db_session):
    hr = login(client, "hr@xingye.test")
    resp = client.post("/api/v1/saas/bills", json={
        "period": "2026-09", "plan_name": "专业版", "seats": 43,
        "seat_cost": 5547, "ai_cost": 286.4, "total": 5833.4, "status": "pending",
    }, headers=auth_header(hr))
    assert resp.status_code == 201
    bill = resp.json()
    assert bill["status"] == "pending"
    assert bill["total"] == 5833.4

    resp = client.get("/api/v1/saas/bills", headers=auth_header(hr))
    assert resp.status_code == 200
    assert len(resp.json()) >= 1

    resp = client.post(f"/api/v1/saas/bills/{bill['id']}/pay", headers=auth_header(hr))
    assert resp.status_code == 200
    assert resp.json()["status"] == "paid"

    resp = client.put(f"/api/v1/saas/bills/{bill['id']}", json={"seats": 44}, headers=auth_header(hr))
    assert resp.json()["seats"] == 44


def test_bill_cross_tenant_404(client, db_session):
    hr = login(client, "hr@xingye.test")
    t2 = login(client, "hr@linyuan.test")
    bill = client.post("/api/v1/saas/bills", json={
        "period": "2026-09", "plan_name": "标准版", "seats": 10, "total": 690,
    }, headers=auth_header(t2)).json()
    resp = client.post(f"/api/v1/saas/bills/{bill['id']}/pay", headers=auth_header(hr))
    assert resp.status_code == 404


def test_ai_usage_list_and_quota(client, db_session):
    hr = login(client, "hr@xingye.test")
    tenant_id = _xingye_id(db_session)
    db_session.add(AIUsage(
        tenant_id=tenant_id, feature="出题", model="豆包-pro",
        prompt_tokens=8600, completion_tokens=4200, total_tokens=12800,
        cost=0.082, operator="系统自动",
    ))
    db_session.commit()

    resp = client.get("/api/v1/saas/ai/usage", headers=auth_header(hr))
    assert resp.status_code == 200
    rows = resp.json()
    assert len(rows) >= 1
    assert rows[0]["scene"] == "出题"
    assert rows[0]["input_tokens"] == 8600

    # 按场景过滤
    resp = client.get("/api/v1/saas/ai/usage?scene=归因", headers=auth_header(hr))
    assert all(r["scene"] == "归因" for r in resp.json())

    # 配额
    resp = client.get("/api/v1/saas/ai/quota", headers=auth_header(hr))
    assert resp.status_code == 200
    quota = resp.json()
    assert quota["monthly_token_quota"] > 0
    assert quota["month_used_tokens"] >= 12800

    resp = client.put("/api/v1/saas/ai/quota", json={
        "monthly_token_quota": 80_000_000, "over_strategy": "降级为规则引擎",
    }, headers=auth_header(hr))
    assert resp.json()["monthly_token_quota"] == 80_000_000

    # 趋势
    resp = client.get("/api/v1/saas/ai/trend?months=3", headers=auth_header(hr))
    assert resp.status_code == 200
    assert len(resp.json()) == 3


def test_template_install_uninstall(client, db_session):
    hr = login(client, "hr@xingye.test")
    pack = TemplatePack(name="测试行业包", industry="通用", version="v1.0",
                        standards_count=50, rating=4.5, installs=10, desc="测试")
    db_session.add(pack)
    db_session.commit()

    resp = client.get("/api/v1/saas/templates", headers=auth_header(hr))
    assert resp.status_code == 200

    resp = client.post(f"/api/v1/saas/templates/{pack.id}/install", headers=auth_header(hr))
    assert resp.status_code == 201
    assert resp.json()["installed"] is True
    assert resp.json()["active"] is True

    resp = client.delete(f"/api/v1/saas/templates/{pack.id}/install", headers=auth_header(hr))
    assert resp.status_code == 204

    # 重复卸载不报错
    resp = client.delete(f"/api/v1/saas/templates/{uuid.uuid4()}/install", headers=auth_header(hr))
    assert resp.status_code == 204


def test_config_update(client, db_session):
    hr = login(client, "hr@xingye.test")
    tenant_id = _xingye_id(db_session)
    item = SaasConfigItem(
        tenant_id=tenant_id, group="强制分布",
        template_value="S 10% / A 25%", override_value="", note="测试配置",
    )
    db_session.add(item)
    db_session.commit()

    resp = client.get("/api/v1/saas/config", headers=auth_header(hr))
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) >= 1
    assert items[0]["customized"] is False

    resp = client.put(f"/api/v1/saas/config/{item.id}", json={
        "override_value": "S 8% / A 27%", "status": "active",
    }, headers=auth_header(hr))
    assert resp.status_code == 200
    body = resp.json()
    assert body["override_value"] == "S 8% / A 27%"
    assert body["customized"] is True


def test_invalid_bill_period(client, db_session):
    hr = login(client, "hr@xingye.test")
    resp = client.post("/api/v1/saas/bills", json={
        "period": "2026/09", "plan_name": "标准版", "seats": 10, "total": 690,
    }, headers=auth_header(hr))
    assert resp.status_code == 422
