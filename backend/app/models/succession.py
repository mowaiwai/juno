"""核心岗位 / 继任候选 / 梯队池 数据模型（spec talent-matching §4.1）。

纯增量模块：不建岗位/部门主数据表，dept_id 沿用字符串。
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.types import UTCDateTime


class CandidateOrigin(str, enum.Enum):
    AUTO = "auto"
    MANUAL = "manual"


class Willingness(str, enum.Enum):
    UNCONFIRMED = "unconfirmed"
    WILLING = "willing"
    UNWILLING = "unwilling"


class PoolLevel(str, enum.Enum):
    L1 = "L1"
    L2 = "L2"
    L3 = "L3"


class PoolStatus(str, enum.Enum):
    ACTIVE = "active"
    GRADUATED = "graduated"
    EXITED = "exited"


class CorePosition(Base):
    """核心岗位清单：HR 手工维护，含在岗人、编制数与所属序列。"""

    __tablename__ = "core_positions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    name: Mapped[str] = mapped_column(String(128))
    dept_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    sequence: Mapped[str] = mapped_column(String(32))
    grade: Mapped[str] = mapped_column(String(32))
    headcount: Mapped[int] = mapped_column(Integer, default=1)
    incumbent_employee_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("employees.id"), nullable=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(Uuid)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)


class SuccessionCandidate(Base):
    """某核心岗位的继任候选：系统初筛或人工提名。"""

    __tablename__ = "succession_candidates"
    __table_args__ = (
        UniqueConstraint(
            "core_position_id", "employee_id",
            name="succession_candidates_position_employee_uc",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    core_position_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("core_positions.id"), index=True
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("employees.id"), index=True
    )
    origin: Mapped[CandidateOrigin] = mapped_column(default=CandidateOrigin.AUTO)
    willingness: Mapped[Willingness] = mapped_column(
        default=Willingness.UNCONFIRMED
    )
    willingness_confirmed_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, nullable=True
    )
    willingness_at: Mapped[datetime | None] = mapped_column(
        UTCDateTime, nullable=True
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)


class TalentPool(Base):
    """梯队池成员：按 L1/L2/L3 分级，可毕业或退出。"""

    __tablename__ = "talent_pools"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "employee_id", "pool_level",
            name="talent_pools_tenant_employee_level_uc",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("employees.id"), index=True
    )
    pool_level: Mapped[PoolLevel] = mapped_column(default=PoolLevel.L1)
    reason: Mapped[str] = mapped_column(Text)
    joined_by: Mapped[uuid.UUID] = mapped_column(Uuid)
    joined_at: Mapped[datetime] = mapped_column(UTCDateTime)
    status: Mapped[PoolStatus] = mapped_column(default=PoolStatus.ACTIVE)
