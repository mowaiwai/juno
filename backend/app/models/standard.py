import enum
import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Numeric, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.types import UTCDateTime


class StandardStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class StandardSet(Base):
    __tablename__ = "standard_sets"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    sequence: Mapped[str] = mapped_column(String(32), index=True)
    target_grade: Mapped[str] = mapped_column(String(32))
    version: Mapped[int] = mapped_column(default=1)
    status: Mapped[StandardStatus] = mapped_column(default=StandardStatus.DRAFT)
    published_at: Mapped[datetime | None] = mapped_column(
        UTCDateTime, nullable=True
    )

    items: Mapped[list["StandardItem"]] = relationship(
        back_populates="standard_set",
        cascade="all, delete-orphan",
        order_by="StandardItem.sort_order",
    )


class StandardItem(Base):
    __tablename__ = "standard_items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    standard_set_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("standard_sets.id"), index=True
    )
    code: Mapped[str] = mapped_column(String(64))
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    requirement: Mapped[str] = mapped_column(Text)
    weight: Mapped[float] = mapped_column(Numeric(5, 2))
    sort_order: Mapped[int] = mapped_column(default=0)

    standard_set: Mapped[StandardSet] = relationship(back_populates="items")


# 快照模型随 standard 模块一起导出（申请评审读快照）
from app.models.standard_snapshot import StandardSnapshot  # noqa: E402,F401
