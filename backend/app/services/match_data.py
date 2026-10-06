"""匹配引擎的数据装配：从员工主数据与画像快照取五维实际分。

与算分内核分离：本模块访问 DB，services.match 保持纯函数。
"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.employee import Employee
from app.models.profile import DimensionStatus, ProfileSnapshot
from app.services.match import DIM_PERF, MATCH_DIMENSIONS, grade_to_score


def latest_match_snapshot(
    db: Session, employee_id: uuid.UUID, tenant_id: uuid.UUID
) -> ProfileSnapshot | None:
    return db.scalar(
        select(ProfileSnapshot)
        .where(
            ProfileSnapshot.employee_id == employee_id,
            ProfileSnapshot.tenant_id == tenant_id,
        )
        .order_by(ProfileSnapshot.version_seq.desc())
        .limit(1)
    )


def latest_snapshots_map(
    db: Session, tenant_id: uuid.UUID, employee_ids: list[uuid.UUID]
) -> dict[uuid.UUID, ProfileSnapshot]:
    """批量取多名员工的最新画像（每个员工 2 条 SQL：快照+维度，整体 2 条）。"""
    if not employee_ids:
        return {}
    snapshots = db.scalars(
        select(ProfileSnapshot)
        .options(selectinload(ProfileSnapshot.dimensions))
        .where(
            ProfileSnapshot.tenant_id == tenant_id,
            ProfileSnapshot.employee_id.in_(list(employee_ids)),
        )
        .order_by(ProfileSnapshot.employee_id, ProfileSnapshot.version_seq.desc())
    ).all()
    latest: dict[uuid.UUID, ProfileSnapshot] = {}
    for snap in snapshots:
        latest.setdefault(snap.employee_id, snap)
    return latest


def actual_from_snapshot(emp: Employee, snapshot: ProfileSnapshot | None) -> dict | None:
    """按统一口径从员工+快照取五维实际分；无快照返回 None。

    perf 一律以员工绩效等级换算（S=95/A=90/B=80/C=70/D=60），
    不读画像 perf 维；其余四维取最新画像实测分。
    """
    if snapshot is None:
        return None
    actual: dict[str, int] = {}
    for dim in snapshot.dimensions:
        if (
            dim.dimension_key in MATCH_DIMENSIONS
            and dim.dimension_key != DIM_PERF
            and dim.status == DimensionStatus.MEASURED
            and dim.score is not None
        ):
            actual[dim.dimension_key] = dim.score
    perf_score = grade_to_score(emp.perf_grade)
    if perf_score is not None:
        actual[DIM_PERF] = perf_score
    return actual


def employee_match_actual(db: Session, emp: Employee) -> dict | None:
    """单员工五维实际分（逐人单行查询，少量对象场景）。"""
    snapshot = latest_match_snapshot(db, emp.id, emp.tenant_id)
    return actual_from_snapshot(emp, snapshot)


def employees_match_actual(
    db: Session, employees: list[Employee]
) -> dict[uuid.UUID, dict | None]:
    """批量装配：{employee_id: 五维实际分或 None}，避免 N+1。"""
    if not employees:
        return {}
    tenant_id = employees[0].tenant_id
    snapshots = latest_snapshots_map(db, tenant_id, [e.id for e in employees])
    return {
        emp.id: actual_from_snapshot(emp, snapshots.get(emp.id))
        for emp in employees
    }
