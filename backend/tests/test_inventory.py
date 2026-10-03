"""C2 盘点批次与九宫格：服务层规则。"""

from datetime import date

from sqlalchemy import select

from app.models.audit import AuditLog
from app.models.employee import Employee
from app.models.inventory import (
    BatchStatus,
    InventoryBatch,
    InventoryResult,
    Potential,
)
from app.models.user import User
from app.services.inventory import (
    confirm_batch,
    create_batch,
    distribution,
    locate_grid,
    reject_batch,
    save_calibration,
    start_batch,
    submit_calibration,
)
from app.services.profile import generate_profile
from tests.test_profile import _make_app, _standard_set  # noqa: F401
from app.models.application import SelfLevel  # noqa: F401


def _user(db, email):
    return db.scalar(select(User).where(User.email == email))


def _emp(db, email):
    return db.scalar(
        select(Employee).where(
            Employee.user_id
            == select(User.id).where(User.email == email).scalar_subquery()
        )
    )


def _create_and_start(db, name="2026 年度盘点", scope=None):
    hr = _user(db, "hr@xingye.test")
    batch = create_batch(
        db, hr.tenant_id, hr, name=name, purpose="annual",
        scope_employee_ids=scope,
    )
    start_batch(db, batch.id, hr)
    db.commit()
    return db.get(InventoryBatch, batch.id)


# ---------------------------------------------------------------------------
# 落格纯函数
# ---------------------------------------------------------------------------

def test_locate_grid_columns_and_rows():
    assert locate_grid("S", Potential.HIGH) == "9A1"
    assert locate_grid("A", Potential.MID) == "9A2"
    assert locate_grid("A", Potential.LOW) == "9A3"
    assert locate_grid("B", Potential.HIGH) == "9B1"
    assert locate_grid("B", Potential.MID) == "9B2"
    assert locate_grid("B", Potential.LOW) == "9B3"
    assert locate_grid("C", Potential.HIGH) == "9C1"
    assert locate_grid("C", Potential.MID) == "9C2"
    assert locate_grid("C", Potential.LOW) == "9C3"


def test_locate_grid_needs_both_inputs():
    assert locate_grid(None, Potential.HIGH) is None
    assert locate_grid("A", None) is None


# ---------------------------------------------------------------------------
# 创建与初排
# ---------------------------------------------------------------------------

def test_create_batch_is_draft(db_session):
    hr = _user(db_session, "hr@xingye.test")
    batch = create_batch(
        db_session, hr.tenant_id, hr, name="测试盘点", purpose="annual"
    )
    db_session.commit()
    assert batch.status == BatchStatus.DRAFT
    assert batch.published_at is None

    log = db_session.scalar(
        select(AuditLog).where(AuditLog.action == "inventory_created")
    )
    assert log is not None


def test_start_creates_results_unlocated(db_session):
    emp = _emp(db_session, "employee@xingye.test")
    batch = _create_and_start(db_session)

    results = db_session.scalars(
        select(InventoryResult).where(InventoryResult.batch_id == batch.id)
    ).all()
    assert batch.status == BatchStatus.CALIBRATING
    assert len(results) == 8  # t1 全部在册员工
    by_emp = {r.employee_id: r for r in results}
    row = by_emp[emp.id]
    assert row.potential is None
    assert row.located is False
    assert row.grid_code is None
    assert row.perf_label == "B"
    # 无画像时 ability_score 为空
    assert row.ability_score is None


def test_start_picks_ability_score_from_latest_profile(db_session):
    emp = _emp(db_session, "employee@xingye.test")
    _make_app(
        db_session, emp, "P4",
        [SelfLevel.MET, SelfLevel.PARTIALLY_MET, SelfLevel.MET],
        status="published",
    )
    db_session.commit()
    generate_profile(db_session, emp.id)
    db_session.commit()

    batch = _create_and_start(db_session)
    row = db_session.scalar(
        select(InventoryResult).where(
            InventoryResult.batch_id == batch.id,
            InventoryResult.employee_id == emp.id,
        )
    )
    assert row.ability_score == 83


def test_scope_limits_results(db_session):
    emp = _emp(db_session, "employee@xingye.test")
    hr = _user(db_session, "hr@xingye.test")
    batch = create_batch(
        db_session, hr.tenant_id, hr, name="小范围", purpose="succession",
        scope_employee_ids=[emp.id],
    )
    start_batch(db_session, batch.id, hr)
    db_session.commit()

    results = db_session.scalars(
        select(InventoryResult).where(InventoryResult.batch_id == batch.id)
    ).all()
    assert len(results) == 1


# ---------------------------------------------------------------------------
# 校准
# ---------------------------------------------------------------------------

def test_rate_potential_locates_grid(db_session):
    emp = _emp(db_session, "employee@xingye.test")
    batch = _create_and_start(db_session)
    hr = _user(db_session, "hr@xingye.test")

    result = save_calibration(
        db_session, batch.id, emp.id, hr,
        potential=Potential.HIGH, note="连续两年关键项目主导",
    )
    db_session.commit()
    assert result.located is True
    assert result.grid_code == "9B1"
    assert result.potential == Potential.HIGH
    assert result.potential_by == hr.id
    assert result.potential_at is not None

    actions = {
        log.action
        for log in db_session.scalars(select(AuditLog)).all()
    }
    assert "potential_rated" in actions


def test_missing_perf_remains_unlocated(db_session):
    emp = _emp(db_session, "employee@xingye.test")
    hr = _user(db_session, "hr@xingye.test")

    # 初排前置空绩效（新员工尚无绩效结果）
    emp.perf_grade = None
    db_session.flush()

    batch = create_batch(
        db_session, hr.tenant_id, hr,
        name="缺绩效盘点", purpose="annual",
        scope_employee_ids=[emp.id],
    )
    start_batch(db_session, batch.id, hr)
    db_session.commit()

    result = save_calibration(
        db_session, batch.id, emp.id, hr,
        potential=Potential.MID, note="绩效数据缺失待补",
    )
    db_session.commit()
    assert result.located is False
    assert result.grid_code is None


def test_manual_grid_override_requires_note(db_session):
    import pytest

    emp = _emp(db_session, "employee@xingye.test")
    batch = _create_and_start(db_session)
    hr = _user(db_session, "hr@xingye.test")

    # 无 note 的人工调格 → 422
    with pytest.raises(Exception):
        save_calibration(
            db_session, batch.id, emp.id, hr,
            potential=Potential.HIGH, grid_code="9A2", note=None,
        )
    db_session.rollback()

    result = save_calibration(
        db_session, batch.id, emp.id, hr,
        potential=Potential.HIGH, grid_code="9A2",
        note="业绩稳定但潜力评定偏保守，校准上调",
    )
    db_session.commit()
    assert result.grid_code == "9A2"
    log = db_session.scalar(
        select(AuditLog)
        .where(AuditLog.action == "calibrated")
        .order_by(AuditLog.id.desc())
    )
    assert log is not None
    assert log.after["grid_code"] == "9A2"


def test_invalid_grid_code_rejected(db_session):
    import pytest

    emp = _emp(db_session, "employee@xingye.test")
    batch = _create_and_start(db_session)
    hr = _user(db_session, "hr@xingye.test")
    with pytest.raises(Exception):
        save_calibration(
            db_session, batch.id, emp.id, hr,
            potential=Potential.HIGH, grid_code="7X9", note="非法格码",
        )


# ---------------------------------------------------------------------------
# 状态流转
# ---------------------------------------------------------------------------

def test_full_flow_to_published(db_session):
    batch = _create_and_start(db_session)
    hr = _user(db_session, "hr@xingye.test")
    admin = _user(db_session, "admin@xingye.test")

    results = db_session.scalars(
        select(InventoryResult).where(InventoryResult.batch_id == batch.id)
    ).all()
    for r in results:
        save_calibration(
            db_session, batch.id, r.employee_id, hr,
            potential=Potential.MID, note="校准会逐人评定",
        )

    submit_calibration(db_session, batch.id, hr)
    db_session.commit()
    assert db_session.get(InventoryBatch, batch.id).status == BatchStatus.CONFIRMING

    confirm_batch(db_session, batch.id, admin)
    db_session.commit()
    published = db_session.get(InventoryBatch, batch.id)
    assert published.status == BatchStatus.PUBLISHED
    assert published.published_at is not None


def test_reject_back_to_calibrating(db_session):
    batch = _create_and_start(db_session)
    hr = _user(db_session, "hr@xingye.test")
    admin = _user(db_session, "admin@xingye.test")

    submit_calibration(db_session, batch.id, hr)
    db_session.commit()
    reject_batch(db_session, batch.id, admin)
    db_session.commit()
    assert db_session.get(InventoryBatch, batch.id).status == BatchStatus.CALIBRATING

    log = db_session.scalar(
        select(AuditLog).where(AuditLog.action == "executive_confirmed")
    )
    # 退回不产生确认审计
    assert log is None


def test_invalid_transitions_raise(db_session):
    import pytest

    batch = _create_and_start(db_session)
    hr = _user(db_session, "hr@xingye.test")
    admin = _user(db_session, "admin@xingye.test")

    # calibrating 不能直接 confirm
    with pytest.raises(Exception):
        confirm_batch(db_session, batch.id, admin)
    db_session.rollback()

    submit_calibration(db_session, batch.id, hr)
    db_session.commit()
    # confirming 阶段不能再校准
    emp = _emp(db_session, "employee@xingye.test")
    with pytest.raises(Exception):
        save_calibration(
            db_session, batch.id, emp.id, hr,
            potential=Potential.HIGH, note="不应保存",
        )
    db_session.rollback()

    confirm_batch(db_session, batch.id, admin)
    db_session.commit()
    # published 后只读
    with pytest.raises(Exception):
        save_calibration(
            db_session, batch.id, emp.id, hr,
            potential=Potential.LOW, note="发布后不应修改",
        )


# ---------------------------------------------------------------------------
# 分布统计
# ---------------------------------------------------------------------------

def test_distribution_counts(db_session):
    batch = _create_and_start(db_session)
    hr = _user(db_session, "hr@xingye.test")

    # 全部初排后先看未定位数
    stats = distribution(db_session, batch.id)
    assert stats["total"] == 8
    assert stats["unlocated"] == 8
    assert sum(stats["grids"].values()) == 0

    results = db_session.scalars(
        select(InventoryResult).where(InventoryResult.batch_id == batch.id)
    ).all()
    for r in results:
        save_calibration(
            db_session, batch.id, r.employee_id, hr,
            potential=Potential.MID, note="评定",
        )
    db_session.commit()

    stats = distribution(db_session, batch.id)
    assert stats["unlocated"] == 0
    # B 绩效（含 A/S 列）落各自格；总人数守恒
    assert sum(stats["grids"].values()) == 8
    assert all(0 <= p <= 100 for p in stats["percentages"].values())
