"""统一人岗匹配度端点（PRD 模块四 P3）。

端点只做取数、鉴权与编排；所有算分逻辑在 services.match 纯内核。
权限点复用 gap.manage（差距分析/组织诊断运行查看），不新增权限点。
"""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import Principal, err, get_principal
from app.database import get_db
from app.models.employee import Employee
from app.models.gap import Gap
from app.models.org_diagnosis import LiquidProject
from app.models.standard import StandardSet, StandardStatus
from app.schemas.match import (
    HeatmapIn,
    HeatmapDimOut,
    HeatmapRowOut,
    MatchConfigIn,
    MatchConfigOut,
    RecommendIn,
    RecommendItemOut,
    RecommendOut,
)
from app.schemas.org_diagnosis import ProjectTeamIn, TeamCandidateOut
from app.services.audit import audit_as
from app.services.match_config import get_match_config, upsert_match_config
from app.services.match_data import (
    employee_match_actual,
    employees_match_actual,
)
from app.services.match_team import build_team_candidates
from app.services.scope import apply_employee_scope, can_access_employee

router = APIRouter(tags=["match"])


@router.get("/match/config", response_model=MatchConfigOut)
def get_config(
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    """读取本租户匹配配置（权重/要求/阈值）；未配置返回平台默认。"""
    if not principal.can("gap.manage"):
        raise err(403, "forbidden", "当前角色无权查看匹配配置")
    cfg = get_match_config(db, principal.user.tenant_id)
    return MatchConfigOut(
        weights=cfg.weights,
        required=cfg.required,
        good_threshold=cfg.good,
        warn_threshold=cfg.warn,
        is_default=cfg.is_default,
    )


@router.put("/match/config", response_model=MatchConfigOut)
def update_config(
    body: MatchConfigIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    """整体替换本租户匹配配置（五维全量），写审计日志。"""
    if not principal.can("gap.manage"):
        raise err(403, "forbidden", "当前角色无权修改匹配配置")
    user = principal.user
    before = get_match_config(db, user.tenant_id)
    cfg = upsert_match_config(
        db,
        user.tenant_id,
        weights=body.weights,
        required=body.required,
        good=body.good_threshold,
        warn=body.warn_threshold,
        updated_by=user.id,
    )
    # 审计记 before/after 全量快照（含 required），可回溯旧配置（Minor-10）
    audit_as(
        db,
        user,
        "match_config_updated",
        "match_tenant_config",
        None,
        {
            "weights": before.weights,
            "required": before.required,
            "good_threshold": before.good,
            "warn_threshold": before.warn,
            "is_default": before.is_default,
        },
        {
            "weights": cfg.weights,
            "required": cfg.required,
            "good_threshold": cfg.good,
            "warn_threshold": cfg.warn,
        },
    )
    db.commit()
    return MatchConfigOut(
        weights=cfg.weights,
        required=cfg.required,
        good_threshold=cfg.good,
        warn_threshold=cfg.warn,
        is_default=False,
    )


@router.post("/match/heatmap", response_model=list[HeatmapRowOut])
def heatmap(
    body: HeatmapIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    """差距热力图：范围内在职员工逐人五维匹配分与等级。"""
    if not principal.can("gap.manage"):
        raise err(403, "forbidden", "当前角色无权查看匹配热力图")
    user = principal.user

    stmt = select(Employee).where(
        Employee.tenant_id == user.tenant_id,
        Employee.is_active.is_(True),
    )
    if body.dept_id:
        stmt = stmt.where(Employee.dept_id == body.dept_id)
    else:
        # batch 分支（FR-6 批次口径）：仅覆盖该批次产生过 Gap 行的员工；
        # 本期不建批次成员名册，全达标无 Gap 行的员工不进入批次视图
        batch_emps = (
            select(Gap.employee_id)
            .where(
                Gap.tenant_id == user.tenant_id,
                Gap.batch_id == body.batch_id,
            )
            .distinct()
        )
        stmt = stmt.where(Employee.id.in_(batch_emps))
    stmt = apply_employee_scope(stmt, db, principal)
    employees = db.scalars(stmt).all()

    cfg = get_match_config(db, user.tenant_id)
    actuals = employees_match_actual(db, list(employees))
    rows: list[HeatmapRowOut] = []
    for emp in employees:
        result = cfg.score(actuals.get(emp.id) or {})
        rows.append(
            HeatmapRowOut(
                employee_id=emp.id,
                name=emp.name,
                position=emp.position,
                score=result.score,
                level=result.level,
                reason=result.reason,
                missing_dims=result.missing_dims,
                dims=[
                    HeatmapDimOut(
                        key=d.key,
                        actual=d.actual,
                        required=d.required,
                        ratio=d.ratio,
                        is_gap=d.is_gap,
                    )
                    for d in result.dims
                ],
            )
        )
    return rows


def _published_positions(
    db: Session, tenant_id: uuid.UUID
) -> list[StandardSet]:
    """已发布岗位标准：同 sequence+target_grade 只取最新版本。"""
    sets = db.scalars(
        select(StandardSet)
        .where(
            StandardSet.tenant_id == tenant_id,
            StandardSet.status == StandardStatus.PUBLISHED,
        )
        # version 并列时按发布时间、再按 id 确定性取舍（先到先得，Minor-2）
        .order_by(
            StandardSet.version.desc(),
            StandardSet.published_at.desc(),
            StandardSet.id.desc(),
        )
    ).all()
    latest: dict[tuple[str, str], StandardSet] = {}
    for s in sets:
        key = (s.sequence, s.target_grade)
        if key not in latest:
            latest[key] = s
    return list(latest.values())


@router.post("/match/recommend", response_model=RecommendOut)
def recommend(
    body: RecommendIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    """双向推荐：employee_id → TOP 岗位；岗位定位 → TOP 在职员工。"""
    user = principal.user
    if body.employee_id is not None:
        return _recommend_positions(body, db, principal)

    if not principal.can("gap.manage"):
        raise err(403, "forbidden", "当前角色无权执行一岗多人推荐")

    # 解析目标岗位
    if body.standard_set_id is not None:
        target = db.get(StandardSet, body.standard_set_id)
        if (
            target is None
            or target.tenant_id != user.tenant_id
            or target.status != StandardStatus.PUBLISHED
        ):
            raise err(404, "standard_set_not_found", "岗位标准不存在或未发布")
    else:
        target = next(
            (
                s
                for s in _published_positions(db, user.tenant_id)
                if s.sequence == body.sequence
                and s.target_grade == body.target_grade
            ),
            None,
        )
        if target is None:
            raise err(404, "standard_set_not_found", "岗位标准不存在或未发布")

    stmt = select(Employee).where(
        Employee.tenant_id == user.tenant_id,
        Employee.is_active.is_(True),
    )
    stmt = apply_employee_scope(stmt, db, principal)
    cfg = get_match_config(db, user.tenant_id)

    scoped_employees = db.scalars(stmt).all()
    actuals = employees_match_actual(db, list(scoped_employees))
    scored: list[tuple] = []
    for emp in scoped_employees:
        result = cfg.score(actuals.get(emp.id) or {})
        scored.append((result, emp))
    # 有分降序、数据不足置底；同序按姓名稳定排序
    scored.sort(
        key=lambda t: (
            t[0].score is None,
            -(t[0].score or 0),
            t[1].name or "",
        )
    )
    items = [
        RecommendItemOut(
            employee_id=emp.id,
            name=emp.name,
            position=emp.position,
            score=result.score,
            level=result.level,
            missing_dims=result.missing_dims,
        )
        for result, emp in scored[: body.limit]
    ]
    return RecommendOut(direction="employees", items=items)


def _recommend_positions(
    body: RecommendIn,
    db: Session,
    principal: Principal,
) -> RecommendOut:
    """一人多岗：员工可查本人；HR 按数据范围查他人。"""
    user = principal.user
    emp = db.get(Employee, body.employee_id)
    if emp is None or emp.tenant_id != user.tenant_id or not emp.is_active:
        raise err(404, "employee_not_found", "员工不存在")

    if principal.can("gap.manage"):
        if not can_access_employee(db, principal, emp):
            raise err(404, "employee_not_found", "员工不存在")
    else:
        own_id = db.scalar(
            select(Employee.id).where(
                Employee.user_id == user.id,
                Employee.tenant_id == user.tenant_id,
            )
        )
        if own_id != emp.id:
            raise err(404, "employee_not_found", "员工不存在")

    cfg = get_match_config(db, user.tenant_id)
    result = cfg.score(employee_match_actual(db, emp) or {})
    positions = _published_positions(db, user.tenant_id)
    # 本期岗位要求基准全租户统一，分差仅在员工本身；按序列/职级稳定排序。
    # 同分时 TOP N 截断的是字典序靠后岗位而非最不匹配岗位，待序列级要求分
    # 落地后恢复按分排序（评审 Question-1）；target_grade 为字典序，
    # "P10" < "P2"，职级序数列下期（评审 Question-5）
    positions.sort(key=lambda s: (s.sequence, s.target_grade))
    items = [
        RecommendItemOut(
            set_id=s.id,
            sequence=s.sequence,
            target_grade=s.target_grade,
            score=result.score,
            level=result.level,
            missing_dims=result.missing_dims,
        )
        for s in positions[: body.limit]
    ]
    return RecommendOut(direction="positions", items=items)


@router.post("/match/project-team", response_model=list[TeamCandidateOut])
def project_team(
    body: ProjectTeamIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    """液态项目快速组队：统一匹配引擎口径（FR-8）。

    与旧 /org/project-team 同入参同响应，仅算分收敛到引擎。
    """
    project = db.get(LiquidProject, body.project_id)
    if project is None or project.tenant_id != principal.user.tenant_id:
        raise err(404, "project_not_found", "液态项目不存在")
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
