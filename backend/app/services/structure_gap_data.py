"""缺口预测 DB 薄层：配置读写、层级映射构建、供给聚合（spec structure-gap-forecast）。

算数全部委托 services.structure_gap 纯内核；本模块只做数据装配。
"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.framework_content import DEFAULT_GRADE_LEVELS
from app.models.employee import Employee
from app.models.level_framework import (
    FrameworkStatus,
    LevelFrameworkVersion,
    TenantLevelMapping,
)
from app.models.structure_gap import SequenceLevelHeadcount, StructureGapConfig
from app.models.succession import PoolStatus, TalentPool
from app.services.structure_gap import (
    DEFAULT_FACTORS,
    CellInput,
    GapFactors,
)


def build_grade_level_map(db: Session, tenant_id: uuid.UUID) -> dict[str, int]:
    """构建本租户 grade → level_order 映射（NFR-1：每请求一次，避免 N+1）。

    租户覆盖优先，平台默认兜底；无已发布框架时返回空 dict（全部未映射）。
    """
    fw = db.scalar(
        select(LevelFrameworkVersion)
        .where(LevelFrameworkVersion.status == FrameworkStatus.PUBLISHED)
        .order_by(LevelFrameworkVersion.version.desc())
    )
    if fw is None:
        return {}
    mapping = dict(DEFAULT_GRADE_LEVELS)
    overrides = db.scalars(
        select(TenantLevelMapping).where(
            TenantLevelMapping.tenant_id == tenant_id,
            TenantLevelMapping.framework_version_id == fw.id,
        )
    ).all()
    for row in overrides:
        mapping[row.grade_code] = row.level_order
    return mapping


def level_names(db: Session) -> dict[int, str]:
    """已发布框架的 level_order → 层级名称；无框架返回空。"""
    fw = db.scalar(
        select(LevelFrameworkVersion)
        .where(LevelFrameworkVersion.status == FrameworkStatus.PUBLISHED)
        .order_by(LevelFrameworkVersion.version.desc())
    )
    if fw is None:
        return {}
    return {lv.level_order: lv.name for lv in fw.levels}


def get_gap_config(db: Session, tenant_id: uuid.UUID) -> tuple[GapFactors, bool]:
    """读折算系数；无记录返回平台默认（is_default=True）。"""
    row = db.scalar(
        select(StructureGapConfig).where(StructureGapConfig.tenant_id == tenant_id)
    )
    if row is None:
        return DEFAULT_FACTORS, True
    return GapFactors(l1=row.factor_l1, l2=row.factor_l2, l3=row.factor_l3), False


def upsert_gap_config(
    db: Session,
    tenant_id: uuid.UUID,
    *,
    factor_l1: float,
    factor_l2: float,
    factor_l3: float,
    updated_by: uuid.UUID | None,
) -> GapFactors:
    """整体替换折算系数（每租户至多一行）。调用方负责校验与 commit。"""
    row = db.scalar(
        select(StructureGapConfig).where(StructureGapConfig.tenant_id == tenant_id)
    )
    if row is None:
        row = StructureGapConfig(tenant_id=tenant_id)
        db.add(row)
    row.factor_l1 = factor_l1
    row.factor_l2 = factor_l2
    row.factor_l3 = factor_l3
    row.updated_by = updated_by
    db.flush()
    return GapFactors(l1=factor_l1, l2=factor_l2, l3=factor_l3)


def list_headcounts(db: Session, tenant_id: uuid.UUID) -> list[SequenceLevelHeadcount]:
    return list(
        db.scalars(
            select(SequenceLevelHeadcount)
            .where(SequenceLevelHeadcount.tenant_id == tenant_id)
            .order_by(SequenceLevelHeadcount.sequence, SequenceLevelHeadcount.level_order)
        ).all()
    )


def replace_headcounts(
    db: Session,
    tenant_id: uuid.UUID,
    rows: list[dict],
    *,
    updated_by: uuid.UUID | None,
) -> list[SequenceLevelHeadcount]:
    """整体替换标准编制：库内不在提交集内的行删除。调用方负责校验与 commit。"""
    existing = list_headcounts(db, tenant_id)
    keep = {(r["sequence"], r["level_order"]) for r in rows}
    for row in existing:
        if (row.sequence, row.level_order) not in keep:
            db.delete(row)
    by_key = {(r.sequence, r.level_order): r for r in existing}
    for r in rows:
        key = (r["sequence"], r["level_order"])
        row = by_key.get(key)
        if row is None:
            row = SequenceLevelHeadcount(
                tenant_id=tenant_id,
                sequence=r["sequence"],
                level_order=r["level_order"],
            )
            db.add(row)
        row.headcount = r["headcount"]
        row.updated_by = updated_by
    db.flush()
    return list_headcounts(db, tenant_id)


def build_cell_inputs(db: Session, tenant_id: uuid.UUID) -> tuple[list[CellInput], dict]:
    """聚合供给与需求为内核输入；返回 (cells, unmapped)。

    unmapped：{"count": int, "grades": sorted list[str]} —— grade 无法解析到
    层级的在职员工（含其 active 池籍折算放弃），不静默丢弃（FR-3）。
    """
    grade_level = build_grade_level_map(db, tenant_id)

    employees = db.scalars(
        select(Employee).where(
            Employee.tenant_id == tenant_id, Employee.is_active.is_(True)
        )
    ).all()
    active_ids = {e.id for e in employees}

    # 在岗供给 + 未映射分组
    active_count: dict[tuple[str, int], int] = {}
    unmapped_grades: set[str] = set()
    unmapped_count = 0
    emp_cell: dict[uuid.UUID, tuple[str, int] | None] = {}
    for e in employees:
        level = grade_level.get(e.grade)
        if level is None:
            unmapped_count += 1
            unmapped_grades.add(e.grade)
            emp_cell[e.id] = None
            continue
        key = (e.sequence, level)
        emp_cell[e.id] = key
        active_count[key] = active_count.get(key, 0) + 1

    # 梯队折算：仅 active 池籍 + 本人在职 + 本人 grade 已映射
    pool_rows = db.scalars(
        select(TalentPool).where(
            TalentPool.tenant_id == tenant_id,
            TalentPool.status == PoolStatus.ACTIVE,
        )
    ).all()
    pool_levels: dict[tuple[str, int], list[str]] = {}
    for p in pool_rows:
        if p.employee_id not in active_ids:
            continue
        key = emp_cell.get(p.employee_id)
        if key is None:
            continue
        pool_levels.setdefault(key, []).append(p.pool_level.value)

    # 需求：标准编制配置
    demand: dict[tuple[str, int], int] = {}
    for h in list_headcounts(db, tenant_id):
        demand[(h.sequence, h.level_order)] = h.headcount

    keys = set(demand) | set(active_count) | set(pool_levels)
    cells = [
        CellInput(
            sequence=seq,
            level_order=lv,
            demand=demand.get((seq, lv), 0),
            active_count=active_count.get((seq, lv), 0),
            pool_levels=tuple(pool_levels.get((seq, lv), ())),
        )
        for seq, lv in sorted(keys)
    ]
    unmapped = {"count": unmapped_count, "grades": sorted(unmapped_grades)}
    return cells, unmapped
