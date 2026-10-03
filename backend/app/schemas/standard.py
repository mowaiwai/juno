import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class StandardItemIn(BaseModel):
    code: str = Field(max_length=64)
    name: str = Field(max_length=255)
    description: str
    requirement: str
    weight: float = Field(ge=0, le=100)
    sort_order: int = 0


class StandardSetCreate(BaseModel):
    sequence: str = Field(max_length=32)
    target_grade: str = Field(max_length=32)
    items: list[StandardItemIn] = Field(min_length=1)


# 修改与创建同结构
StandardSetUpdate = StandardSetCreate


class StandardItemOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    description: str
    requirement: str
    weight: float
    sort_order: int

    model_config = {"from_attributes": True}


class StandardSetOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    sequence: str
    target_grade: str
    version: int
    status: str
    published_at: datetime | None
    items: list[StandardItemOut]

    model_config = {"from_attributes": True}
