"""人岗匹配 / 差距分析 Schemas（Module C）。"""

import uuid

from pydantic import BaseModel, ConfigDict


class GapOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_id: uuid.UUID
    dimension: str
    detail: str
    standard: str
    current: str
    severity: str
    action: str
    priority: int
    batch_id: uuid.UUID | None


class GapAnalyzeIn(BaseModel):
    """触发差距分析的范围：可按部门 / 盘点批次限定。"""

    dept_id: str | None = None
    batch_id: uuid.UUID | None = None


class GapActionIn(BaseModel):
    """批量生成改进动作建议的差距清单。"""

    gap_ids: list[uuid.UUID]


class TeamGapOut(BaseModel):
    """团队差距看板行：按员工聚合。"""

    employee_id: uuid.UUID
    name: str
    position: str
    dept_name: str
    gap_count: int
    high_count: int
    actions: list[str]
    gaps: list[GapOut]


class GapActionOut(BaseModel):
    """单条差距的改进动作建议。"""

    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    gap_id: uuid.UUID
    employee_id: uuid.UUID
    action: str
    priority: int
    suggestion: str
