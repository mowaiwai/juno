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
    # 模块六 P3：统一匹配引擎就绪度（无画像数据 → None）
    match_score: float | None = None
    readiness: str | None = None


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


# ---------------------------------------------------------------------------
# 模块六 P3：继任推荐 / 就绪度三档 / 继任地图
# 就绪度三档口径：Ready Now（≥good）→ P-L1 核心继任、
# 1–2 年（≥warn）→ P-L2 重点培养、3 年+（<warn）→ P-L3 潜力储备
# ---------------------------------------------------------------------------

READINESS_READY_NOW = "ready_now"
READINESS_1_2Y = "ready_1_2y"
READINESS_3Y = "ready_3y"
READINESS_UNASSESSED = "unassessed"

READINESS_LABELS: dict[str, str] = {
    READINESS_READY_NOW: "Ready Now（核心继任）",
    READINESS_1_2Y: "1–2 年可继任",
    READINESS_3Y: "3 年+潜力储备",
    READINESS_UNASSESSED: "暂无画像数据",
}


class RecommendationOut(BaseModel):
    """单岗位继任推荐（统一匹配引擎打分，排序后 Top N）。"""

    employee_id: uuid.UUID
    name: str
    position: str | None = None
    grade: str | None = None
    perf_grade: str | None = None
    match_score: float
    readiness: str
    readiness_label: str
    level: str  # 引擎原始等级 good/watch/mismatch
    reason: str
    missing_dims: list[str] = []
    willingness: str = "unconfirmed"
    in_pool: bool = False  # 是否已在任一 active 梯队池


class MapPositionOut(BaseModel):
    """继任地图单岗位行（就绪度分桶计数，不含个人明细）。"""

    position_id: uuid.UUID
    name: str
    dept_name: str | None = None
    sequence: str
    grade: str
    headcount: int
    incumbent_name: str | None = None
    ready_now: int = 0
    ready_1_2y: int = 0
    ready_3y: int = 0
    unassessed: int = 0
    candidate_count: int = 0
    coverage: int  # 0-100，与既有 position_view 口径一致
    risk: str  # HIGH / MID / LOW


class SuccessionMapOut(BaseModel):
    positions: list[MapPositionOut] = []
    summary: dict
