"""人才盘点 Schemas。"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


class BatchIn(BaseModel):
    name: str
    purpose: str
    scope_employee_ids: list[uuid.UUID] | None = None


class BatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: uuid.UUID
    name: str
    purpose: str
    status: str
    owner_id: uuid.UUID
    scope_employee_ids: list[uuid.UUID] | None
    created_at: datetime
    published_at: datetime | None


class ResultIn(BaseModel):
    potential: str | None = None
    grid_code: str | None = None
    note: str | None = None

    @field_validator("potential")
    @classmethod
    def _validate_potential(cls, v):
        if v is not None and v not in ("high", "mid", "low"):
            raise ValueError("potential must be high/mid/low")
        return v


class ResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: uuid.UUID
    employee_id: uuid.UUID
    perf_label: str | None
    ability_score: int | None
    potential: str | None
    grid_code: str | None
    located: bool
    calibrate_note: str | None


class DistributionOut(BaseModel):
    total: int
    unlocated: int
    grids: dict[str, int]
    percentages: dict[str, int]


class TrackPointOut(BaseModel):
    """员工在单个已发布批次中的九宫格落点（轨迹的一点）。"""

    batch_id: uuid.UUID
    batch_name: str
    published_at: datetime | None
    grid_code: str | None
    potential: str | None
    perf_label: str | None
