"""绩效结果录入服务：两段式权限、SABC 校验、系数计算。"""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import Principal
from app.models.employee import Employee
from app.models.perf import PerfPlan, PerfPlanStatus, PerfResult
from app.services.audit import audit_as
from app.services.perf_rules import (
    PERF_GRADES,
    coefficient_for,
    grade_for_score,
    resolve_constants,
)
from app.services.scope import can_access_employee

class ResultError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def _roster_employee(
    db: Session, plan: PerfPlan, employee_id: uuid.UUID
) -> Employee:
    if employee_id not in set(plan.roster):
        raise ResultError(404, "not_in_roster", "员工不在该方案名册内")
    emp = db.get(Employee, employee_id)
    if emp is None or emp.tenant_id != plan.tenant_id:
        raise ResultError(404, "not_in_roster", "员工不在该方案名册内")
    return emp


def _check_write_principal(
    db: Session, principal: Principal, plan: PerfPlan, emp: Employee
) -> None:
    is_coe = principal.can("perf.plan.manage")
    status = plan.status

    if status == PerfPlanStatus.DRAFT.value:
        raise ResultError(409, "plan_not_open", "草稿方案未开始评定")
    if status == PerfPlanStatus.PUBLISHED.value:
        raise ResultError(409, "plan_published", "方案已发布，结果锁定")

    if status == PerfPlanStatus.CALIBRATING.value:
        if not is_coe:
            raise ResultError(409, "entry_locked", "校准阶段仅 COE 可录入")
        return

    # evaluating
    if is_coe:
        return
    if not principal.can("perf.result.entry"):
        raise ResultError(403, "forbidden", "当前角色无权录入绩效结果")
    if not can_access_employee(db, principal, emp):
        # 数据范围外统一 404 口径
        raise ResultError(404, "not_in_roster", "员工不在该方案名册内")


def compute_valid_coefficient(
    constants: dict,
    grade: str,
    score: float | None = None,
    evidence: list[str] | None = None,
    require_evidence: bool = True,
) -> tuple[float, list[str]]:
    """SABC 单条校验，返回 (系数, 清洗后举证)。导入时 require_evidence=False。"""
    if grade not in PERF_GRADES:
        raise ResultError(422, "invalid_grade", "绩效等级必须为 S/A/B/C/D")
    cleaned_evidence = [
        e.strip() for e in (evidence or []) if e and e.strip()
    ]
    if require_evidence and grade in ("S", "A") and not cleaned_evidence:
        raise ResultError(422, "evidence_required", "S/A 等级必须填写举证")
    if grade == "C" and score is None:
        raise ResultError(422, "score_required_for_c", "C 档必须提供分数")
    if score is not None:
        expected = grade_for_score(constants, score)
        if expected != grade:
            raise ResultError(
                422,
                "score_grade_mismatch",
                f"分数 {score} 按生效分数线应落 {expected} 档，与 {grade} 矛盾",
            )
    try:
        coefficient = coefficient_for(constants, grade, score)
    except ValueError as exc:
        raise ResultError(422, "invalid_grade", str(exc))
    return coefficient, cleaned_evidence


def _validate(constants: dict, grade: str, score: float | None,
              evidence: list[str]) -> float:
    coefficient, _ = compute_valid_coefficient(
        constants, grade, score, evidence, require_evidence=True
    )
    return coefficient


def upsert_result(
    db: Session,
    principal: Principal,
    plan: PerfPlan,
    employee_id: uuid.UUID,
    grade: str,
    score: float | None,
    evidence: list[str],
) -> PerfResult:
    emp = _roster_employee(db, plan, employee_id)
    _check_write_principal(db, principal, plan, emp)
    constants = resolve_constants(db, plan.tenant_id)
    coefficient = _validate(constants, grade, score, evidence)

    result = db.scalar(
        select(PerfResult).where(
            PerfResult.plan_id == plan.id,
            PerfResult.employee_id == employee_id,
        )
    )
    before = None
    if result is None:
        result = PerfResult(
            tenant_id=plan.tenant_id,
            plan_id=plan.id,
            employee_id=employee_id,
            grade=grade,
            score=score,
            coefficient=coefficient,
            org_coefficient=1.0,
            evidence=[e.strip() for e in evidence if e and e.strip()],
            entered_by=principal.user.id,
        )
        db.add(result)
    else:
        before = {
            "grade": result.grade,
            "score": result.score,
            "coefficient": result.coefficient,
        }
        result.grade = grade
        result.score = score
        result.coefficient = coefficient
        result.evidence = [e.strip() for e in evidence if e and e.strip()]
        result.entered_by = principal.user.id
    db.flush()
    audit_as(
        db, principal.user,
        "perf_result_entered", "perf_result", result.id,
        before=before,
        after={"plan_id": str(plan.id), "employee_id": str(employee_id),
               "grade": grade, "score": score, "coefficient": coefficient},
    )
    return result


def import_draft_results(
    db: Session,
    principal: Principal,
    plan: PerfPlan,
    items: list,
) -> tuple[int, list[tuple[str, str]]]:
    """批量导入结果到【草稿】方案：逐行回执，合法行落方案、绝不动 perf_grade。

    导入不要求举证（S/A 举证由 COE 在校准前补齐，发布仍会拦截）。
    """
    if plan.status != PerfPlanStatus.DRAFT.value:
        raise ResultError(409, "plan_not_draft", "仅草稿方案可导入结果")

    constants = resolve_constants(db, plan.tenant_id)
    roster = set(plan.roster)
    employees = db.scalars(
        select(Employee).where(Employee.tenant_id == plan.tenant_id)
    ).all()
    by_no = {
        e.employee_no: e
        for e in employees
        if e.id in roster and can_access_employee(db, principal, e)
    }
    existing = {
        r.employee_id: r
        for r in db.scalars(
            select(PerfResult).where(PerfResult.plan_id == plan.id)
        ).all()
    }

    imported = 0
    errors: list[tuple[str, str]] = []
    seen: set[str] = set()
    for item in items:
        no = (item.employee_no or "").strip()
        if not no:
            errors.append((no, "工号为空"))
            continue
        if no in seen:
            errors.append((no, "工号重复"))
            continue
        seen.add(no)
        emp = by_no.get(no)
        if emp is None:
            errors.append((no, "工号不存在或不在方案名册内"))
            continue
        try:
            coefficient, _evidence = compute_valid_coefficient(
                constants, item.grade, item.score,
                evidence=None, require_evidence=False,
            )
        except ResultError as exc:
            errors.append((no, exc.message))
            continue

        result = existing.get(emp.id)
        if result is None:
            result = PerfResult(
                tenant_id=plan.tenant_id,
                plan_id=plan.id,
                employee_id=emp.id,
                grade=item.grade,
                score=item.score,
                coefficient=coefficient,
                org_coefficient=1.0,
                evidence=[],
                entered_by=principal.user.id,
            )
            db.add(result)
        else:
            result.grade = item.grade
            result.score = item.score
            result.coefficient = coefficient
            result.entered_by = principal.user.id
        imported += 1

    db.flush()
    audit_as(
        db, principal.user,
        "perf_results_imported", "perf_plan", plan.id,
        after={"imported": imported, "failed": len(errors)},
    )
    return imported, errors
