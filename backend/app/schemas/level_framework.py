"""层级框架 Pydantic DTO。"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class LevelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    level_order: int
    code: str
    name: str
    role_definition: str
    performance_level: str
    key_behaviors: list[str]
    influence_scope: str
    target_anchor: str


class AnchorOut(BaseModel):
    code: str
    name: str
    description: str


class ConditionOut(BaseModel):
    level_order: int
    education_min: str
    min_work_years: int | None
    min_company_years: int | None
    certificates: list[str]


class BonusItemOut(BaseModel):
    code: str
    name: str
    measure_unit: str
    sort_order: int


class FrameworkOut(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    id: uuid.UUID
    version: int
    status: str
    published_at: datetime | None
    levels: list[LevelOut]
    anchors: list[AnchorOut]
    conditions: list[ConditionOut]
    bonus_items: list[BonusItemOut]


class ResolveOut(BaseModel):
    grade: str
    source: str  # default / override
    required_anchor: str
    level: LevelOut
    framework_version_id: uuid.UUID


class MappingItemOut(BaseModel):
    grade_code: str
    level_order: int
    level_name: str
    source: str  # default / override


class TenantMappingOut(BaseModel):
    framework_version_id: uuid.UUID
    framework_version: int
    items: list[MappingItemOut]


class MappingItemIn(BaseModel):
    grade_code: str
    level_order: int


class TenantMappingIn(BaseModel):
    framework_version_id: uuid.UUID
    items: list[MappingItemIn]


# ---------------------------------------------------------------------------
# 草稿编辑输入
# ---------------------------------------------------------------------------

class LevelIn(BaseModel):
    level_order: int
    code: str
    name: str
    role_definition: str
    performance_level: str
    key_behaviors: list[str]
    influence_scope: str
    target_anchor: str


class AnchorIn(BaseModel):
    code: str
    name: str
    description: str


class ConditionIn(BaseModel):
    level_order: int
    education_min: str
    min_work_years: int | None
    min_company_years: int | None
    certificates: list[str]


class BonusItemIn(BaseModel):
    code: str
    name: str
    measure_unit: str
    sort_order: int


class FrameworkDraftIn(BaseModel):
    levels: list[LevelIn]
    anchors: list[AnchorIn]
    conditions: list[ConditionIn]
    bonus_items: list[BonusItemIn]
