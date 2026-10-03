"""C1 画像引擎：服务层规则（维度计算/版本/汇报链/回写/补录）。"""

import uuid

from sqlalchemy import select

from app.models.application import (
    Application,
    ApplicationStatus,
    SelfAssessment,
    SelfLevel,
)
from app.models.audit import AuditLog
from app.models.employee import Employee
from app.models.profile import ProfileSource
from app.models.standard import StandardSet, StandardStatus
from app.services.profile import (
    generate_profile,
    latest_profile,
    subordinate_ids,
    update_basic,
    writeback_on_publish,
)

_published_clock = [0]


def _standard_set(db, tenant_id, target_grade):
    existing = db.scalar(
        select(StandardSet).where(
            StandardSet.tenant_id == tenant_id,
            StandardSet.sequence == "SW",
            StandardSet.target_grade == target_grade,
        )
    )
    if existing:
        return existing
    ss = StandardSet(
        tenant_id=tenant_id, sequence="SW", target_grade=target_grade,
        status=StandardStatus.PUBLISHED,
    )
    db.add(ss)
    db.flush()
    return ss


def _get_employee(db_session, email):
    from app.models.user import User
    return db_session.scalar(
        select(Employee).where(
            Employee.user_id == select(User.id).where(User.email == email).scalar_subquery()
        )
    )


def _make_app(db, employee, target_grade, levels, *, status):
    from datetime import datetime, timedelta

    published_at = None
    if status == ApplicationStatus.PUBLISHED:
        _published_clock[0] += 1
        published_at = datetime(2026, 1, 1) + timedelta(
            days=_published_clock[0]
        )

    app = Application(
        tenant_id=employee.tenant_id,
        employee_id=employee.id,
        standard_set_id=_standard_set(db, employee.tenant_id, target_grade).id,
        target_sequence="SW",
        target_grade=target_grade,
        status=status,
        published_at=published_at,
    )
    db.add(app)
    db.flush()
    for i, lv in enumerate(levels, 1):
        db.add(
            SelfAssessment(
                application_id=app.id,
                standard_item_code=f"D{i:03d}",
                self_level=lv,
            )
        )
    db.flush()
    return app


def _dim(snapshot, key):
    return next(d for d in snapshot.dimensions if d.dimension_key == key)


def test_profile_without_sources_all_null(db_session):
    emp = _get_employee(db_session, "employee@xingye.test")
    snapshot = generate_profile(db_session, emp.id)
    db_session.commit()

    assert snapshot.version_seq == 1
    assert snapshot.overall is None
    assert len(snapshot.dimensions) == 7
    for key in ("basic", "biz", "contribution", "duty", "knowledge", "ability"):
        d = _dim(snapshot, key)
        assert d.score is None
    assert _dim(snapshot, "duty").status.value == "no_data"
    perf = _dim(snapshot, "perf")
    assert perf.status.value == "measured"
    assert perf.score is None
    assert perf.grade_label == "B"


def test_duty_score_from_latest_published(db_session):
    emp = _get_employee(db_session, "employee@xingye.test")
    _make_app(
        db_session, emp, "P4",
        [SelfLevel.MET, SelfLevel.PARTIALLY_MET, SelfLevel.MET],
        status=ApplicationStatus.PUBLISHED,
    )
    db_session.commit()

    snapshot = generate_profile(db_session, emp.id)
    duty = _dim(snapshot, "duty")
    assert duty.status.value == "measured"
    # (1 + 0.5 + 1) / 3 * 100 = 83
    assert duty.score == 83
    assert duty.source_ref is not None
    # 仅两个带分维度 → overall 仍为空
    assert snapshot.overall is None


def test_duty_ignores_non_published_applications(db_session):
    emp = _get_employee(db_session, "lowperf@xingye.test")
    _make_app(
        db_session, emp, "P4", [SelfLevel.MET],
        status=ApplicationStatus.REJECTED,
    )
    _make_app(
        db_session, emp, "P4", [SelfLevel.NOT_MET],
        status=ApplicationStatus.DRAFT,
    )
    db_session.commit()

    snapshot = generate_profile(db_session, emp.id)
    assert _dim(snapshot, "duty").status.value == "no_data"


def test_latest_published_wins_when_multiple(db_session):
    emp = _get_employee(db_session, "employee@xingye.test")
    _make_app(
        db_session, emp, "P3", [SelfLevel.MET, SelfLevel.MET],
        status=ApplicationStatus.PUBLISHED,
    )
    second = _make_app(
        db_session, emp, "P4", [SelfLevel.PARTIALLY_MET, SelfLevel.PARTIALLY_MET],
        status=ApplicationStatus.PUBLISHED,
    )
    db_session.commit()

    snapshot = generate_profile(db_session, emp.id)
    duty = _dim(snapshot, "duty")
    assert duty.score == 50
    assert duty.source_ref == second.id


def test_version_seq_increments_and_history_kept(db_session):
    emp = _get_employee(db_session, "employee@xingye.test")
    first = generate_profile(db_session, emp.id)
    second = generate_profile(db_session, emp.id)
    db_session.commit()

    assert first.version_seq == 1
    assert second.version_seq == 2
    assert first.id != second.id
    assert latest_profile(db_session, emp.id).id == second.id


def test_subordinate_ids_recursive(db_session):
    mgr = _get_employee(db_session, "manager@xingye.test")
    ids = subordinate_ids(db_session, mgr.id)
    direct = {
        _get_employee(db_session, email).id
        for email in ("employee@xingye.test", "junior@xingye.test",
                      "lowperf@xingye.test")
    }
    assert direct <= ids

    # 递归间接下级：临时插入一条汇报链，用后即删
    sub = Employee(
        tenant_id=mgr.tenant_id,
        user_id=uuid.uuid4(),
        employee_no="TMP01", name="临时下级", dept_id="305",
        position="实习", family="P", sequence="SW", grade="P2",
        grade_since=mgr.grade_since, perf_grade="B",
        manager_id=next(iter(direct)), is_active=True,
    )
    db_session.add(sub)
    db_session.flush()
    try:
        assert sub.id in subordinate_ids(db_session, mgr.id)
    finally:
        db_session.delete(sub)
        db_session.commit()


def test_update_basic_then_basic_measured(db_session):
    from app.models.user import User

    emp = _get_employee(db_session, "employee@xingye.test")
    hr = db_session.scalar(select(User).where(User.email == "hr@xingye.test"))

    before = {"education": None, "certificates": []}
    update_basic(db_session, emp, hr, education="本科", certificates=["PMP"])
    db_session.commit()

    assert emp.education == "本科"
    assert emp.certificates == ["PMP"]
    assert emp.basic_updated_by == hr.id
    assert emp.basic_updated_at is not None

    snapshot = generate_profile(db_session, emp.id)
    basic = _dim(snapshot, "basic")
    # P3 要求大专，本科达标 → 70 + 1 证书×5 = 75
    assert basic.status.value == "measured"
    assert basic.score == 75

    log = db_session.scalar(
        select(AuditLog)
        .where(AuditLog.action == "profile_basic_updated")
        .order_by(AuditLog.id.desc())
    )
    assert log.before == before
    assert log.after == {"education": "本科", "certificates": ["PMP"]}


def test_writeback_on_publish_creates_full_new_version(db_session):
    emp = _get_employee(db_session, "employee@xingye.test")
    generate_profile(db_session, emp.id)  # v1 manual

    app = _make_app(
        db_session, emp, "P4", [SelfLevel.MET, SelfLevel.MET],
        status=ApplicationStatus.PUBLISHED,
    )
    db_session.commit()

    writeback_on_publish(db_session, app)
    db_session.commit()

    snap = latest_profile(db_session, emp.id)
    assert snap.version_seq == 2
    assert snap.source == ProfileSource.CERT_WRITEBACK
    assert snap.generated_by is None
    assert _dim(snap, "duty").score == 100
    assert len(snap.dimensions) == 7
