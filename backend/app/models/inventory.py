"""人才盘点数据模型（spec talent-matching §3.1）。"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.types import UTCDateTime


class InventoryPurpose(str, enum.Enum):
    ANNUAL = "annual"
    SUCCESSION = "succession"
    SALARY = "salary"
    DEVELOPMENT = "development"


class BatchStatus(str, enum.Enum):
    DRAFT = "draft"
    CALIBRATING = "calibrating"
    CONFIRMING = "confirming"
    PUBLISHED = "published"


class Potential(str, enum.Enum):
    HIGH = "high"
    MID = "mid"
    LOW = "low"


class InventoryBatch(Base):
    """盘点批次：初排→校准→确认→发布。"""

    __tablename__ = "inventory_batches"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    name: Mapped[str] = mapped_column(String(128))
    purpose: Mapped[InventoryPurpose] = mapped_column(
        default=InventoryPurpose.ANNUAL
    )
    status: Mapped[BatchStatus] = mapped_column(default=BatchStatus.DRAFT)
    owner_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    scope_employee_ids: Mapped[list | None] = mapped_column(
        JSON, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)
    published_at: Mapped[datetime | None] = mapped_column(
        UTCDateTime, nullable=True
    )


class InventoryResult(Base):
    """批次内逐人结果：潜力人工评定，格码按业绩×潜力。"""

    __tablename__ = "inventory_results"
    __table_args__ = (
        UniqueConstraint("batch_id", "employee_id",
                         name="inventory_results_batch_employee_uc"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    batch_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("inventory_batches.id"), index=True
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("employees.id"), index=True
    )
    perf_label: Mapped[str | None] = mapped_column(String(4), nullable=True)
    ability_score: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    potential: Mapped[Potential | None] = mapped_column(nullable=True)
    potential_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, nullable=True
    )
    potential_at: Mapped[datetime | None] = mapped_column(
        UTCDateTime, nullable=True
    )
    grid_code: Mapped[str | None] = mapped_column(String(4), nullable=True)
    located: Mapped[bool] = mapped_column(Boolean, default=False)
    calibrate_note: Mapped[str | None] = mapped_column(Text, nullable=True)
