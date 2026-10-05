import uuid
from dataclasses import dataclass, field

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.permissions import BUILTIN_TEMPLATES, ScopeType
from app.core.security import decode_access_token
from app.database import get_db
from app.models.role_def import RoleScope, TenantRole
from app.models.user import Role, User, parse_custom_ref

bearer_scheme = HTTPBearer()

ACTIVE_ROLE_HEADER = "X-Active-Role"


def err(
    status_code: int,
    code: str,
    message: str,
    details=None,
) -> HTTPException:
    detail: dict = {"code": code, "message": message}
    if details is not None:
        detail["details"] = details
    return HTTPException(status_code=status_code, detail=detail)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise err(401, "invalid_token", "登录凭证无效或已过期")

    user = db.get(User, user_id)
    if user is None or str(user.tenant_id) != payload.get("tenant_id"):
        raise err(401, "invalid_token", "登录凭证无效或已过期")
    return user


@dataclass
class Principal:
    """当前请求的激活角色上下文（ADR-0014）。

    权限点、数据范围、字段掩码一律只由这一个激活角色决定，不做角色并集。
    """

    user: User
    ref: str
    scope_type: ScopeType
    permissions: frozenset[str]
    role: Role | None = None
    custom_role: TenantRole | None = None
    # ASSIGNED_DEPTS：[(dept_id, include_subtree)]
    assigned_depts: list[tuple[str, bool]] = field(default_factory=list)
    display_name: str = ""

    # ---- 权限判断 ----
    def can(self, *points: str) -> bool:
        if "*" in self.permissions:
            return True
        return bool(set(points) & self.permissions)

    def is_active_role(self, *roles: Role) -> bool:
        return self.role is not None and self.role in set(roles)

    # ---- 字段掩码 ----
    def can_view_salary(self, target: User | None = None) -> bool:
        if target is not None and target.id == self.user.id:
            return True
        return self.can("employee.salary.view")

    def can_view_perf(self, target_user_id: uuid.UUID | None = None) -> bool:
        if target_user_id is not None and target_user_id == self.user.id:
            return True
        return self.can("employee.field.perf.view")


def _resolve_active_ref(user: User, request: Request | None) -> str:
    header_ref = request.headers.get(ACTIVE_ROLE_HEADER) if request else None
    ref = header_ref or user.default_active_ref()
    if not user.owns_role_ref(ref):
        raise err(403, "invalid_active_role", "激活角色不属于当前用户")
    return ref


def get_principal(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Principal:
    ref = _resolve_active_ref(user, request)
    custom_id = parse_custom_ref(ref)

    if custom_id is not None:
        role_def = db.get(TenantRole, custom_id)
        if role_def is None or role_def.tenant_id != user.tenant_id:
            raise err(403, "invalid_active_role", "角色不存在或已被删除")
        try:
            scope_type = ScopeType(role_def.scope_type)
        except ValueError:
            scope_type = ScopeType.GLOBAL
        assigned = _load_assigned_depts(db, user, ref, scope_type)
        return Principal(
            user=user,
            ref=ref,
            role=None,
            custom_role=role_def,
            scope_type=scope_type,
            permissions=frozenset(role_def.permissions or []),
            assigned_depts=assigned,
            display_name=role_def.name,
        )

    try:
        role = Role(ref)
    except ValueError:
        raise err(403, "invalid_active_role", "未知角色")
    template = BUILTIN_TEMPLATES[ref]
    assigned = _load_assigned_depts(db, user, ref, template.scope_type)
    return Principal(
        user=user,
        ref=ref,
        role=role,
        scope_type=template.scope_type,
        permissions=template.permissions,
        assigned_depts=assigned,
        display_name=template.display_name,
    )


def _load_assigned_depts(
    db: Session, user: User, ref: str, scope_type: ScopeType
) -> list[tuple[str, bool]]:
    if scope_type != ScopeType.ASSIGNED_DEPTS:
        return []
    rows = db.scalars(
        select(RoleScope).where(
            RoleScope.tenant_id == user.tenant_id,
            RoleScope.user_id == user.id,
            RoleScope.role_ref == ref,
        )
    ).all()
    return [(r.dept_id, r.include_subtree) for r in rows]


def require_perm(*points: str):
    """权限点守卫：激活角色不具备任一权限点 → 403。"""

    def checker(principal: Principal = Depends(get_principal)) -> Principal:
        if not principal.can(*points):
            raise err(403, "forbidden", "当前角色无权执行此操作")
        return principal

    return checker


def require_perm_user(*points: str):
    """同 require_perm，但直接返回 User（兼容既有以 user 为参数的端点）。"""

    def checker(principal: Principal = Depends(get_principal)) -> User:
        if not principal.can(*points):
            raise err(403, "forbidden", "当前角色无权执行此操作")
        return principal.user

    return checker


def require_active_roles(*roles: Role):
    """内置角色守卫：当前【激活角色】必须是给定内置角色之一。

    注意与旧 require_roles 的区别：按激活角色判断而非角色集合并集，
    避免"切到员工视角仍可调 HR 接口"。通配管理员始终放行。
    """

    def checker(principal: Principal = Depends(get_principal)) -> Principal:
        if principal.can("*") or principal.is_active_role(*roles):
            return principal
        raise err(403, "forbidden", "当前角色无权执行此操作")

    return checker


def require_active_roles_user(*roles: Role):
    """同 require_active_roles，但直接返回 User（兼容以 user 为参数的端点）。"""

    def checker(principal: Principal = Depends(get_principal)) -> User:
        if principal.can("*") or principal.is_active_role(*roles):
            return principal.user
        raise err(403, "forbidden", "当前角色无权执行此操作")

    return checker


# 向后兼容别名：旧 require_roles 语义升级为"激活角色"守卫
def require_roles(*roles: Role):
    return require_active_roles(*roles)
