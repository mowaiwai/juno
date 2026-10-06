"""/match/recommend 双向推荐测试（spec match-engine AC-7、AC-11）。"""

from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.models.employee import Employee
from app.models.standard import StandardSet, StandardStatus
from app.models.user import User
from tests.conftest import auth_header, login


@pytest.fixture
def clean_sets(db_session):
    """测试期间新建的标准集结束即删，避免跨用例污染。"""
    created: list = []
    yield created
    for sid in created:
        obj = db_session.get(StandardSet, sid)
        if obj is not None:
            db_session.delete(obj)
    db_session.commit()


def _emp(db_session, email: str) -> Employee:
    user = db_session.scalar(select(User).where(User.email == email))
    return db_session.scalar(
        select(Employee).where(Employee.user_id == user.id)
    )


def _set(db_session, created, tenant_id, sequence, grade, version, status):
    s = StandardSet(
        tenant_id=tenant_id,
        sequence=sequence,
        target_grade=grade,
        version=version,
        status=status,
        published_at=datetime.now(timezone.utc)
        if status == StandardStatus.PUBLISHED
        else None,
    )
    db_session.add(s)
    db_session.commit()
    created.append(s.id)
    return s


def _profile(db_session, emp, dim_scores):
    from app.models.profile import (
        DimensionStatus,
        ProfileDimension,
        ProfileSnapshot,
        ProfileSource,
    )

    snap = ProfileSnapshot(
        tenant_id=emp.tenant_id,
        employee_id=emp.id,
        version_seq=1,
        source=ProfileSource.MANUAL,
        overall=None,
        generated_by=None,
        generated_at=datetime.now(timezone.utc),
        dimensions=[
            ProfileDimension(
                dimension_key=k, status=DimensionStatus.MEASURED, score=v
            )
            for k, v in dim_scores.items()
        ],
    )
    db_session.add(snap)
    db_session.commit()


# --- TR-5.1 一人多岗：去重取最新发布版、降序、截断、字段 -----------------------

def test_recommend_positions_for_employee(client, db_session, clean_sets):
    full = _emp(db_session, "employee@xingye.test")
    _profile(db_session, full, {
        "perf": 80, "duty": 75, "ability": 72,
        "contribution": 65, "knowledge": 70,
    })
    tid = full.tenant_id
    # 序列名加 "!" 前缀保证字典序在所有既有/残留发布集之前，避免被 limit 截断
    sw_v1 = _set(db_session, clean_sets, tid, "!SW", "P3", 1,
                 StandardStatus.PUBLISHED)
    sw_v2 = _set(db_session, clean_sets, tid, "!SW", "P3", 2,
                 StandardStatus.PUBLISHED)
    eng = _set(db_session, clean_sets, tid, "!ENG", "P4", 1,
               StandardStatus.PUBLISHED)
    _set(db_session, clean_sets, tid, "!MGT", "M2", 1,
         StandardStatus.DRAFT)  # 草稿排除

    token = login(client, "hr@xingye.test")
    resp = client.post(
        "/api/v1/match/recommend",
        json={"employee_id": str(full.id), "limit": 20},
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["direction"] == "positions"
    # 只断言本用例自建岗位（全套件共享开发库，其他套件可能留有发布集）
    items = [i for i in data["items"] if i["sequence"].startswith("!")]
    # SW/P3 两版只取 v2；草稿不出现
    assert [(i["sequence"], i["target_grade"]) for i in items] == [
        ("!ENG", "P4"),
        ("!SW", "P3"),
    ]
    sw_item = next(i for i in items if i["sequence"] == "!SW")
    assert sw_item["set_id"] == str(sw_v2.id)
    assert sw_item["set_id"] != str(sw_v1.id)
    assert sw_item["score"] == 100.0 and sw_item["level"] == "good"


def test_recommend_positions_limit(client, db_session, clean_sets):
    full = _emp(db_session, "employee@xingye.test")
    _profile(db_session, full, {"duty": 75})
    tid = full.tenant_id
    # 6 个自建岗位（序列排序需早于其他套件可能残留的 A01 系列），
    # 默认 limit=5 应截断为 5，且前五条全是本用例自建集
    for i in range(1, 7):
        _set(db_session, clean_sets, tid, f"A00{i}", "P3", 1,
             StandardStatus.PUBLISHED)
    token = login(client, "hr@xingye.test")
    resp = client.post(
        "/api/v1/match/recommend",
        json={"employee_id": str(full.id)},  # 默认 limit=5
        headers=auth_header(token),
    )
    items = resp.json()["items"]
    assert len(items) == 5
    assert all(i["sequence"].startswith("A00") for i in items)


# --- TR-5.2 一岗多人：降序、缺画像置底 -----------------------------------------

def test_recommend_employees_for_position(client, db_session, clean_sets):
    full = _emp(db_session, "employee@xingye.test")
    junior = _emp(db_session, "junior@xingye.test")
    _profile(db_session, full, {
        "perf": 80, "duty": 75, "ability": 72,
        "contribution": 65, "knowledge": 70,
    })
    _profile(db_session, junior, {"duty": 40, "ability": 40})
    eng = _set(db_session, clean_sets, full.tenant_id, "ENG", "P4", 1,
               StandardStatus.PUBLISHED)

    token = login(client, "hr@xingye.test")
    resp = client.post(
        "/api/v1/match/recommend",
        json={"standard_set_id": str(eng.id), "limit": 20},
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["direction"] == "employees"
    items = data["items"]
    assert items[0]["name"] == "许星遥"
    assert items[0]["score"] == 100.0
    assert items[1]["name"] == "许清禾"
    assert items[1]["score"] == 69.6
    # 无画像者全部置底且带 insufficient_data
    assert all(i["level"] == "insufficient_data" for i in items[2:])
    assert all(i["score"] is None for i in items[2:])

    # 默认 TOP 5 截断
    resp5 = client.post(
        "/api/v1/match/recommend",
        json={"standard_set_id": str(eng.id)},
        headers=auth_header(token),
    )
    assert len(resp5.json()["items"]) == 5


# --- TR-5.3 权限：本人 200、越权 404、员工查岗位方向 403 -----------------------

def test_recommend_self_scope_and_forbidden(client, db_session, clean_sets):
    full = _emp(db_session, "employee@xingye.test")
    junior = _emp(db_session, "junior@xingye.test")
    _set(db_session, clean_sets, full.tenant_id, "SW", "P3", 1,
         StandardStatus.PUBLISHED)

    token = login(client, "employee@xingye.test")
    # 本人
    ok = client.post(
        "/api/v1/match/recommend",
        json={"employee_id": str(full.id)},
        headers=auth_header(token),
    )
    assert ok.status_code == 200
    # 查他人 → 404（不泄露存在性）
    other = client.post(
        "/api/v1/match/recommend",
        json={"employee_id": str(junior.id)},
        headers=auth_header(token),
    )
    assert other.status_code == 404
    # 员工查一岗多人方向 → 403
    forbidden = client.post(
        "/api/v1/match/recommend",
        json={"sequence": "SW", "target_grade": "P3"},
        headers=auth_header(token),
    )
    assert forbidden.status_code == 403


def test_recommend_unknown_employee_404(client, db_session):
    import uuid

    token = login(client, "hr@xingye.test")
    resp = client.post(
        "/api/v1/match/recommend",
        json={"employee_id": str(uuid.uuid4())},
        headers=auth_header(token),
    )
    assert resp.status_code == 404


# --- TR-5.4 无已发布标准集 → 空列表 200 ----------------------------------------

def test_recommend_empty_when_no_published_sets(client, db_session):
    t2_emp = _emp(db_session, "employee@linyuan.test")
    token = login(client, "employee@linyuan.test")
    resp = client.post(
        "/api/v1/match/recommend",
        json={"employee_id": str(t2_emp.id)},
        headers=auth_header(token),
    )
    assert resp.status_code == 200
    assert resp.json()["items"] == []


# --- 入参校验 -----------------------------------------------------------------

def test_recommend_direction_mutex(client):
    import uuid

    token = login(client, "hr@xingye.test")
    base = "/api/v1/match/recommend"
    assert client.post(base, json={},
                       headers=auth_header(token)).status_code == 422
    assert client.post(
        base,
        json={"employee_id": str(uuid.uuid4()), "sequence": "SW"},
        headers=auth_header(token),
    ).status_code == 422
    assert client.post(
        base, json={"sequence": "SW"}, headers=auth_header(token)
    ).status_code == 422
