import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import Principal, get_current_user, get_principal
from app.core.permissions import BUILTIN_TEMPLATES
from app.models.employee import Employee
from app.models.role_def import TenantRole
from app.models.user import User, parse_custom_ref
from app.database import get_db
from sqlalchemy.orm import Session

router = APIRouter(tags=["me"])


class RoleRefOut(BaseModel):
    ref: str
    name: str
    kind: str  # builtin / custom
    scope_type: str
    active: bool


class MeResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    email: str
    name: str
    active_role_ref: str
    active_role_name: str
    role_refs: list[RoleRefOut]
    employee_id: uuid.UUID | None = None
    family: str | None = None
    grade: str | None = None


def _describe_refs(db: Session, user: User) -> list[RoleRefOut]:
    refs = user.role_refs()
    active = user.default_active_ref()
    custom_ids = {
        ref: pid for ref in refs if (pid := parse_custom_ref(ref)) is not None
    }
    customs: dict[uuid.UUID, TenantRole] = {}
    if custom_ids:
        rows = db.scalars(
            select(TenantRole).where(TenantRole.id.in_(list(custom_ids.values())))
        ).all()
        customs = {r.id: r for r in rows}
    result: list[RoleRefOut] = []
    for ref in refs:
        if ref in BUILTIN_TEMPLATES:
            tpl = BUILTIN_TEMPLATES[ref]
            result.append(RoleRefOut(
                ref=ref, name=tpl.display_name, kind="builtin",
                scope_type=tpl.scope_type.value, active=ref == active,
            ))
        else:
            cid = parse_custom_ref(ref)
            role_def = customs.get(cid) if cid else None
            if role_def is None:
                # 自定义角色已被删除：跳过，不污染切换器
                continue
            result.append(RoleRefOut(
                ref=ref, name=role_def.name, kind="custom",
                scope_type=role_def.scope_type, active=ref == active,
            ))
    return result


@router.get("/me", response_model=MeResponse)
def read_me(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    emp = db.scalar(select(Employee).where(Employee.user_id == user.id))
    refs = _describe_refs(db, user)
    active_name = next((r.name for r in refs if r.active), user.role.value)
    return MeResponse(
        id=user.id,
        tenant_id=user.tenant_id,
        email=user.email,
        name=user.name,
        active_role_ref=user.default_active_ref(),
        active_role_name=active_name,
        role_refs=refs,
        employee_id=emp.id if emp else None,
        family=emp.family if emp else None,
        grade=emp.grade if emp else None,
    )


@router.get("/me/scopes")
def read_my_scopes(
    principal: Principal = Depends(get_principal),
    db: Session = Depends(get_db),
):
    """当前激活角色的数据范围（供前端展示与部门树标注）。"""
    depts = [
        {"dept_id": dept_id, "include_subtree": include_subtree}
        for dept_id, include_subtree in principal.assigned_depts
    ]
    return {
        "active_role_ref": principal.ref,
        "active_role_name": principal.display_name,
        "scope_type": principal.scope_type.value,
        "assigned_depts": depts,
        "permissions": sorted(principal.permissions),
    }
