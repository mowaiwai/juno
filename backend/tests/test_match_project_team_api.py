"""/match/project-team 与旧 /org/project-team 收敛测试（spec match-engine TR-6）。"""

import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import delete, select

from app.models.employee import Employee
from app.models.org_diagnosis import LiquidProject, LiquidProjectStatus
from app.models.profile import (
    DimensionStatus,
    ProfileDimension,
    ProfileSnapshot,
    ProfileSource,
)
from app.models.user import User
from tests.conftest import auth_header, login

NEEDS = [
    {"ability": "能力素质", "level": 80},
    {"ability": "职责履行", "level": 75},
]


def _emp(db_session, email: str) -> Employee:
    user = db_session.scalar(select(User).where(User.email == email))
    return db_session.scalar(
        select(Employee).where(Employee.user_id == user.id)
    )


def _snapshot(db_session, emp: Employee, dim_scores: dict):
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


@pytest.fixture
def make_project(db_session):
    created: list[uuid.UUID] = []

    def _make(needs: list, name: str = "组队测试项目") -> str:
        hr = db_session.scalar(
            select(User).where(User.email == "hr@xingye.test")
        )
        project = LiquidProject(
            tenant_id=hr.tenant_id,
            name=name,
            dept_name="研发",
            needs=needs,
            deadline="2027-12-31",
            status=LiquidProjectStatus.FORMING,
        )
        db_session.add(project)
        db_session.commit()
        db_session.refresh(project)
        created.append(project.id)
        return str(project.id)

    yield _make
    for pid in created:
        db_session.execute(delete(LiquidProject).where(LiquidProject.id == pid))
    db_session.commit()


# --- TR-6.1 两 URL 结果一致 ---------------------------------------------------

def test_project_team_urls_identical(client, db_session, make_project):
    full = _emp(db_session, "employee@xingye.test")    # 许星遥
    junior = _emp(db_session, "junior@xingye.test")    # 许清禾
    partial = _emp(db_session, "lowperf@xingye.test")  # 董斯年（无基线画像）
    _snapshot(db_session, full, {"ability": 80, "duty": 75})
    _snapshot(db_session, junior, {"ability": 40, "duty": 40})
    # TR-6.2：只提供 ability 且达标，duty 缺维 → 在可算维内归一，得 100
    _snapshot(db_session, partial, {"ability": 80})

    project_id = make_project(NEEDS)
    token = login(client, "hr@xingye.test")
    headers = auth_header(token)

    old = client.post(
        "/api/v1/org/project-team",
        json={"project_id": project_id},
        headers=headers,
    )
    new = client.post(
        "/api/v1/match/project-team",
        json={"project_id": project_id},
        headers=headers,
    )
    assert old.status_code == 200, old.text
    assert new.status_code == 200, new.text
    assert old.json() == new.json()  # 旧 URL 响应字段与口径完全一致

    rows = {r["name"]: r for r in new.json()}
    assert rows["许星遥"]["match_score"] == 100.0
    assert rows["许星遥"]["readiness"] == "ready"
    assert rows["许星遥"]["willingness"] == "unconfirmed"

    junior_row = rows["许清禾"]
    assert junior_row["match_score"] == 51.7  # (40/80 + 40/75)/2*100
    assert junior_row["readiness"] == "developing"
    assert "能力素质 40/80" in junior_row["reason"]
    assert "职责履行 40/75" in junior_row["reason"]

    # 缺维不再按 0 分：旧实现会得 50，引擎归一后得 100
    assert rows["董斯年"]["match_score"] == 100.0
    assert rows["董斯年"]["readiness"] == "ready"

    # Minor-5：缺维出参，两 URL 均可见（JSON 一致断言已覆盖旧端）
    assert rows["许星遥"]["missing_dims"] == []
    assert rows["董斯年"]["missing_dims"] == ["duty"]

    # 降序
    scores = [r["match_score"] for r in new.json()]
    assert scores == sorted(scores, reverse=True)


def test_project_team_readiness_follows_tenant_good(
    client, db_session, make_project
):
    """Minor-1：readiness 的 ready 档跟随租户 good 阈值，不再硬编码 80。"""
    from app.services.match import DEFAULT_REQUIRED, DEFAULT_WEIGHTS
    from app.services.match_config import upsert_match_config

    full = _emp(db_session, "employee@xingye.test")
    _snapshot(db_session, full, {"ability": 80})  # 单维 80/90 → 88.9
    hr = db_session.scalar(select(User).where(User.email == "hr@xingye.test"))
    upsert_match_config(
        db_session,
        hr.tenant_id,
        weights=dict(DEFAULT_WEIGHTS),
        required=dict(DEFAULT_REQUIRED),
        good=95,
        warn=60,
        updated_by=hr.id,
    )
    db_session.commit()

    project_id = make_project([{"ability": "能力素质", "level": 90}])
    token = login(client, "hr@xingye.test")
    resp = client.post(
        "/api/v1/match/project-team",
        json={"project_id": project_id},
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    rows = {r["name"]: r for r in resp.json()}
    assert rows["许星遥"]["match_score"] == 88.9
    # 旧硬编码 80 会给 ready，与引擎 level=watch 自相矛盾；现跟随 good=95
    assert rows["许星遥"]["readiness"] == "developing"


def test_project_team_allows_employee_user(client, db_session, make_project):
    """旧端点对任意登录用户开放，新端点保持同等待遇。"""
    project_id = make_project(NEEDS)
    token = login(client, "employee@xingye.test")
    resp = client.post(
        "/api/v1/match/project-team",
        json={"project_id": project_id},
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text


# --- TR-6.3 空需求 -------------------------------------------------------------

def test_project_team_scope_narrowing(client, db_session, make_project):
    """AC-11：manager 仅见 subtree、SELF 仅见本人；两 URL 收窄一致。"""
    full = _emp(db_session, "employee@xingye.test")
    _snapshot(db_session, full, {"ability": 80, "duty": 75})
    project_id = make_project(NEEDS)

    # manager（陆行舟，subtree 含部门 305 全员）
    mgr = login(client, "manager@xingye.test")
    for path in ("/api/v1/org/project-team", "/api/v1/match/project-team"):
        resp = client.post(
            path,
            json={"project_id": project_id},
            headers=auth_header(mgr),
        )
        assert resp.status_code == 200, resp.text
        names = {r["name"] for r in resp.json()}
        assert "许星遥" in names
        assert "温晚晴" not in names  # 201，不在汇报链

    # SELF 员工只能看到自己
    own = login(client, "employee@xingye.test")
    resp = client.post(
        "/api/v1/match/project-team",
        json={"project_id": project_id},
        headers=auth_header(own),
    )
    assert resp.status_code == 200, resp.text
    assert {r["name"] for r in resp.json()} == {"许星遥"}


def test_project_team_empty_needs(client, db_session, make_project):
    project_id = make_project([])
    token = login(client, "hr@xingye.test")
    for path in ("/api/v1/org/project-team", "/api/v1/match/project-team"):
        resp = client.post(
            path,
            json={"project_id": project_id},
            headers=auth_header(token),
        )
        assert resp.status_code == 200, resp.text
        assert resp.json() == []


# --- 项目不存在 / 跨租户 --------------------------------------------------------

def test_project_team_project_not_found(client, db_session):
    token = login(client, "hr@xingye.test")
    for path in ("/api/v1/org/project-team", "/api/v1/match/project-team"):
        resp = client.post(
            path,
            json={"project_id": str(uuid.uuid4())},
            headers=auth_header(token),
        )
        assert resp.status_code == 404


def test_project_team_cross_tenant(client, db_session, make_project):
    project_id = make_project(NEEDS)
    token = login(client, "hr@linyuan.test")
    for path in ("/api/v1/org/project-team", "/api/v1/match/project-team"):
        resp = client.post(
            path,
            json={"project_id": project_id},
            headers=auth_header(token),
        )
        assert resp.status_code == 404
