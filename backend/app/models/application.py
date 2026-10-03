import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    Uuid,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.types import UTCDateTime


class ApplicationStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    IN_MANAGER_REVIEW = "in_manager_review"
    IN_COMMITTEE_REVIEW = "in_committee_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    PUBLISHED = "published"


class SelfLevel(str, enum.Enum):
    MET = "met"
    PARTIALLY_MET = "partially_met"
    NOT_MET = "not_met"


class Application(Base):
    """认证申请单。"""

    __tablename__ = "applications"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("employees.id"), index=True
    )
    target_sequence: Mapped[str] = mapped_column(String(32))
    target_grade: Mapped[str] = mapped_column(String(32))
    standard_set_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("standard_sets.id")
    )
    status: Mapped[ApplicationStatus] = mapped_column(default=ApplicationStatus.DRAFT)
    previous_application_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("applications.id"), nullable=True
    )
    submit_count: Mapped[int] = mapped_column(Integer, default=0)
    # 提交时快照直属经理与初审截止
    manager_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("employees.id"), nullable=True
    )
    manager_deadline_at: Mapped[datetime | None] = mapped_column(
        UTCDateTime, nullable=True
    )

    submitted_at: Mapped[datetime | None] = mapped_column(
        UTCDateTime, nullable=True
    )
    manager_reviewed_at: Mapped[datetime | None] = mapped_column(
        UTCDateTime, nullable=True
    )
    decided_at: Mapped[datetime | None] = mapped_column(
        UTCDateTime, nullable=True
    )
    published_at: Mapped[datetime | None] = mapped_column(
        UTCDateTime, nullable=True
    )

    # 申请级评审悲观锁（Q3）：任一成员认领后整单锁 30 分钟
    review_locked_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("employees.id"), nullable=True
    )
    review_locked_until: Mapped[datetime | None] = mapped_column(
        UTCDateTime, nullable=True
    )

    self_assessments: Mapped[list["SelfAssessment"]] = relationship(
        back_populates="application", cascade="all, delete-orphan"
    )
    evidences: Mapped[list["Evidence"]] = relationship(
        back_populates="application", cascade="all, delete-orphan"
    )
    manager_review: Mapped["ManagerReview | None"] = relationship(
        back_populates="application", uselist=False, cascade="all, delete-orphan"
    )
    decision: Mapped["Decision | None"] = relationship(
        back_populates="application", uselist=False, cascade="all, delete-orphan"
    )


class Decision(Base):
    """评审组长终裁记录。每单唯一一条，决定最终结论。"""

    __tablename__ = "decisions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("applications.id"), unique=True, index=True
    )
    decision: Mapped[str] = mapped_column(String(16))  # approved / rejected
    comment: Mapped[str] = mapped_column(Text)
    interview_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_suggestion_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("ai_suggestions.id"), nullable=True
    )
    reviewer_id: Mapped[uuid.UUID] = mapped_column(Uuid)

    application: Mapped[Application] = relationship(back_populates="decision")


class ManagerReview(Base):
    """经理初审记录。每单唯一一条。"""

    __tablename__ = "manager_reviews"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("applications.id"), unique=True, index=True
    )
    decision: Mapped[str] = mapped_column(String(16))  # approved / rejected
    reject_category: Mapped[str | None] = mapped_column(String(64), nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewer_id: Mapped[uuid.UUID] = mapped_column(Uuid)

    application: Mapped[Application] = relationship(
        back_populates="manager_review"
    )


class SelfAssessment(Base):
    """履职表自评，随申请单，无独立流程。"""

    __tablename__ = "self_assessments"
    __table_args__ = (
        UniqueConstraint("application_id", "standard_item_code"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("applications.id"), index=True
    )
    standard_item_code: Mapped[str] = mapped_column(String(64))
    self_level: Mapped[SelfLevel]
    self_comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    application: Mapped[Application] = relationship(
        back_populates="self_assessments"
    )


class Evidence(Base):
    """举证附件。"""

    __tablename__ = "evidences"
    __table_args__ = (
        CheckConstraint(
            "mime_type IN ('image/jpeg','image/png','application/pdf')",
            name="evidence_mime_type_check",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("applications.id"), index=True
    )
    standard_item_code: Mapped[str] = mapped_column(String(64), index=True)
    file_name: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(64))
    size_bytes: Mapped[int] = mapped_column(Integer)
    storage_path: Mapped[str] = mapped_column(String(512))
    uploaded_by: Mapped[uuid.UUID] = mapped_column(Uuid)

    application: Mapped[Application] = relationship(back_populates="evidences")
