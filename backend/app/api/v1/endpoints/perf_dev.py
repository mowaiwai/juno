"""PIP / 辅导记录 / 我的绩效端点（P1 绩效内生，AC-8/9/10）。"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import Principal, err, get_principal, require_perm
from app.database import get_db
from app.models.employee import Employee
from app.models.perf import CoachingRecord, Pip
from app.schemas.perf import (
    CoachingCreate,
    CoachingOut,
    MyPerfOut,
    MyResultOut,
    PipConclusionIn,
    PipCreate,
    PipOut,
    PipUpdate,
)
from app.services.perf_dev_service import (
    DevError,
    conclude_pip,
    create_coaching,
    create_pip,
    get_owned_pip,
    list_published_results,
    update_pip,
    visible_employee,
)
from app.services.scope import apply_employee_scope

router = APIRouter(tags=["perf"])


def _pip_out(db: Session, pip: Pip) -> PipOut:
    emp = db.get(Employee, pip.employee_id)
    return PipOut(
        id=pip.id,
        employee_id=pip.employee_id,
        employee_no=emp.employee_no if emp else "",
        employee_name=emp.name if emp else "",
        period=pip.period,
        goals=list(pip.goals or []),
        deadline=pip.deadline,
        status=pip.status,
        conclusion=pip.conclusion,
        concluded_at=pip.concluded_at,
        perf_result_id=pip.perf_result_id,
        linked_adjust_id=pip.linked_adjust_id,
        created_at=pip.created_at,
    )


# ---------- PIP ----------

@router.get("/perf/pips", response_model=list[PipOut])
def list_pips(
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    principal: Principal = Depends(
        require_perm("perf.pip.manage", "perf.result.entry")
    ),
):
    """PIP 看板：COE 全租户，主管仅本人数据范围内成员。"""
    stmt = select(Pip).where(Pip.tenant_id == principal.user.tenant_id)
    if status:
        stmt = stmt.where(Pip.status == status)
    if not principal.can("perf.pip.manage"):
        emp_stmt = apply_employee_scope(
            select(Employee.id), db, principal
        )
        emp_ids = set(db.scalars(emp_stmt).all())
        stmt = stmt.where(Pip.employee_id.in_(emp_ids) if emp_ids
                          else Pip.employee_id.is_(None))
    pips = db.scalars(stmt.order_by(Pip.created_at.desc())).all()
    return [_pip_out(db, p) for p in pips]


@router.post("/perf/pips", response_model=PipOut, status_code=201)
def post_pip(
    body: PipCreate,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_perm("perf.pip.manage")),
):
    """手动为 C 等员工建档（D 由发布自动建档，本端点也可直接补）。"""
    try:
        pip = create_pip(
            db, principal, body.employee_id, body.period,
            body.goals, body.deadline, body.perf_result_id,
        )
    except DevError as exc:
        raise err(exc.status, exc.code, exc.message)
    db.commit()
    db.refresh(pip)
    return _pip_out(db, pip)


@router.put("/perf/pips/{pip_id}", response_model=PipOut)
def put_pip(
    pip_id: uuid.UUID,
    body: PipUpdate,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_perm("perf.pip.manage")),
):
    try:
        pip = get_owned_pip(db, principal, pip_id)
        update_pip(db, principal, pip, body.goals, body.deadline)
    except DevError as exc:
        raise err(exc.status, exc.code, exc.message)
    db.commit()
    db.refresh(pip)
    return _pip_out(db, pip)


@router.post("/perf/pips/{pip_id}/conclusion", response_model=PipOut)
def conclude(
    pip_id: uuid.UUID,
    body: PipConclusionIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_perm("perf.pip.manage")),
):
    """PIP 结论终结：passed/failed 后不可再改（AC-8）。"""
    try:
        pip = get_owned_pip(db, principal, pip_id)
        conclude_pip(db, principal, pip, body.result, body.note)
    except DevError as exc:
        raise err(exc.status, exc.code, exc.message)
    db.commit()
    db.refresh(pip)
    return _pip_out(db, pip)


# ---------- 辅导记录 ----------

@router.post("/perf/coaching", response_model=CoachingOut, status_code=201)
def post_coaching(
    body: CoachingCreate,
    db: Session = Depends(get_db),
    principal: Principal = Depends(
        require_perm("perf.result.entry", "perf.plan.manage")
    ),
):
    """主管/HRBP/COE 在数据范围内登记轻量辅导记录（AC-9）。"""
    try:
        record = create_coaching(
            db, principal, body.employee_id, body.content,
            body.happened_at, body.plan_id,
        )
    except DevError as exc:
        raise err(exc.status, exc.code, exc.message)
    db.commit()
    db.refresh(record)
    return CoachingOut.model_validate(record, from_attributes=True)


@router.get("/perf/coaching", response_model=list[CoachingOut])
def list_coaching(
    employee_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    """辅导记录列表：员工本人或其主管/HRBP/COE 可见（AC-9）。"""
    try:
        visible_employee(db, principal, employee_id)
    except DevError as exc:
        raise err(exc.status, exc.code, exc.message)
    records = db.scalars(
        select(CoachingRecord)
        .where(CoachingRecord.employee_id == employee_id)
        .order_by(CoachingRecord.happened_at.desc())
    ).all()
    return [CoachingOut.model_validate(r, from_attributes=True)
            for r in records]


# ---------- 我的绩效 ----------

@router.get("/perf/me", response_model=MyPerfOut)
def my_perf(
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    """员工自助：已发布结果（含 OKR/360）与本人 PIP（AC-10）。"""
    emp = db.scalar(
        select(Employee).where(Employee.user_id == principal.user.id)
    )
    if emp is None:
        return MyPerfOut(results=[], pips=[])

    results = [
        MyResultOut(
            plan_id=p.id,
            period=p.period,
            tool_type=p.tool_type,
            grade=r.grade,
            score=r.score,
            coefficient=r.coefficient,
            org_coefficient=r.org_coefficient,
            evidence=list(r.evidence or []),
            published_at=p.published_at,
        )
        for r, p in list_published_results(db, emp.id)
    ]
    pips = db.scalars(
        select(Pip)
        .where(Pip.employee_id == emp.id)
        .order_by(Pip.created_at.desc())
    ).all()
    return MyPerfOut(
        results=results,
        pips=[_pip_out(db, p) for p in pips],
    )
