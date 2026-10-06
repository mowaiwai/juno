"""500 人性能基线（spec match-engine TR-9 / AC-13）。

宽松计时断言，仅在本地 PG 开发库验证量级，不与并行测试抢时间的意义上做断言。
"""

import time
from datetime import date, datetime, timezone

import pytest
from sqlalchemy import delete, select

from app.models.employee import Employee
from app.models.profile import (
    DimensionStatus,
    ProfileDimension,
    ProfileSnapshot,
    ProfileSource,
)
from app.core.security import hash_password
from app.models.user import Role, User
from app.services.match import DEFAULT_CONFIG
from tests.conftest import auth_header, login

PERF_DEPT = "PERF500"
N = 500
_DIMS = ("perf", "duty", "ability", "contribution", "knowledge")


@pytest.fixture
def five_hundred(db_session):
    hr = db_session.scalar(
        select(User).where(User.email == "hr@xingye.test")
    )
    tid = hr.tenant_id

    users = [
        User(
            tenant_id=tid,
            email=f"perf{i:04d}@xingye.test",
            name=f"性能测试{i:04d}",
            role=Role.EMPLOYEE,
            roles=[Role.EMPLOYEE.value],
            hashed_password=hash_password("perf-perf-perf"),
        )
        for i in range(N)
    ]
    db_session.add_all(users)
    db_session.commit()

    emps = [
        Employee(
            tenant_id=tid,
            user_id=u.id,
            employee_no=f"PERF{i:04d}",
            name=u.name,
            dept_id=PERF_DEPT,
            position="工程师",
            family="M",
            sequence="SW",
            grade="P3",
            grade_since=date(2024, 1, 1),
            perf_grade="B",
            manager_id=None,
            is_active=True,
        )
        for i, u in enumerate(users)
    ]
    db_session.add_all(emps)
    db_session.commit()

    snaps = [
        ProfileSnapshot(
            tenant_id=tid,
            employee_id=e.id,
            version_seq=1,
            source=ProfileSource.MANUAL,
            overall=None,
            generated_by=None,
            generated_at=datetime.now(timezone.utc),
            dimensions=[
                ProfileDimension(
                    dimension_key=key,
                    status=DimensionStatus.MEASURED,
                    score=60 + (i % 40),
                )
                for key in _DIMS
            ],
        )
        for i, e in enumerate(emps)
    ]
    db_session.add_all(snaps)
    db_session.commit()

    yield emps

    emp_ids = [e.id for e in emps]
    snap_ids = list(db_session.scalars(
        select(ProfileSnapshot.id).where(
            ProfileSnapshot.employee_id.in_(emp_ids)
        )
    ).all())
    if snap_ids:
        db_session.execute(
            delete(ProfileDimension).where(
                ProfileDimension.profile_snapshot_id.in_(snap_ids)
            )
        )
        db_session.execute(
            delete(ProfileSnapshot).where(ProfileSnapshot.id.in_(snap_ids))
        )
    db_session.execute(
        delete(Employee).where(Employee.dept_id == PERF_DEPT)
    )
    db_session.execute(
        delete(User).where(User.email.like("perf%@xingye.test"))
    )
    db_session.commit()


def test_pure_scoring_500_under_100ms():
    """纯引擎 500 人算分 ≤ 100ms。"""
    actuals = [
        {key: 60 + (i % 40) for key in _DIMS}
        for i in range(N)
    ]
    start = time.perf_counter()
    for actual in actuals:
        result = DEFAULT_CONFIG.score(actual)
        assert result.score is not None
    elapsed = time.perf_counter() - start
    assert elapsed < 0.1, f"500 人纯算分耗时 {elapsed:.3f}s > 0.1s"


def test_heatmap_500_under_2s(client, five_hundred):
    """500 人热力图端到端 ≤ 2s，且逐人返回。"""
    token = login(client, "hr@xingye.test")
    start = time.perf_counter()
    resp = client.post(
        "/api/v1/match/heatmap",
        json={"dept_id": PERF_DEPT},
        headers=auth_header(token),
    )
    elapsed = time.perf_counter() - start
    assert resp.status_code == 200, resp.text
    rows = resp.json()
    assert len(rows) == N
    assert elapsed < 2.0, f"500 人热力图耗时 {elapsed:.3f}s > 2s"
