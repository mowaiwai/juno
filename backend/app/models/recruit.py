"""招聘面试数据模型。

在招需求、候选人管道、面试题库（履职表即题库）。
面试题来源：manual（人工）/ standard（履职表转制）/ ai（AI 生成待审核）。
"""

import enum
import uuid
from datetime import date

from sqlalchemy import ForeignKey, Integer, JSON, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class CandStage(str, enum.Enum):
    SCREEN = "screen"        # 简历初筛
    FIRST = "first"          # 初试
    FINAL = "final"          # 复试
    OFFER = "offer"          # Offer
    ONBOARD = "onboard"      # 已入职
    REJECTED = "rejected"    # 已淘汰


class QuestionSource(str, enum.Enum):
    MANUAL = "manual"
    STANDARD = "standard"
    AI = "ai"


class QuestionStatus(str, enum.Enum):
    APPROVED = "approved"
    PENDING_REVIEW = "pending_review"
    REJECTED = "rejected"


class Requisition(Base):
    """在招需求。"""

    __tablename__ = "requisitions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    position: Mapped[str] = mapped_column(String(128))
    dept_id: Mapped[str] = mapped_column(String(32))
    grade: Mapped[str] = mapped_column(String(32))
    headcount: Mapped[int] = mapped_column(Integer, default=1)
    # 漏斗：简历 → 初筛 → 初试 → 复试 → offer
    funnel: Mapped[list] = mapped_column(JSON, default=list)
    owner: Mapped[str] = mapped_column(String(64))
    priority: Mapped[str] = mapped_column(String(8), default="mid")
    opened_at: Mapped[date] = mapped_column(String(32))


class Candidate(Base):
    """候选人。"""

    __tablename__ = "candidates"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    req_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("requisitions.id"), index=True
    )
    name: Mapped[str] = mapped_column(String(64))
    stage: Mapped[CandStage] = mapped_column(default=CandStage.SCREEN)
    source: Mapped[str] = mapped_column(String(64))
    match_score: Mapped[int] = mapped_column(Integer, default=0)
    years: Mapped[int] = mapped_column(Integer, default=0)
    last_title: Mapped[str] = mapped_column(String(128))
    expected_salary: Mapped[int] = mapped_column(Integer, default=0)
    rating: Mapped[float | None] = mapped_column(nullable=True)
    tags: Mapped[list] = mapped_column(JSON, default=list)
    applied_at: Mapped[str] = mapped_column(String(32))


class InterviewQuestion(Base):
    """面试题。履职表即题库，四维度（1 履职 / 2 知识 / 3 能力 / 4 业绩）。"""

    __tablename__ = "interview_questions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    dimension: Mapped[int] = mapped_column(Integer)  # 1-4
    position: Mapped[str] = mapped_column(String(128))
    grade: Mapped[str] = mapped_column(String(32))
    question: Mapped[str] = mapped_column(Text)
    answer_point: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[QuestionSource] = mapped_column(default=QuestionSource.MANUAL)
    status: Mapped[QuestionStatus] = mapped_column(default=QuestionStatus.APPROVED)
    created_by: Mapped[uuid.UUID] = mapped_column(Uuid)


class InterviewRecord(Base):
    """面试记录。"""

    __tablename__ = "interview_records"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("candidates.id"), index=True
    )
    req_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("requisitions.id"), nullable=True
    )
    interviewer_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    dimension_scores: Mapped[list] = mapped_column(JSON, default=list)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    rating: Mapped[float | None] = mapped_column(nullable=True)
    stage: Mapped[str] = mapped_column(String(16))
