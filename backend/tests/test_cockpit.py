"""驾驶舱问答测试：假 LLM 客户端，不触网。"""
import json

import pytest

from app.models.ai import AIUsage
from app.models.tenant_config import TenantConfig
from app.models.user import User
from sqlalchemy import select
from tests import fake_llm
from tests.conftest import auth_header, login


@pytest.fixture(scope="module")
def h(client):
    return auth_header(login(client, "hr@xingye.test"))


@pytest.fixture(scope="module")
def emp_h(client):
    return auth_header(login(client, "employee@xingye.test"))


@pytest.fixture(scope="module")
def tenant_id(db_session):
    user = db_session.scalar(
        select(User).where(User.email == "hr@xingye.test")
    )
    return user.tenant_id


def _set_key(db_session, tenant_id, key):
    row = db_session.get(TenantConfig, tenant_id)
    values = dict(row.values) if row and row.values else {}
    if key is None:
        values.pop("ai_api_key", None)
    else:
        values["ai_api_key"] = key
    if row is None:
        db_session.add(TenantConfig(tenant_id=tenant_id, values=values))
    else:
        row.values = values
    db_session.commit()


@pytest.fixture
def configured_ai(db_session, tenant_id):
    _set_key(db_session, tenant_id, "test-key")
    yield
    _set_key(db_session, tenant_id, None)


def test_ask_without_key_returns_503(client, h, db_session, tenant_id):
    _set_key(db_session, tenant_id, None)
    resp = client.post(
        "/api/v1/cockpit/ask", headers=h, json={"question": "高潜有几人？"}
    )
    assert resp.status_code == 503
    assert resp.json()["code"] == "ai_not_configured"


def test_ask_success_with_traceable_sources(client, h, configured_ai, db_session):
    def good_handler(messages):
        return (
            json.dumps(
                {
                    "answer": "最新盘点高潜 2 人；核心岗位高风险 1 个，建议优先补位。",
                    "sources": ["最新盘点", "继任概览"],
                },
                ensure_ascii=False,
            ),
            60,
            40,
        )

    fake_llm.set_handler(good_handler)
    before = db_session.query(AIUsage).filter_by(feature="cockpit_qa").count()
    try:
        resp = client.post(
            "/api/v1/cockpit/ask",
            headers=h,
            json={"question": "高潜有几人？断层风险如何？"},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["answer"].startswith("最新盘点高潜")
        assert set(data["sources"]) <= {"最新盘点", "继任概览", "员工名册"}
        assert data["model"]

        after = db_session.query(AIUsage).filter_by(feature="cockpit_qa").count()
        assert after == before + 1
        usage = (
            db_session.query(AIUsage)
            .filter_by(feature="cockpit_qa")
            .order_by(AIUsage.id.desc())
            .first()
        )
        assert usage.total_tokens == 100
    finally:
        fake_llm.reset_handler()


def test_ask_forbidden_for_employee(client, emp_h, configured_ai):
    resp = client.post(
        "/api/v1/cockpit/ask", headers=emp_h, json={"question": "测试"}
    )
    assert resp.status_code == 403


def test_ask_bad_llm_output_returns_502(client, h, configured_ai):
    def bad_handler(messages):
        return "我不是 JSON", 10, 5

    fake_llm.set_handler(bad_handler)
    try:
        resp = client.post(
            "/api/v1/cockpit/ask", headers=h, json={"question": "测试"}
        )
        assert resp.status_code == 502
        assert resp.json()["code"] == "ai_request_failed"
    finally:
        fake_llm.reset_handler()


def test_context_contains_real_facts(db_session, tenant_id):
    """事实组装应产出三类来源且无异常（无已发布批次时走兜底文案）。"""
    from app.services.cockpit import build_context

    context = build_context(db_session, tenant_id)
    assert "员工名册" in context
    assert "最新盘点" in context
    assert "继任概览" in context
    assert "在职员工共" in context
