"""GET /interview-records/compare 收敛到匹配引擎（spec match-engine TR-7）。"""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.models.recruit import (
    Candidate,
    CandStage,
    InterviewRecord,
    Requisition,
)
from app.models.user import User
from tests.conftest import auth_header, login

FULL_SCORES = [
    {"dimension": "绩效", "score": 60},
    {"dimension": "职责履行", "score": 75},
    {"dimension": "能力素质", "score": 72},
    {"dimension": "团队贡献", "score": 65},
    {"dimension": "知识技能", "score": 70},
]


@pytest.fixture
def recruit_rows(db_session):
    reqs: list = []
    cands: list = []
    recs: list = []

    hr = db_session.scalar(
        select(User).where(User.email == "hr@xingye.test")
    )

    def _make(records_scores: list, *, static_match: int = 0, name: str = "比对测试候选人"):
        req = Requisition(
            tenant_id=hr.tenant_id,
            position="后端工程师",
            dept_id="305",
            grade="P4",
            headcount=1,
            funnel=[],
            owner="HR",
            opened_at="2026-01-01",
        )
        db_session.add(req)
        db_session.commit()
        db_session.refresh(req)
        reqs.append(req.id)

        cand = Candidate(
            tenant_id=hr.tenant_id,
            req_id=req.id,
            name=name,
            stage=CandStage.FIRST,
            source="referral",
            match_score=static_match,
            years=3,
            last_title="工程师",
            expected_salary=0,
            tags=[],
            applied_at="2026-05-01",
        )
        db_session.add(cand)
        db_session.commit()
        db_session.refresh(cand)
        cands.append(cand.id)

        for i, dim_scores in enumerate(records_scores):
            rec = InterviewRecord(
                tenant_id=hr.tenant_id,
                candidate_id=cand.id,
                interviewer_id=hr.id,
                dimension_scores=dim_scores,
                comment=None,
                rating=None,
                stage="first",
                created_at=datetime.now(timezone.utc) + timedelta(minutes=i),
            )
            db_session.add(rec)
            db_session.commit()
            db_session.refresh(rec)
            recs.append(rec.id)
        return cand.id

    yield _make

    for rec_id in recs:
        obj = db_session.get(InterviewRecord, rec_id)
        if obj:
            db_session.delete(obj)
    for cand_id in cands:
        obj = db_session.get(Candidate, cand_id)
        if obj:
            db_session.delete(obj)
    for req_id in reqs:
        obj = db_session.get(Requisition, req_id)
        if obj:
            db_session.delete(obj)
    db_session.commit()


def _compare(client, token, cand_id):
    return client.get(
        f"/api/v1/interview-records/compare?candidate_id={cand_id}",
        headers=auth_header(token),
    )


# --- TR-7.1 五维齐全：引擎分与逐维结构 -----------------------------------------

def test_compare_full_dimensions(client, db_session, recruit_rows):
    cand_id = recruit_rows([FULL_SCORES])
    token = login(client, "hr@xingye.test")
    resp = _compare(client, token, cand_id)
    assert resp.status_code == 200, resp.text
    data = resp.json()

    # 绩效 60/80=0.75，其余四维恰好达标 → (0.75+4)/5*100 = 95
    assert data["match_score"] == 95.0
    assert data["level"] == "good"
    assert data["missing_dims"] == []
    assert {d["key"] for d in data["dims"]} == {
        "perf", "duty", "ability", "contribution", "knowledge",
    }
    perf = next(d for d in data["dims"] if d["key"] == "perf")
    assert perf["actual"] == 60
    assert perf["required"] == 80
    assert perf["is_gap"] is True
    assert perf["ratio"] == 0.75


# --- TR-7.2 静态列无关 ---------------------------------------------------------

def test_compare_ignores_static_match_score(client, db_session, recruit_rows):
    cand_id = recruit_rows([FULL_SCORES], static_match=123)
    token = login(client, "hr@xingye.test")
    data = _compare(client, token, cand_id).json()
    assert data["match_score"] == 95.0  # 不是静态列 123


def test_compare_uses_latest_record(client, db_session, recruit_rows):
    # 旧记录五维齐全，新记录只评绩效 → 以新记录为准，其余四维缺维归一
    cand_id = recruit_rows(
        [FULL_SCORES, [{"dimension": "绩效", "score": 100}]]
    )
    token = login(client, "hr@xingye.test")
    data = _compare(client, token, cand_id).json()
    assert data["match_score"] == 100.0
    assert data["missing_dims"] == ["duty", "ability", "contribution", "knowledge"]


# --- TR-7.3 无记录/键全缺 → 数据不足 -------------------------------------------

def test_compare_no_records_insufficient(client, db_session, recruit_rows):
    cand_id = recruit_rows([])
    token = login(client, "hr@xingye.test")
    data = _compare(client, token, cand_id).json()
    assert data["match_score"] is None
    assert data["level"] == "insufficient_data"
    assert len(data["missing_dims"]) == 5


def test_compare_unrecognized_keys_insufficient(client, db_session, recruit_rows):
    cand_id = recruit_rows(
        [[{"dimension": 1, "score": 90}, {"foo": "bar", "score": 90}]]
    )
    token = login(client, "hr@xingye.test")
    data = _compare(client, token, cand_id).json()
    assert data["match_score"] is None
    assert data["level"] == "insufficient_data"


# --- TR-7.4 跨租户 -------------------------------------------------------------

def test_compare_cross_tenant_404(client, db_session, recruit_rows):
    cand_id = recruit_rows([FULL_SCORES])
    token = login(client, "hr@linyuan.test")
    resp = _compare(client, token, cand_id)
    assert resp.status_code == 404


# --- Minor-3：score 显式 None 回退 value ----------------------------------------

def test_compare_score_none_falls_back_to_value(client, db_session, recruit_rows):
    cand_id = recruit_rows([[{"key": "perf", "score": None, "value": 90}]])
    token = login(client, "hr@xingye.test")
    data = _compare(client, token, cand_id).json()
    # 90/80 封顶 1.0，单维归一 → 100；修复前该维被丢弃 → insufficient_data
    assert data["match_score"] == 100.0
    assert data["missing_dims"] == ["duty", "ability", "contribution", "knowledge"]


# --- Minor-6：created_at 并列按 id 降序确定性取舍 -------------------------------

def test_compare_latest_tie_breaks_by_id(client, db_session, recruit_rows):
    import uuid as _uuid

    from sqlalchemy import delete

    cand_id = recruit_rows([])
    hr = db_session.scalar(select(User).where(User.email == "hr@xingye.test"))
    cand = db_session.get(Candidate, cand_id)
    ts = datetime.now(timezone.utc)
    older_id = _uuid.UUID("00000000-0000-0000-0000-000000000001")
    newer_id = _uuid.UUID("00000000-0000-0000-0000-000000000002")
    # 先插 id 大者再插小者，排除插入序干扰
    for rid, score in ((newer_id, 100), (older_id, 10)):
        db_session.add(
            InterviewRecord(
                id=rid,
                tenant_id=cand.tenant_id,
                candidate_id=cand.id,
                interviewer_id=hr.id,
                dimension_scores=[{"dimension": "绩效", "score": score}],
                comment=None,
                rating=None,
                stage="first",
                created_at=ts,
            )
        )
    db_session.commit()
    try:
        token = login(client, "hr@xingye.test")
        data = _compare(client, token, cand_id).json()
        assert data["match_score"] == 100.0  # id 大者的 100 分记录生效
    finally:
        db_session.execute(
            delete(InterviewRecord).where(InterviewRecord.candidate_id == cand_id)
        )
        db_session.commit()
