import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ApplicationCreate(BaseModel):
    target_sequence: str = Field(max_length=32)
    target_grade: str = Field(max_length=32)


class SelfAssessmentItemIn(BaseModel):
    standard_item_code: str = Field(max_length=64)
    self_level: str = Field(pattern="^(met|partially_met|not_met)$")
    self_comment: str | None = None


class SelfAssessmentUpdate(BaseModel):
    items: list[SelfAssessmentItemIn] = Field(min_length=1)


class SelfAssessmentOut(BaseModel):
    standard_item_code: str
    self_level: str
    self_comment: str | None = None


class EvidenceOut(BaseModel):
    id: uuid.UUID
    standard_item_code: str
    file_name: str
    mime_type: str
    size_bytes: int


class ManagerReviewOut(BaseModel):
    decision: str
    reject_category: str | None = None
    comment: str | None = None


class StandardItemBrief(BaseModel):
    code: str
    name: str
    description: str
    requirement: str
    weight: float
    sort_order: int


class ApplicationDetailOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    target_sequence: str
    target_grade: str
    standard_set_id: uuid.UUID
    status: str
    previous_application_id: uuid.UUID | None
    submitted_at: datetime | None
    standard_items: list[StandardItemBrief]
    self_assessments: list[SelfAssessmentOut]
    evidences: list[EvidenceOut]
    manager_review: ManagerReviewOut | None = None
    # 终裁结果对员工可见，但组长意见原文不外泄（spec §6 可见性矩阵）
    final_decision: str | None = None


class ApplicationListItem(BaseModel):
    id: uuid.UUID
    target_sequence: str
    target_grade: str
    status: str
    submitted_at: datetime | None
    decided_at: datetime | None = None
    published_at: datetime | None = None
    employee_name: str | None = None


class DecisionIn(BaseModel):
    decision: str = Field(pattern="^(approved|rejected)$")
    comment: str = Field(min_length=1, max_length=2000)
    interview_notes: str | None = Field(default=None, max_length=2000)
    ai_suggestion_id: uuid.UUID | None = None
