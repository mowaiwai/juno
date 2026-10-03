"""在线考试全链路测试：AI 组卷 → 审核 → 开始 → 交卷判分。假 LLM，不触网。"""
import json

import pytest
from sqlalchemy import select

from app.models.exam import ExamPaper
from app.models.tenant_config import TenantConfig
from app.models.user import User
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
    user = db_session.scalar(select(User).where(User.email == "hr@xingye.test"))
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


def _two_question_paper(answer_indices=(0, 2)):
    def handler(messages):
        content = json.dumps(
            {
                "questions": [
                    {
                        "stem": "LRU 缓存适合用哪种数据结构实现？",
                        "options": ["哈希表+双向链表", "数组", "栈", "队列"],
                        "answer_index": answer_indices[0],
                        "analysis": "哈希表 O(1) 定位，双向链表维护访问顺序。",
                    },
                    {
                        "stem": "CAP 定理不包含以下哪一项？",
                        "options": ["一致性", "可用性", "可观测性", "分区容错性"],
                        "answer_index": answer_indices[1],
                        "analysis": "CAP 为一致性、可用性、分区容错性。",
                    },
                ]
            },
            ensure_ascii=False,
        )
        return content, 80, 60

    return handler


def _generate(client, h, **overrides):
    body = {
        "title": "软件工程师 P3 认证考试",
        "target_position": "软件工程师",
        "target_grade": "P3",
        "question_count": 2,
        "duration_minutes": 30,
        "pass_score": 20,
        **overrides,
    }
    return client.post("/api/v1/exam/papers/generate", headers=h, json=body)


# ---------------------------------------------------------------------------
# 组卷
# ---------------------------------------------------------------------------

def test_generate_without_key_returns_503(client, h, db_session, tenant_id):
    _set_key(db_session, tenant_id, None)
    resp = _generate(client, h)
    assert resp.status_code == 503
    assert resp.json()["code"] == "ai_not_configured"


def test_generate_success_pending_review(client, h, configured_ai):
    fake_llm.set_handler(_two_question_paper())
    try:
        resp = _generate(client, h)
        assert resp.status_code == 201, resp.text
        data = resp.json()
        assert data["status"] == "pending_review"
        assert data["question_count"] == 2
        assert data["total_score"] == 20
        assert len(data["questions"]) == 2
        assert data["questions"][0]["answer_index"] == 0
    finally:
        fake_llm.reset_handler()


def test_generate_forbidden_for_employee(client, emp_h, configured_ai):
    resp = _generate(client, emp_h)
    assert resp.status_code == 403


def test_generate_bad_llm_output_returns_502(client, h, configured_ai):
    def bad_handler(messages):
        return "not json", 10, 5

    fake_llm.set_handler(bad_handler)
    try:
        resp = _generate(client, h)
        assert resp.status_code == 502
        assert resp.json()["code"] == "ai_request_failed"
    finally:
        fake_llm.reset_handler()


def test_generate_pass_score_over_total_422(client, h, configured_ai):
    fake_llm.set_handler(_two_question_paper())
    try:
        resp = _generate(client, h, pass_score=999)
        # schema 层仅限制 ge=1，总分校验在 service（LLM 调用前）
        assert resp.status_code == 422
        assert resp.json()["code"] == "pass_score_exceeds_total"
    finally:
        fake_llm.reset_handler()


# ---------------------------------------------------------------------------
# 审核
# ---------------------------------------------------------------------------

def test_approve_reject_flow(client, h, emp_h, configured_ai):
    fake_llm.set_handler(_two_question_paper())
    try:
        paper_id = _generate(client, h).json()["id"]

        # 待审核试卷对员工不可见
        papers = client.get("/api/v1/exam/papers", headers=emp_h).json()
        assert all(p["id"] != paper_id for p in papers)

        # 员工不能审核
        assert (
            client.post(
                f"/api/v1/exam/papers/{paper_id}/approve", headers=emp_h
            ).status_code
            == 403
        )

        # HR 通过
        resp = client.post(
            f"/api/v1/exam/papers/{paper_id}/approve", headers=h
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "published"
        assert resp.json()["published_at"]

        # 发布后员工可见
        papers = client.get("/api/v1/exam/papers", headers=emp_h).json()
        assert any(p["id"] == paper_id for p in papers)

        # 已发布不能重复审核
        assert (
            client.post(
                f"/api/v1/exam/papers/{paper_id}/approve", headers=h
            ).status_code
            == 409
        )
    finally:
        fake_llm.reset_handler()


def test_reject_flow(client, h, configured_ai):
    fake_llm.set_handler(_two_question_paper())
    try:
        paper_id = _generate(client, h).json()["id"]
        resp = client.post(
            f"/api/v1/exam/papers/{paper_id}/reject",
            headers=h,
            json={"reason": "题目与职级不匹配"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "rejected"
        assert data["reject_reason"] == "题目与职级不匹配"
    finally:
        fake_llm.reset_handler()


# ---------------------------------------------------------------------------
# 开始 / 交卷
# ---------------------------------------------------------------------------

def test_start_submit_grade_full_flow(client, h, emp_h, configured_ai):
    fake_llm.set_handler(_two_question_paper())
    try:
        paper_id = _generate(client, h, pass_score=20).json()["id"]
        client.post(f"/api/v1/exam/papers/{paper_id}/approve", headers=h)

        # 开始考试
        resp = client.post(
            f"/api/v1/exam/papers/{paper_id}/start", headers=emp_h
        )
        assert resp.status_code == 200, resp.text
        started = resp.json()
        attempt_id = started["attempt_id"]
        questions = started["questions"]
        assert len(questions) == 2
        # 关键安全：开始考试的下发结构中不含答案
        raw = json.dumps(questions)
        assert "answer_index" not in raw
        assert "analysis" not in raw

        # 幂等：再次开始返回同一进行中的 attempt
        again = client.post(
            f"/api/v1/exam/papers/{paper_id}/start", headers=emp_h
        ).json()
        assert again["attempt_id"] == attempt_id

        q1, q2 = questions[0]["id"], questions[1]["id"]
        # 第一题答对(0)、第二题答错(选1，正确是2)
        submit = client.post(
            f"/api/v1/exam/attempts/{attempt_id}/submit",
            headers=emp_h,
            json={"answers": {q1: 0, q2: 1}},
        )
        assert submit.status_code == 200, submit.text
        result = submit.json()
        assert result["score"] == 10
        assert result["total_score"] == 20
        assert result["passed"] is False
        detail = result["questions"]
        assert detail[0]["correct"] is True
        assert detail[0]["selected_index"] == 0
        assert detail[1]["correct"] is False
        assert detail[1]["answer_index"] == 2

        # 重复交卷 → 409
        again_submit = client.post(
            f"/api/v1/exam/attempts/{attempt_id}/submit",
            headers=emp_h,
            json={"answers": {q1: 0, q2: 2}},
        )
        assert again_submit.status_code == 409

        # 成绩列表包含本次记录
        attempts = client.get("/api/v1/exam/attempts", headers=emp_h).json()
        assert any(a["id"] == attempt_id and a["score"] == 10 for a in attempts)

        # 交卷后可查看带答案的回顾
        review = client.get(
            f"/api/v1/exam/attempts/{attempt_id}", headers=emp_h
        ).json()
        assert review["questions"][1]["answer_index"] == 2

        # 补考：交卷后重新开始产生新 attempt
        new_attempt = client.post(
            f"/api/v1/exam/papers/{paper_id}/start", headers=emp_h
        ).json()
        assert new_attempt["attempt_id"] != attempt_id
    finally:
        fake_llm.reset_handler()


def test_submit_ignores_invalid_answers(client, h, emp_h, configured_ai):
    """非法 question_id/越界选项不计分；全错为 0 分。"""
    fake_llm.set_handler(_two_question_paper())
    try:
        paper_id = _generate(client, h).json()["id"]
        client.post(f"/api/v1/exam/papers/{paper_id}/approve", headers=h)
        started = client.post(
            f"/api/v1/exam/papers/{paper_id}/start", headers=emp_h
        ).json()
        q1 = started["questions"][0]["id"]
        result = client.post(
            f"/api/v1/exam/attempts/{started['attempt_id']}/submit",
            headers=emp_h,
            json={
                "answers": {
                    q1: 9,                  # 越界
                    "bogus-id": 0,          # 不存在的题
                    started["questions"][1]["id"]: "1",  # 非整数
                }
            },
        ).json()
        assert result["score"] == 0
        assert result["passed"] is False
    finally:
        fake_llm.reset_handler()


def test_cannot_start_unpublished_paper(client, h, emp_h, configured_ai):
    fake_llm.set_handler(_two_question_paper())
    try:
        paper_id = _generate(client, h).json()["id"]
        # 员工对未发布试卷 get_paper_for_user 返回 None → 404
        resp = client.post(
            f"/api/v1/exam/papers/{paper_id}/start", headers=emp_h
        )
        assert resp.status_code == 404
    finally:
        fake_llm.reset_handler()


def test_persisted_paper_count_unchanged_after_failed_ai(
    client, h, configured_ai, db_session
):
    """LLM 失败时不得残留半成品试卷。"""
    def failing_handler(messages):
        return "{", 1, 1

    before = db_session.query(ExamPaper).count()
    fake_llm.set_handler(failing_handler)
    try:
        resp = _generate(client, h)
        assert resp.status_code == 502
    finally:
        fake_llm.reset_handler()
    db_session.expire_all()
    assert db_session.query(ExamPaper).count() == before
