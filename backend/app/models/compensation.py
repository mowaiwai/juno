"""薪酬激励数据模型（P2，ADR-0016）。

- TenantSalaryBand：租户薪级带宽 + 市场分位（P25/P50/P75/P90）。
- SalaryAdjustmentHistory：调薪历史（旧薪/新薪/生效日/来源方案）。
- AdjustmentPlan：年度调薪方案（矩阵建议→高管批准→写 base_salary）。
- BonusPlan：绩效奖金方案（周期/奖金包/状态机）。
- BonusPlanItem：奖金发放明细（目标/系数/公式应发/缩放比/实发）。
- BonusDeptPool：部门奖金包（预切/微调留痕）。

金额用 Numeric(14,2)；枚举以字符串落库，不建 PG 原生枚举。
created_at/updated_at 由 Base 统一提供。
"""
import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.types import UTCDateTime


class BonusPlanStatus(str, enum.Enum):
    DRAFT = "draft"
    CALCULATED = "calculated"
    APPROVING = "approving"
    APPROVED = "approved"
    ARCHIVED = "archived"


class AdjustmentPlanStatus(str, enum.Enum):
    DRAFT = "draft"
    APPROVING = "approving"
    APPROVED = "approved"


class TenantSalaryBand(Base):
    __tablename__ = "tenant_salary_bands"
    __table_args__ = (
        UniqueConstraint("tenant_id", "grade", name="tsb_tenant_grade_uc"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    grade: Mapped[str] = mapped_column(String(32))
    min_value: Mapped[int] = mapped_column(Integer)
    max_value: Mapped[int] = mapped_column(Integer)
    # 市场分位（P2 新增，可空，缺省无市场数据）
    p25: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    p50: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    p75: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    p90: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    market_source_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=True
    )


class SalaryAdjustmentHistory(Base):
    """调薪历史：每次 base_salary 变更留痕（调薪方案批准/PIP 降薪等）。"""

    __tablename__ = "salary_adjustment_history"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("employees.id"), index=True
    )
    old_salary: Mapped[int] = mapped_column(Integer)
    new_salary: Mapped[int] = mapped_column(Integer)
    effective_date: Mapped[date] = mapped_column(Date)
    source_plan_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, nullable=True, index=True
    )
    source_type: Mapped[str] = mapped_column(String(32), default="adjustment")
    operator_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=True
    )


class AdjustmentPlan(Base):
    """年度调薪方案：基于矩阵测算建议，经高管批准后写 base_salary。"""

    __tablename__ = "adjustment_plans"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    perf_plan_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("perf_plans.id"), nullable=True, index=True
    )
    plan_name: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(
        String(16), default=AdjustmentPlanStatus.DRAFT.value
    )
    # 建议明细 JSON：[{employee_id, current_salary, suggested_pct, suggested_salary,
    #                 stop_market, pip_fail}]
    items: Mapped[list] = mapped_column(JSON, default=list)
    # 微调审计 JSON：[{employee_id, old_pct, new_pct, operator_id, at}]
    adjustments: Mapped[list] = mapped_column(JSON, default=list)
    reject_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=True
    )


class BonusPlan(Base):
    """绩效奖金方案：取已发布 KPI/PBC 周期结果测算，经高管批准后发放。"""

    __tablename__ = "bonus_plans"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    perf_plan_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("perf_plans.id"), index=True
    )
    plan_name: Mapped[str] = mapped_column(String(100))
    bonus_pool_total: Mapped[float] = mapped_column(Numeric(14, 2))
    proration_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    scope_depts: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(
        String(16), default=BonusPlanStatus.DRAFT.value
    )
    reject_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=True
    )


class BonusPlanItem(Base):
    """奖金发放明细：每人目标/系数/公式应发/缩放比/实发。"""

    __tablename__ = "bonus_plan_items"
    __table_args__ = (
        UniqueConstraint(
            "plan_id", "employee_id", name="uq_bonus_item_plan_employee"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    plan_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("bonus_plans.id"), index=True
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("employees.id"), index=True
    )
    target_bonus: Mapped[float] = mapped_column(Numeric(14, 2))
    perf_coefficient: Mapped[float] = mapped_column(Numeric(4, 2))
    org_coefficient: Mapped[float] = mapped_column(Numeric(4, 2), default=1.0)
    service_months: Mapped[float | None] = mapped_column(Numeric(3, 1), nullable=True)
    formula_amount: Mapped[float] = mapped_column(Numeric(14, 2))
    dept_pool_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("bonus_dept_pools.id"), nullable=True, index=True
    )
    scale_ratio: Mapped[float] = mapped_column(Numeric(6, 4), default=1.0)
    final_amount: Mapped[float] = mapped_column(Numeric(14, 2))
    excluded_reason: Mapped[str | None] = mapped_column(String(64), nullable=True)


class BonusDeptPool(Base):
    """部门奖金包：按目标基数占比预切，可微调留痕。"""

    __tablename__ = "bonus_dept_pools"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    plan_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("bonus_plans.id"), index=True
    )
    dept_id: Mapped[str] = mapped_column(String(32))
    target_sum: Mapped[float] = mapped_column(Numeric(14, 2))
    formula_sum: Mapped[float] = mapped_column(Numeric(14, 2))
    pool_amount: Mapped[float] = mapped_column(Numeric(14, 2))
    adjust_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
