import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import get_current_user
from app.models.employee import Employee
from app.models.user import User
from app.database import get_db

router = APIRouter(tags=["me"])


class MeResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    email: str
    name: str
    role: str
    roles: list[str]
    employee_id: uuid.UUID | None = None
    family: str | None = None
    grade: str | None = None


@router.get("/me", response_model=MeResponse)
def read_me(user: User = Depends(get_current_user), db=Depends(get_db)):
    emp = db.scalar(
        select(Employee).where(Employee.user_id == user.id)
    )
    return MeResponse(
        id=user.id,
        tenant_id=user.tenant_id,
        email=user.email,
        name=user.name,
        role=user.role.value,
        roles=sorted(r.value for r in user.role_set()),
        employee_id=emp.id if emp else None,
        family=emp.family if emp else None,
        grade=emp.grade if emp else None,
    )
