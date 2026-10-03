"""人才画像 Schemas。"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DimensionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    dimension_key: str
    status: str
    score: int | None
    grade_label: str | None
    note: str | None


class ProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    version_seq: int
    source: str
    overall: int | None
    generated_by: uuid.UUID | None
    generated_at: datetime
    dimensions: list[DimensionOut]


class ProfileVersionItem(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    version_seq: int
    source: str
    overall: int | None
    generated_at: datetime


class GenerateIn(BaseModel):
    employee_id: uuid.UUID | None = None
    scope: str | None = None


class BasicIn(BaseModel):
    education: str
    certificates: list[str]


class BasicOut(BaseModel):
    education: str | None
    certificates: list[str]
