"""激活角色的数据范围推导（ADR-0014）。

四档范围：
- GLOBAL：全租户
- SELF：仅本人
- SUBTREE：部门领导型——我领导的部门子树 ∪ 我在汇报链上的全员
- ASSIGNED_DEPTS：授权部门（可多个、可含子树）

范围外员工完全不可见（不是掩码）。
"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import Principal
from app.core.permissions import ScopeType
from app.models.employee import Employee
from app.models.org import Department


def _dept_children_map(db: Session, tenant_id) -> dict[str | None, list[str]]:
    rows = db.scalars(
        select(Department).where(Department.tenant_id == tenant_id)
    ).all()
    children: dict[str | None, list[str]] = {}
    for d in rows:
        children.setdefault(d.parent_id, []).append(d.id)
    return children


def _scope_cache(db: Session) -> dict:
    """会话内缓存：同一请求内多次 scope 推导不重复全表加载。"""
    return db.info.setdefault("scope_cache", {})


def dept_subtree(db: Session, tenant_id, root_ids) -> set[str]:
    """若干部门节点及其全部下级。"""
    cache_key = ("dept_subtree", tenant_id, tuple(sorted(root_ids)))
    cached = _scope_cache(db).get(cache_key)
    if cached is not None:
        return cached
    children = _dept_children_map(db, tenant_id)
    seen: set[str] = set()
    stack = list(root_ids)
    while stack:
        node = stack.pop()
        if node in seen:
            continue
        seen.add(node)
        stack.extend(children.get(node, []))
    _scope_cache(db)[cache_key] = seen
    return seen


def _my_employee(db: Session, principal: Principal) -> Employee | None:
    return db.scalar(
        select(Employee).where(
            Employee.tenant_id == principal.user.tenant_id,
            Employee.user_id == principal.user.id,
        )
    )


def _report_subtree(db: Session, tenant_id, root_emp_id) -> set[uuid.UUID]:
    """沿 manager_id 汇报链向下的全部员工 id（含根）。"""
    cache_key = ("report_subtree", tenant_id, root_emp_id)
    cached = _scope_cache(db).get(cache_key)
    if cached is not None:
        return cached
    rows = db.scalars(
        select(Employee).where(Employee.tenant_id == tenant_id)
    ).all()
    children: dict[uuid.UUID | None, list[Employee]] = {}
    for e in rows:
        children.setdefault(e.manager_id, []).append(e)
    seen: set[uuid.UUID] = set()
    stack = [root_emp_id]
    while stack:
        pid = stack.pop()
        if pid in seen:
            continue
        seen.add(pid)
        stack.extend(c.id for c in children.get(pid, []))
    _scope_cache(db)[cache_key] = seen
    return seen


def scope_dept_ids(db: Session, principal: Principal) -> set[str] | None:
    """激活角色可见部门集合；None 表示 GLOBAL（不按部门收窄）。"""
    if principal.scope_type == ScopeType.GLOBAL:
        return None
    if principal.scope_type == ScopeType.ASSIGNED_DEPTS:
        roots = [dept_id for dept_id, include_subtree in principal.assigned_depts]
        if not roots:
            return set()
        return dept_subtree(
            db,
            principal.user.tenant_id,
            [d for d, sub in principal.assigned_depts if sub],
        ) | {d for d, sub in principal.assigned_depts if not sub}
    # SUBTREE / SELF 由员工关系推导，不在此用部门集合粗滤
    return None


def can_access_employee(db: Session, principal: Principal, emp: Employee) -> bool:
    """单个员工是否落在激活角色数据范围内。"""
    if principal.scope_type == ScopeType.GLOBAL:
        return emp.tenant_id == principal.user.tenant_id

    if emp.tenant_id != principal.user.tenant_id:
        return False

    if emp.user_id == principal.user.id:
        return True

    if principal.scope_type == ScopeType.SELF:
        return False

    if principal.scope_type == ScopeType.ASSIGNED_DEPTS:
        visible_depts = scope_dept_ids(db, principal)
        return bool(visible_depts) and emp.dept_id in visible_depts

    if principal.scope_type == ScopeType.SUBTREE:
        me = _my_employee(db, principal)
        if me is None:
            return False
        # 汇报链
        if emp.id in _report_subtree(db, emp.tenant_id, me.id):
            return True
        # 我领导的部门（含子树）
        led = db.scalars(
            select(Department).where(
                Department.tenant_id == emp.tenant_id,
                Department.leader_employee_id == me.id,
            )
        ).all()
        if led:
            visible_depts = dept_subtree(db, emp.tenant_id, [d.id for d in led])
            if emp.dept_id in visible_depts:
                return True
        return False

    return False


def apply_employee_scope(stmt, db: Session, principal: Principal):
    """给 Employee 查询语句追加数据范围过滤。"""
    if principal.scope_type == ScopeType.GLOBAL:
        return stmt

    tenant_id = principal.user.tenant_id

    if principal.scope_type == ScopeType.SELF:
        return stmt.where(Employee.user_id == principal.user.id)

    if principal.scope_type == ScopeType.ASSIGNED_DEPTS:
        visible_depts = scope_dept_ids(db, principal)
        if not visible_depts:
            return stmt.where(Employee.id.is_(None))  # 未授权任何部门 → 空集
        return stmt.where(Employee.dept_id.in_(visible_depts))

    if principal.scope_type == ScopeType.SUBTREE:
        me = _my_employee(db, principal)
        if me is None:
            return stmt.where(Employee.id.is_(None))
        emp_ids = _report_subtree(db, tenant_id, me.id)
        led = db.scalars(
            select(Department).where(
                Department.tenant_id == tenant_id,
                Department.leader_employee_id == me.id,
            )
        ).all()
        if led:
            dept_ids = dept_subtree(db, tenant_id, [d.id for d in led])
            return stmt.where(
                (Employee.id.in_(emp_ids)) | (Employee.dept_id.in_(dept_ids))
            )
        return stmt.where(Employee.id.in_(emp_ids))

    return stmt
