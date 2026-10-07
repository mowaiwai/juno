"""P3 远期激励与问卷模型。

- IncentiveRecord：津贴福利 / 股权 / 荣誉表彰（统一表，category 区分）。
- Questionnaire：盘点/能力测评/敬业度问卷（AI 生成题目）。
"""
import enum
import uuid
from datetime import date

from sqlalchemy import Date, Float, JSON, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class IncentiveCategory(str, enum.Enum):
    BENEFIT = "benefit"   # 津贴福利
    EQUITY = "equity"     # 股权
    HONOR = "honor"       # 荣誉表彰


class IncentiveStatus(str, enum.Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    REVOKED = "revoked"


class IncentiveRecord(Base):
    """激励记录（津贴福利/股权/荣誉表彰统一表）。"""

    __tablename__ = "incentive_records"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    category: Mapped[str] = mapped_column(String(16), index=True)
    item_name: Mapped[str] = mapped_column(String(128))
    amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    currency: Mapped[str | None] = mapped_column(String(8), default="CNY")
    granted_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    effective_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default=IncentiveStatus.ACTIVE.value)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)


class QuestionnaireType(str, enum.Enum):
    INVENTORY = "inventory"
    COMPETENCY = "competency"
    ENGAGEMENT = "engagement"


class Questionnaire(Base):
    """问卷（盘点/能力测评/敬业度，AI 生成）。"""

    __tablename__ = "questionnaires"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    title: Mapped[str] = mapped_column(String(256))
    q_type: Mapped[str] = mapped_column(String(16))
    questions: Mapped[list] = mapped_column(JSON, default=list)
    source: Mapped[str] = mapped_column(String(16), default="ai_generated")
    status: Mapped[str] = mapped_column(String(16), default="draft")
    created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
