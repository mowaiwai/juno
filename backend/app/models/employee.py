import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, ForeignKey, JSON, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.types import UTCDateTime


class Employee(Base):
    """员工 HR 档案。与登录账号 User 一对一。"""

    __tablename__ = "employees"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), unique=True, index=True
    )
    employee_no: Mapped[str] = mapped_column(String(32))
    name: Mapped[str] = mapped_column(String(64))
    dept_id: Mapped[str] = mapped_column(String(32))
    position: Mapped[str] = mapped_column(String(128))
    family: Mapped[str] = mapped_column(String(8))
    sequence: Mapped[str] = mapped_column(String(32))
    grade: Mapped[str] = mapped_column(String(32))
    grade_since: Mapped[date] = mapped_column(Date)
    perf_grade: Mapped[str | None] = mapped_column(String(4), nullable=True)
    manager_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("employees.id"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # C1：基本条件补录（客观可核验事实）
    education: Mapped[str | None] = mapped_column(String(32), nullable=True)
    certificates: Mapped[list] = mapped_column(JSON, default=list)
    basic_updated_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, nullable=True
    )
    basic_updated_at: Mapped[datetime | None] = mapped_column(
        UTCDateTime, nullable=True
    )
