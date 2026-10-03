"""在线考试模型：试卷 / 题目 / 考试记录（attempt）。

MVP 约定：题目全部为四选一单选（single_choice），保证 AI 出题与自动判分确定可靠；
填空/问答题型延后。试卷状态机：AI 组卷 → pending_review → published / rejected。
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Integer, JSON, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, _utcnow
from app.models.types import UTCDateTime


class PaperStatus(str, enum.Enum):
    PENDING_REVIEW = "pending_review"
    PUBLISHED = "published"
    REJECTED = "rejected"


class AttemptStatus(str, enum.Enum):
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"


class ExamPaper(Base):
    __tablename__ = "exam_papers"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    title: Mapped[str] = mapped_column(String(128))
    description: Mapped[str] = mapped_column(Text, default="")
    # 组卷面向的岗位/序列/职级（作为 AI 出题上下文）
    target_position: Mapped[str] = mapped_column(String(128), default="")
    target_sequence: Mapped[str] = mapped_column(String(32), default="")
    target_grade: Mapped[str] = mapped_column(String(32), default="")

    status: Mapped[PaperStatus] = mapped_column(
        String(16), default=PaperStatus.PENDING_REVIEW
    )
    source: Mapped[str] = mapped_column(String(8), default="ai")  # ai / manual
    model: Mapped[str | None] = mapped_column(String(64), nullable=True)

    duration_minutes: Mapped[int] = mapped_column(Integer, default=60)
    pass_score: Mapped[int] = mapped_column(Integer, default=60)
    total_score: Mapped[int] = mapped_column(Integer, default=0)
    reject_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_by: Mapped[uuid.UUID] = mapped_column(Uuid)
    published_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)

    questions: Mapped[list["ExamQuestion"]] = relationship(
        back_populates="paper",
        cascade="all, delete-orphan",
        order_by="ExamQuestion.sort_order",
    )


class ExamQuestion(Base):
    __tablename__ = "exam_questions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    paper_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("exam_papers.id"), index=True
    )
    sort_order: Mapped[int] = mapped_column(Integer)
    type: Mapped[str] = mapped_column(String(16), default="single_choice")
    stem: Mapped[str] = mapped_column(Text)
    options: Mapped[list[str]] = mapped_column(JSON)
    # 正确选项下标 0-3；判分用，开始考试时不下发
    answer_index: Mapped[int] = mapped_column(Integer)
    score: Mapped[int] = mapped_column(Integer, default=10)
    analysis: Mapped[str] = mapped_column(Text, default="")

    paper: Mapped[ExamPaper] = relationship(back_populates="questions")


class ExamAttempt(Base):
    __tablename__ = "exam_attempts"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    paper_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("exam_papers.id"), index=True
    )
    examinee_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("employees.id"), index=True
    )

    status: Mapped[AttemptStatus] = mapped_column(
        String(16), default=AttemptStatus.IN_PROGRESS
    )
    # {question_id(str): option_index(int)}
    answers: Mapped[dict] = mapped_column(JSON, default=dict)
    score: Mapped[int] = mapped_column(Integer, default=0)
    total_score: Mapped[int] = mapped_column(Integer, default=0)
    passed: Mapped[bool] = mapped_column(Boolean, default=False)

    started_at: Mapped[datetime] = mapped_column(UTCDateTime, default=_utcnow)
    submitted_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
