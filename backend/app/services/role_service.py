"""租户自定义角色与角色授权服务（ADR-0014）。"""

import uuid

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.permissions import (
    BUILTIN_TEMPLATES,
    CLONEABLE_BUILTIN,
    PERMISSION_GROUPS,
    PERMISSION_POINTS,
    PRESET_ALL_HR_NAME,
    PRESET_ALL_HR_PERMS,
    ScopeType,
)
from app.models.role_def import RoleScope, TenantRole
from app.models.user import (
    Role,
    User,
    custom_role_ref,
    is_custom_ref,
    parse_custom_ref,
)

VALID_SCOPES = {s.value for s in ScopeType}


# ---------------------------------------------------------------------------
# 角色目录
# ---------------------------------------------------------------------------

def catalog() -> dict:
    """权限点目录（供配置 UI 展示）。"""
    return {
        "groups": [
            {"code": code, "title": title,
             "points": [{"code": p, "label": label} for p, label in points]}
            for title, code, points in PERMISSION_GROUPS
        ],
        "builtin_roles": [
            {
                "ref": key,
                "name": tpl.display_name,
                "scope_type": tpl.scope_type.value,
                "cloneable": tpl.cloneable,
                "permissions": sorted(tpl.permissions),
            }
            for key, tpl in BUILTIN_TEMPLATES.items()
        ],
        "cloneable": CLONEABLE_BUILTIN,
        "scope_types": [s.value for s in ScopeType],
    }


def list_tenant_roles(db: Session, tenant_id) -> list[TenantRole]:
    return list(
        db.scalars(
            select(TenantRole)
            .where(TenantRole.tenant_id == tenant_id)
            .order_by(TenantRole.created_at)
        ).all()
    )


# ---------------------------------------------------------------------------
# 自定义角色 CRUD
# ---------------------------------------------------------------------------

def _validate_perms(perms: list[str]) -> list[str]:
    unknown = [p for p in perms if p not in PERMISSION_POINTS]
    if unknown:
        raise ValueError(f"unknown_permission:{unknown[0]}")
    # 去重保序
    return list(dict.fromkeys(perms))


def create_role(
    db: Session,
    tenant_id,
    name: str,
    scope_type: str,
    permissions: list[str],
    actor_id,
    cloned_from: str | None = None,
) -> TenantRole:
    if scope_type not in VALID_SCOPES:
        raise ValueError("invalid_scope_type")
    if not name.strip():
        raise ValueError("name_required")
    role = TenantRole(
        tenant_id=tenant_id,
        name=name.strip(),
        scope_type=scope_type,
        permissions=_validate_perms(permissions),
        cloned_from=cloned_from,
        created_by=actor_id,
    )
    db.add(role)
    db.flush()
    return role


def clone_builtin(
    db: Session, tenant_id, builtin_key: str, new_name: str, actor_id
) -> TenantRole:
    if builtin_key not in CLONEABLE_BUILTIN:
        raise ValueError("builtin_not_cloneable")
    tpl = BUILTIN_TEMPLATES[builtin_key]
    return create_role(
        db,
        tenant_id,
        new_name.strip() or f"{tpl.display_name}（自定义）",
        tpl.scope_type.value,
        sorted(tpl.permissions),
        actor_id,
        cloned_from=builtin_key,
    )


def update_role(
    db: Session,
    tenant_id,
    role_id: uuid.UUID,
    name: str | None = None,
    scope_type: str | None = None,
    permissions: list[str] | None = None,
) -> TenantRole:
    role = db.get(TenantRole, role_id)
    if role is None or role.tenant_id != tenant_id:
        raise ValueError("role_not_found")
    if name is not None:
        if not name.strip():
            raise ValueError("name_required")
        role.name = name.strip()
    if scope_type is not None:
        if scope_type not in VALID_SCOPES:
            raise ValueError("invalid_scope_type")
        role.scope_type = scope_type
    if permissions is not None:
        role.permissions = _validate_perms(permissions)
    return role


def delete_role(db: Session, tenant_id, role_id: uuid.UUID) -> None:
    role = db.get(TenantRole, role_id)
    if role is None or role.tenant_id != tenant_id:
        raise ValueError("role_not_found")
    ref = custom_role_ref(role.id)
    # 从所有用户的角色集合中摘除
    users = db.scalars(select(User).where(User.tenant_id == tenant_id)).all()
    for u in users:
        refs = u.role_refs()
        if ref in refs:
            u.roles = [r for r in refs if r != ref]
            if u.active_role_ref == ref:
                u.active_role_ref = None
    db.execute(delete(RoleScope).where(RoleScope.role_ref == ref))
    db.delete(role)


def ensure_preset_all_hr(db: Session, tenant_id) -> TenantRole:
    """幂等创建/获取「综合 HR（一人全包）」预设。"""
    existing = db.scalar(
        select(TenantRole).where(
            TenantRole.tenant_id == tenant_id,
            TenantRole.name == PRESET_ALL_HR_NAME,
        )
    )
    if existing:
        return existing
    return create_role(
        db,
        tenant_id,
        PRESET_ALL_HR_NAME,
        ScopeType.GLOBAL.value,
        sorted(PRESET_ALL_HR_PERMS),
        actor_id=None,
        cloned_from="preset_all_hr",
    )


# ---------------------------------------------------------------------------
# 用户授角 / 数据范围授权
# ---------------------------------------------------------------------------

def grant_role(db: Session, tenant_id, user_id: uuid.UUID, ref: str) -> User:
    user = db.get(User, user_id)
    if user is None or user.tenant_id != tenant_id:
        raise ValueError("user_not_found")
    if is_custom_ref(ref):
        custom_id = parse_custom_ref(ref)
        role = db.get(TenantRole, custom_id) if custom_id else None
        if role is None or role.tenant_id != tenant_id:
            raise ValueError("role_not_found")
    else:
        try:
            Role(ref)
        except ValueError:
            raise ValueError("unknown_role")
    refs = user.role_refs()
    if ref not in refs:
        user.roles = [*refs, ref]
    return user


def revoke_role(db: Session, tenant_id, user_id: uuid.UUID, ref: str) -> User:
    user = db.get(User, user_id)
    if user is None or user.tenant_id != tenant_id:
        raise ValueError("user_not_found")
    if ref == Role.TENANT_ADMIN.value or ref == Role.PLATFORM_ADMIN.value:
        # 管理员角色摘除走最后的管理员防呆校验
        pass
    refs = [r for r in user.role_refs() if r != ref]
    user.roles = refs
    if user.role.value == ref:
        user.role = Role.EMPLOYEE
    if user.active_role_ref == ref:
        user.active_role_ref = None
    db.execute(
        delete(RoleScope).where(
            RoleScope.user_id == user_id, RoleScope.role_ref == ref
        )
    )
    _ensure_last_admin(db, tenant_id)
    return user


def set_active_role(db: Session, tenant_id, user_id, ref: str) -> User:
    user = db.get(User, user_id)
    if user is None or user.tenant_id != tenant_id:
        raise ValueError("user_not_found")
    if ref not in user.role_refs():
        raise ValueError("role_not_granted")
    user.active_role_ref = ref
    return user


def set_scopes(
    db: Session,
    tenant_id,
    user_id: uuid.UUID,
    role_ref: str,
    depts: list[tuple[str, bool]],
) -> None:
    """覆盖式设置某用户某角色的 ASSIGNED_DEPTS 授权部门清单。"""
    user = db.get(User, user_id)
    if user is None or user.tenant_id != tenant_id:
        raise ValueError("user_not_found")
    if role_ref not in user.role_refs():
        raise ValueError("role_not_granted")
    db.execute(
        delete(RoleScope).where(
            RoleScope.user_id == user_id, RoleScope.role_ref == role_ref
        )
    )
    for dept_id, include_subtree in depts:
        db.add(
            RoleScope(
                tenant_id=tenant_id,
                user_id=user_id,
                role_ref=role_ref,
                dept_id=dept_id,
                include_subtree=include_subtree,
            )
        )


def list_scopes(db: Session, tenant_id, user_id) -> list[RoleScope]:
    return list(
        db.scalars(
            select(RoleScope).where(
                RoleScope.tenant_id == tenant_id,
                RoleScope.user_id == user_id,
            )
        ).all()
    )


def _ensure_last_admin(db: Session, tenant_id) -> None:
    """至少保留一个全权限管理员（租户或平台管理员），防止自锁。"""
    users = db.scalars(select(User).where(User.tenant_id == tenant_id)).all()
    has_admin = any(
        u.has_any(Role.TENANT_ADMIN, Role.PLATFORM_ADMIN) for u in users
    )
    if not has_admin:
        raise ValueError("last_admin_protected")
