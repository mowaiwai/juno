"""岗位价值评估模型（模块八 P3，spec PRD §模块八 / 端到端数据流 1）。

采用点因素法：知识技能 / 责任 / 工作复杂度 / 工作条件 / 管理沟通 五个维度，
每维度 1–5 级评分 × 权重，总分映射职级。评估结果为定薪提供客观依据。
"""
import enum
import uuid

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class JobEvalStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"


# 点因素法五维度及默认权重（权重和 = 1.0）
DEFAULT_FACTORS = [
    {"key": "knowledge", "name": "知识与技能", "weight": 0.25},
    {"key": "responsibility", "name": "责任", "weight": 0.25},
    {"key": "complexity", "name": "工作复杂度", "weight": 0.20},
    {"key": "conditions", "name": "工作条件", "weight": 0.10},
    {"key": "impact", "name": "管理与沟通影响", "weight": 0.20},
]


class JobEvaluation(Base):
    """岗位价值评估记录。"""

    __tablename__ = "job_evaluations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    position_name: Mapped[str] = mapped_column(String(128))
    dept_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # 因素评分：[{"key":"knowledge","score":4,"weight":0.25}, ...]
    factor_scores: Mapped[list] = mapped_column(JSON, default=list)
    total_score: Mapped[float] = mapped_column(Float, default=0)
    # 映射职级（如 P3 / M2），由总分区间表或人工指定
    grade: Mapped[str | None] = mapped_column(String(16), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default=JobEvalStatus.DRAFT.value)
    notes: Mapped[str] = mapped_column(Text, default="")
    evaluated_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    evaluated_at: Mapped[DateTime | None] = mapped_column(DateTime, nullable=True)
