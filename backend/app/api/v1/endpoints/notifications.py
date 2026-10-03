import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import err, get_current_user
from app.database import get_db
from app.models.employee import Employee
from app.models.notification import Notification
from app.models.user import User

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _current_employee(db: Session, user: User) -> Employee:
    employee = db.scalar(select(Employee).where(Employee.user_id == user.id))
    if employee is None:
        raise err(422, "no_employee_profile", "当前账号缺少员工档案")
    return employee


class NotificationOut(BaseModel):
    id: uuid.UUID
    type: str
    title: str
    payload: dict
    read_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    employee = _current_employee(db, user)
    return db.scalars(
        select(Notification)
        .where(Notification.recipient_id == employee.id)
        .order_by(Notification.created_at.desc())
    ).all()


@router.get("/unread-count")
def unread_count(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    employee = _current_employee(db, user)
    count = db.scalar(
        select(func.count(Notification.id)).where(
            Notification.recipient_id == employee.id,
            Notification.read_at.is_(None),
        )
    )
    return {"count": int(count or 0)}


@router.post("/{notification_id}/read", response_model=NotificationOut)
def mark_read(
    notification_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    employee = _current_employee(db, user)
    notification = db.scalar(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.recipient_id == employee.id,
        )
    )
    if notification is None:
        raise err(404, "not_found", "通知不存在")

    if notification.read_at is None:
        notification.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(notification)
    return notification
