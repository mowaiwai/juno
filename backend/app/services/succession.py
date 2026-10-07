"""核心岗位 / 继任 / 梯队池 服务（spec talent-matching §4）。

风险与覆盖率只基于确定性数据；匹配信息逐维展示，不造总分。
"""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import err
from app.models.employee import Employee
from app.models.profile import DimensionStatus
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
from app.models.org import Department
from app.schemas.succession import (
    READINESS_1_2Y,
    READINESS_3Y,
    READINESS_LABELS,
    READINESS_READY_NOW,
    READINESS_UNASSESSED,
)
from app.services.audit import audit_as
from app.services.match import score_match
from app.services.match_config import get_match_config
from app.services.match_data import employees_match_actual
from app.services.match_team import willingness_by_employee
from app.services.profile import latest_profile
from app.services.scope import apply_employee_scope

_VALID_PERF = {"S", "A", "B"}


def _now():
    return datetime.now().astimezone()


# ---------------------------------------------------------------------------
# 核心岗位 CRUD
# ---------------------------------------------------------------------------

def create_position(
    db: Session,
    actor: User,
    *,
    name: str,
    grade: str,
    sequence: str,
    headcount: int = 1,
    dept_id: str | None = None,
    incumbent_employee_id=None,
) -> CorePosition:
    if not name or not name.strip():
        raise err(422, "invalid_request", "岗位名称不能为空")
    if headcount < 1:
        raise err(422, "invalid_headcount", "编制数必须 ≥ 1")

    position = CorePosition(
        tenant_id=actor.tenant_id,
        name=name.strip(),
        dept_id=dept_id,
        sequence=sequence,
        grade=grade,
        headcount=headcount,
        incumbent_employee_id=incumbent_employee_id,
        created_by=actor.id,
        created_at=_now(),
    )
    db.add(position)
    db.flush()

    audit_as(
        db, actor,
        "core_position_created", "core_position", position.id,
        None,
        {"name": position.name, "grade": grade,
         "headcount": headcount},
    )
    db.flush()
    return position


def update_position(
    db: Session, position: CorePosition, actor: User, **fields
) -> CorePosition:
    if "headcount" in fields and fields["headcount"] is not None:
        if fields["headcount"] < 1:
            raise err(422, "invalid_headcount", "编制数必须 ≥ 1")
    before = {}
    for key, value in fields.items():
        if value is None:
            continue
        if hasattr(position, key):
            before[key] = getattr(position, key)
            setattr(position, key, value)

    if before:
        audit_as(
            db, actor,
            "core_position_updated", "core_position", position.id,
            before,
            {k: getattr(position, k) for k in before},
        )
    db.flush()
    return position


def delete_position(db: Session, position: CorePosition, actor: User) -> None:
    # 级联删除候选（无 ORM relationship，手动清理）
    db.query(SuccessionCandidate).filter(
        SuccessionCandidate.core_position_id == position.id
    ).delete(synchronize_session=False)
    db.delete(position)
    audit_as(
        db, actor,
        "core_position_deleted", "core_position", position.id,
        {"name": position.name}, None,
    )
    db.flush()


def list_positions(db: Session, tenant_id) -> list[CorePosition]:
    return db.scalars(
        select(CorePosition)
        .where(CorePosition.tenant_id == tenant_id)
        .order_by(CorePosition.created_at.desc())
    ).all()


def get_position(db: Session, position_id, tenant_id) -> CorePosition:
    position = db.get(CorePosition, position_id)
    if position is None or position.tenant_id != tenant_id:
        raise err(404, "core_position_not_found", "核心岗位不存在")
    return position


# ---------------------------------------------------------------------------
# 风险等级 / 覆盖率 / 匹配信息
# ---------------------------------------------------------------------------

def _duty_score(db: Session, employee_id) -> int | None:
    profile = latest_profile(db, employee_id)
    if profile is None:
        return None
    dim = next(
        (d for d in profile.dimensions if d.dimension_key == "duty"), None
    )
    if dim is None or dim.status != DimensionStatus.MEASURED:
        return None
    return dim.score


def candidate_payload(
    db: Session,
    candidate: SuccessionCandidate,
    *,
    tenant_id=None,
    actuals: dict | None = None,
    cfg=None,
) -> dict:
    """候选出参；actuals/cfg 由调用方批量预取，未传则单条现算。"""
    employee = db.get(Employee, candidate.employee_id)
    tenant = tenant_id
    if tenant is None:
        pos = db.get(CorePosition, candidate.core_position_id)
        tenant = pos.tenant_id if pos else None

    match_score = None
    readiness = None
    if tenant is not None:
        if actuals is None:
            emp = employee
            actuals = (
                employees_match_actual(db, [emp]) if emp else {}
            )
        actual = (actuals or {}).get(candidate.employee_id)
        if actual:
            cfg = cfg or get_match_config(db, tenant)
            result = score_match(
                actual,
                required=cfg.required,
                weights=cfg.weights,
                good=cfg.good,
                warn=cfg.warn,
            )
            if result.score is not None:
                match_score = result.score
                readiness = readiness_tier(result.score, cfg.good, cfg.warn)

    return {
        "id": candidate.id,
        "core_position_id": candidate.core_position_id,
        "employee_id": candidate.employee_id,
        "origin": candidate.origin.value,
        "willingness": candidate.willingness.value,
        "perf_label": employee.perf_grade if employee else None,
        "duty_score": _duty_score(db, candidate.employee_id),
        "match_score": match_score,
        "readiness": readiness,
    }


def readiness_tier(score: float, good: int, warn: int) -> str:
    """统一匹配分 → 就绪度三档（PRD 模块六 P3）。

    Ready Now（≥good）→ P-L1；1–2 年（≥warn）→ P-L2；3 年+（<warn）→ P-L3。
    """
    if score >= good:
        return READINESS_READY_NOW
    if score >= warn:
        return READINESS_1_2Y
    return READINESS_3Y


def position_view(db: Session, position: CorePosition) -> dict:
    candidates = list_candidates(db, position)
    candidate_count = len(candidates)
    coverage = min(100, round(candidate_count / position.headcount * 100))

    if position.incumbent_employee_id is None:
        risk = "HIGH"
        reason = "岗位空缺，需立即补位"
    elif candidate_count == 0:
        risk = "HIGH"
        reason = "无继任候选人，存在断档风险"
    elif coverage < 100:
        risk = "MID"
        reason = "继任候选不足"
    else:
        risk = "LOW"
        reason = "继任候选充足"

    # 批量预取画像实际分与租户配置，避免逐候选 N+1
    cfg = get_match_config(db, position.tenant_id)
    emp_rows = (
        db.scalars(
            select(Employee).where(
                Employee.id.in_([c.employee_id for c in candidates])
            )
        ).all()
        if candidates
        else []
    )
    actuals = employees_match_actual(db, emp_rows) if emp_rows else {}

    return {
        "id": position.id,
        "name": position.name,
        "dept_id": position.dept_id,
        "sequence": position.sequence,
        "grade": position.grade,
        "headcount": position.headcount,
        "incumbent_employee_id": position.incumbent_employee_id,
        "created_by": position.created_by,
        "created_at": position.created_at,
        "risk": risk,
        "risk_reason": reason,
        "coverage": coverage,
        "candidate_count": candidate_count,
        "candidates": [
            candidate_payload(
                db, c, tenant_id=position.tenant_id,
                actuals=actuals, cfg=cfg,
            )
            for c in candidates
        ],
    }


# ---------------------------------------------------------------------------
# 继任候选
# ---------------------------------------------------------------------------

def list_candidates(
    db: Session, position: CorePosition
) -> list[SuccessionCandidate]:
    return db.scalars(
        select(SuccessionCandidate).where(
            SuccessionCandidate.core_position_id == position.id
        )
    ).all()


def _get_candidate(
    db: Session, position: CorePosition, employee_id
) -> SuccessionCandidate | None:
    return db.scalar(
        select(SuccessionCandidate).where(
            SuccessionCandidate.core_position_id == position.id,
            SuccessionCandidate.employee_id == employee_id,
        )
    )


def auto_screen(db: Session, position: CorePosition, actor: User) -> None:
    """刷新自动初筛：同序列 + 绩效 S/A/B + 排除在岗人。

    移除既有 AUTO 候选后重新生成；保留 MANUAL 提名。
    """
    existing = list_candidates(db, position)
    manual_ids = {
        c.employee_id for c in existing if c.origin == CandidateOrigin.MANUAL
    }
    for c in existing:
        if c.origin == CandidateOrigin.AUTO:
            db.delete(c)
    db.flush()

    eligible = db.scalars(
        select(Employee).where(
            Employee.tenant_id == position.tenant_id,
            Employee.sequence == position.sequence,
            Employee.perf_grade.in_(_VALID_PERF),
            Employee.is_active.is_(True),
        )
    ).all()

    for emp in eligible:
        if emp.id == position.incumbent_employee_id:
            continue
        if emp.id in manual_ids:
            continue
        if _get_candidate(db, position, emp.id) is not None:
            continue
        db.add(
            SuccessionCandidate(
                core_position_id=position.id,
                employee_id=emp.id,
                origin=CandidateOrigin.AUTO,
            )
        )
    db.flush()


def nominee(
    db: Session, position: CorePosition, employee: Employee, actor: User
) -> SuccessionCandidate:
    if employee.id == position.incumbent_employee_id:
        raise err(
            422, "nominate_incumbent", "在岗人不可作为继任候选人"
        )
    if _get_candidate(db, position, employee.id) is not None:
        raise err(
            409, "candidate_exists", "该员工已是继任候选人"
        )
    candidate = SuccessionCandidate(
        core_position_id=position.id,
        employee_id=employee.id,
        origin=CandidateOrigin.MANUAL,
    )
    db.add(candidate)
    db.flush()
    audit_as(
        db, actor,
        "succession_nominated", "succession_candidate", candidate.id,
        None,
        {"employee_id": str(employee.id),
         "position_id": str(position.id)},
    )
    db.flush()
    return candidate


def remove_candidate(
    db: Session, position: CorePosition, employee: Employee, actor: User
) -> None:
    candidate = _get_candidate(db, position, employee.id)
    if candidate is None:
        raise err(404, "candidate_not_found", "该员工非继任候选人")
    db.delete(candidate)
    audit_as(
        db, actor,
        "succession_removed", "succession_candidate", candidate.id,
        {"employee_id": str(employee.id)}, None,
    )
    db.flush()


def set_willingness(
    db: Session,
    position: CorePosition,
    employee: Employee,
    actor: User,
    willingness: Willingness,
) -> SuccessionCandidate:
    if not isinstance(willingness, Willingness):
        raise err(422, "invalid_willingness", "意愿取值不合法")
    candidate = _get_candidate(db, position, employee.id)
    if candidate is None:
        raise err(404, "candidate_not_found", "该员工非继任候选人")
    before = candidate.willingness.value
    candidate.willingness = willingness
    candidate.willingness_confirmed_by = actor.id
    candidate.willingness_at = _now()
    audit_as(
        db, actor,
        "willingness_confirmed", "succession_candidate", candidate.id,
        {"willingness": before},
        {"willingness": willingness.value},
    )
    db.flush()
    return candidate


# ---------------------------------------------------------------------------
# 梯队池
# ---------------------------------------------------------------------------

def list_pools(db: Session, tenant_id) -> list[TalentPool]:
    return db.scalars(
        select(TalentPool)
        .where(TalentPool.tenant_id == tenant_id)
        .order_by(TalentPool.joined_at.desc())
    ).all()


# 端点使用单数命名
list_pool = list_pools


def join_pool(
    db: Session,
    actor: User,
    employee: Employee,
    *,
    level: PoolLevel,
    reason: str,
) -> TalentPool:
    existing = db.scalar(
        select(TalentPool).where(
            TalentPool.tenant_id == actor.tenant_id,
            TalentPool.employee_id == employee.id,
            TalentPool.pool_level == level,
        )
    )
    if existing is not None:
        raise err(409, "pool_member_exists", "该员工已在此梯队中")
    member = TalentPool(
        tenant_id=actor.tenant_id,
        employee_id=employee.id,
        pool_level=level,
        reason=reason,
        joined_by=actor.id,
        joined_at=_now(),
    )
    db.add(member)
    db.flush()
    audit_as(
        db, actor,
        "pool_joined", "talent_pool", member.id,
        None,
        {"employee_id": str(employee.id), "pool_level": level.value},
    )
    db.flush()
    return member


def update_pool(
    db: Session, member: TalentPool, actor: User, **fields
) -> TalentPool:
    # 端点传 level=，映射到 pool_level
    if "level" in fields and fields["level"] is not None:
        fields["pool_level"] = fields.pop("level")
    before = {}
    for key, value in fields.items():
        if value is None:
            continue
        if hasattr(member, key):
            before[key] = getattr(member, key)
            setattr(member, key, value)
    if before:
        audit_as(
            db, actor,
            "pool_updated", "talent_pool", member.id,
            {k: (v.value if hasattr(v, "value") else v)
             for k, v in before.items()},
            {k: (getattr(member, k).value
                 if hasattr(getattr(member, k), "value")
                 else getattr(member, k))
             for k in before},
        )
    db.flush()
    return member


def leave_pool(db: Session, member: TalentPool, actor: User) -> TalentPool:
    before = member.status.value
    member.status = PoolStatus.EXITED
    audit_as(
        db, actor,
        "pool_left", "talent_pool", member.id,
        {"status": before}, {"status": PoolStatus.EXITED.value},
    )
    db.flush()
    return member


# ---------------------------------------------------------------------------
# 模块六 P3：继任推荐 / 继任地图
# ---------------------------------------------------------------------------

def recommend_for_position(
    db: Session,
    position: CorePosition,
    principal,
    limit: int = 10,
) -> list[dict]:
    """单岗位继任推荐：统一匹配引擎打分 + 就绪度三档。

    候选池 = 同序列在岗员工（数据范围内），排除在岗人与既有候选；
    按匹配分降序取 Top N。无可算维（画像缺失）者不入榜。
    """
    tenant_id = position.tenant_id

    existing_ids = {
        c.employee_id for c in list_candidates(db, position)
    }
    stmt = select(Employee).where(
        Employee.tenant_id == tenant_id,
        Employee.sequence == position.sequence,
        Employee.is_active.is_(True),
    )
    stmt = apply_employee_scope(stmt, db, principal)
    emps = [
        e for e in db.scalars(stmt).all()
        if e.id != position.incumbent_employee_id
        and e.id not in existing_ids
    ]
    if not emps:
        return []

    cfg = get_match_config(db, tenant_id)
    actuals = employees_match_actual(db, emps)
    will = willingness_by_employee(db, tenant_id)
    pool_ids = set(
        db.scalars(
            select(TalentPool.employee_id).where(
                TalentPool.tenant_id == tenant_id,
                TalentPool.status == PoolStatus.ACTIVE,
            )
        ).all()
    )

    out: list[dict] = []
    for emp in emps:
        actual = actuals.get(emp.id)
        if not actual:
            continue
        result = score_match(
            actual,
            required=cfg.required,
            weights=cfg.weights,
            good=cfg.good,
            warn=cfg.warn,
        )
        if result.score is None:
            continue
        tier = readiness_tier(result.score, cfg.good, cfg.warn)
        out.append(
            {
                "employee_id": emp.id,
                "name": emp.name,
                "position": emp.position,
                "grade": emp.grade,
                "perf_grade": emp.perf_grade,
                "match_score": result.score,
                "readiness": tier,
                "readiness_label": READINESS_LABELS[tier],
                "level": result.level,
                "reason": result.reason,
                "missing_dims": list(result.missing_dims),
                "willingness": will.get(emp.id, "unconfirmed"),
                "in_pool": emp.id in pool_ids,
            }
        )
    out.sort(key=lambda r: r["match_score"], reverse=True)
    return out[: max(1, min(limit, 50))]


def _dept_name_map(db: Session, tenant_id, dept_ids: set) -> dict:
    if not dept_ids:
        return {}
    rows = db.scalars(
        select(Department).where(
            Department.tenant_id == tenant_id,
            Department.id.in_(list(dept_ids)),
        )
    ).all()
    return {d.id: d.name for d in rows}


def build_succession_map(db: Session, tenant_id) -> dict:
    """继任地图：核心岗位 × 就绪度分桶 + 汇总。

    聚合计数不含个人明细，数据范围外角色也可读总览；
    个人明细仍走 /candidates（按范围收窄）。
    """
    positions = list_positions(db, tenant_id)
    cand_rows = db.execute(
        select(
            SuccessionCandidate.core_position_id,
            SuccessionCandidate.employee_id,
        ).join(
            CorePosition,
            SuccessionCandidate.core_position_id == CorePosition.id,
        ).where(CorePosition.tenant_id == tenant_id)
    ).all()

    by_position: dict = {}
    emp_ids = {r[1] for r in cand_rows} | {
        p.incumbent_employee_id
        for p in positions
        if p.incumbent_employee_id is not None
    }
    emps = (
        db.scalars(select(Employee).where(Employee.id.in_(list(emp_ids)))).all()
        if emp_ids
        else []
    )
    emp_map = {e.id: e for e in emps}
    cfg = get_match_config(db, tenant_id)
    actuals = employees_match_actual(db, emps) if emps else {}
    incumbents = {
        p.id: emp_map.get(p.incumbent_employee_id) for p in positions
    }
    dept_names = _dept_name_map(
        db, tenant_id, {p.dept_id for p in positions if p.dept_id}
    )

    for pos_id, emp_id in cand_rows:
        by_position.setdefault(pos_id, []).append(emp_id)

    rows = []
    total_ready = 0
    uncovered = 0
    vacant = 0
    for p in positions:
        ids = by_position.get(p.id, [])
        buckets = {
            READINESS_READY_NOW: 0,
            READINESS_1_2Y: 0,
            READINESS_3Y: 0,
            READINESS_UNASSESSED: 0,
        }
        for eid in ids:
            actual = actuals.get(eid)
            if not actual:
                buckets[READINESS_UNASSESSED] += 1
                continue
            result = score_match(
                actual,
                required=cfg.required,
                weights=cfg.weights,
                good=cfg.good,
                warn=cfg.warn,
            )
            if result.score is None:
                buckets[READINESS_UNASSESSED] += 1
            else:
                buckets[readiness_tier(result.score, cfg.good, cfg.warn)] += 1

        coverage = min(100, round(len(ids) / p.headcount * 100))
        incumbent = incumbents.get(p.id)
        if p.incumbent_employee_id is None:
            risk = "HIGH"
        elif not ids or buckets[READINESS_READY_NOW] == 0:
            risk = "HIGH"
        elif coverage < 100:
            risk = "MID"
        else:
            risk = "LOW"
        if not ids and p.incumbent_employee_id is not None:
            uncovered += 1
        if p.incumbent_employee_id is None:
            vacant += 1
        if buckets[READINESS_READY_NOW] > 0:
            total_ready += 1

        rows.append(
            {
                "position_id": p.id,
                "name": p.name,
                "dept_name": dept_names.get(p.dept_id),
                "sequence": p.sequence,
                "grade": p.grade,
                "headcount": p.headcount,
                "incumbent_name": incumbent.name if incumbent else None,
                "ready_now": buckets[READINESS_READY_NOW],
                "ready_1_2y": buckets[READINESS_1_2Y],
                "ready_3y": buckets[READINESS_3Y],
                "unassessed": buckets[READINESS_UNASSESSED],
                "candidate_count": len(ids),
                "coverage": coverage,
                "risk": risk,
            }
        )

    return {
        "positions": rows,
        "summary": {
            "positions": len(rows),
            "covered_positions": total_ready,
            "ready_now_positions": total_ready,
            "no_backup_positions": uncovered,
            "vacant_positions": vacant,
        },
    }
