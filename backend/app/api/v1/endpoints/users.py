import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.database import get_db
from app.models.user import Role, User

router = APIRouter(tags=["users"])


class UserOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    email: str
    name: str
    role: str
    roles: list[str]


@router.get("/users", response_model=list[UserOut])
def list_users(
    user: User = Depends(require_roles(Role.HR, Role.TENANT_ADMIN)),
    db: Session = Depends(get_db),
):
    """租户内用户列表。租户隔离：只查当前用户 tenant_id。"""
    rows = db.scalars(select(User).where(User.tenant_id == user.tenant_id)).all()
    return [
        UserOut(
            id=u.id,
            tenant_id=u.tenant_id,
            email=u.email,
            name=u.name,
            role=u.role.value,
            roles=sorted(r.value for r in u.role_set()),
        )
        for u in rows
    ]
