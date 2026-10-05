"""部门主数据服务：静态树扶正、领导变更自动授/收 MANAGER 角色（ADR-0014）。"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.models.org import Department
from app.models.user import Role, User

# 原 org.py 静态部门树扶正为种子主数据（虚拟数据：星野制造）
DEPARTMENT_SEED = [
    {"id": "100", "parent_id": None, "name": "星野制造", "type": "biz"},
    {"id": "101", "parent_id": "100", "name": "经营管理部", "type": "biz"},
    {"id": "200", "parent_id": "100", "name": "职能中心", "type": "func"},
    {"id": "201", "parent_id": "200", "name": "人力资源部", "type": "func"},
    {"id": "202", "parent_id": "200", "name": "财务部", "type": "func"},
    {"id": "203", "parent_id": "200", "name": "综合管理部", "type": "func"},
    {"id": "300", "parent_id": "100", "name": "研发中心", "type": "tech"},
    {"id": "305", "parent_id": "300", "name": "软件研发部", "type": "tech"},
    {"id": "306", "parent_id": "300", "name": "机械设计部", "type": "tech"},
    {"id": "307", "parent_id": "300", "name": "工艺工程部", "type": "tech"},
    {"id": "400", "parent_id": "100", "name": "制造中心", "type": "biz"},
    {"id": "401", "parent_id": "400", "name": "机加车间", "type": "biz"},
    {"id": "402", "parent_id": "400", "name": "装配车间", "type": "biz"},
    {"id": "403", "parent_id": "400", "name": "质量部", "type": "tech"},
    {"id": "500", "parent_id": "100", "name": "供应链中心", "type": "func"},
    {"id": "501", "parent_id": "500", "name": "采购部", "type": "func"},
    {"id": "502", "parent_id": "500", "name": "仓储物流部", "type": "func"},
    {"id": "600", "parent_id": "100", "name": "营销中心", "type": "biz"},
    {"id": "601", "parent_id": "600", "name": "销售部", "type": "biz"},
    {"id": "602", "parent_id": "600", "name": "市场部", "type": "biz"},
]

# 种子部门领导工号映射（原 manager_no）
LEADER_NO_SEED = {
    "201": "E10002",
    "305": "E10020",
}


def seed_departments(db: Session, tenant_id: uuid.UUID) -> None:
    """幂等扶正部门树；已有同编码部门不覆盖。"""
    existing = {
        d.id
        for d in db.scalars(
            select(Department).where(Department.tenant_id == tenant_id)
        ).all()
    }
    seed_by_id = {row["id"]: row for row in DEPARTMENT_SEED}
    for row in DEPARTMENT_SEED:
        if row["id"] in existing:
            continue
        db.add(
            Department(
                id=row["id"],
                tenant_id=tenant_id,
                name=row["name"],
                parent_id=row["parent_id"],
                type=row["type"],
            )
        )
    db.flush()

    # 绑定种子领导并授角色
    for dept_id, emp_no in LEADER_NO_SEED.items():
        emp = db.scalar(
            select(Employee).where(
                Employee.tenant_id == tenant_id,
                Employee.employee_no == emp_no,
            )
        )
        if emp is None:
            continue
        dept = db.scalar(
            select(Department).where(
                Department.tenant_id == tenant_id,
                Department.id == dept_id,
            )
        )
        if dept is not None and dept.leader_employee_id is None:
            set_department_leader(db, tenant_id, dept_id, emp.id)


def grant_manager_role(db: Session, user: User) -> bool:
    refs = user.role_refs()
    if Role.MANAGER.value in refs:
        return False
    refs = [*refs, Role.MANAGER.value]
    user.roles = refs
    if user.role == Role.EMPLOYEE:
        user.role = Role.MANAGER
    return True


def revoke_manager_role(db: Session, user: User) -> bool:
    refs = [r for r in user.role_refs() if r != Role.MANAGER.value]
    changed = len(refs) != len(user.role_refs())
    if changed:
        user.roles = refs
        if user.role == Role.MANAGER:
            user.role = Role.EMPLOYEE
    return changed


def _leads_any_department(
    db: Session, tenant_id, employee_id: uuid.UUID, exclude_dept: str | None = None
) -> bool:
    stmt = select(Department.id).where(
        Department.tenant_id == tenant_id,
        Department.leader_employee_id == employee_id,
    )
    if exclude_dept:
        stmt = stmt.where(Department.id != exclude_dept)
    return db.scalar(stmt) is not None


def set_department_leader(
    db: Session,
    tenant_id,
    dept_id: str,
    employee_id: uuid.UUID | None,
) -> tuple[uuid.UUID | None, uuid.UUID | None]:
    """设置部门领导并同步角色。

    返回 (新领导 user_id, 被收回角色的旧领导 user_id)。
    """
    dept = db.scalar(
        select(Department).where(
            Department.tenant_id == tenant_id,
            Department.id == dept_id,
        )
    )
    if dept is None:
        raise ValueError("department_not_found")

    old_emp_id = dept.leader_employee_id
    if employee_id is not None:
        emp = db.get(Employee, employee_id)
        if emp is None or emp.tenant_id != tenant_id:
            raise ValueError("employee_not_found")

    dept.leader_employee_id = employee_id

    old_user_id = None
    if old_emp_id and old_emp_id != employee_id:
        if not _leads_any_department(db, tenant_id, old_emp_id, dept_id):
            old_emp = db.get(Employee, old_emp_id)
            if old_emp is not None:
                old_user = db.get(User, old_emp.user_id)
                if old_user is not None and Role.MANAGER.value in old_user.role_refs():
                    revoke_manager_role(db, old_user)
                    old_user_id = old_user.id

    if employee_id is not None:
        new_emp = db.get(Employee, employee_id)
        new_user = db.get(User, new_emp.user_id)
        if new_user is not None:
            grant_manager_role(db, new_user)

    return (new_user.id if employee_id is not None else None, old_user_id)
