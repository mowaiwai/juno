"""人岗匹配 / 差距分析端点（Module C）。

- 分析：基于画像七维 + 绩效等级识别员工-岗位差距，写出维度/严重度/动作/优先级
- 清单 / 看板：按部门、维度过滤与团队聚合
- 动作建议：根据差距类型给出改进动作文案
"""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.deps import err, get_current_user, require_roles
from app.database import get_db
from app.models.employee import Employee
from app.models.gap import Gap, GapAction, GapDimension, GapSeverity
from app.models.profile import ProfileSnapshot
from app.models.user import Role, User
from app.schemas.gap import (
    GapActionIn,
    GapActionOut,
    GapAnalyzeIn,
    GapOut,
    TeamGapOut,
)
from app.services.audit import audit_as

router = APIRouter(tags=["gap"])

# 绩效等级 → 数值（A=90 / B=80 / C=70 / D=60）
_PERF_SCORE = {"A": 90, "B": 80, "C": 70, "D": 60}

# 维度阈值：dimension_key → (threshold, gap_dimension, gap_action, priority, label)
_THRESHOLDS = {
    "duty": (75, GapDimension.DUTY, GapAction.PROCESS_SUPERVISION, 2, "职责履行"),
    "ability": (72, GapDimension.ABILITY, GapAction.BEHAVIOR_IMPROVE, 3, "能力素质"),
    "contribution": (
        65,
        GapDimension.CONTRIBUTION,
        GapAction.TEAM_CONTRIBUTION,
        2,
        "团队贡献",
    ),
    "knowledge": (
        70,
        GapDimension.KNOWLEDGE,
        GapAction.LEARN_KNOWLEDGE,
        3,
        "知识技能",
    ),
}

# 改进动作建议文案
_SUGGESTIONS = {
    GapAction.PERF_IMPROVEMENT: "制定绩效改进计划，与上级对齐目标，按月复盘关键节点。",
    GapAction.PROCESS_SUPERVISION: "加强职责履行与流程监督，定期检查履职情况并辅导改进。",
    GapAction.BEHAVIOR_IMPROVE: "针对能力短板制定行为改善计划，通过训练、轮岗与导师辅导提升。",
    GapAction.TEAM_CONTRIBUTION: "增加团队协作与贡献，参与跨部门项目或承担带教任务。",
    GapAction.LEARN_KNOWLEDGE: "补充知识技能短板，制定学习计划并考取相关认证。",
}


def _severity_for(score: int, threshold: int) -> GapSeverity:
    if score < threshold - 15:
        return GapSeverity.HIGH
    if score < threshold - 5:
        return GapSeverity.MID
    return GapSeverity.LOW


def _latest_snapshot(
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


@router.post("/gaps/analyze", response_model=list[GapOut])
def analyze_gaps(
    body: GapAnalyzeIn,
    db: Session = Depends(get_db),
    user: User = Depends(
        require_roles(Role.HR, Role.MANAGER, Role.TENANT_ADMIN)
    ),
):
    """差距分析：基于画像七维 + 绩效等级识别员工-岗位差距。

    每次分析会先清理这些员工的历史差距记录，再写入新结果。
    """
    emp_stmt = select(Employee).where(
        Employee.tenant_id == user.tenant_id,
        Employee.is_active.is_(True),
    )
    if body.dept_id:
        emp_stmt = emp_stmt.where(Employee.dept_id == body.dept_id)
    employees = db.scalars(emp_stmt).all()
    if not employees:
        return []

    emp_ids = [e.id for e in employees]

    # 清理这些员工的历史差距记录（每次分析覆盖历史）
    db.execute(
        delete(Gap).where(
            Gap.tenant_id == user.tenant_id,
            Gap.employee_id.in_(emp_ids),
        )
    )

    new_gaps: list[Gap] = []
    for emp in employees:
        snapshot = _latest_snapshot(db, emp.id, user.tenant_id)
        dim_scores: dict[str, int | None] = {}
        if snapshot:
            for d in snapshot.dimensions:
                dim_scores[d.dimension_key] = d.score

        # 绩效差距：perf_grade < B（数值 < 80）
        perf_grade = (emp.perf_grade or "").upper()
        perf_score = _PERF_SCORE.get(perf_grade)
        if perf_score is not None and perf_score < 80:
            new_gaps.append(
                Gap(
                    tenant_id=user.tenant_id,
                    employee_id=emp.id,
                    dimension=GapDimension.PERF,
                    detail="绩效等级低于 B 级",
                    standard="≥ B 级 (80 分)",
                    current=f"{perf_grade} 级 ({perf_score} 分)",
                    severity=_severity_for(perf_score, 80),
                    action=GapAction.PERF_IMPROVEMENT,
                    priority=1,
                    batch_id=body.batch_id,
                )
            )

        # 维度差距
        for key, (
            threshold,
            dim,
            action,
            priority,
            label,
        ) in _THRESHOLDS.items():
            score = dim_scores.get(key)
            if score is None:
                continue
            if score < threshold:
                new_gaps.append(
                    Gap(
                        tenant_id=user.tenant_id,
                        employee_id=emp.id,
                        dimension=dim,
                        detail=f"{label}维度得分低于阈值",
                        standard=f"≥ {threshold} 分",
                        current=f"{score} 分",
                        severity=_severity_for(score, threshold),
                        action=action,
                        priority=priority,
                        batch_id=body.batch_id,
                    )
                )

    for g in new_gaps:
        db.add(g)

    audit_as(
        db,
        user,
        "gaps_analyzed",
        "gap",
        None,
        None,
        {"employee_count": len(employees)},
    )
    db.commit()
    for g in new_gaps:
        db.refresh(g)
    return [GapOut.model_validate(g) for g in new_gaps]


@router.get("/gaps", response_model=list[GapOut])
def list_gaps(
    dept_id: str | None = None,
    dimension: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """差距清单：可按部门 / 维度过滤。"""
    dim_filter: GapDimension | None = None
    if dimension:
        try:
            dim_filter = GapDimension(dimension)
        except ValueError:
            raise err(400, "invalid_dimension", "维度参数无效")

    stmt = select(Gap).where(Gap.tenant_id == user.tenant_id)
    if dept_id:
        stmt = stmt.join(Employee, Gap.employee_id == Employee.id).where(
            Employee.dept_id == dept_id
        )
    if dim_filter is not None:
        stmt = stmt.where(Gap.dimension == dim_filter)
    stmt = stmt.order_by(Gap.priority.asc(), Gap.created_at.desc())
    return [GapOut.model_validate(g) for g in db.scalars(stmt).all()]


@router.get("/gaps/mine", response_model=list[GapOut])
def list_my_gaps(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """我的差距：返回当前用户员工档案关联的差距记录。"""
    employee = db.scalar(
        select(Employee).where(Employee.user_id == user.id)
    )
    if employee is None:
        return []
    rows = db.scalars(
        select(Gap)
        .where(
            Gap.tenant_id == user.tenant_id,
            Gap.employee_id == employee.id,
        )
        .order_by(Gap.priority.asc(), Gap.created_at.desc())
    ).all()
    return [GapOut.model_validate(g) for g in rows]


@router.get("/gaps/team", response_model=list[TeamGapOut])
def team_gaps(
    dept_id: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """团队差距看板：按员工聚合差距。"""
    emp_stmt = select(Employee).where(
        Employee.tenant_id == user.tenant_id,
        Employee.is_active.is_(True),
    )
    if dept_id:
        emp_stmt = emp_stmt.where(Employee.dept_id == dept_id)
    employees = db.scalars(emp_stmt).all()
    if not employees:
        return []

    emp_ids = [e.id for e in employees]
    gaps = db.scalars(
        select(Gap)
        .where(
            Gap.tenant_id == user.tenant_id,
            Gap.employee_id.in_(emp_ids),
        )
        .order_by(Gap.priority.asc(), Gap.created_at.desc())
    ).all()

    by_emp: dict[uuid.UUID, list[Gap]] = {}
    for g in gaps:
        by_emp.setdefault(g.employee_id, []).append(g)

    rows: list[TeamGapOut] = []
    for emp in employees:
        emp_gaps = by_emp.get(emp.id, [])
        # 去重动作但保留按优先级的出现顺序
        seen: set[str] = set()
        ordered_actions: list[str] = []
        for g in emp_gaps:
            action_val = (
                g.action.value if isinstance(g.action, GapAction) else g.action
            )
            if action_val not in seen:
                seen.add(action_val)
                ordered_actions.append(action_val)
        high_count = sum(
            1 for g in emp_gaps if g.severity == GapSeverity.HIGH
        )
        rows.append(
            TeamGapOut(
                employee_id=emp.id,
                name=emp.name,
                position=emp.position,
                dept_name=emp.dept_id,
                gap_count=len(emp_gaps),
                high_count=high_count,
                actions=ordered_actions,
                gaps=[GapOut.model_validate(g) for g in emp_gaps],
            )
        )
    return rows


@router.post("/gaps/action", response_model=list[GapActionOut])
def generate_actions(
    body: GapActionIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """根据差距生成改进动作建议。"""
    if not body.gap_ids:
        return []

    gaps = db.scalars(
        select(Gap).where(
            Gap.tenant_id == user.tenant_id,
            Gap.id.in_(body.gap_ids),
        )
    ).all()
    found_ids = {g.id for g in gaps}
    missing = set(body.gap_ids) - found_ids
    if missing:
        raise err(404, "gap_not_found", f"差距记录不存在: {missing}")

    rows: list[GapActionOut] = []
    for g in gaps:
        action = g.action if isinstance(g.action, GapAction) else GapAction(g.action)
        rows.append(
            GapActionOut(
                gap_id=g.id,
                employee_id=g.employee_id,
                action=action.value,
                priority=g.priority,
                suggestion=_SUGGESTIONS.get(action, ""),
            )
        )
    rows.sort(key=lambda r: r.priority)
    return rows
