import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class PanelTemplateIn(BaseModel):
    sequence: str = Field(max_length=32)
    lead_reviewer_id: uuid.UUID
    reviewer_ids: list[uuid.UUID]
    is_active: bool = True


class PanelTemplateOut(BaseModel):
    id: uuid.UUID
    sequence: str
    lead_reviewer_id: uuid.UUID
    reviewer_ids: list[uuid.UUID]
    is_active: bool

    model_config = {"from_attributes": True}


class OpinionIn(BaseModel):
    opinion: str = Field(min_length=1, max_length=2000)


class ReviewTaskOut(BaseModel):
    id: uuid.UUID
    application_id: uuid.UUID
    assignee_id: uuid.UUID
    role: str
    opinion: str | None
    submitted_at: datetime | None
    # 申请级锁状态随任务返回，前端据此渲染"开始评审/等待中"
    locked_by: uuid.UUID | None
    locked_until: datetime | None
