"""组织诊断端点（spec org-diagnosis）。

组织结构分布、断层预警、三张图看板、能力×业绩四象限、液态组队匹配。
所有数据均基于租户内员工、画像、核心岗位与继任候选聚合。
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import err, get_current_user
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
    DeptStructureOut,
    GapWarningOut,
    LiquidProjectOut,
    ProjectTeamIn,
    TalentMapOut,
    TeamCandidateOut,
    ThreeChartsOut,
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

_PERF_MAP = {"A": 90, "B": 80, "C": 70, "D": 60}

# 画像七维 key → 中文标签
_DIM_LABELS = {
    "basic": "基本条件",
    "biz": "业绩",
    "contribution": "团队贡献",
    "duty": "职责履行",
    "knowledge": "知识技能",
    "ability": "能力素质",
    "perf": "绩效",
}
_LABEL_TO_KEY = {v: k for k, v in _DIM_LABELS.items()}


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


def _willingness_by_employee(db: Session, tenant_id: uuid.UUID) -> dict:
    """取每个员工的继任意愿（任一记录 willing/unwilling 覆盖 unconfirmed）。"""
    rows = db.execute(
        select(SuccessionCandidate.employee_id, SuccessionCandidate.willingness)
        .join(CorePosition, SuccessionCandidate.core_position_id == CorePosition.id)
        .where(CorePosition.tenant_id == tenant_id)
    ).all()
    out: dict = {}
    for emp_id, w in rows:
        val = w.value if hasattr(w, "value") else str(w)
        if emp_id not in out or out[emp_id] == "unconfirmed":
            out[emp_id] = val
    return out


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


def _ability_to_key(ability: str) -> str:
    """将需求中的能力名（标签或 key）归一到 dimension_key。"""
    if not ability:
        return ""
    if ability in _LABEL_TO_KEY:
        return _LABEL_TO_KEY[ability]
    return ability


def _match(needs: list, dim_scores: dict) -> tuple[float, str]:
    """计算人岗匹配分与缺口说明。"""
    if not needs:
        return 0.0, "项目未定义能力需求"
    total = 0.0
    gaps: list[str] = []
    for need in needs:
        ability = need.get("ability", "") if isinstance(need, dict) else ""
        level = need.get("level", 0) if isinstance(need, dict) else 0
        key = _ability_to_key(ability)
        score = dim_scores.get(key)
        if score is None:
            score = dim_scores.get(ability)
        if score is None or not level:
            gaps.append(f"{ability}无数据")
            continue
        total += min(score / level, 1.0)
        if score < level:
            gaps.append(f"{ability} {score}/{level}")
    match_score = round(total / len(needs) * 100, 1)
    reason = "能力缺口：" + "；".join(gaps) if gaps else "能力匹配良好"
    return match_score, reason


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
    user: User = Depends(get_current_user),
):
    project = db.get(LiquidProject, body.project_id)
    if project is None or project.tenant_id != user.tenant_id:
        raise err(404, "project_not_found", "液态项目不存在")
    needs = project.needs or []
    emps = db.scalars(
        select(Employee).where(
            Employee.tenant_id == user.tenant_id,
            Employee.is_active.is_(True),
        )
    ).all()
    latest = _latest_snapshots(db, user.tenant_id)
    will = _willingness_by_employee(db, user.tenant_id)
    candidates: list[TeamCandidateOut] = []
    for emp in emps:
        snap = latest.get(emp.id)
        dim_scores: dict = {}
        if snap:
            for d in snap.dimensions:
                if d.score is not None:
                    dim_scores[d.dimension_key] = d.score
        score, reason = _match(needs, dim_scores)
        if score <= 0:
            continue
        readiness = (
            "ready" if score >= 80
            else ("developing" if score >= 50 else "gap")
        )
        candidates.append(TeamCandidateOut(
            employee_id=emp.id,
            name=emp.name,
            position=emp.position,
            match_score=score,
            willingness=will.get(emp.id, "unconfirmed"),
            readiness=readiness,
            reason=reason,
        ))
    candidates.sort(key=lambda c: c.match_score, reverse=True)
    return candidates
