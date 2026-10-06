"""人才梯队建设服务（模块七 P3，spec PRD §模块七）。

只读计算指标，不落库：
- 厚度 = 每层合格人数 ÷ 标准编制；合格 = 在岗 + Σ(active 池籍 × 折算系数)
- 断层率 = 无合格后备的关键层级占比；关键层级 = 有关键岗位分布的层级
- 流动率 = 近 365 天 (graduated+exited) ÷ 当前 active 池籍
"""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.models.inventory import (
    BatchStatus,
    InventoryBatch,
    InventoryResult,
    Potential,
)
from app.models.succession import (
    CorePosition,
    PoolLevel,
    PoolStatus,
    TalentPool,
)
from app.services.structure_gap_data import (
    build_grade_level_map,
    get_gap_config,
    level_names,
    list_headcounts,
)

# 后备识别的合格绩效标签（与 succession.auto_screen 同口径）
_BACKUP_VALID_PERF = {"S", "A"}

# 断层预警默认阈值：qualified < headcount 即触发（可由租户后续配置覆盖）
_GAP_EPSILON = 1e-6


def _factor_map(factors) -> dict[str, float]:
    return {"L1": factors.l1, "L2": factors.l2, "L3": factors.l3}


def _latest_published_batch(db: Session, tenant_id) -> InventoryBatch | None:
    return db.scalar(
        select(InventoryBatch)
        .where(
            InventoryBatch.tenant_id == tenant_id,
            InventoryBatch.status == BatchStatus.PUBLISHED,
        )
        .order_by(InventoryBatch.published_at.desc().nullslast(),
                  InventoryBatch.created_at.desc())
        .limit(1)
    )


def _active_pool_levels(db: Session, tenant_id) -> dict[uuid.UUID, list[str]]:
    """员工 → 其 active 池籍等级列表。"""
    rows = db.scalars(
        select(TalentPool).where(
            TalentPool.tenant_id == tenant_id,
            TalentPool.status == PoolStatus.ACTIVE,
        )
    ).all()
    out: dict[uuid.UUID, list[str]] = {}
    for r in rows:
        out.setdefault(r.employee_id, []).append(r.pool_level.value)
    return out


def _pool_outflow_count(db: Session, tenant_id, days: int = 365) -> int:
    """近 N 天 graduated + exited 池籍总数。"""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    rows = db.scalars(
        select(TalentPool).where(
            TalentPool.tenant_id == tenant_id,
            TalentPool.status.in_([PoolStatus.GRADUATED, PoolStatus.EXITED]),
            TalentPool.joined_at >= cutoff,
        )
    ).all()
    return len(rows)


def _active_pool_count(db: Session, tenant_id) -> int:
    rows = db.scalars(
        select(TalentPool).where(
            TalentPool.tenant_id == tenant_id,
            TalentPool.status == PoolStatus.ACTIVE,
        )
    ).all()
    return len(rows)


def _build_cells(db: Session, tenant_id, sequence: str | None):
    """构建序列×层级单元格（厚度/缺口标记）；返回 (cells, level_name_map)。"""
    grade_level = build_grade_level_map(db, tenant_id)
    level_name_map = level_names(db)
    factors, _ = get_gap_config(db, tenant_id)
    fmap = _factor_map(factors)

    emp_q = select(Employee).where(
        Employee.tenant_id == tenant_id,
        Employee.is_active.is_(True),
    )
    if sequence:
        emp_q = emp_q.where(Employee.sequence == sequence)
    employees = db.scalars(emp_q).all()
    active_by_key: dict[tuple[str, int], int] = {}
    emp_cell: dict[uuid.UUID, tuple[str, int]] = {}
    for e in employees:
        lv = grade_level.get(e.grade)
        if lv is None:
            continue
        key = (e.sequence, lv)
        emp_cell[e.id] = key
        active_by_key[key] = active_by_key.get(key, 0) + 1

    pool_rows = db.scalars(
        select(TalentPool).where(
            TalentPool.tenant_id == tenant_id,
            TalentPool.status == PoolStatus.ACTIVE,
        )
    ).all()
    pool_by_key: dict[tuple[str, int], dict[str, int]] = {}
    for p in pool_rows:
        key = emp_cell.get(p.employee_id)
        if key is None:
            continue
        bucket = pool_by_key.setdefault(key, {"L1": 0, "L2": 0, "L3": 0})
        bucket[p.pool_level.value] = bucket.get(p.pool_level.value, 0) + 1

    # 标准编制（需求）按序列过滤
    standards_rows = list_headcounts(db, tenant_id)
    if sequence:
        standards_rows = [r for r in standards_rows if r.sequence == sequence]
    headcount_by_key = {
        (r.sequence, r.level_order): r.headcount for r in standards_rows
    }

    # 关键层级 = 有 CorePosition 分布的 (sequence, level_order)
    positions = db.scalars(
        select(CorePosition).where(CorePosition.tenant_id == tenant_id)
    ).all()
    critical_keys: set[tuple[str, int]] = set()
    for pos in positions:
        lv = grade_level.get(pos.grade)
        if lv is None:
            continue
        critical_keys.add((pos.sequence, lv))
    if sequence:
        critical_keys = {k for k in critical_keys if k[0] == sequence}

    keys = set(headcount_by_key) | set(active_by_key) | set(pool_by_key)
    cells = []
    for seq, lv in sorted(keys):
        hc = headcount_by_key.get((seq, lv), 0)
        active = active_by_key.get((seq, lv), 0)
        bucket = pool_by_key.get((seq, lv), {})
        pool_l1 = bucket.get("L1", 0)
        pool_l2 = bucket.get("L2", 0)
        pool_l3 = bucket.get("L3", 0)
        qualified = active + (
            pool_l1 * fmap["L1"] + pool_l2 * fmap["L2"] + pool_l3 * fmap["L3"]
        )
        thickness = round(qualified / hc, 4) if hc > 0 else None
        has_gap = hc > 0 and qualified + _GAP_EPSILON < hc
        cells.append({
            "sequence": seq,
            "level_order": lv,
            "level_name": level_name_map.get(lv, f"L{lv}"),
            "headcount": hc,
            "active_count": active,
            "pool_l1": pool_l1,
            "pool_l2": pool_l2,
            "pool_l3": pool_l3,
            "qualified": round(qualified, 2),
            "thickness": thickness,
            "is_critical": (seq, lv) in critical_keys,
            "has_gap": has_gap,
        })
    return cells, level_name_map, critical_keys


def build_pyramid(db: Session, tenant_id, sequence: str) -> dict:
    """单序列梯队图：层级升序 + 汇总。"""
    cells, _, _ = _build_cells(db, tenant_id, sequence)
    total_hc = sum(c["headcount"] for c in cells)
    total_active = sum(c["active_count"] for c in cells)
    total_pool = sum(c["pool_l1"] + c["pool_l2"] + c["pool_l3"] for c in cells)
    return {
        "sequence": sequence,
        "levels": cells,
        "total_headcount": total_hc,
        "total_active": total_active,
        "total_pool": total_pool,
    }


def compute_health(db: Session, tenant_id) -> dict:
    """三指标汇总：厚度/断层率/流动率。"""
    cells, _, critical_keys = _build_cells(db, tenant_id, None)

    # 厚度：仅统计有编制配置的 cell（避免无配置层级稀释）
    hc_cells = [c for c in cells if c["headcount"] > 0]
    total_hc = sum(c["headcount"] for c in hc_cells)
    total_qualified = sum(c["qualified"] for c in hc_cells)
    thickness = round(total_qualified / total_hc, 4) if total_hc > 0 else None

    # 断层率：仅统计关键层级（有关键岗位）
    critical_cells = [c for c in cells if c["is_critical"]]
    gap_critical = [c for c in critical_cells if c["has_gap"]]
    critical_count = len(critical_cells)
    gap_rate = (
        round(len(gap_critical) / critical_count, 4) if critical_count else 0.0
    )

    # 流动率：近 365 天流出 ÷ 当前 active
    outflow = _pool_outflow_count(db, tenant_id, days=365)
    active_pool = _active_pool_count(db, tenant_id)
    flow_rate = round(outflow / active_pool, 4) if active_pool > 0 else 0.0

    batch = _latest_published_batch(db, tenant_id)
    return {
        "thickness": thickness,
        "gap_rate": gap_rate,
        "flow_rate": flow_rate,
        "critical_levels": critical_count,
        "gap_levels": len(gap_critical),
        "active_pool": active_pool,
        "recent_outflow": outflow,
        "batch_id": batch.id if batch else None,
        "batch_name": batch.name if batch else None,
        "published_at": batch.published_at if batch else None,
    }


def list_gap_warnings(db: Session, tenant_id) -> list[dict]:
    """断层预警：合格供给 < 标准编制 的层级，按缺口降序。"""
    cells, _, _ = _build_cells(db, tenant_id, None)
    warnings = []
    for c in cells:
        if not c["has_gap"]:
            continue
        shortage = round(c["headcount"] - c["qualified"], 2)
        thickness_pct = (
            f"{round(c['thickness'] * 100, 1)}%" if c["thickness"] is not None
            else "—"
        )
        suggestion = (
            f"{c['sequence']}·{c['level_name']}：编制 {c['headcount']}、"
            f"合格供给 {c['qualified']}（厚度 {thickness_pct}），缺 {shortage}。"
            "建议：1) 从盘点高潜池补位 L1/L2；2) 启动继任盘点；3) 外部招聘补缺口。"
        )
        warnings.append({
            "sequence": c["sequence"],
            "level_order": c["level_order"],
            "level_name": c["level_name"],
            "headcount": c["headcount"],
            "qualified": c["qualified"],
            "shortage": shortage,
            "thickness": c["thickness"],
            "suggestion": suggestion,
        })
    warnings.sort(key=lambda w: (-w["shortage"], w["sequence"], w["level_order"]))
    return warnings


def list_backup_candidates(db: Session, tenant_id) -> dict:
    """后备人才识别：最新发布盘点批次中 potential=high + perf∈{S,A}，未入池标记。

    池籍状态随查询返回（可能已入池，前端据 pool_level 渲染）。
    """
    batch = _latest_published_batch(db, tenant_id)
    if batch is None:
        return {"batch_id": None, "batch_name": None, "items": [], "total": 0}

    results = db.scalars(
        select(InventoryResult).where(
            InventoryResult.batch_id == batch.id,
            InventoryResult.potential == Potential.HIGH,
            InventoryResult.perf_label.in_(_BACKUP_VALID_PERF),
        )
    ).all()
    if not results:
        return {
            "batch_id": batch.id, "batch_name": batch.name, "items": [], "total": 0,
        }

    grade_level = build_grade_level_map(db, tenant_id)
    pool_map = _active_pool_levels(db, tenant_id)

    items = []
    for r in results:
        emp = db.get(Employee, r.employee_id)
        if emp is None or not emp.is_active or emp.tenant_id != tenant_id:
            continue
        pools = pool_map.get(emp.id, [])
        pool_level = pools[0] if pools else None
        items.append({
            "employee_id": emp.id,
            "name": emp.name,
            "dept_id": emp.dept_id,
            "position": emp.position,
            "sequence": emp.sequence,
            "grade": emp.grade,
            "level_order": grade_level.get(emp.grade),
            "perf_label": r.perf_label or "",
            "ability_score": r.ability_score,
            "grid_code": r.grid_code,
            "potential": r.potential.value if r.potential else "high",
            "pool_level": pool_level,
            "batch_id": batch.id,
            "batch_name": batch.name,
        })
    items.sort(key=lambda x: (x["sequence"], -(x["level_order"] or 0), x["name"]))
    return {
        "batch_id": batch.id,
        "batch_name": batch.name,
        "items": items,
        "total": len(items),
    }
