"""绩效模块 Pydantic 模型（P1 绩效内生）。"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

ToolType = Literal["pbc", "kpi", "okr", "360"]
PlanStatus = Literal["draft", "evaluating", "calibrating", "published"]
Grade = Literal["S", "A", "B", "C", "D"]


class ConstantsUpdate(BaseModel):
    """SABC 常量租户覆盖：只更新提供的键。"""

    score_cutoffs: dict[str, float] | None = None
    coefficients: dict[str, float] | None = None
    c_divisor: float | None = None
    distribution: dict[str, list[float]] | None = None
    small_roster_threshold: int | None = Field(default=None, ge=0)

    def patch_dict(self) -> dict:
        return {k: v for k, v in self.model_dump().items() if v is not None}


# ---------- 考核方案 ----------

class PlanCreate(BaseModel):
    period: str = Field(min_length=1, max_length=20)
    tool_type: ToolType
    dept_ids: list[str] = Field(default_factory=list)
    sequence_codes: list[str] = Field(default_factory=list)
    exclude_ids: list[uuid.UUID] = Field(default_factory=list)


class PlanUpdate(BaseModel):
    """草稿期修改：周期/工具/圈定条件（重算候选，保留既有剔除）。"""

    period: str | None = Field(default=None, min_length=1, max_length=20)
    tool_type: ToolType | None = None
    dept_ids: list[str] | None = None
    sequence_codes: list[str] | None = None


class RosterUpdate(BaseModel):
    member_ids: list[uuid.UUID]


class PlanTransition(BaseModel):
    to: Literal["evaluating", "calibrating"]


class RosterMember(BaseModel):
    id: uuid.UUID
    employee_no: str
    name: str
    dept_id: str
    position: str
    sequence: str


class PlanOut(BaseModel):
    id: uuid.UUID
    period: str
    tool_type: ToolType
    status: PlanStatus
    scope_depts: list[str]
    scope_sequences: list[str]
    roster_members: list[RosterMember]
    excluded_members: list[RosterMember]
    distribution_override_reason: str | None = None
    published_at: datetime | None = None
    result_count: int = 0


class PlanSummary(BaseModel):
    id: uuid.UUID
    period: str
    tool_type: ToolType
    status: PlanStatus
    roster_size: int
    result_count: int
    published_at: datetime | None = None


# ---------- 结果录入 ----------

class ResultItemIn(BaseModel):
    employee_id: uuid.UUID
    grade: Grade
    score: float | None = Field(default=None, ge=0, le=100)
    evidence: list[str] = Field(default_factory=list)


class ResultBatchIn(BaseModel):
    items: list[ResultItemIn] = Field(min_length=1)


class ResultOut(BaseModel):
    plan_id: uuid.UUID
    employee_id: uuid.UUID
    employee_no: str
    name: str
    grade: Grade
    score: float | None
    coefficient: float
    org_coefficient: float
    evidence: list[str]


# ---------- 校准与发布 ----------

class DistributionViolation(BaseModel):
    bucket: str
    ratio: float
    low: float
    high: float


class UngradedMember(BaseModel):
    employee_id: uuid.UUID
    employee_no: str
    name: str


class DistributionOut(BaseModel):
    roster_size: int
    graded_count: int
    counts: dict[str, int]
    ratios: dict[str, float]
    cd_ratio: float
    ungraded: list[UngradedMember]
    violations: list[DistributionViolation]
    small_roster: bool


class PublishIn(BaseModel):
    override_reason: str | None = None


# ---------- 导入到方案草稿 ----------

class PlanImportItem(BaseModel):
    employee_no: str
    grade: Grade
    score: float | None = Field(default=None, ge=0, le=100)


class PlanImportIn(BaseModel):
    items: list[PlanImportItem] = Field(min_length=1)


class PlanImportError(BaseModel):
    employee_no: str
    reason: str


class PlanImportOut(BaseModel):
    imported: int
    errors: list[PlanImportError]


# ---------- PIP ----------

class PipCreate(BaseModel):
    employee_id: uuid.UUID
    period: str = Field(min_length=1, max_length=20)
    goals: list[str] = Field(default_factory=list)
    deadline: date | None = None
    perf_result_id: uuid.UUID | None = None


class PipUpdate(BaseModel):
    goals: list[str] | None = None
    deadline: date | None = None


class PipConclusionIn(BaseModel):
    result: Literal["passed", "failed"]
    note: str | None = None


class PipOut(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    employee_no: str
    employee_name: str
    period: str
    goals: list[str]
    deadline: date | None = None
    status: str
    conclusion: str | None = None
    concluded_at: datetime | None = None
    perf_result_id: uuid.UUID | None = None
    linked_adjust_id: uuid.UUID | None = None
    created_at: datetime


# ---------- 辅导记录 ----------

class CoachingCreate(BaseModel):
    employee_id: uuid.UUID
    content: str = Field(min_length=1)
    happened_at: date
    plan_id: uuid.UUID | None = None


class CoachingOut(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    content: str
    happened_at: date
    plan_id: uuid.UUID | None = None
    created_at: datetime


# ---------- 我的绩效 ----------

class MyResultOut(BaseModel):
    plan_id: uuid.UUID
    period: str
    tool_type: str
    grade: str
    score: float | None = None
    coefficient: float
    org_coefficient: float
    evidence: list[str]
    published_at: datetime


class MyPerfOut(BaseModel):
    results: list[MyResultOut]
    pips: list[PipOut]




