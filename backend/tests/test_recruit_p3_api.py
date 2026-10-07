"""模块三 P3 增强测试：五维题库、评分锚点、预匹配、录用建议。"""

import pytest
from sqlalchemy import select

from app.models.recruit import DIMENSION_KEY_MAP
from tests.conftest import auth_header, login


def _req_and_cand(client, token, **cand_kw):
    req = client.post("/api/v1/requisitions", json={
        "position": "后端工程师", "dept_id": "305", "grade": "P4",
        "headcount": 1, "owner": "温晚晴", "priority": "high",
    }, headers=auth_header(token)).json()
    cand = client.post("/api/v1/candidates", json={
        "req_id": req["id"], "name": "沈知夏", "source": "内推",
        "years": 4, "last_title": "高级后端工程师",
        "expected_salary": 35000, "tags": ["分布式", "高并发"],
        **cand_kw,
    }, headers=auth_header(token)).json()
    return req, cand


@pytest.fixture
def hr_token(client):
    return login(client, "hr@xingye.test")


# --- 五维题库生成 -----------------------------------------------------------

def test_generate_five_dimensions_with_rubric(client, hr_token):
    resp = client.post("/api/v1/interview-questions/generate", json={
        "position": "后端工程师", "grade": "P4", "sequence": "SW",
    }, headers=auth_header(hr_token))
    assert resp.status_code == 201, resp.text
    qs = resp.json()
    assert len(qs) == 5
    dims = sorted(q["dimension"] for q in qs)
    assert dims == [1, 2, 3, 4, 5]
    for q in qs:
        assert q["dimension_key"] == DIMENSION_KEY_MAP[q["dimension"]]
        assert q["sequence"] == "SW"
        assert len(q["rubric"]) == 5
        levels = sorted(r["level"] for r in q["rubric"])
        assert levels == [1, 2, 3, 4, 5]


def test_generate_single_dimension(client, hr_token):
    resp = client.post("/api/v1/interview-questions/generate", json={
        "position": "后端工程师", "grade": "P4", "dimension": 5,
    }, headers=auth_header(hr_token))
    qs = resp.json()
    assert len(qs) == 1
    assert qs[0]["dimension"] == 5
    assert qs[0]["dimension_key"] == "contribution"


# --- sequence 过滤 ----------------------------------------------------------

def test_list_filter_by_sequence(client, hr_token):
    # 生成 SW 和 ENG 各一组
    client.post("/api/v1/interview-questions/generate", json={
        "position": "后端工程师", "grade": "P4", "sequence": "SW",
    }, headers=auth_header(hr_token))
    client.post("/api/v1/interview-questions/generate", json={
        "position": "机械工程师", "grade": "P3", "sequence": "ENG",
    }, headers=auth_header(hr_token))
    resp = client.get("/api/v1/interview-questions?sequence=SW", headers=auth_header(hr_token))
    assert resp.status_code == 200
    rows = resp.json()
    assert all(r["sequence"] == "SW" for r in rows)
    assert len(rows) >= 5


# --- 预匹配 -----------------------------------------------------------------

def test_prescreen_returns_score_and_breakdown(client, hr_token):
    _, cand = _req_and_cand(client, hr_token)
    resp = client.post(
        f"/api/v1/candidates/{cand['id']}/prescreen",
        headers=auth_header(hr_token),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert 0 <= data["prescreen_score"] <= 100
    assert data["level"] in ("good", "watch", "mismatch")
    assert "years" in data["breakdown"]
    assert "title" in data["breakdown"]


def test_prescreen_good_match(client, hr_token):
    # P4 期望 4-5 年，候选人 4 年；标签含 SW 关键词；期望薪资 35000 在 P4 带宽内
    _, cand = _req_and_cand(client, hr_token, years=4, last_title="高级后端工程师",
                            expected_salary=35000, tags=["分布式", "高并发", "微服务"])
    data = client.post(
        f"/api/v1/candidates/{cand['id']}/prescreen",
        headers=auth_header(hr_token),
    ).json()
    assert data["prescreen_score"] >= 70
    assert data["level"] in ("good", "watch")


def test_prescreen_cross_tenant_404(client, hr_token):
    t2 = login(client, "hr@linyuan.test")
    _, cand = _req_and_cand(client, t2)
    resp = client.post(
        f"/api/v1/candidates/{cand['id']}/prescreen",
        headers=auth_header(hr_token),
    )
    assert resp.status_code == 404


# --- compare 录用建议 -------------------------------------------------------

def test_compare_returns_recommendation(client, hr_token, db_session):
    from app.models.user import User

    _ = db_session.scalar(select(User).where(User.email == "hr@xingye.test"))
    _, cand = _req_and_cand(client, hr_token)
    # 保存一条五维满分面试记录
    client.post("/api/v1/interview-records", json={
        "candidate_id": cand["id"],
        "dimension_scores": [
            {"dimension": "绩效", "score": 90},
            {"dimension": "职责履行", "score": 85},
            {"dimension": "能力素质", "score": 88},
            {"dimension": "团队贡献", "score": 82},
            {"dimension": "知识技能", "score": 86},
        ],
        "stage": "final",
    }, headers=auth_header(hr_token))
    resp = client.get(
        f"/api/v1/interview-records/compare?candidate_id={cand['id']}",
        headers=auth_header(hr_token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "recommendation" in data
    assert data["match_score"] >= 80
    assert data["recommendation"] == "建议录用"


def test_compare_no_records_recommend_hold(client, hr_token):
    _, cand = _req_and_cand(client, hr_token)
    resp = client.get(
        f"/api/v1/interview-records/compare?candidate_id={cand['id']}",
        headers=auth_header(hr_token),
    )
    data = resp.json()
    assert data["recommendation"] == "建议暂缓"
    assert data["match_score"] is None
