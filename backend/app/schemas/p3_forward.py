"""P3 远期能力 Schemas：岗位价值评估 / 激励记录 / 问卷。"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


# ============================================================================
# 岗位价值评估
# ============================================================================

JobEvalStatus = Literal["draft", "published"]


class FactorScoreIn(BaseModel):
    key: str
    score: int = Field(ge=1, le=5)
    weight: float = Field(ge=0, le=1)


class JobEvalCreate(BaseModel):
    position_name: str = Field(max_length=128)
    dept_id: str | None = None
    factor_scores: list[FactorScoreIn]
    grade: str | None = None
    notes: str = ""


class JobEvalUpdate(BaseModel):
    position_name: str | None = None
    dept_id: str | None = None
    factor_scores: list[FactorScoreIn] | None = None
    grade: str | None = None
    notes: str | None = None
    status: JobEvalStatus | None = None


class FactorScoreOut(BaseModel):
    key: str
    score: int
    weight: float
    name: str = ""
    weighted: float = 0


class JobEvalOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    tenant_id: uuid.UUID
    position_name: str
    dept_id: str | None
    factor_scores: list
    total_score: float
    grade: str | None
    status: str
    notes: str
    evaluated_by: uuid.UUID | None
    evaluated_at: datetime | None


# ============================================================================
# 激励记录（津贴福利/股权/荣誉）
# ============================================================================

IncentiveCategory = Literal["benefit", "equity", "honor"]
IncentiveStatus = Literal["active", "expired", "revoked"]


class IncentiveCreate(BaseModel):
    employee_id: uuid.UUID
    category: IncentiveCategory
    item_name: str = Field(max_length=128)
    amount: float | None = None
    currency: str | None = "CNY"
    granted_at: date | None = None
    effective_from: date | None = None
    effective_to: date | None = None
    note: str = ""


class IncentiveUpdate(BaseModel):
    item_name: str | None = None
    amount: float | None = None
    currency: str | None = None
    granted_at: date | None = None
    effective_from: date | None = None
    effective_to: date | None = None
    status: IncentiveStatus | None = None
    note: str | None = None


class IncentiveOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    category: str
    item_name: str
    amount: float | None
    currency: str | None
    granted_at: date | None
    effective_from: date | None
    effective_to: date | None
    status: str
    note: str | None


# ============================================================================
# 问卷
# ============================================================================

QuestionnaireType = Literal["inventory", "competency", "engagement"]


class QuestionnaireCreate(BaseModel):
    title: str = Field(max_length=256)
    q_type: QuestionnaireType
    focus: str | None = None  # AI 生成关注点


class QuestionnaireOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    tenant_id: uuid.UUID
    title: str
    q_type: str
    questions: list
    source: str
    status: str
    created_by: uuid.UUID | None


# ============================================================================
# 离职风险预警（显式信号规则 + 分档，不产出概率）
# ============================================================================

class TurnoverConfigOut(BaseModel):
    thresholds: dict
    weights: dict
    buckets: dict
    is_default: bool


class TurnoverConfigUpdate(BaseModel):
    thresholds: dict | None = None
    weights: dict | None = None
    buckets: dict | None = None


class TurnoverSignalOut(BaseModel):
    key: str
    label: str
    detail: str


class TurnoverRiskItem(BaseModel):
    employee_id: uuid.UUID
    name: str
    dept_id: str
    position: str
    grade: str
    perf_grade: str | None
    score: int
    bucket: str
    signals: list[TurnoverSignalOut]


class TurnoverRiskReport(BaseModel):
    generated_at: str
    engine: str  # rule_based
    disclaimer: str
    summary: dict
    items: list[TurnoverRiskItem]
