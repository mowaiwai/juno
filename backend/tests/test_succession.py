"""C3 核心岗位/继任/梯队：服务层规则。"""

import pytest

from sqlalchemy import select

from app.models.audit import AuditLog
from app.models.employee import Employee
from app.models.succession import (
    CandidateOrigin,
    CorePosition,
    PoolLevel,
    PoolStatus,
    SuccessionCandidate,
    TalentPool,
    Willingness,
)
from app.models.user import User
from app.services.succession import (
    auto_screen,
    create_position,
    delete_position,
    join_pool,
    leave_pool,
    list_candidates,
    list_positions,
    nominee,
    position_view,
    remove_candidate,
    set_willingness,
    update_pool,
    update_position,
)


def _user(db, email):
    return db.scalar(select(User).where(User.email == email))


def _emp(db, email):
    return db.scalar(
        select(Employee).where(
            Employee.user_id
            == select(User.id).where(User.email == email).scalar_subquery()
        )
    )


def _position(db, hr, *, name="软件研发经理", grade="M2", sequence="MGT",
              headcount=1, incumbent=None, dept_id="305"):
    return create_position(
        db, hr,
        name=name, dept_id=dept_id, grade=grade, sequence=sequence,
        headcount=headcount, incumbent_employee_id=incumbent.id if incumbent else None,
    )


# ---------------------------------------------------------------------------
# 核心岗位 CRUD
# ---------------------------------------------------------------------------

def test_create_position(db_session):
    hr = _user(db_session, "hr@xingye.test")
    position = _position(db_session, hr)
    db_session.commit()

    assert position.name == "软件研发经理"
    assert position.headcount == 1
    log = db_session.scalar(
        select(AuditLog).where(AuditLog.action == "core_position_created")
    )
    assert log is not None


def test_create_position_invalid_headcount(db_session):
    hr = _user(db_session, "hr@xingye.test")
    with pytest.raises(Exception):
        create_position(
            db_session, hr, name="编制非法", dept_id="305",
            grade="M2", sequence="MGT", headcount=0,
        )


def test_update_and_delete_position(db_session):
    hr = _user(db_session, "hr@xingye.test")
    position = _position(db_session, hr)
    update_position(db_session, position, hr, headcount=2, name="研发经理")
    db_session.commit()
    assert position.headcount == 2
    assert position.name == "研发经理"

    delete_position(db_session, position, hr)
    db_session.commit()
    assert db_session.get(CorePosition, position.id) is None
    actions = {
        log.action
        for log in db_session.scalars(select(AuditLog)).all()
    }
    assert {"core_position_updated", "core_position_deleted"} <= actions


def test_list_positions_tenant_isolated(db_session):
    hr = _user(db_session, "hr@xingye.test")
    _position(db_session, hr)
    db_session.commit()

    t1_rows = list_positions(db_session, hr.tenant_id)
    t2_hr = _user(db_session, "hr@linyuan.test")
    assert len(t1_rows) == 1
    assert list_positions(db_session, t2_hr.tenant_id) == []


# ---------------------------------------------------------------------------
# 风险等级
# ---------------------------------------------------------------------------

def test_risk_vacant_high(db_session):
    hr = _user(db_session, "hr@xingye.test")
    position = _position(db_session, hr)
    db_session.commit()
    view = position_view(db_session, position)
    assert view["risk"] == "HIGH"
    assert "空缺" in view["risk_reason"]


def test_risk_no_candidate_high(db_session):
    hr = _user(db_session, "hr@xingye.test")
    mgr = _emp(db_session, "manager@xingye.test")
    position = _position(db_session, hr, incumbent=mgr)
    db_session.commit()
    view = position_view(db_session, position)
    assert view["risk"] == "HIGH"
    assert "无继任候选" in view["risk_reason"]


def test_risk_low_coverage_mid(db_session):
    hr = _user(db_session, "hr@xingye.test")
    mgr = _emp(db_session, "manager@xingye.test")
    position = _position(db_session, hr, incumbent=mgr, headcount=2)
    nominee(db_session, position, _emp(db_session, "employee@xingye.test"), hr)
    db_session.commit()

    view = position_view(db_session, position)
    assert view["risk"] == "MID"
    assert view["coverage"] == 50
    assert view["candidate_count"] == 1


def test_risk_low_when_covered(db_session):
    hr = _user(db_session, "hr@xingye.test")
    mgr = _emp(db_session, "manager@xingye.test")
    position = _position(db_session, hr, incumbent=mgr)
    nominee(db_session, position, _emp(db_session, "employee@xingye.test"), hr)
    db_session.commit()

    view = position_view(db_session, position)
    assert view["risk"] == "LOW"
    assert view["coverage"] == 100


def test_coverage_capped_at_100(db_session):
    hr = _user(db_session, "hr@xingye.test")
    mgr = _emp(db_session, "manager@xingye.test")
    position = _position(db_session, hr, incumbent=mgr)
    nominee(db_session, position, _emp(db_session, "employee@xingye.test"), hr)
    nominee(db_session, position, _emp(db_session, "junior@xingye.test"), hr)
    db_session.commit()

    assert position_view(db_session, position)["coverage"] == 100


# ---------------------------------------------------------------------------
# 自动初筛
# ---------------------------------------------------------------------------

def test_auto_screen_rules(db_session):
    hr = _user(db_session, "hr@xingye.test")
    rev1 = _emp(db_session, "rev1@xingye.test")
    # SW/P4 核心岗位，在岗人 rev1
    position = _position(
        db_session, hr, name="高级软件工程师", grade="P4",
        sequence="SW", incumbent=rev1,
    )
    auto_screen(db_session, position, hr)
    db_session.commit()

    candidates = list_candidates(db_session, position)
    ids = {c.employee_id for c in candidates}
    # 同序列 SW + 绩效 S/A/B：employee、junior 入选
    assert ids == {
        _emp(db_session, "employee@xingye.test").id,
        _emp(db_session, "junior@xingye.test").id,
    }
    # 排除在岗人 rev1、绩效 C 的 lowperf、不同序列 ENG 的 rev2
    assert all(c.origin == CandidateOrigin.AUTO for c in candidates)


def test_auto_screen_is_idempotent(db_session):
    hr = _user(db_session, "hr@xingye.test")
    mgr = _emp(db_session, "manager@xingye.test")
    # 用全租户无员工的唯一序列 → 初筛为空
    position = _position(
        db_session, hr, name="无候选岗位", sequence="UNIQ",
        grade="U1", incumbent=mgr,
    )
    auto_screen(db_session, position, hr)
    auto_screen(db_session, position, hr)
    db_session.commit()
    assert len(list_candidates(db_session, position)) == 0


def test_auto_screen_keeps_manual_nominees(db_session):
    hr = _user(db_session, "hr@xingye.test")
    rev1 = _emp(db_session, "rev1@xingye.test")
    position = _position(
        db_session, hr, name="高级软件工程师", grade="P4",
        sequence="SW", incumbent=rev1,
    )
    # 人工提名跨序列的 rev2
    rev2 = _emp(db_session, "rev2@xingye.test")
    nominee(db_session, position, rev2, hr)
    auto_screen(db_session, position, hr)
    db_session.commit()

    ids = {c.employee_id for c in list_candidates(db_session, position)}
    assert rev2.id in ids
    assert _emp(db_session, "employee@xingye.test").id in ids


# ---------------------------------------------------------------------------
# 提名/移除/意愿
# ---------------------------------------------------------------------------

def test_nominate_duplicate_rejected(db_session):
    hr = _user(db_session, "hr@xingye.test")
    mgr = _emp(db_session, "manager@xingye.test")
    position = _position(db_session, hr, incumbent=mgr)
    nominee(db_session, position, _emp(db_session, "employee@xingye.test"), hr)
    db_session.commit()
    with pytest.raises(Exception):
        nominee(db_session, position, _emp(db_session, "employee@xingye.test"), hr)


def test_nominate_incumbent_rejected(db_session):
    hr = _user(db_session, "hr@xingye.test")
    mgr = _emp(db_session, "manager@xingye.test")
    position = _position(db_session, hr, incumbent=mgr)
    with pytest.raises(Exception):
        nominee(db_session, position, mgr, hr)


def test_remove_candidate(db_session):
    hr = _user(db_session, "hr@xingye.test")
    mgr = _emp(db_session, "manager@xingye.test")
    position = _position(db_session, hr, incumbent=mgr)
    employee = _emp(db_session, "employee@xingye.test")
    nominee(db_session, position, employee, hr)
    remove_candidate(db_session, position, employee, hr)
    db_session.commit()
    assert list_candidates(db_session, position) == []
    log = db_session.scalar(
        select(AuditLog).where(AuditLog.action == "succession_removed")
    )
    assert log is not None


def test_willingness_flow(db_session):
    hr = _user(db_session, "hr@xingye.test")
    mgr = _emp(db_session, "manager@xingye.test")
    position = _position(db_session, hr, incumbent=mgr)
    employee = _emp(db_session, "employee@xingye.test")
    nominee(db_session, position, employee, hr)

    candidate = set_willingness(
        db_session, position, employee, hr, Willingness.WILLING
    )
    db_session.commit()
    assert candidate.willingness == Willingness.WILLING
    assert candidate.willingness_confirmed_by == hr.id
    assert candidate.willingness_at is not None

    log = db_session.scalar(
        select(AuditLog).where(AuditLog.action == "willingness_confirmed")
    )
    assert log.after["willingness"] == "willing"


def test_candidate_match_info_no_fabricated_score(db_session):
    from app.models.application import SelfLevel
    from tests.test_profile import _make_app
    from app.services.profile import generate_profile

    hr = _user(db_session, "hr@xingye.test")
    rev1 = _emp(db_session, "rev1@xingye.test")
    position = _position(
        db_session, hr, name="高级软件工程师", grade="P4",
        sequence="SW", incumbent=rev1,
    )
    employee = _emp(db_session, "employee@xingye.test")
    _make_app(
        db_session, employee, "P4",
        [SelfLevel.MET, SelfLevel.PARTIALLY_MET, SelfLevel.MET],
        status="published",
    )
    db_session.commit()
    generate_profile(db_session, employee.id)
    db_session.commit()
    nominee(db_session, position, employee, hr)
    db_session.commit()

    view = position_view(db_session, position)
    candidate = view["candidates"][0]
    # P3 契约：统一引擎就绪度（缺维不计入分母，不造分；无画像 → None）
    assert candidate["match_score"] == 100.0
    assert candidate["readiness"] == "ready_now"
    assert candidate["perf_label"] == "B"
    assert candidate["duty_score"] == 83


# ---------------------------------------------------------------------------
# 梯队池
# ---------------------------------------------------------------------------

def test_join_pool(db_session):
    hr = _user(db_session, "hr@xingye.test")
    employee = _emp(db_session, "employee@xingye.test")
    member = join_pool(
        db_session, hr, employee,
        level=PoolLevel.L1, reason="绩效稳定、关键项目主导",
    )
    db_session.commit()
    assert member.status == PoolStatus.ACTIVE
    assert member.joined_by == hr.id
    log = db_session.scalar(
        select(AuditLog).where(AuditLog.action == "pool_joined")
    )
    assert log is not None


def test_join_pool_duplicate_rejected(db_session):
    hr = _user(db_session, "hr@xingye.test")
    employee = _emp(db_session, "employee@xingye.test")
    join_pool(db_session, hr, employee, level=PoolLevel.L1, reason="依据")
    db_session.commit()
    with pytest.raises(Exception):
        join_pool(db_session, hr, employee, level=PoolLevel.L1, reason="重复")


def test_update_and_leave_pool(db_session):
    hr = _user(db_session, "hr@xingye.test")
    employee = _emp(db_session, "employee@xingye.test")
    member = join_pool(
        db_session, hr, employee, level=PoolLevel.L3, reason="潜力储备"
    )
    update_pool(db_session, member, hr, pool_level=PoolLevel.L2)
    db_session.commit()
    assert member.pool_level == PoolLevel.L2

    leave_pool(db_session, member, hr)
    db_session.commit()
    assert member.status == PoolStatus.EXITED
    actions = {
        log.action
        for log in db_session.scalars(select(AuditLog)).all()
    }
    assert {"pool_updated", "pool_left"} <= actions
