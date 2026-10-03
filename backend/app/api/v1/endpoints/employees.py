import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import err, get_current_user, require_roles
from app.database import get_db
from app.models.employee import Employee
from app.models.user import Role, User
from app.services.audit import audit_as

router = APIRouter(tags=["employees"])

# 绩效等级合法取值（字母等级，不换算分数）
PERF_GRADES = {"S", "A", "B", "C", "D"}


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


class PerfImportItem(BaseModel):
    employee_no: str
    perf_grade: str

    @field_validator("perf_grade")
    @classmethod
    def _validate_grade(cls, v: str) -> str:
        grade = v.strip().upper()
        if grade not in PERF_GRADES:
            raise ValueError("绩效等级必须为 S/A/B/C/D")
        return grade


class PerfImportIn(BaseModel):
    items: list[PerfImportItem]


class PerfImportError(BaseModel):
    employee_no: str
    reason: str


class PerfImportOut(BaseModel):
    updated: int
    errors: list[PerfImportError]


def _manager_name(db: Session, manager_id) -> str | None:
    if not manager_id:
        return None
    mgr = db.get(Employee, manager_id)
    return mgr.name if mgr else None


@router.get("/employees", response_model=list[EmployeeDirectoryOut])
def list_employees(
    dept_id: str | None = Query(default=None, description="按部门 id 过滤"),
    db: Session = Depends(get_db),
    user: User = Depends(
        require_roles(Role.HR, Role.MANAGER, Role.EXECUTIVE, Role.TENANT_ADMIN)
    ),
):
    """员工目录：花名册 / 组织树 / 岗位在编等场景共用。仅本租户。

    数据范围（CONTEXT.md）：HR/高管/租户管理员看全员；经理沿 manager_id
    递归看自己的下级（含本人）。
    """
    stmt = (
        select(Employee)
        .where(Employee.tenant_id == user.tenant_id)
        .order_by(Employee.employee_no)
    )
    if dept_id:
        stmt = stmt.where(Employee.dept_id == dept_id)
    rows = list(db.scalars(stmt).all())

    is_full_scope = user.has_any(Role.HR, Role.EXECUTIVE, Role.TENANT_ADMIN)
    if not is_full_scope:
        me = next((e for e in rows if e.user_id == user.id), None)
        if me is None:
            return []
        children: dict[uuid.UUID | None, list[Employee]] = {}
        for e in rows:
            children.setdefault(e.manager_id, []).append(e)
        visible: set[uuid.UUID] = set()
        stack = [me.id]
        while stack:
            pid = stack.pop()
            if pid in visible:
                continue
            visible.add(pid)
            stack.extend(c.id for c in children.get(pid, []))
        rows = [e for e in rows if e.id in visible]

    # 批量查 manager 名称
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
            perf_grade=r.perf_grade,
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
    user: User = Depends(get_current_user),
):
    """单个员工详情（含基本条件补录）。本人或 HR 可查。"""
    emp = db.get(Employee, employee_id)
    if emp is None or emp.tenant_id != user.tenant_id:
        raise err(404, "employee_not_found", "员工不存在")
    is_self = emp.user_id == user.id
    if not is_self and not user.has_any(Role.HR):
        raise err(403, "forbidden", "无权查看该员工档案")
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
        perf_grade=emp.perf_grade,
        manager_id=emp.manager_id,
        manager_name=_manager_name(db, emp.manager_id),
        is_active=emp.is_active,
        education=emp.education,
        certificates=list(emp.certificates or []),
    )


@router.put("/employees/perf", response_model=PerfImportOut)
def import_perf_grades(
    body: PerfImportIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.HR)),
):
    """绩效结果批量导入：按工号回写档案 perf_grade（HR）。

    数据飞轮入口：绩效是画像 perf 维度与九宫格业绩轴的数据源；
    回写后在盘点启动（初排快照）与发布（画像回写）时生效。
    """
    if not body.items:
        raise err(422, "invalid_request", "导入内容为空")
    rows = db.scalars(
        select(Employee).where(Employee.tenant_id == user.tenant_id)
    ).all()
    by_no = {e.employee_no: e for e in rows}
    updated = 0
    errors: list[PerfImportError] = []
    seen: set[str] = set()
    for item in body.items:
        no = item.employee_no.strip()
        if not no or no in seen:
            errors.append(
                PerfImportError(
                    employee_no=no, reason="工号为空" if not no else "工号重复"
                )
            )
            continue
        seen.add(no)
        emp = by_no.get(no)
        if emp is None:
            errors.append(PerfImportError(employee_no=no, reason="工号不存在"))
            continue
        before = emp.perf_grade
        if before == item.perf_grade:
            continue
        emp.perf_grade = item.perf_grade
        audit_as(
            db, user,
            "perf_grade_imported", "employee", emp.id,
            {"perf_grade": before}, {"perf_grade": item.perf_grade},
        )
        updated += 1
    db.commit()
    return PerfImportOut(updated=updated, errors=errors)
