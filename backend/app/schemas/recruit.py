"""招聘面试 Schemas。"""

import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class RequisitionIn(BaseModel):
    """创建在招需求。"""
    position: str
    dept_id: str
    grade: str
    headcount: int = Field(default=1, ge=1)
    owner: str
    priority: str = "mid"
    opened_at: str = ""


class CandidateIn(BaseModel):
    """投递候选人。"""
    req_id: uuid.UUID
    name: str
    source: str
    years: int = 0
    last_title: str = ""
    expected_salary: int = 0
    tags: list = Field(default_factory=list)


class CandidateStageIn(BaseModel):
    """候选人阶段流转。"""
    stage: str


class OnboardOut(BaseModel):
    """候选人入职结果。"""
    candidate_id: uuid.UUID
    employee_id: uuid.UUID
    user_id: uuid.UUID
    employee_no: str


class RequisitionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    position: str
    dept_id: str
    grade: str
    headcount: int
    funnel: list
    owner: str
    priority: str
    opened_at: str


class CandidateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    req_id: uuid.UUID
    name: str
    stage: str
    source: str
    match_score: int
    years: int
    last_title: str
    expected_salary: int
    rating: float | None
    tags: list
    applied_at: str
    prescreen_score: int | None = None


class InterviewQuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    dimension: int
    dimension_key: str
    position: str
    grade: str
    sequence: str
    question: str
    answer_point: str | None
    rubric: list
    source: str
    status: str
    created_by: uuid.UUID


class QuestionGenerateIn(BaseModel):
    """AI 生成面试题。"""
    position: str
    grade: str
    dimension: int = 0  # 0=全维度
    sequence: str = ""
    count: int = 6


class PrescreenOut(BaseModel):
    """候选人简历预匹配结果。"""
    candidate_id: uuid.UUID
    prescreen_score: int
    breakdown: dict
    level: str


class QuestionReviewIn(BaseModel):
    """面试题审核。"""
    approved: bool


class InterviewRecordIn(BaseModel):
    """保存面试记录。"""
    candidate_id: uuid.UUID
    req_id: uuid.UUID | None = None
    dimension_scores: list = []
    comment: str | None = None
    rating: float | None = None
    stage: str = "first"


class InterviewRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    candidate_id: uuid.UUID
    req_id: uuid.UUID | None
    interviewer_id: uuid.UUID
    dimension_scores: list
    comment: str | None
    rating: float | None
    stage: str
