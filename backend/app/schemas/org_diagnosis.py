"""组织诊断 Schemas。"""

import uuid

from pydantic import BaseModel, ConfigDict


class LiquidProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    dept_name: str
    needs: list[dict]
    deadline: str
    status: str


class DeptStructureOut(BaseModel):
    dept_id: str
    dept_name: str
    headcount: int
    grade_count: dict[str, int]
    shape: str
    shape_label: str
    mid_ratio: float


class GapWarningOut(BaseModel):
    position_id: uuid.UUID
    position_name: str
    dept_name: str
    incumbent_id: uuid.UUID | None
    incumbent_name: str | None
    level: str
    reason: str
    suggestion: str


class ThreeChartsOut(BaseModel):
    year: int
    strategy: list[dict]
    org: dict
    talent: dict


class TalentMapOut(BaseModel):
    dept_id: str
    scatter: list[dict]
    quadrants: dict
    willingness_anomaly: list[str]


class ProjectTeamIn(BaseModel):
    project_id: uuid.UUID


class TeamCandidateOut(BaseModel):
    employee_id: uuid.UUID
    name: str
    position: str
    match_score: float
    willingness: str
    readiness: str
    reason: str
    # 缺维出参（Minor-5）：新增字段不减既有字段，兼容旧前端
    missing_dims: list[str] = []
