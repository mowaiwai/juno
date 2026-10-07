"""SaaS 运营模块数据模型。

- BillingPlan：平台套餐目录（免费/标准/专业/企业）。
- BillingBill：租户月度账单（席位费 + AI 用量费）。
- TemplatePack：平台模板市场目录（行业任职资格包）。
- TenantTemplate：租户模板安装记录（pack_id + active）。
- SaasConfigItem：配置中心条目（模板默认值 + 租户覆盖值 + 状态）。
"""
import enum
import uuid

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class BillStatus(str, enum.Enum):
    PAID = "paid"
    PENDING = "pending"
    OVERDUE = "overdue"


class ConfigStatus(str, enum.Enum):
    ACTIVE = "active"
    DRAFT = "draft"


class BillingPlan(Base):
    """平台套餐目录（平台级，无 tenant_id）。"""

    __tablename__ = "billing_plans"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(32), unique=True)
    scope: Mapped[str] = mapped_column(Text, default="")
    billing: Mapped[str] = mapped_column(String(128), default="")
    price: Mapped[str] = mapped_column(String(32), default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class BillingBill(Base):
    """租户月度账单。"""

    __tablename__ = "billing_bills"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    period: Mapped[str] = mapped_column(String(7))  # YYYY-MM
    plan_name: Mapped[str] = mapped_column(String(32))
    seats: Mapped[int] = mapped_column(Integer, default=0)
    seat_cost: Mapped[float] = mapped_column(Float, default=0)
    ai_cost: Mapped[float] = mapped_column(Float, default=0)
    total: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[str] = mapped_column(String(16), default=BillStatus.PENDING.value)


class TemplatePack(Base):
    """平台模板市场目录（平台级）。"""

    __tablename__ = "template_packs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(128))
    industry: Mapped[str] = mapped_column(String(32))
    version: Mapped[str] = mapped_column(String(16))
    standards_count: Mapped[int] = mapped_column(Integer, default=0)
    rating: Mapped[float] = mapped_column(Float, default=5.0)
    installs: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(8), default="on")  # on / off
    desc: Mapped[str] = mapped_column(Text, default="")


class TenantTemplate(Base):
    """租户模板安装记录。"""

    __tablename__ = "tenant_templates"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    pack_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class PlatformMonthlyMetric(Base):
    """平台月度运营指标快照（MRR、新增租户等），用于运营看板趋势图。"""

    __tablename__ = "platform_monthly_metrics"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    month: Mapped[str] = mapped_column(String(7), unique=True)  # YYYY-MM
    mrr: Mapped[float] = mapped_column(Float, default=0)  # 单位：元
    new_tenants: Mapped[int] = mapped_column(Integer, default=0)


class SaasConfigItem(Base):
    """配置中心条目：模板默认值 + 租户覆盖值。"""

    __tablename__ = "saas_config_items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    group: Mapped[str] = mapped_column(String(64))
    template_value: Mapped[str] = mapped_column(Text, default="")
    override_value: Mapped[str] = mapped_column(Text, default="")
    note: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(16), default=ConfigStatus.ACTIVE.value)
