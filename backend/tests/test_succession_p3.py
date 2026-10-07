"""模块六 P3：继任推荐 / 就绪度三档 / 继任地图。

注意 db_session 为 session 作用域、跨文件存在泄漏数据，
本文件对岗位使用唯一命名、断言不依赖全局精确计数。
"""

from datetime import datetime, timezone

import pytest
from sqlalchemy import delete, select

from app.models.employee import Employee
from app.models.profile import (
    DimensionStatus,
    ProfileDimension,
    ProfileSnapshot,
    ProfileSource,
)
from app.models.user import User
from app.services.succession import readiness_tier
from tests.conftest import auth_header, login


def _emp_id(db, email):
    return db.scalar(
        select(Employee.id).where(
            Employee.user_id
            == select(User.id).where(User.email == email).scalar_subquery()
        )
    )


def _emp(db, email) -> Employee:
    return db.scalar(
        select(Employee).where(
            Employee.user_id
            == select(User.id).where(User.email == email).scalar_subquery()
        )
    )


def _snapshot(db_session, emp: Employee, dim_scores: dict):
    """幂等写 v99 快照（先清同版本，防重复插入）。"""
    db_session.execute(
        delete(ProfileSnapshot).where(
            ProfileSnapshot.employee_id == emp.id,
            ProfileSnapshot.version_seq == 99,
        )
    )
    db_session.flush()
    snap = ProfileSnapshot(
        tenant_id=emp.tenant_id,
        employee_id=emp.id,
        version_seq=99,
        source=ProfileSource.MANUAL,
        overall=None,
        generated_by=None,
        generated_at=datetime.now(timezone.utc),
        dimensions=[
            ProfileDimension(
                dimension_key=key,
                status=DimensionStatus.MEASURED,
                score=score,
            )
            for key, score in dim_scores.items()
        ],
    )
    db_session.add(snap)
    db_session.commit()


def _seed_snapshots(db_session, emails: list[str]):
    """employee(B)=100 → ready_now；junior(B)=78.7 → ready_1_2y；
    lowperf(C)=56.4 → ready_3y。"""
    dims_map = {
        "employee@xingye.test": {"ability": 90, "duty": 90},
        "junior@xingye.test": {"ability": 50, "duty": 50},
        "lowperf@xingye.test": {"ability": 30, "duty": 30},
    }
    for email in emails:
        _snapshot(db_session, _emp(db_session, email), dims_map[email])


@pytest.fixture
def sw_position(client, db_session):
    """SW 序列核心岗位（唯一命名防跨文件同名），在岗人 rev1。"""
    hr = login(client, "hr@xingye.test")
    body = {
        "name": "P3·高级软件工程师",
        "dept_id": "305",
        "grade": "P4",
        "sequence": "SW",
        "headcount": 1,
        "incumbent_employee_id": str(_emp_id(db_session, "rev1@xingye.test")),
    }
    resp = client.post(
        "/api/v1/core-positions", headers=auth_header(hr), json=body
    )
    assert resp.status_code == 201, resp.text
    position_id = str(resp.json()["id"])
    yield position_id, hr
    client.delete(
        f"/api/v1/core-positions/{position_id}", headers=auth_header(hr)
    )


def _nominate(client, hr, position_id: str, emp_id) -> None:
    resp = client.post(
        f"/api/v1/core-positions/{position_id}/candidates",
        headers=auth_header(hr),
        json={"employee_id": str(emp_id)},
    )
    assert resp.status_code == 201, resp.text


# --- 就绪度三档 ---------------------------------------------------------------

def test_readiness_tier_boundaries():
    assert readiness_tier(80, 80, 60) == "ready_now"
    assert readiness_tier(79.9, 80, 60) == "ready_1_2y"
    assert readiness_tier(60, 80, 60) == "ready_1_2y"
    assert readiness_tier(59.9, 80, 60) == "ready_3y"


# --- 继任推荐 -----------------------------------------------------------------

def test_recommendations_sorted_with_tiers(client, db_session, sw_position):
    position_id, hr = sw_position
    _seed_snapshots(
        db_session,
        ["employee@xingye.test", "junior@xingye.test", "lowperf@xingye.test"],
    )

    resp = client.get(
        f"/api/v1/core-positions/{position_id}/recommendations",
        headers=auth_header(hr),
    )
    assert resp.status_code == 200, resp.text
    recs = resp.json()
    # 三名 SW 同序列员工均入榜（排除在岗人 rev1），按分降序三档齐全
    assert [r["readiness"] for r in recs] == [
        "ready_now", "ready_1_2y", "ready_3y",
    ]
    scores = [r["match_score"] for r in recs]
    assert scores == sorted(scores, reverse=True)
    # 缺维逐条回显，不造分
    assert recs[0]["missing_dims"] == ["contribution", "knowledge"]
    assert recs[0]["readiness_label"]
    assert recs[0]["level"] == "good"


def test_recommendations_exclude_incumbent_and_existing(client, db_session, sw_position):
    position_id, hr = sw_position
    _seed_snapshots(db_session, ["employee@xingye.test", "junior@xingye.test"])
    _nominate(client, hr, position_id, _emp_id(db_session, "employee@xingye.test"))

    recs = client.get(
        f"/api/v1/core-positions/{position_id}/recommendations",
        headers=auth_header(hr),
    ).json()
    ids = {r["employee_id"] for r in recs}
    assert str(_emp_id(db_session, "employee@xingye.test")) not in ids
    assert str(_emp_id(db_session, "rev1@xingye.test")) not in ids
    assert str(_emp_id(db_session, "junior@xingye.test")) in ids


def test_recommendations_marks_pool_membership(client, db_session, sw_position):
    position_id, hr = sw_position
    _seed_snapshots(
        db_session, ["employee@xingye.test", "junior@xingye.test"]
    )
    client.post(
        "/api/v1/talent-pools",
        headers=auth_header(hr),
        json={
            "employee_id": str(_emp_id(db_session, "junior@xingye.test")),
            "pool_level": "L2",
            "reason": "重点培养",
        },
    )
    recs = client.get(
        f"/api/v1/core-positions/{position_id}/recommendations",
        headers=auth_header(hr),
    ).json()
    by_id = {r["employee_id"]: r for r in recs}
    assert by_id[str(_emp_id(db_session, "junior@xingye.test"))]["in_pool"] is True
    assert by_id[str(_emp_id(db_session, "employee@xingye.test"))]["in_pool"] is False


def test_recommendations_forbidden_for_employee(client, sw_position):
    position_id, _ = sw_position
    token = login(client, "employee@xingye.test")
    resp = client.get(
        f"/api/v1/core-positions/{position_id}/recommendations",
        headers=auth_header(token),
    )
    assert resp.status_code == 403


def test_recommendations_cross_tenant_forbidden(client, sw_position):
    position_id, _ = sw_position
    token = login(client, "hr@linyuan.test")
    resp = client.get(
        f"/api/v1/core-positions/{position_id}/recommendations",
        headers=auth_header(token),
    )
    assert resp.status_code == 403


def test_recommendations_limit_clamped(client, db_session, sw_position):
    position_id, hr = sw_position
    _seed_snapshots(
        db_session,
        ["employee@xingye.test", "junior@xingye.test", "lowperf@xingye.test"],
    )
    resp = client.get(
        f"/api/v1/core-positions/{position_id}/recommendations?limit=2",
        headers=auth_header(hr),
    )
    assert len(resp.json()) == 2


# --- 候选出参补就绪度 ----------------------------------------------------------

def test_candidates_payload_includes_readiness(client, db_session, sw_position):
    position_id, hr = sw_position
    _seed_snapshots(db_session, ["employee@xingye.test"])
    client.post(
        f"/api/v1/core-positions/{position_id}/auto-screen",
        headers=auth_header(hr),
    )
    cands = client.get(
        f"/api/v1/core-positions/{position_id}/candidates",
        headers=auth_header(hr),
    ).json()
    by_id = {c["employee_id"]: c for c in cands}
    emp = str(_emp_id(db_session, "employee@xingye.test"))
    junior = str(_emp_id(db_session, "junior@xingye.test"))
    # 有画像：统一引擎分 + 三档
    assert by_id[emp]["readiness"] == "ready_now"
    assert by_id[emp]["match_score"] == 100.0
    # 无画像候选不造分：readiness / match_score 均为 None
    assert by_id[junior]["readiness"] is None
    assert by_id[junior]["match_score"] is None


# --- 继任地图 -----------------------------------------------------------------

def test_map_empty_tenant(client):
    hr = login(client, "hr@linyuan.test")
    resp = client.get("/api/v1/succession/map", headers=auth_header(hr))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["positions"] == []
    assert body["summary"]["positions"] == 0


def test_map_buckets_and_summary(client, db_session, sw_position):
    position_id, hr = sw_position
    _seed_snapshots(
        db_session,
        ["employee@xingye.test", "junior@xingye.test", "lowperf@xingye.test"],
    )
    _nominate(client, hr, position_id, _emp_id(db_session, "employee@xingye.test"))
    _nominate(client, hr, position_id, _emp_id(db_session, "junior@xingye.test"))
    # 第二个岗位：无候选无在岗 → 空缺 HIGH
    resp = client.post(
        "/api/v1/core-positions",
        headers=auth_header(hr),
        json={
            "name": "P3·算法负责人", "grade": "P5",
            "sequence": "SW", "headcount": 1,
        },
    )
    assert resp.status_code == 201, resp.text
    vacant_id = str(resp.json()["id"])

    try:
        body = client.get(
            "/api/v1/succession/map", headers=auth_header(hr)
        ).json()
        rows = {r["name"]: r for r in body["positions"]}
        filled = rows["P3·高级软件工程师"]
        assert filled["ready_now"] == 1
        assert filled["ready_1_2y"] == 1
        assert filled["candidate_count"] == 2
        assert filled["coverage"] == 100
        assert filled["risk"] == "LOW"
        assert filled["incumbent_name"] is not None

        vacant = rows["P3·算法负责人"]
        assert vacant["candidate_count"] == 0
        assert vacant["risk"] == "HIGH"
        assert vacant["incumbent_name"] is None

        # 泄漏数据可能存在，只断言不小于本文件创建的量
        assert body["summary"]["positions"] >= 2
        assert body["summary"]["vacant_positions"] >= 1
        assert body["summary"]["ready_now_positions"] >= 1
    finally:
        client.delete(
            f"/api/v1/core-positions/{vacant_id}", headers=auth_header(hr)
        )


def test_map_forbidden_for_employee(client):
    token = login(client, "employee@xingye.test")
    resp = client.get("/api/v1/succession/map", headers=auth_header(token))
    assert resp.status_code == 403
