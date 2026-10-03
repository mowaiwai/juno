"""IDP 个人发展计划数据模型。

员工季度 / 管理者半年，基于画像差距生成发展目标与关键行为计划。
状态流转：draft → confirmed → reviewing → closed。
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Integer, JSON, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.types import UTCDateTime


class IDPStatus(str, enum.Enum):
    DRAFT = "draft"
    CONFIRMED = "confirmed"
    REVIEWING = "reviewing"
    CLOSED = "closed"


class IDPPeriodType(int, enum.Enum):
    EMPLOYEE_QUARTERLY = 1
    MANAGER_SEMIANNUAL = 2


class IDP(Base):
    """个人发展计划头表。"""

    __tablename__ = "idps"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("employees.id"), index=True
    )
    period: Mapped[str] = mapped_column(String(32))
    period_type: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[IDPStatus] = mapped_column(default=IDPStatus.DRAFT)
    goals: Mapped[list] = mapped_column(JSON, default=list)
    key_behaviors: Mapped[list] = mapped_column(JSON, default=list)
    review_result: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(Uuid)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
