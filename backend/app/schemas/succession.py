"""核心岗位 / 继任 / 梯队池 Schemas。"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


# ---------------------------------------------------------------------------
# 核心岗位
# ---------------------------------------------------------------------------

class CorePositionIn(BaseModel):
    name: str
    grade: str
    sequence: str
    headcount: int = 1
    dept_id: str | None = None
    incumbent_employee_id: uuid.UUID | None = None


class CorePositionUpdate(BaseModel):
    name: str | None = None
    grade: str | None = None
    sequence: str | None = None
    headcount: int | None = None
    dept_id: str | None = None
    incumbent_employee_id: uuid.UUID | None = None


class CorePositionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: uuid.UUID
    name: str
    dept_id: str | None
    sequence: str
    grade: str
    headcount: int
    incumbent_employee_id: uuid.UUID | None
    created_by: uuid.UUID
    created_at: datetime
    # 动态计算字段
    risk: str
    risk_reason: str
    coverage: int
    candidate_count: int
    candidates: list[dict] = []


# ---------------------------------------------------------------------------
# 继任候选
# ---------------------------------------------------------------------------

class CandidateIn(BaseModel):
    employee_id: uuid.UUID


class CandidateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: uuid.UUID
    core_position_id: uuid.UUID
    employee_id: uuid.UUID
    origin: str
    willingness: str
    perf_label: str | None = None
    duty_score: int | None = None


class WillingnessIn(BaseModel):
    willingness: str

    @field_validator("willingness")
    @classmethod
    def _validate_willingness(cls, v):
        if v not in ("unconfirmed", "willing", "unwilling"):
            raise ValueError("willingness must be unconfirmed/willing/unwilling")
        return v


class WillingnessOut(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    willingness: str


# ---------------------------------------------------------------------------
# 梯队池
# ---------------------------------------------------------------------------

class TalentPoolIn(BaseModel):
    employee_id: uuid.UUID
    pool_level: str
    reason: str

    @field_validator("pool_level")
    @classmethod
    def _validate_level(cls, v):
        if v not in ("L1", "L2", "L3"):
            raise ValueError("pool_level must be L1/L2/L3")
        return v


class TalentPoolUpdate(BaseModel):
    pool_level: str | None = None
    reason: str | None = None
    status: str | None = None

    @field_validator("pool_level")
    @classmethod
    def _validate_level(cls, v):
        if v is not None and v not in ("L1", "L2", "L3"):
            raise ValueError("pool_level must be L1/L2/L3")
        return v

    @field_validator("status")
    @classmethod
    def _validate_status(cls, v):
        if v is not None and v not in ("active", "graduated", "exited"):
            raise ValueError("status must be active/graduated/exited")
        return v


class TalentPoolOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    pool_level: str
    reason: str
    joined_by: uuid.UUID
    joined_at: datetime
    status: str
