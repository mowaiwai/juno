"""绩效内生数据模型（P1，ADR-0015/0016）。

- PerfPlan：考核方案（周期/工具/显式名册/状态机）。
- PerfResult：方案内每人一条最终 SABC 结果（分数/系数/举证）。
- Pip：绩效改进计划（D 自动建档；结论终结；linked_adjust_id 为 P2 钩子）。
- CoachingRecord：轻量绩效辅导记录。

枚举一律以小写字符串落库（String 列 + Python enum），规避 PG 原生枚举漂移。
"""
import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    Date,
    Float,
    ForeignKey,
    JSON,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.types import GUIDList, UTCDateTime


class PerfToolType(str, enum.Enum):
    PBC = "pbc"
    KPI = "kpi"
    OKR = "okr"
    REVIEW_360 = "360"


class PerfPlanStatus(str, enum.Enum):
    DRAFT = "draft"
    EVALUATING = "evaluating"
    CALIBRATING = "calibrating"
    PUBLISHED = "published"


class PipStatus(str, enum.Enum):
    ACTIVE = "active"
    PASSED = "passed"
    FAILED = "failed"


# 发布时回写 employees.perf_grade 的工具（OKR/360 只沉淀结果，spec OQ-1）
WRITEBACK_TOOLS = frozenset({PerfToolType.PBC.value, PerfToolType.KPI.value})


class PerfPlan(Base):
    """考核方案：一个方案 = 一个周期 + 一种工具 + 一份显式名册快照。"""

    __tablename__ = "perf_plans"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    period: Mapped[str] = mapped_column(String(20))
    tool_type: Mapped[str] = mapped_column(String(8))
    status: Mapped[str] = mapped_column(
        String(16), default=PerfPlanStatus.DRAFT.value
    )
    # 名册快照：employee_id 列表（圈定后不随入离职自动变化，spec AS-2）
    roster: Mapped[list[uuid.UUID]] = mapped_column(GUIDList, default=list)
    # 名册圈定条件（部门 id 含子树 / 序列码），草稿期可据此重算候选并保留剔除
    scope_depts: Mapped[list] = mapped_column(JSON, default=list)
    scope_sequences: Mapped[list] = mapped_column(JSON, default=list)
    distribution_override_reason: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )
    published_at: Mapped[datetime | None] = mapped_column(
        UTCDateTime, nullable=True
    )


class PerfResult(Base):
    """方案内每名在册员工恰好一条最终结果。"""

    __tablename__ = "perf_results"
    __table_args__ = (
        UniqueConstraint(
            "plan_id", "employee_id", name="uq_perf_result_plan_employee"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    plan_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("perf_plans.id"), index=True
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("employees.id"), index=True
    )
    grade: Mapped[str] = mapped_column(String(2))
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    coefficient: Mapped[float] = mapped_column(Float)
    # 组织系数预留位（spec AS-7）：缺省 1.0，本期无写入入口
    org_coefficient: Mapped[float] = mapped_column(Float, default=1.0)
    evidence: Mapped[list] = mapped_column(JSON, default=list)
    entered_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=True
    )


class Pip(Base):
    """绩效改进计划：D 发布自动建档，COE 也可为 C 等手动建档。"""

    __tablename__ = "pips"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    perf_result_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("perf_results.id"), nullable=True, index=True
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("employees.id"), index=True
    )
    period: Mapped[str] = mapped_column(String(20))
    goals: Mapped[list] = mapped_column(JSON, default=list)
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(
        String(16), default=PipStatus.ACTIVE.value
    )
    conclusion: Mapped[str | None] = mapped_column(Text, nullable=True)
    concluded_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, nullable=True
    )
    concluded_at: Mapped[datetime | None] = mapped_column(
        UTCDateTime, nullable=True
    )
    # P2 降薪联动钩子：本期恒为空
    linked_adjust_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, nullable=True
    )


class CoachingRecord(Base):
    """轻量绩效辅导记录（四循环第二环）。"""

    __tablename__ = "coaching_records"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("employees.id"), index=True
    )
    plan_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("perf_plans.id"), nullable=True, index=True
    )
    content: Mapped[str] = mapped_column(Text)
    happened_at: Mapped[date] = mapped_column(Date)
    created_by: Mapped[uuid.UUID] = mapped_column(Uuid)
