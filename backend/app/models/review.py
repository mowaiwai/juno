import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.types import GUIDList, UTCDateTime


class ReviewPanelTemplate(Base):
    """按序列配置的评审小组模板：1 组长 + 2 评委。

    reviewer_ids 以 JSON 数组存储（跨 SQLite/PostgreSQL 兼容；
    PostgreSQL 原生 uuid[] 的收益在当前规模下可忽略）。
    """

    __tablename__ = "review_panel_templates"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    sequence: Mapped[str] = mapped_column(String(32), index=True)
    lead_reviewer_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("employees.id")
    )
    reviewer_ids: Mapped[list] = mapped_column(GUIDList)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class ReviewTask(Base):
    """派给单个成员的评审任务。每申请生成 3 条（2 reviewer + 1 lead）。"""

    __tablename__ = "review_tasks"
    __table_args__ = (
        UniqueConstraint("application_id", "assignee_id",
                         name="review_tasks_application_assignee_uc"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("applications.id"), index=True
    )
    assignee_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("employees.id"), index=True
    )
    role: Mapped[str] = mapped_column(String(16))  # reviewer / lead
    opinion: Mapped[str | None] = mapped_column(Text, nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(
        UTCDateTime, nullable=True
    )
