"""SaaS 运营模块 Pydantic 模型。"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

BillStatus = Literal["paid", "pending", "overdue"]
ConfigStatus = Literal["active", "draft"]


# ---------- 套餐 ----------
class PlanOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    scope: str
    billing: str
    price: str
    sort_order: int


# ---------- 账单 ----------
class BillCreate(BaseModel):
    period: str = Field(pattern=r"^\d{4}-\d{2}$")
    plan_name: str = Field(max_length=32)
    seats: int = Field(default=0, ge=0)
    seat_cost: float = Field(default=0, ge=0)
    ai_cost: float = Field(default=0, ge=0)
    total: float = Field(default=0, ge=0)
    status: BillStatus = "pending"


class BillUpdate(BaseModel):
    seats: int | None = Field(default=None, ge=0)
    seat_cost: float | None = Field(default=None, ge=0)
    ai_cost: float | None = Field(default=None, ge=0)
    total: float | None = Field(default=None, ge=0)
    status: BillStatus | None = None


class BillOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    period: str
    plan_name: str
    seats: int
    seat_cost: float
    ai_cost: float
    total: float
    status: BillStatus


# ---------- AI 用量 ----------
class AiUsageOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    created_at: datetime
    scene: str
    model: str
    input_tokens: int
    output_tokens: int
    cost: float
    operator: str | None


class AiQuotaOut(BaseModel):
    monthly_token_quota: int
    month_used_tokens: int
    month_calls: int
    month_cost: float
    over_strategy: str
    usage_pct: int


class AiTrendPoint(BaseModel):
    month: str
    tokens: float  # 百万
    cost: float


# ---------- 模板市场 ----------
class TemplatePackOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    industry: str
    version: str
    standards_count: int
    rating: float
    installs: int
    status: str
    desc: str
    installed: bool = False
    active: bool = False


# ---------- 配置中心 ----------
class ConfigItemUpdate(BaseModel):
    override_value: str | None = None
    note: str | None = None
    status: ConfigStatus | None = None


class ConfigItemOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    group: str
    template_value: str
    override_value: str
    note: str
    status: ConfigStatus
    customized: bool
    updated_at: datetime


# ---------- 平台运营 ----------
class TenantOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    status: str
    industry: str | None
    plan_name: str | None
    seats: int
    mrr: float
    health: int
    joined_at: str | None


class TenantUpdate(BaseModel):
    status: Literal["active", "trial", "suspended"] | None = None
    plan_name: str | None = None
    seats: int | None = Field(default=None, ge=0)
    health: int | None = Field(default=None, ge=0, le=100)


class MrrTrendPoint(BaseModel):
    month: str
    mrr: float  # 元
    new_tenants: int


class PlatformDashboard(BaseModel):
    total_tenants: int
    paying_tenants: int
    trial_tenants: int
    suspended: int
    mrr: float
    paid_seats: int
    new_tenants_this_month: int
    trial_conversion: int
    mrr_trend: list[MrrTrendPoint]
    industry_dist: list[dict]
    plan_dist: list[dict]
    risky_tenants: list[TenantOut]
