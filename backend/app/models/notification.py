import uuid
from datetime import datetime

from sqlalchemy import JSON, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.types import UTCDateTime


class Notification(Base):
    """站内通知。recipient 为员工；payload 携带事件数据与行动指引。"""

    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    recipient_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("employees.id"), index=True
    )
    # task_assigned / manager_review_approved / manager_review_rejected /
    # decision_approved / decision_rejected / decision_published / review_reminder
    type: Mapped[str] = mapped_column(String(64))
    title: Mapped[str] = mapped_column(String(200))
    payload: Mapped[dict] = mapped_column(JSON)
    read_at: Mapped[datetime | None] = mapped_column(
        UTCDateTime, nullable=True
    )
