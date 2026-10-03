"""人岗匹配 / 差距分析数据模型（Module C）。

基于画像七维与绩效等级，识别员工与岗位标准之间的差距，
输出维度、严重度、改进动作与优先级，供团队看板与个人 IDP 联动使用。
"""

import enum
import uuid

from sqlalchemy import ForeignKey, Integer, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class GapDimension(str, enum.Enum):
    PERF = "perf"
    DUTY = "duty"
    ABILITY = "ability"
    CONTRIBUTION = "contribution"
    KNOWLEDGE = "knowledge"


class GapAction(str, enum.Enum):
    PERF_IMPROVEMENT = "perf_improvement"
    PROCESS_SUPERVISION = "process_supervision"
    BEHAVIOR_IMPROVE = "behavior_improve"
    TEAM_CONTRIBUTION = "team_contribution"
    LEARN_KNOWLEDGE = "learn_knowledge"


class GapSeverity(str, enum.Enum):
    HIGH = "HIGH"
    MID = "MID"
    LOW = "LOW"


class Gap(Base):
    """员工-岗位差距记录：一次差距分析后逐人逐维度写入。"""

    __tablename__ = "gaps"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("employees.id"), index=True
    )
    dimension: Mapped[GapDimension] = mapped_column()
    detail: Mapped[str] = mapped_column(Text)
    standard: Mapped[str] = mapped_column(Text)
    current: Mapped[str] = mapped_column(Text)
    severity: Mapped[GapSeverity] = mapped_column()
    action: Mapped[GapAction] = mapped_column()
    priority: Mapped[int] = mapped_column(Integer)
    batch_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("inventory_batches.id"), nullable=True
    )
