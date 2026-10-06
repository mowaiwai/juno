"""液态项目快速组队：统一经匹配引擎算候选（PRD 模块四 FR-8）。

旧 /org/project-team 与新 /match/project-team 共用本服务，保证口径一致。
"""

import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import Principal
from app.models.employee import Employee
from app.models.succession import CorePosition, SuccessionCandidate
from app.services.match import (
    MATCH_DIMENSION_SET,
    normalize_dimension_key,
    score_match,
    to_score,
)
from app.services.match_config import get_match_config
from app.services.match_data import employees_match_actual
from app.services.scope import apply_employee_scope


@dataclass(frozen=True)
class TeamCandidate:
    employee_id: uuid.UUID
    name: str
    position: str | None
    match_score: float
    willingness: str
    readiness: str
    reason: str
    missing_dims: list[str]


def willingness_by_employee(db: Session, tenant_id: uuid.UUID) -> dict:
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


def _needs_to_required(needs: list) -> tuple[dict, tuple[str, ...]]:
    """项目能力需求 → 引擎要求分。

    需求项 {"ability": 标签或 key, "level": 0-100 分值}；
    level 与画像分同量纲（见 seed_data 60/75/80），直接作为要求分。
    """
    required: dict[str, float] = {}
    for need in needs:
        if not isinstance(need, dict):
            continue
        key = normalize_dimension_key(need.get("ability", ""))
        level = to_score(need.get("level"))
        if key in MATCH_DIMENSION_SET and level:
            required[key] = level
    return required, tuple(required)


def build_team_candidates(
    db: Session, principal: Principal, needs: list
) -> list[TeamCandidate]:
    """按项目需求对数据范围内员工算匹配分；无任何可算维者不出现在候选中。"""
    tenant_id = principal.user.tenant_id
    required, dim_order = _needs_to_required(needs)
    if not required:
        return []

    stmt = select(Employee).where(
        Employee.tenant_id == tenant_id,
        Employee.is_active.is_(True),
    )
    stmt = apply_employee_scope(stmt, db, principal)
    emps = db.scalars(stmt).all()
    cfg = get_match_config(db, tenant_id)
    will = willingness_by_employee(db, tenant_id)
    actuals = employees_match_actual(db, list(emps))

    candidates: list[TeamCandidate] = []
    for emp in emps:
        actual = actuals.get(emp.id) or {}
        result = score_match(
            actual,
            required=required,
            weights=cfg.weights,
            good=cfg.good,
            warn=cfg.warn,
            dimensions=dim_order,
        )
        if result.score is None:
            continue
        # ready 档跟随租户 good 阈值，避免与 level 口径自相矛盾（Minor-1）；
        # developing 下限 50 为独立于配置的旧口径档位，兼容既有三档展示
        readiness = (
            "ready" if result.score >= cfg.good
            else ("developing" if result.score >= 50 else "gap")
        )
        candidates.append(
            TeamCandidate(
                employee_id=emp.id,
                name=emp.name,
                position=emp.position,
                match_score=result.score,
                willingness=will.get(emp.id, "unconfirmed"),
                readiness=readiness,
                reason=result.reason,
                missing_dims=list(result.missing_dims),
            )
        )
    candidates.sort(key=lambda c: c.match_score, reverse=True)
    return candidates
