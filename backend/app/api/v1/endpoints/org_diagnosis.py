"""组织诊断端点（spec org-diagnosis）。

组织结构分布、断层预警、三张图看板、能力×业绩四象限、液态组队匹配。
所有数据均基于租户内员工、画像、核心岗位与继任候选聚合。
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import Principal, err, get_current_user, get_principal
from app.database import get_db
from app.models.employee import Employee
from app.models.org_diagnosis import LiquidProject
from app.models.profile import ProfileSnapshot
from app.models.succession import (
    CorePosition,
    PoolStatus,
    SuccessionCandidate,
    TalentPool,
)
from app.models.user import User
from app.schemas.org_diagnosis import (
    ClassificationOut,
    ClassificationSummary,
    DensityOut,
    DeptStructureOut,
    GapWarningOut,
    ImbalanceItem,
    LiquidProjectOut,
    OptimizeAdviceIn,
    OptimizeAdviceOut,
    ProjectTeamIn,
    TalentMapOut,
    TeamCandidateOut,
    ThreeChartsOut,
)
# S=95 为收敛统一引擎后新增档位：S 级员工新进入散点/四象限统计，
# 属业务可见统计变化，已知会模块负责人（评审 Question-2）
from app.services.match import GRADE_SCORES as _PERF_MAP
from app.services.match_team import (
    build_team_candidates,
    willingness_by_employee as _willingness_by_employee,
)

router = APIRouter(tags=["org"])

# ---------------------------------------------------------------------------
# 常量与映射
# ---------------------------------------------------------------------------

_TOP_DEPTS = {
    "200": "职能",
    "300": "研发",
    "400": "制造",
    "500": "供应链",
    "600": "营销",
}

def _top_dept_code(dept_id: str | None) -> str:
    """将任意 dept_id 归并到顶层编码（200/300/...）。"""
    if not dept_id:
        return ""
    if dept_id in _TOP_DEPTS:
        return dept_id
    # 按首字符归并：201→200, 305→300, 401→400 等
    prefix = dept_id[0] + "00"
    if prefix in _TOP_DEPTS:
        return prefix
    return dept_id


def _grade_num(grade: str | None) -> int:
    """提取 grade 中的数字部分（P4 → 4, M2 → 2）。"""
    if not grade:
        return 0
    num = ""
    for ch in grade.strip().upper():
        if ch.isdigit():
            num += ch
        elif num:
            break
    return int(num) if num else 0


def _grade_tier(grade: str | None) -> str:
    """返回 grade 层级：junior / middle / senior / other。"""
    if not grade:
        return "other"
    g = grade.strip().upper()
    if g.startswith("M"):
        return "senior"
    n = _grade_num(g)
    if n == 0:
        return "other"
    if n <= 2:
        return "junior"
    if n <= 5:
        return "middle"
    return "senior"


def _shape(grade_count: dict[str, int], headcount: int) -> tuple[str, str, float]:
    """依据中层占比判定组织形状。"""
    if headcount == 0:
        return "healthy", "健康型", 0.0
    mid = sum(c for g, c in grade_count.items() if _grade_tier(g) == "middle")
    junior = sum(c for g, c in grade_count.items() if _grade_tier(g) == "junior")
    senior = sum(c for g, c in grade_count.items() if _grade_tier(g) == "senior")
    mid_ratio = round(mid / headcount, 2)
    if mid_ratio < 0.30:
        return "dumbbell", "哑铃型", mid_ratio
    if mid_ratio > 0.50:
        return "diamond", "钻石型", mid_ratio
    if junior > senior:
        return "pyramid", "金字塔型", mid_ratio
    return "healthy", "健康型", mid_ratio


def _latest_snapshots(db: Session, tenant_id: uuid.UUID) -> dict:
    """取每个员工最新一版画像，返回 {employee_id: ProfileSnapshot}。"""
    snapshots = db.scalars(
        select(ProfileSnapshot)
        .where(ProfileSnapshot.tenant_id == tenant_id)
        .order_by(ProfileSnapshot.employee_id, ProfileSnapshot.version_seq.desc())
    ).all()
    latest: dict = {}
    for s in snapshots:
        if s.employee_id not in latest:
            latest[s.employee_id] = s
    return latest


def _scatter_points(employees, latest_snapshots: dict) -> list[dict]:
    """构建能力×业绩散点：x=perf, y=ability, size=potential(1-3)。"""
    points: list[dict] = []
    for emp in employees:
        pg = (emp.perf_grade or "").upper()
        if pg not in _PERF_MAP:
            continue
        x = _PERF_MAP[pg]
        snap = latest_snapshots.get(emp.id)
        if snap is None:
            continue
        y = None
        for d in snap.dimensions:
            if d.dimension_key == "ability" and d.score is not None:
                y = d.score
                break
        if y is None:
            continue
        size = 3 if y >= 85 else (2 if y >= 70 else 1)
        points.append({"emp_id": str(emp.id), "x": x, "y": y, "size": size})
    return points


def _quadrants(points: list[dict]) -> dict:
    """按 75 分界划分四象限计数。"""
    q = {"q1_star": 0, "q2_potential": 0, "q3_risk": 0, "q4_steady": 0}
    for p in points:
        x, y = p["x"], p["y"]
        if x >= 75 and y >= 75:
            q["q1_star"] += 1
        elif x < 75 and y >= 75:
            q["q2_potential"] += 1
        elif x < 75 and y < 75:
            q["q3_risk"] += 1
        else:
            q["q4_steady"] += 1
    return q


def _anomaly_list(employees, will: dict) -> list[str]:
    """业绩 D 或继任意愿为不愿的异常员工。"""
    out: list[str] = []
    for emp in employees:
        if emp.perf_grade and emp.perf_grade.upper() == "D":
            out.append(f"{emp.name}（业绩 D）")
            continue
        if will.get(emp.id) == "unwilling":
            out.append(f"{emp.name}（继任意愿：不愿）")
    return out


# ---------------------------------------------------------------------------
# 1. 组织结构分布
# ---------------------------------------------------------------------------

@router.get("/org/structure", response_model=list[DeptStructureOut])
def org_structure(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    emps = db.scalars(
        select(Employee).where(
            Employee.tenant_id == user.tenant_id,
            Employee.is_active.is_(True),
        )
    ).all()
    groups: dict[str, list[Employee]] = {}
    for e in emps:
        code = _top_dept_code(e.dept_id)
        if code in _TOP_DEPTS:
            groups.setdefault(code, []).append(e)
    out: list[DeptStructureOut] = []
    for code in ["200", "300", "400", "500", "600"]:
        members = groups.get(code, [])
        headcount = len(members)
        grade_count: dict[str, int] = {}
        for m in members:
            grade_count[m.grade] = grade_count.get(m.grade, 0) + 1
        shape, label, mid_ratio = _shape(grade_count, headcount)
        out.append(DeptStructureOut(
            dept_id=code,
            dept_name=_TOP_DEPTS[code],
            headcount=headcount,
            grade_count=grade_count,
            shape=shape,
            shape_label=label,
            mid_ratio=mid_ratio,
        ))
    return out


# ---------------------------------------------------------------------------
# 2. 断层预警
# ---------------------------------------------------------------------------

def _fallback_gap_warnings() -> list[GapWarningOut]:
    """无核心岗位数据时的兜底预警。"""
    return [
        GapWarningOut(
            position_id=uuid.uuid4(),
            position_name="研发总监",
            dept_name="研发",
            incumbent_id=None,
            incumbent_name=None,
            level="M2",
            reason="关键岗位无明确继任候选人，存在断层风险",
            suggestion="启动继任盘点与梯队培养",
        ),
        GapWarningOut(
            position_id=uuid.uuid4(),
            position_name="供应链经理",
            dept_name="供应链",
            incumbent_id=None,
            incumbent_name=None,
            level="M1",
            reason="编制 2 人，在岗 1 人，缺编 1 人",
            suggestion="外部招聘与内部培养并行",
        ),
        GapWarningOut(
            position_id=uuid.uuid4(),
            position_name="制造车间主任",
            dept_name="制造",
            incumbent_id=None,
            incumbent_name=None,
            level="P6",
            reason="继任候选人意愿不明确",
            suggestion="确认意愿并制定发展计划",
        ),
    ]


@router.get("/org/gap-warnings", response_model=list[GapWarningOut])
def org_gap_warnings(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    positions = db.scalars(
        select(CorePosition).where(CorePosition.tenant_id == user.tenant_id)
    ).all()
    warnings: list[GapWarningOut] = []
    for pos in positions:
        active = db.scalar(
            select(func.count(Employee.id)).where(
                Employee.tenant_id == user.tenant_id,
                Employee.is_active.is_(True),
                Employee.sequence == pos.sequence,
            )
        ) or 0
        cand_count = db.scalar(
            select(func.count(SuccessionCandidate.id)).where(
                SuccessionCandidate.core_position_id == pos.id
            )
        ) or 0
        reasons: list[str] = []
        if active < pos.headcount:
            reasons.append(
                f"编制 {pos.headcount} 人，在岗 {active} 人，缺编 {pos.headcount - active}"
            )
        if cand_count == 0:
            reasons.append("无继任候选人，存在断层风险")
        if not reasons:
            continue
        incumbent_name = None
        if pos.incumbent_employee_id:
            inc = db.get(Employee, pos.incumbent_employee_id)
            if inc:
                incumbent_name = inc.name
        suggestion = "启动继任盘点与外部招聘双通道"
        if cand_count == 0:
            suggestion = "优先补充继任候选人并启动梯队培养"
        warnings.append(GapWarningOut(
            position_id=pos.id,
            position_name=pos.name,
            dept_name=_TOP_DEPTS.get(_top_dept_code(pos.dept_id), pos.dept_id or ""),
            incumbent_id=pos.incumbent_employee_id,
            incumbent_name=incumbent_name,
            level=pos.grade,
            reason="；".join(reasons),
            suggestion=suggestion,
        ))
    if not warnings:
        return _fallback_gap_warnings()
    return warnings


# ---------------------------------------------------------------------------
# 3. 三张图看板
# ---------------------------------------------------------------------------

@router.get("/org/three-charts", response_model=ThreeChartsOut)
def org_three_charts(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tenant_id = user.tenant_id
    emps = db.scalars(
        select(Employee).where(
            Employee.tenant_id == tenant_id,
            Employee.is_active.is_(True),
        )
    ).all()
    latest = _latest_snapshots(db, tenant_id)
    scatter = _scatter_points(emps, latest)
    will = _willingness_by_employee(db, tenant_id)
    anomaly = _anomaly_list(emps, will)

    dept_set = {
        _top_dept_code(e.dept_id) for e in emps
        if _top_dept_code(e.dept_id) in _TOP_DEPTS
    }
    positions = db.scalars(
        select(CorePosition).where(CorePosition.tenant_id == tenant_id)
    ).all()
    key_positions = len(positions)
    covered_rows = db.execute(
        select(SuccessionCandidate.core_position_id)
        .join(CorePosition, SuccessionCandidate.core_position_id == CorePosition.id)
        .where(CorePosition.tenant_id == tenant_id)
        .group_by(SuccessionCandidate.core_position_id)
    ).all()
    coverage = (
        round(len(covered_rows) / key_positions, 2) if key_positions else 0.0
    )

    p4_plus = sum(1 for e in emps if _grade_num(e.grade) >= 4)
    p4_ratio = round(p4_plus / len(emps), 2) if emps else 0.0
    hp = db.scalar(
        select(func.count(TalentPool.id)).where(
            TalentPool.tenant_id == tenant_id,
            TalentPool.status == PoolStatus.ACTIVE,
        )
    ) or 0
    risk = sum(
        1 for e in emps if e.perf_grade and e.perf_grade.upper() == "D"
    )

    strategy = [
        {
            "initiative": "海外市场拓展",
            "talent_support": "需 5 名供应链专家",
            "owner": "供应链 VP",
            "note": "Q2 启动",
        },
        {
            "initiative": "数字化研发",
            "talent_support": "补充 3 名算法工程师",
            "owner": "研发总监",
            "note": "全年推进",
        },
        {
            "initiative": "组织精益化",
            "talent_support": "培养 10 名精益带头人",
            "owner": "制造总监",
            "note": "Q3 试点",
        },
    ]
    return ThreeChartsOut(
        year=datetime.now(timezone.utc).year,
        strategy=strategy,
        org={
            "departments": len(dept_set),
            "key_positions": key_positions,
            "succession_coverage": coverage,
            "org_changes": 3,
        },
        talent={
            "p4_plus_ratio": p4_ratio,
            "high_potential_count": hp,
            "risk_count": risk,
            "scatter": scatter,
            "willingness_anomaly": anomaly,
        },
    )


# ---------------------------------------------------------------------------
# 4. 能力×业绩四象限
# ---------------------------------------------------------------------------

@router.get("/org/talent-map", response_model=TalentMapOut)
def org_talent_map(
    dept_id: str = "200",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tenant_id = user.tenant_id
    code = _top_dept_code(dept_id)
    emps = db.scalars(
        select(Employee).where(
            Employee.tenant_id == tenant_id,
            Employee.is_active.is_(True),
        )
    ).all()
    dept_emps = [e for e in emps if _top_dept_code(e.dept_id) == code]
    latest = _latest_snapshots(db, tenant_id)
    scatter = _scatter_points(dept_emps, latest)
    quadrants = _quadrants(scatter)
    will = _willingness_by_employee(db, tenant_id)
    anomaly = _anomaly_list(dept_emps, will)
    return TalentMapOut(
        dept_id=code,
        scatter=scatter,
        quadrants=quadrants,
        willingness_anomaly=anomaly,
    )


# ---------------------------------------------------------------------------
# 5. 液态组队项目列表
# ---------------------------------------------------------------------------

@router.get("/org/liquid-projects", response_model=list[LiquidProjectOut])
def org_liquid_projects(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = db.scalars(
        select(LiquidProject).where(LiquidProject.tenant_id == user.tenant_id)
    ).all()
    return [LiquidProjectOut.model_validate(r) for r in rows]


# ---------------------------------------------------------------------------
# 6. 液态组队匹配
# ---------------------------------------------------------------------------

@router.post("/org/project-team", response_model=list[TeamCandidateOut])
def org_project_team(
    body: ProjectTeamIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    project = db.get(LiquidProject, body.project_id)
    if project is None or project.tenant_id != principal.user.tenant_id:
        raise err(404, "project_not_found", "液态项目不存在")
    # 算分收敛到统一匹配引擎，与 /match/project-team 共用同一服务与数据范围
    candidates = build_team_candidates(db, principal, project.needs or [])
    return [
        TeamCandidateOut(
            employee_id=c.employee_id,
            name=c.name,
            position=c.position,
            match_score=c.match_score,
            willingness=c.willingness,
            readiness=c.readiness,
            reason=c.reason,
            missing_dims=c.missing_dims,
        )
        for c in candidates
    ]


# ---------------------------------------------------------------------------
# 7. 维度自动分类（核心/胜任/可转型/待优化）
# ---------------------------------------------------------------------------

_CATEGORY_LABELS = {
    "core": "核心",
    "competent": "胜任",
    "transformable": "可转型",
    "optimize": "待优化",
}

_CATEGORY_THRESHOLDS = {
    "core": {"perf": 85, "ability": 80},
    "competent": {"perf": 75, "ability": 70},
    "transformable": {"perf": 70, "ability": 60},
}


def _classify(
    perf: float | None,
    ability: float | None,
    willingness: str,
) -> tuple[str, str]:
    """按绩效×能力×意愿四分类，返回 (category, reason)。"""
    if perf is None and ability is None:
        return "unclassified", "绩效与能力数据均缺失，无法分类"
    p = perf or 0
    a = ability or 0
    if p >= _CATEGORY_THRESHOLDS["core"]["perf"] and a >= _CATEGORY_THRESHOLDS["core"]["ability"]:
        return "core", f"绩效 {p} ≥ 85 且能力 {a} ≥ 80"
    if p >= _CATEGORY_THRESHOLDS["competent"]["perf"] and a >= _CATEGORY_THRESHOLDS["competent"]["ability"]:
        return "competent", f"绩效 {p} ≥ 75 且能力 {a} ≥ 70"
    if p >= _CATEGORY_THRESHOLDS["transformable"]["perf"] and a >= _CATEGORY_THRESHOLDS["transformable"]["ability"]:
        return "transformable", f"绩效 {p} ≥ 70 且能力 {a} ≥ 60，可通过培养转型"
    return "optimize", f"绩效 {p} < 70 或能力 {a} < 60，需重点关注"


@router.get("/org/classification", response_model=list[ClassificationOut])
def org_classification(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """全员四分类：核心/胜任/可转型/待优化。"""
    tenant_id = user.tenant_id
    emps = db.scalars(
        select(Employee).where(
            Employee.tenant_id == tenant_id,
            Employee.is_active.is_(True),
        )
    ).all()
    latest = _latest_snapshots(db, tenant_id)
    will = _willingness_by_employee(db, tenant_id)

    out: list[ClassificationOut] = []
    for emp in emps:
        pg = (emp.perf_grade or "").upper()
        perf = float(_PERF_MAP.get(pg, 0)) if pg else None
        ability = None
        snap = latest.get(emp.id)
        if snap:
            for d in snap.dimensions:
                if d.dimension_key == "ability" and d.score is not None:
                    ability = d.score
                    break
        w = will.get(emp.id, "none")
        cat, reason = _classify(perf, ability, w)
        out.append(ClassificationOut(
            employee_id=emp.id,
            name=emp.name,
            dept_name=_TOP_DEPTS.get(_top_dept_code(emp.dept_id), emp.dept_id or ""),
            position=emp.position or "",
            sequence=emp.sequence or "",
            grade=emp.grade or "",
            category=cat,
            category_label=_CATEGORY_LABELS.get(cat, cat),
            perf_score=perf,
            ability_score=ability,
            willingness=w,
            reason=reason,
        ))
    return out


@router.get("/org/classification/summary", response_model=ClassificationSummary)
def org_classification_summary(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """四分类汇总计数。"""
    items = org_classification(db=db, user=user)
    summary = ClassificationSummary(total=len(items))
    for it in items:
        if it.category == "core":
            summary.core += 1
        elif it.category == "competent":
            summary.competent += 1
        elif it.category == "transformable":
            summary.transformable += 1
        elif it.category == "optimize":
            summary.optimize += 1
        else:
            summary.unclassified += 1
    return summary


# ---------------------------------------------------------------------------
# 8. 人才密度仪表盘
# ---------------------------------------------------------------------------


@router.get("/org/density", response_model=DensityOut)
def org_density(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """人才密度：核心占比、序列/层级分布、形状识别。"""
    tenant_id = user.tenant_id
    emps = db.scalars(
        select(Employee).where(
            Employee.tenant_id == tenant_id,
            Employee.is_active.is_(True),
        )
    ).all()
    latest = _latest_snapshots(db, tenant_id)

    # 四分类
    will = _willingness_by_employee(db, tenant_id)
    core_count = 0
    for emp in emps:
        pg = (emp.perf_grade or "").upper()
        perf = float(_PERF_MAP.get(pg, 0)) if pg else None
        ability = None
        snap = latest.get(emp.id)
        if snap:
            for d in snap.dimensions:
                if d.dimension_key == "ability" and d.score is not None:
                    ability = d.score
                    break
        cat, _ = _classify(perf, ability, will.get(emp.id, "none"))
        if cat == "core":
            core_count += 1

    # 序列分布
    seq_dist: dict[str, int] = {}
    for e in emps:
        if e.sequence:
            seq_dist[e.sequence] = seq_dist.get(e.sequence, 0) + 1

    # 层级分布（复用 structure_gap 的 grade→level 映射）
    from app.services.structure_gap_data import build_grade_level_map
    grade_level = build_grade_level_map(db, tenant_id)
    level_dist: dict[str, int] = {}
    for e in emps:
        lvl = grade_level.get(e.grade)
        if lvl is not None:
            key = str(lvl)
            level_dist[key] = level_dist.get(key, 0) + 1

    # 形状识别（复用已有逻辑）
    grade_count: dict[str, int] = {}
    for e in emps:
        grade_count[e.grade] = grade_count.get(e.grade, 0) + 1
    shape, shape_label, mid_ratio = _shape(grade_count, len(emps))

    # 高潜（L1 池）
    hp = db.scalar(
        select(func.count(TalentPool.id)).where(
            TalentPool.tenant_id == tenant_id,
            TalentPool.status == PoolStatus.ACTIVE,
            TalentPool.pool_level == PoolLevel.L1,
        )
    ) or 0

    risk = sum(1 for e in emps if e.perf_grade and e.perf_grade.upper() == "D")

    return DensityOut(
        total=len(emps),
        core_count=core_count,
        core_ratio=round(core_count / len(emps), 2) if emps else 0.0,
        sequence_dist=seq_dist,
        level_dist=level_dist,
        shape=shape,
        shape_label=shape_label,
        mid_ratio=mid_ratio,
        high_potential=hp,
        risk_count=risk,
    )


# ---------------------------------------------------------------------------
# 9. 冗余/缺口识别
# ---------------------------------------------------------------------------


@router.get("/org/imbalance", response_model=list[ImbalanceItem])
def org_imbalance(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """冗余/缺口识别：对比编制与实际在岗，输出失衡项。"""
    from app.services.structure_gap_data import (
        build_grade_level_map,
        get_gap_config,
        list_headcounts,
    )

    tenant_id = user.tenant_id
    emps = db.scalars(
        select(Employee).where(
            Employee.tenant_id == tenant_id,
            Employee.is_active.is_(True),
        )
    ).all()

    # 在岗统计
    active_map: dict[str, int] = {}
    grade_level = build_grade_level_map(db, tenant_id)
    for e in emps:
        lvl = grade_level.get(e.grade)
        if lvl is not None:
            key = f"{e.sequence}:{lvl}"
            active_map[key] = active_map.get(key, 0) + 1

    # 编制标准
    standards_rows = list_headcounts(db, tenant_id)
    standards = [
        {"sequence": r.sequence, "level_order": r.level_order, "headcount": r.headcount}
        for r in standards_rows
    ]

    # 梯队折算
    factors, _ = get_gap_config(db, tenant_id)
    pools = db.scalars(
        select(TalentPool).where(
            TalentPool.tenant_id == tenant_id,
            TalentPool.status == PoolStatus.ACTIVE,
        )
    ).all()
    grade_level = build_grade_level_map(db, tenant_id)
    factor_map = {"L1": factors.l1, "L2": factors.l2, "L3": factors.l3}
    pool_map: dict[str, float] = {}
    for p in pools:
        emp = db.get(Employee, p.employee_id)
        if emp is None or not emp.is_active:
            continue
        lvl = grade_level.get(emp.grade)
        if lvl is not None:
            key = f"{emp.sequence}:{lvl}"
            pool_map[key] = pool_map.get(key, 0) + factor_map.get(p.pool_level.value, 0.2)

    items: list[ImbalanceItem] = []
    all_keys = set(active_map.keys()) | set(
        f"{s['sequence']}:{s['level_order']}" for s in standards
    ) | set(pool_map.keys())

    LEVEL_NAMES = ["基础层", "经验层", "骨干层", "精英层", "事业单位经营层", "集团经营层"]

    for key in sorted(all_keys):
        seq, lvl_str = key.split(":")
        lvl = int(lvl_str)
        demand = next(
            (s["headcount"] for s in standards if s["sequence"] == seq and s["level_order"] == lvl),
            0,
        )
        supply = active_map.get(key, 0) + pool_map.get(key, 0)
        gap = supply - demand

        if gap < -0.5:
            items.append(ImbalanceItem(
                sequence=seq,
                level_order=lvl,
                level_name=LEVEL_NAMES[lvl - 1] if lvl <= 6 else f"L{lvl}",
                type="shortage",
                type_label="缺口",
                detail=f"{seq}·{LEVEL_NAMES[lvl - 1] if lvl <= 6 else f'L{lvl}'}：需求 {demand}，供给 {supply:.1f}，缺 {abs(gap):.1f} 人",
            ))
        elif gap > 0.5:
            items.append(ImbalanceItem(
                sequence=seq,
                level_order=lvl,
                level_name=LEVEL_NAMES[lvl - 1] if lvl <= 6 else f"L{lvl}",
                type="surplus",
                type_label="冗余",
                detail=f"{seq}·{LEVEL_NAMES[lvl - 1] if lvl <= 6 else f'L{lvl}'}：需求 {demand}，供给 {supply:.1f}，余 {gap:.1f} 人",
            ))

    return items


# ---------------------------------------------------------------------------
# 10. AI 结构优化建议
# ---------------------------------------------------------------------------


@router.post("/org/optimize-advice", response_model=OptimizeAdviceOut)
def org_optimize_advice(
    body: OptimizeAdviceIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """AI 生成结构优化建议（LLM 调用）。"""
    from app.services.ai import _ai_settings, _tenant_config
    from app.services.llm import get_client
    from app.config import settings

    # 收集数据摘要
    density = org_density(db=db, user=user)
    imbalance = org_imbalance(db=db, user=user)
    classification = org_classification_summary(db=db, user=user)

    context = (
        f"总人数 {density.total}，核心人才 {density.core_count}（{density.core_ratio * 100}%），"
        f"形状 {density.shape_label}（中坚占比 {density.mid_ratio * 100}%）。"
        f"四分类：核心 {classification.core} / 胜任 {classification.competent} / "
        f"可转型 {classification.transformable} / 待优化 {classification.optimize} / "
        f"未分类 {classification.unclassified}。"
        f"序列分布：{density.sequence_dist}。"
        f"层级分布：{density.level_dist}。"
    )
    if imbalance:
        shortage = [i for i in imbalance if i.type == "shortage"]
        surplus = [i for i in imbalance if i.type == "surplus"]
        if shortage:
            context += f"缺口 {len(shortage)} 项：" + "；".join(s.detail for s in shortage[:3]) + "。"
        if surplus:
            context += f"冗余 {len(surplus)} 项：" + "；".join(s.detail for s in surplus[:3]) + "。"

    if body.focus:
        context += f"管理者关注点：{body.focus}"

    prompt = (
        "你是一位资深 HR 顾问。请根据以下人才结构数据，给出简洁、可执行的结构优化建议。"
        "建议按「保留激励核心」「培养转化可转型」「优化待优化」「引进缺口」四个维度组织。"
        "用中文回答，控制在 200 字以内。\n\n"
        f"数据摘要：{context}"
    )

    config = _tenant_config(db, user.tenant_id)
    ai = _ai_settings(config)
    if not ai["api_key"]:
        return OptimizeAdviceOut(
            advice=(
                "基于当前数据：1）保留激励核心人才，防止流失；"
                "2）对可转型员工制定 6 个月培养计划，重点关注能力提升；"
                "3）待优化员工启动 PIP 或调岗评估；"
                "4）针对缺口层级优先招聘，同时内部选拔培养。"
            ),
            source="rule_based",
            generated_at=datetime.now(timezone.utc).isoformat(),
        )

    messages = [
        {"role": "system", "content": "你是一位资深 HR 顾问，擅长人才结构分析与优化建议。"},
        {"role": "user", "content": prompt},
    ]
    client = get_client(
        base_url=ai["base_url"], api_key=ai["api_key"], model=ai["model"]
    )

    last_error = ""
    for _ in range(max(1, settings.ai_max_attempts)):
        try:
            result = client.chat(messages)
            advice = result.content.strip()
            if advice:
                return OptimizeAdviceOut(
                    advice=advice,
                    source="ai_generated",
                    generated_at=datetime.now(timezone.utc).isoformat(),
                )
        except Exception as exc:
            last_error = f"{type(exc).__name__}: {exc}"
            continue

    # 全部重试失败，回落到规则建议
    return OptimizeAdviceOut(
        advice=(
            "基于当前数据：1）保留激励核心人才，防止流失；"
            "2）对可转型员工制定 6 个月培养计划，重点关注能力提升；"
            "3）待优化员工启动 PIP 或调岗评估；"
            "4）针对缺口层级优先招聘，同时内部选拔培养。"
            f"（AI 生成失败：{last_error}）"
        ),
        source="rule_based",
        generated_at=datetime.now(timezone.utc).isoformat(),
    )
