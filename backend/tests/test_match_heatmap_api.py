"""/match/heatmap 端点测试（spec match-engine AC-6、AC-11 热力图侧）。"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select

from app.models.employee import Employee
from app.models.profile import (
    DimensionStatus,
    ProfileDimension,
    ProfileSnapshot,
    ProfileSource,
)
from tests.conftest import auth_header, login


def _emp(db_session, email: str) -> Employee:
    from app.models.user import User

    user = db_session.scalar(select(User).where(User.email == email))
    return db_session.scalar(
        select(Employee).where(Employee.user_id == user.id)
    )


def _snapshot(db_session, emp: Employee, dim_scores: dict, version_seq: int = 1):
    snap = ProfileSnapshot(
        tenant_id=emp.tenant_id,
        employee_id=emp.id,
        version_seq=version_seq,
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


# --- TR-4.1 三态 + 逐维结构 ---------------------------------------------------

def test_heatmap_three_states(client, db_session):
    full = _emp(db_session, "employee@xingye.test")   # perf B，部门 305
    junior = _emp(db_session, "junior@xingye.test")   # perf B，部门 305

    # 齐全者：四画像维恰在要求线上；profile.perf 故意给 99，必须被绩效等级 B=80 覆盖
    _snapshot(db_session, full, {
        "perf": 99, "duty": 75, "ability": 72,
        "contribution": 65, "knowledge": 70,
        "basic": 80, "biz": 80,
    })
    # 缺维者：仅 duty/ability 有值（40 分）
    _snapshot(db_session, junior, {"duty": 40, "ability": 40})

    token = login(client, "hr@xingye.test")
    resp = client.post(
        "/api/v1/match/heatmap",
        json={"dept_id": "305"},
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    rows = {r["name"]: r for r in resp.json()}

    # 部门 305 共 5 人：经理、full、junior、lowperf、评委苏望知（后三人无画像）
    assert set(rows) == {"陆行舟", "许星遥", "许清禾", "董斯年", "苏望知"}

    full_row = rows["许星遥"]
    assert full_row["score"] == 100.0
    assert full_row["level"] == "good"
    assert full_row["missing_dims"] == []
    perf_dim = next(d for d in full_row["dims"] if d["key"] == "perf")
    assert perf_dim["actual"] == 80  # 等级 B，而非画像里的 99
    assert all(d["ratio"] is not None for d in full_row["dims"])

    junior_row = rows["许清禾"]
    assert junior_row["score"] == 69.6
    assert junior_row["level"] == "watch"
    assert junior_row["missing_dims"] == ["contribution", "knowledge"]
    duty_dim = next(d for d in junior_row["dims"] if d["key"] == "duty")
    assert duty_dim["is_gap"] is True

    for name in ("陆行舟", "董斯年", "苏望知"):  # 无画像
        assert rows[name]["score"] is None
        assert rows[name]["level"] == "insufficient_data"


# --- TR-4.2 已在上方断言 perf 取绩效等级 --------------------------------------

# --- TR-4.3 数据范围与租户隔离 ------------------------------------------------

def test_heatmap_scope_and_tenant(client, db_session):
    # manager（陆行舟，部门 305）只能见 subtree
    token = login(client, "manager@xingye.test")
    resp = client.post(
        "/api/v1/match/heatmap",
        json={"dept_id": "305"},
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    names = {r["name"] for r in resp.json()}
    assert "温晚晴" not in names  # 部门 201 的 HRD，不在汇报链
    assert names <= {"陆行舟", "许星遥", "许清禾", "董斯年", "苏望知"}

    # 跨租户：临渊 HR 查 305 为空
    t2 = login(client, "hr@linyuan.test")
    resp2 = client.post(
        "/api/v1/match/heatmap",
        json={"dept_id": "305"},
        headers=auth_header(t2),
    )
    assert resp2.status_code == 200
    assert resp2.json() == []


def test_heatmap_requires_permission(client):
    token = login(client, "employee@xingye.test")
    resp = client.post(
        "/api/v1/match/heatmap",
        json={"dept_id": "305"},
        headers=auth_header(token),
    )
    assert resp.status_code == 403


# --- TR-4.4 入参校验 ----------------------------------------------------------

def test_heatmap_requires_scope_filter(client):
    token = login(client, "hr@xingye.test")
    resp = client.post(
        "/api/v1/match/heatmap", json={}, headers=auth_header(token)
    )
    assert resp.status_code == 422


def test_heatmap_dept_and_batch_mutex(client):
    token = login(client, "hr@xingye.test")
    resp = client.post(
        "/api/v1/match/heatmap",
        json={"dept_id": "305", "batch_id": str(uuid.uuid4())},
        headers=auth_header(token),
    )
    assert resp.status_code == 422


# --- batch_id 分支 -------------------------------------------------------------

def test_heatmap_by_batch_id(client, db_session):
    full = _emp(db_session, "employee@xingye.test")
    junior = _emp(db_session, "junior@xingye.test")
    _snapshot(db_session, full, {
        "perf": 80, "duty": 75, "ability": 72,
        "contribution": 65, "knowledge": 70,
    })
    _snapshot(db_session, junior, {"duty": 40, "ability": 40})

    token = login(client, "hr@xingye.test")
    batch_id = str(uuid.uuid4())
    analyzed = client.post(
        "/api/v1/gaps/analyze",
        json={"dept_id": "305", "batch_id": batch_id},
        headers=auth_header(token),
    )
    assert analyzed.status_code == 200, analyzed.text

    resp = client.post(
        "/api/v1/match/heatmap",
        json={"batch_id": batch_id},
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    # 有差距记录的：junior（duty/ability 低）与 lowperf（perf C）；
    # full 恰在阈值线上无差距记录，不随批次出现
    names = {r["name"] for r in resp.json()}
    assert names == {"许清禾", "董斯年"}
