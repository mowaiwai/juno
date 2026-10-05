import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import (
    Principal,
    err,
    get_principal,
    require_perm,
)
from app.database import get_db
from app.models.employee import Employee
from app.services.audit import audit_as
from app.services.scope import apply_employee_scope, can_access_employee

router = APIRouter(tags=["employees"])


class EmployeeDirectoryOut(BaseModel):
    id: uuid.UUID
    employee_no: str
    name: str
    dept_id: str
    position: str
    family: str
    sequence: str
    grade: str
    grade_since: date | None = None
    perf_grade: str | None = None
    manager_id: uuid.UUID | None = None
    manager_name: str | None = None
    is_active: bool


class EmployeeDetailOut(BaseModel):
    id: uuid.UUID
    employee_no: str
    name: str
    dept_id: str
    position: str
    family: str
    sequence: str
    grade: str
    grade_since: date | None = None
    perf_grade: str | None = None
    manager_id: uuid.UUID | None = None
    manager_name: str | None = None
    is_active: bool
    education: str | None = None
    certificates: list = []
    # 定薪：无权时返回 None（前端掩码展示）
    base_salary: int | None = None
    salary_updated_at: datetime | None = None


class OrgFieldsIn(BaseModel):
    dept_id: str | None = None
    position: str | None = None
    family: str | None = None
    sequence: str | None = None
    grade: str | None = None


class SalaryIn(BaseModel):
    base_salary: int

    @field_validator("base_salary")
    @classmethod
    def _positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("月薪必须为正数")
        return v


def _manager_name(db: Session, manager_id) -> str | None:
    if not manager_id:
        return None
    mgr = db.get(Employee, manager_id)
    return mgr.name if mgr else None


def _get_scoped_employee(
    db: Session, principal: Principal, employee_id: uuid.UUID
) -> Employee:
    emp = db.get(Employee, employee_id)
    if emp is None or emp.tenant_id != principal.user.tenant_id:
        raise err(404, "employee_not_found", "员工不存在")
    if not can_access_employee(db, principal, emp):
        # 范围外统一 404 口径：完全不可见，不暴露存在性
        raise err(404, "employee_not_found", "员工不存在")
    return emp


@router.get("/employees", response_model=list[EmployeeDirectoryOut])
def list_employees(
    dept_id: str | None = Query(default=None, description="按部门 id 过滤"),
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_perm("employee.view")),
):
    """员工目录：按激活角色数据范围过滤；绩效等级按字段权限掩码。"""
    stmt = (
        select(Employee)
        .where(Employee.tenant_id == principal.user.tenant_id)
        .order_by(Employee.employee_no)
    )
    if dept_id:
        stmt = stmt.where(Employee.dept_id == dept_id)
    stmt = apply_employee_scope(stmt, db, principal)
    rows = list(db.scalars(stmt).all())

    manager_ids = {r.manager_id for r in rows if r.manager_id}
    mgr_map: dict[uuid.UUID, str] = {}
    if manager_ids:
        mgrs = db.scalars(
            select(Employee).where(Employee.id.in_(manager_ids))
        ).all()
        mgr_map = {m.id: m.name for m in mgrs}

    return [
        EmployeeDirectoryOut(
            id=r.id,
            employee_no=r.employee_no,
            name=r.name,
            dept_id=r.dept_id,
            position=r.position,
            family=r.family,
            sequence=r.sequence,
            grade=r.grade,
            grade_since=r.grade_since,
            perf_grade=(
                r.perf_grade
                if principal.can_view_perf(r.user_id)
                else None
            ),
            manager_id=r.manager_id,
            manager_name=mgr_map.get(r.manager_id) if r.manager_id else None,
            is_active=r.is_active,
        )
        for r in rows
    ]


@router.get("/employees/{employee_id}", response_model=EmployeeDetailOut)
def get_employee(
    employee_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    """单个员工详情（含基本条件补录与定薪）。

    本人始终可查；他人需落在激活角色数据范围内。
    绩效等级、定薪数据按字段权限掩码。
    """
    emp = db.get(Employee, employee_id)
    if emp is None or emp.tenant_id != principal.user.tenant_id:
        raise err(404, "employee_not_found", "员工不存在")
    is_self = emp.user_id == principal.user.id
    if not is_self:
        if not principal.can("employee.view") or not can_access_employee(
            db, principal, emp
        ):
            raise err(404, "employee_not_found", "员工不存在")

    return EmployeeDetailOut(
        id=emp.id,
        employee_no=emp.employee_no,
        name=emp.name,
        dept_id=emp.dept_id,
        position=emp.position,
        family=emp.family,
        sequence=emp.sequence,
        grade=emp.grade,
        grade_since=emp.grade_since,
        perf_grade=(
            emp.perf_grade if principal.can_view_perf(emp.user_id) else None
        ),
        manager_id=emp.manager_id,
        manager_name=_manager_name(db, emp.manager_id),
        is_active=emp.is_active,
        education=emp.education,
        certificates=list(emp.certificates or []),
        base_salary=(
            emp.base_salary
            if (principal.can("employee.salary.view") or is_self)
            else None
        ),
        salary_updated_at=(
            emp.salary_updated_at
            if (principal.can("employee.salary.view") or is_self)
            else None
        ),
    )


@router.put("/employees/{employee_id}/org-fields", response_model=EmployeeDetailOut)
def update_org_fields(
    employee_id: uuid.UUID,
    body: OrgFieldsIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_perm("employee.field.org.edit")),
):
    """档案组织字段编辑（部门/岗位/职族/序列/职级）：OTD 负责。"""
    emp = _get_scoped_employee(db, principal, employee_id)
    changes: dict[str, str | None] = {}
    for field in ("dept_id", "position", "family", "sequence", "grade"):
        value = getattr(body, field)
        if value is not None and value != getattr(emp, field):
            changes[field] = value
            setattr(emp, field, value)
    if changes:
        audit_as(
            db, principal.user,
            "employee_org_fields_updated", "employee", emp.id,
            after=changes,
        )
    db.commit()
    return EmployeeDetailOut(
        id=emp.id,
        employee_no=emp.employee_no,
        name=emp.name,
        dept_id=emp.dept_id,
        position=emp.position,
        family=emp.family,
        sequence=emp.sequence,
        grade=emp.grade,
        grade_since=emp.grade_since,
        perf_grade=(
            emp.perf_grade if principal.can_view_perf(emp.user_id) else None
        ),
        manager_id=emp.manager_id,
        manager_name=_manager_name(db, emp.manager_id),
        is_active=emp.is_active,
        education=emp.education,
        certificates=list(emp.certificates or []),
        base_salary=emp.base_salary if principal.can("employee.salary.view") else None,
        salary_updated_at=(
            emp.salary_updated_at if principal.can("employee.salary.view") else None
        ),
    )


@router.put("/employees/{employee_id}/salary", response_model=EmployeeDetailOut)
def update_salary(
    employee_id: uuid.UUID,
    body: SalaryIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_perm("employee.salary.edit")),
):
    """定薪：COE·薪酬激励（编辑权隐含查看权）。"""
    emp = _get_scoped_employee(db, principal, employee_id)
    before = emp.base_salary
    emp.base_salary = body.base_salary
    emp.salary_updated_at = datetime.now(timezone.utc)
    audit_as(
        db, principal.user,
        "employee_salary_updated", "employee", emp.id,
        {"base_salary": before}, {"base_salary": body.base_salary},
    )
    db.commit()
    return EmployeeDetailOut(
        id=emp.id,
        employee_no=emp.employee_no,
        name=emp.name,
        dept_id=emp.dept_id,
        position=emp.position,
        family=emp.family,
        sequence=emp.sequence,
        grade=emp.grade,
        grade_since=emp.grade_since,
        perf_grade=(
            emp.perf_grade if principal.can_view_perf(emp.user_id) else None
        ),
        manager_id=emp.manager_id,
        manager_name=_manager_name(db, emp.manager_id),
        is_active=emp.is_active,
        education=emp.education,
        certificates=list(emp.certificates or []),
        base_salary=emp.base_salary,
        salary_updated_at=emp.salary_updated_at,
    )

