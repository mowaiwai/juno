"""角色与权限管理（ADR-0014）：仅租户管理员。

- 权限点目录与内置模板只读；
- 自定义角色增删改查、克隆内置模板；
- 给用户授/收角色引用、设置默认激活角色、配置 ASSIGNED_DEPTS 部门授权。
"""

import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import Principal, err, require_perm
from app.database import get_db
from app.models.user import User
from app.services import role_service
from app.services.audit import audit_as

router = APIRouter(prefix="/roles", tags=["roles"])

_admin = require_perm("role.manage")


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class CustomRoleOut(BaseModel):
    id: uuid.UUID
    name: str
    scope_type: str
    permissions: list[str]
    cloned_from: str | None = None


class CustomRoleIn(BaseModel):
    name: str
    scope_type: str
    permissions: list[str]


class CloneIn(BaseModel):
    builtin_key: str
    name: str | None = None


class RoleRefIn(BaseModel):
    ref: str


class ActiveRoleIn(BaseModel):
    ref: str


class ScopeItem(BaseModel):
    dept_id: str
    include_subtree: bool = True


class ScopesIn(BaseModel):
    role_ref: str
    depts: list[ScopeItem]


class ScopeOut(BaseModel):
    role_ref: str
    dept_id: str
    include_subtree: bool


# ---------------------------------------------------------------------------
# 目录与自定义角色
# ---------------------------------------------------------------------------

@router.get("/catalog")
def get_catalog(principal: Principal = Depends(_admin)):
    """权限点目录 + 内置角色模板（配置 UI 渲染用）。"""
    return role_service.catalog()


@router.get("/custom", response_model=list[CustomRoleOut])
def list_custom(
    db: Session = Depends(get_db),
    principal: Principal = Depends(_admin),
):
    return [
        CustomRoleOut(
            id=r.id,
            name=r.name,
            scope_type=r.scope_type,
            permissions=list(r.permissions or []),
            cloned_from=r.cloned_from,
        )
        for r in role_service.list_tenant_roles(db, principal.user.tenant_id)
    ]


@router.post("/custom", response_model=CustomRoleOut, status_code=201)
def create_custom(
    body: CustomRoleIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(_admin),
):
    try:
        role = role_service.create_role(
            db,
            principal.user.tenant_id,
            body.name,
            body.scope_type,
            body.permissions,
            principal.user.id,
        )
    except ValueError as exc:
        raise err(422, "invalid_role", str(exc))
    audit_as(db, principal.user, "custom_role_created", "role", role.id,
             after={"name": role.name, "scope_type": role.scope_type})
    db.commit()
    return _out(role)


@router.post("/clone", response_model=CustomRoleOut, status_code=201)
def clone_builtin(
    body: CloneIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(_admin),
):
    try:
        role = role_service.clone_builtin(
            db,
            principal.user.tenant_id,
            body.builtin_key,
            body.name or "",
            principal.user.id,
        )
    except ValueError as exc:
        raise err(422, "clone_failed", str(exc))
    audit_as(db, principal.user, "custom_role_cloned", "role", role.id,
             after={"name": role.name, "cloned_from": body.builtin_key})
    db.commit()
    return _out(role)


@router.put("/custom/{role_id}", response_model=CustomRoleOut)
def update_custom(
    role_id: uuid.UUID,
    body: CustomRoleIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(_admin),
):
    try:
        role = role_service.update_role(
            db, principal.user.tenant_id, role_id,
            name=body.name, scope_type=body.scope_type,
            permissions=body.permissions,
        )
    except ValueError as exc:
        raise err(422, "invalid_role", str(exc))
    audit_as(db, principal.user, "custom_role_updated", "role", role.id,
             after={"name": role.name, "scope_type": role.scope_type})
    db.commit()
    return _out(role)


@router.delete("/custom/{role_id}", status_code=204)
def delete_custom(
    role_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(_admin),
):
    try:
        role_service.delete_role(db, principal.user.tenant_id, role_id)
    except ValueError as exc:
        raise err(404, "role_not_found", str(exc))
    audit_as(db, principal.user, "custom_role_deleted", "role", role_id)
    db.commit()


def _out(role) -> CustomRoleOut:
    return CustomRoleOut(
        id=role.id,
        name=role.name,
        scope_type=role.scope_type,
        permissions=list(role.permissions or []),
        cloned_from=role.cloned_from,
    )


# ---------------------------------------------------------------------------
# 用户授角 / 激活角色 / 部门授权
# ---------------------------------------------------------------------------

@router.get("/users/{user_id}/grants")
def list_grants(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(_admin),
):
    user = db.get(User, user_id)
    if user is None or user.tenant_id != principal.user.tenant_id:
        raise err(404, "user_not_found", "用户不存在")
    scopes = role_service.list_scopes(db, principal.user.tenant_id, user_id)
    return {
        "active_role_ref": user.default_active_ref(),
        "role_refs": user.role_refs(),
        "scopes": [
            {"role_ref": s.role_ref, "dept_id": s.dept_id,
             "include_subtree": s.include_subtree}
            for s in scopes
        ],
    }


@router.post("/users/{user_id}/grants", status_code=201)
def grant_role(
    user_id: uuid.UUID,
    body: RoleRefIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(_admin),
):
    try:
        user = role_service.grant_role(
            db, principal.user.tenant_id, user_id, body.ref
        )
    except ValueError as exc:
        raise err(422, "grant_failed", str(exc))
    audit_as(db, principal.user, "role_granted", "user", user_id,
             after={"ref": body.ref})
    db.commit()
    return {"role_refs": user.role_refs()}


@router.delete("/users/{user_id}/grants/{ref}", status_code=204)
def revoke_role(
    user_id: uuid.UUID,
    ref: str,
    db: Session = Depends(get_db),
    principal: Principal = Depends(_admin),
):
    try:
        role_service.revoke_role(
            db, principal.user.tenant_id, user_id, ref
        )
    except ValueError as exc:
        if str(exc) == "last_admin_protected":
            raise err(422, "last_admin_protected", "至少保留一个租户管理员")
        raise err(422, "revoke_failed", str(exc))
    audit_as(db, principal.user, "role_revoked", "user", user_id,
             after={"ref": ref})
    db.commit()


@router.put("/users/{user_id}/active-role")
def set_active_role(
    user_id: uuid.UUID,
    body: ActiveRoleIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(_admin),
):
    try:
        user = role_service.set_active_role(
            db, principal.user.tenant_id, user_id, body.ref
        )
    except ValueError as exc:
        raise err(422, "active_role_failed", str(exc))
    db.commit()
    return {"active_role_ref": user.default_active_ref()}


@router.put("/users/{user_id}/scopes", response_model=list[ScopeOut])
def set_scopes(
    user_id: uuid.UUID,
    body: ScopesIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(_admin),
):
    try:
        role_service.set_scopes(
            db,
            principal.user.tenant_id,
            user_id,
            body.role_ref,
            [(d.dept_id, d.include_subtree) for d in body.depts],
        )
    except ValueError as exc:
        raise err(422, "scope_failed", str(exc))
    audit_as(db, principal.user, "role_scopes_updated", "user", user_id,
             after={"role_ref": body.role_ref,
                    "depts": [d.model_dump() for d in body.depts]})
    db.commit()
    rows = role_service.list_scopes(db, principal.user.tenant_id, user_id)
    return [
        ScopeOut(role_ref=r.role_ref, dept_id=r.dept_id,
                 include_subtree=r.include_subtree)
        for r in rows
        if r.role_ref == body.role_ref
    ]
