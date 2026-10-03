"""招聘面试 Schemas。"""

import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict


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


class InterviewQuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    dimension: int
    position: str
    grade: str
    question: str
    answer_point: str | None
    source: str
    status: str
    created_by: uuid.UUID


class QuestionGenerateIn(BaseModel):
    """AI 生成面试题。"""
    position: str
    grade: str
    dimension: int = 0  # 0=全维度
    count: int = 6


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
