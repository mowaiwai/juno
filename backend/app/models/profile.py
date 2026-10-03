"""人才画像数据模型（spec talent-matching §2.2）。

版本化七维快照：头表只追加、子表随版本聚合。
"""

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
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.types import UTCDateTime

# 维度展示顺序
DIMENSION_KEYS = (
    "basic",
    "biz",
    "contribution",
    "duty",
    "knowledge",
    "ability",
    "perf",
)


class ProfileSource(str, enum.Enum):
    MANUAL = "manual"
    CERT_WRITEBACK = "cert_writeback"
    INVENTORY_WRITEBACK = "inventory_writeback"


class DimensionStatus(str, enum.Enum):
    MEASURED = "measured"
    NO_DATA = "no_data"


class ProfileSnapshot(Base):
    """员工的一版完整画像；每次生成追加，永不覆盖。"""

    __tablename__ = "profile_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("employees.id"), index=True
    )
    version_seq: Mapped[int] = mapped_column(Integer)
    source: Mapped[ProfileSource] = mapped_column(default=ProfileSource.MANUAL)
    overall: Mapped[int | None] = mapped_column(Integer, nullable=True)
    generated_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    generated_at: Mapped[datetime] = mapped_column(UTCDateTime)

    dimensions: Mapped[list["ProfileDimension"]] = relationship(
        cascade="all, delete-orphan",
        order_by="ProfileDimension.id",
    )


class ProfileDimension(Base):
    """七维之一：status 区分实测/无数据，score 仅实测可算时存在。"""

    __tablename__ = "profile_dimensions"
    __table_args__ = (
        UniqueConstraint("profile_snapshot_id", "dimension_key",
                         name="profile_dimensions_snapshot_key_uc"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    profile_snapshot_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("profile_snapshots.id"), index=True
    )
    dimension_key: Mapped[str] = mapped_column(String(16))
    status: Mapped[DimensionStatus] = mapped_column(default=DimensionStatus.NO_DATA)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    grade_label: Mapped[str | None] = mapped_column(String(16), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_ref: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
