"""IDP Schemas。"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class GoalItem(BaseModel):
    ability: str
    target: str


class KeyBehaviorItem(BaseModel):
    behavior: str
    plan: str
    status: str = "todo"


class IDPOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    period: str
    period_type: int
    status: str
    goals: list[GoalItem]
    key_behaviors: list[KeyBehaviorItem]
    review_result: str | None
    created_by: uuid.UUID
    reviewed_by: uuid.UUID | None
    reviewed_at: datetime | None


class IDPCreateIn(BaseModel):
    employee_id: uuid.UUID
    period: str
    period_type: int = 1
    goals: list[GoalItem] = []
    key_behaviors: list[KeyBehaviorItem] = []


class IDPUpdateIn(BaseModel):
    goals: list[GoalItem] | None = None
    key_behaviors: list[KeyBehaviorItem] | None = None


class KeyBehaviorUpdateIn(BaseModel):
    """单条关键行为状态更新。"""
    behavior: str
    plan: str
    status: str


class IDPGenerateIn(BaseModel):
    """AI 生成 IDP 草稿。"""
    employee_id: uuid.UUID
    period: str
    period_type: int = 1
