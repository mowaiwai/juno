import json
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.models.ai import AISuggestion, AIUsage
from app.models.application import Application
from app.models.tenant_config import TenantConfig
from tests.conftest import auth_header, login
from tests import fake_llm

PANEL_NAMES = {"lead": "江予舟", "rev1": "苏望知", "rev2": "顾言溪"}

_counter = {"n": 0}


def next_key():
    _counter["n"] += 1
    n = _counter["n"]
    return f"A{n:02d}", f"Q{n:02d}"


def std_payload(seq, grade):
    return {
        "sequence": seq,
        "target_grade": grade,
        "items": [
            {"code": f"{seq}-{grade}-01", "name": "系统设计",
             "description": "能独立完成模块设计", "requirement": "2 个案例",
             "weight": 40, "sort_order": 1},
            {"code": f"{seq}-{grade}-02", "name": "协同推进",
             "description": "能跨角色协调", "requirement": "跨部门项目",
             "weight": 30, "sort_order": 2},
            {"code": f"{seq}-{grade}-03", "name": "带教传承",
             "description": "能指导初级同事", "requirement": "带教记录",
             "weight": 30, "sort_order": 3},
        ],
    }


def assessment(seq, grade):
    return {"items": [
        {"standard_item_code": f"{seq}-{grade}-0{i}", "self_level": level,
         "self_comment": "说明"}
        for i, level in enumerate(["met", "met", "partially_met"], start=1)
    ]}


@pytest.fixture(scope="module")
def h(client):
    return auth_header(login(client, "hr@xingye.test"))


@pytest.fixture(scope="module")
def mgr_h(client):
    return auth_header(login(client, "manager@xingye.test"))


@pytest.fixture(scope="module")
def emp_h(client):
    return auth_header(login(client, "employee@xingye.test"))


@pytest.fixture(scope="module")
def rev1_h(client):
    return auth_header(login(client, "rev1@xingye.test"))


@pytest.fixture(scope="module")
def lead_h(client):
    return auth_header(login(client, "lead@xingye.test"))


@pytest.fixture(scope="module")
def panel(client, h):
    rows = client.get("/api/v1/employees", headers=h).json()
    by_name = {r["name"]: r["id"] for r in rows}
    return {k: by_name[v] for k, v in PANEL_NAMES.items()}


def approve_to_committee(client, h, mgr_h, emp_h, panel, seq=None, grade=None):
    """建标准+模板，员工提交，经理通过（触发异步 AI）。返回 (app_id, seq, grade)。"""
    if seq is None:
        seq, grade = next_key()

    std = client.post("/api/v1/standard-sets", headers=h,
                      json=std_payload(seq, grade)).json()
    pub = client.post(f"/api/v1/standard-sets/{std['id']}/publish", headers=h)
    assert pub.status_code == 200

    tpl = client.post(
        "/api/v1/review-panel-templates",
        headers=h,
        json={"sequence": seq, "lead_reviewer_id": panel["lead"],
              "reviewer_ids": [panel["rev1"], panel["rev2"]]},
    )
    assert tpl.status_code == 201, tpl.text

    app_id = client.post(
        "/api/v1/applications", headers=emp_h,
        json={"target_sequence": seq, "target_grade": grade},
    ).json()["id"]
    client.put(f"/api/v1/applications/{app_id}/self-assessment",
               headers=emp_h, json=assessment(seq, grade))
    submit = client.post(f"/api/v1/applications/{app_id}/submit",
                         headers=emp_h)
    assert submit.status_code == 200

    approve = client.post(
        f"/api/v1/applications/{app_id}/manager-review",
        headers=mgr_h, json={"decision": "approved"},
    )
    assert approve.status_code == 200, approve.text
    return app_id, seq, grade


def get_suggestion(client, app_id, headers):
    return client.get(f"/api/v1/applications/{app_id}/ai-suggestion",
                      headers=headers)


# ---- 异步生成成功 ----

def test_suggestion_generated_after_approval(
    client, h, mgr_h, emp_h, panel, lead_h
):
    app_id, seq, grade = approve_to_committee(
        client, h, mgr_h, emp_h, panel
    )
    resp = get_suggestion(client, app_id, lead_h)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "completed"
    assert len(body["questions"]) == 3
    assert all(isinstance(q, str) and q.strip() for q in body["questions"])
    assert body["opinion"]


def test_suggestion_visible_to_lead_only(
    client, h, mgr_h, emp_h, panel, rev1_h
):
    app_id, _, _ = approve_to_committee(client, h, mgr_h, emp_h, panel)
    # 评委不可见 AI 产出
    assert get_suggestion(client, app_id, rev1_h).status_code == 403
    # 员工不可见
    assert get_suggestion(client, app_id, emp_h).status_code == 403
    # HR 不可见
    assert get_suggestion(client, app_id, h).status_code == 403


# ---- 生成中 202 ----

def test_pending_returns_202_then_completes(
    client, h, mgr_h, emp_h, panel, lead_h, db_session
):
    app_id, _, _ = approve_to_committee(client, h, mgr_h, emp_h, panel)
    # 模拟生成尚未完成：先删已完成行，插 pending 行
    db_session.query(AISuggestion).filter_by(
        application_id=uuid.UUID(app_id)
    ).delete()
    db_session.add(
        AISuggestion(application_id=uuid.UUID(app_id), status="pending")
    )
    db_session.commit()

    resp = get_suggestion(client, app_id, lead_h)
    assert resp.status_code == 202

    # 手动执行 worker → 完成
    from app.services.ai import generate_for_application

    generate_for_application(db_session, uuid.UUID(app_id))
    db_session.commit()

    assert get_suggestion(client, app_id, lead_h).status_code == 200


# ---- 失败重试 ----

def test_failure_after_retries_marks_failed(
    client, h, mgr_h, emp_h, panel, lead_h
):
    seq, grade = next_key()

    def failing_handler(messages):
        raise RuntimeError("模型服务暂不可用")

    fake_llm.set_handler(failing_handler)
    try:
        app_id, _, _ = approve_to_committee(
            client, h, mgr_h, emp_h, panel, seq, grade
        )
    finally:
        fake_llm.reset_handler()

    resp = get_suggestion(client, app_id, lead_h)
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "failed"
    assert body["questions"] is None
    # 人工流程不被阻塞：申请仍在评审中
    detail = client.get(f"/api/v1/applications/{app_id}", headers=lead_h)
    assert detail.json()["status"] == "in_committee_review"


def test_succeeds_on_third_attempt(
    client, h, mgr_h, emp_h, panel, lead_h
):
    seq, grade = next_key()
    attempts = {"n": 0}

    def flaky_handler(messages):
        attempts["n"] += 1
        if attempts["n"] < 3:
            raise RuntimeError("临时错误")
        content, pt, ct = fake_llm._default_handler(messages)
        return content, pt, ct

    fake_llm.set_handler(flaky_handler)
    try:
        app_id, _, _ = approve_to_committee(
            client, h, mgr_h, emp_h, panel, seq, grade
        )
    finally:
        fake_llm.reset_handler()

    assert attempts["n"] == 3
    assert get_suggestion(client, app_id, lead_h).json()["status"] == "completed"


def test_bad_output_fails_gate_and_retries(
    client, h, mgr_h, emp_h, panel, lead_h
):
    seq, grade = next_key()

    def bad_json_handler(messages):
        # 只有 2 题，不满足质量门
        return json.dumps({"questions": ["q1", "q2"], "opinion": "x"}), 10, 5

    fake_llm.set_handler(bad_json_handler)
    try:
        app_id, _, _ = approve_to_committee(
            client, h, mgr_h, emp_h, panel, seq, grade
        )
    finally:
        fake_llm.reset_handler()

    assert get_suggestion(client, app_id, lead_h).json()["status"] == "failed"


# ---- 配额熔断 ----

def test_quota_circuit_breaker_skips_generation(
    client, h, mgr_h, emp_h, panel, lead_h, db_session
):
    seq, grade = next_key()

    # 给租户写配置：月度配额 1000 tokens。租户 id 从 HR 账号取
    from sqlalchemy import select

    from app.models.user import User

    hr_user = db_session.scalar(
        select(User).where(User.email == "hr@xingye.test")
    )
    tenant_id = hr_user.tenant_id

    cfg_row = db_session.get(TenantConfig, tenant_id)
    existed = cfg_row is not None
    old_values = dict(cfg_row.values) if existed else None
    if not existed:
        cfg_row = TenantConfig(tenant_id=tenant_id, values={})
        db_session.add(cfg_row)
    cfg_row.values = {**(old_values or {}), "ai_monthly_token_quota": 1000}

    # 预置本月已用 1200 tokens
    db_session.add(
        AIUsage(
            tenant_id=tenant_id,
            feature="certification_questions",
            model="fake-model",
            prompt_tokens=1000,
            completion_tokens=200,
            total_tokens=1200,
        )
    )
    db_session.commit()

    app_id, _, _ = approve_to_committee(
        client, h, mgr_h, emp_h, panel, seq, grade
    )

    body = get_suggestion(client, app_id, lead_h).json()
    assert body["status"] == "skipped"

    # 熔断不产生新的计量记录
    new_usage = db_session.query(AIUsage).filter_by(
        application_id=uuid.UUID(app_id)
    ).count()
    assert new_usage == 0

    # 还原配置，避免污染后续测试
    if existed:
        cfg_row.values = old_values
    else:
        db_session.delete(cfg_row)
    db_session.commit()


# ---- 用量计量 ----

def test_usage_recorded_with_tokens(
    client, h, mgr_h, emp_h, panel, db_session
):
    app_id, _, _ = approve_to_committee(client, h, mgr_h, emp_h, panel)
    usage = db_session.query(AIUsage).filter_by(
        application_id=uuid.UUID(app_id)
    ).one()
    assert usage.prompt_tokens == 120
    assert usage.completion_tokens == 80
    assert usage.total_tokens == 200
    assert usage.feature == "certification_questions"
    assert usage.model


# ---- 幂等 ----

def test_generation_runs_once(
    client, h, mgr_h, emp_h, panel, db_session
):
    app_id, _, _ = approve_to_committee(client, h, mgr_h, emp_h, panel)

    from app.services.ai import generate_for_application

    # 再触发：已有产出，直接跳过
    generate_for_application(db_session, uuid.UUID(app_id))

    count = db_session.query(AISuggestion).filter_by(
        application_id=uuid.UUID(app_id)
    ).count()
    assert count == 1


# ---- 超期自动通过同样触发 ----

def test_timeout_advance_triggers_generation(
    client, h, emp_h, panel, lead_h, db_session
):
    seq, grade = next_key()
    std = client.post("/api/v1/standard-sets", headers=h,
                      json=std_payload(seq, grade)).json()
    client.post(f"/api/v1/standard-sets/{std['id']}/publish", headers=h)
    client.post(
        "/api/v1/review-panel-templates", headers=h,
        json={"sequence": seq, "lead_reviewer_id": panel["lead"],
              "reviewer_ids": [panel["rev1"], panel["rev2"]]},
    )

    app_id = client.post(
        "/api/v1/applications", headers=emp_h,
        json={"target_sequence": seq, "target_grade": grade},
    ).json()["id"]
    client.put(f"/api/v1/applications/{app_id}/self-assessment",
               headers=emp_h, json=assessment(seq, grade))
    client.post(f"/api/v1/applications/{app_id}/submit", headers=emp_h)

    # 经理截止时间改到过去
    app = db_session.get(Application, uuid.UUID(app_id))
    app.manager_deadline_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db_session.commit()

    client.post("/api/internal/manager-review-timeouts", headers=h)

    body = get_suggestion(client, app_id, lead_h).json()
    assert body["status"] == "completed"
