import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import Principal, require_perm
from app.database import get_db
from app.models.user import User

router = APIRouter(tags=["users"])


class UserOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    email: str
    name: str
    active_role_ref: str
    role_refs: list[str]


@router.get("/users", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    principal: Principal = Depends(
        require_perm("employee.account.manage", "role.manage")
    ),
):
    """租户内用户列表（SSC 账号管理 / 租户管理员角色管理共用）。"""
    rows = db.scalars(
        select(User).where(User.tenant_id == principal.user.tenant_id)
    ).all()
    return [
        UserOut(
            id=u.id,
            tenant_id=u.tenant_id,
            email=u.email,
            name=u.name,
            active_role_ref=u.default_active_ref(),
            role_refs=u.role_refs(),
        )
        for u in rows
    ]
