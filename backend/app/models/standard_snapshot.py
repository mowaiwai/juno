import enum
import uuid

from sqlalchemy import ForeignKey, JSON, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class StandardSnapshot(Base):
    """申请提交时锁定的标准整版快照，评审全程只读此快照。"""

    __tablename__ = "standard_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("applications.id"), unique=True, index=True
    )
    standard_set_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    payload: Mapped[dict] = mapped_column(JSON)
