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


# ---------------------------------------------------------------------------
# 模块五 P3：维度自动分类 / 人才密度 / 冗余缺口 / 结构优化建议
# ---------------------------------------------------------------------------


class ClassificationOut(BaseModel):
    """员工四分类（核心/胜任/可转型/待优化）。"""

    employee_id: uuid.UUID
    name: str
    dept_name: str
    position: str
    sequence: str
    grade: str
    category: str  # core / competent / transformable / optimize
    category_label: str  # 核心 / 胜任 / 可转型 / 待优化
    perf_score: float | None  # 绩效分（SABC 映射）
    ability_score: float | None  # 能力分（画像 ability 维度）
    willingness: str  # willing / unwilling / unconfirmed / none
    reason: str  # 分类理由（可解释）


class ClassificationSummary(BaseModel):
    """四分类汇总。"""

    core: int = 0
    competent: int = 0
    transformable: int = 0
    optimize: int = 0
    unclassified: int = 0
    total: int = 0


class DensityOut(BaseModel):
    """人才密度仪表盘。"""

    total: int
    core_count: int
    core_ratio: float  # 核心人才占比
    sequence_dist: dict[str, int]  # 序列分布
    level_dist: dict[str, int]  # 层级分布（level_order 1-6）
    shape: str  # dumbbell / diamond / pyramid / healthy
    shape_label: str
    mid_ratio: float
    high_potential: int  # 高潜人数
    risk_count: int  # 绩效 D 人数


class ImbalanceItem(BaseModel):
    """冗余/缺口项。"""

    sequence: str
    level_order: int
    level_name: str
    type: str  # surplus / shortage / gap
    type_label: str  # 冗余 / 缺口 / 断层
    detail: str  # 具体描述


class OptimizeAdviceIn(BaseModel):
    """AI 结构优化建议入参。"""

    focus: str | None = None  # 关注点描述（可选，AI 参考）


class OptimizeAdviceOut(BaseModel):
    """AI 结构优化建议出参。"""

    advice: str  # AI 生成的优化建议文案
    source: str  # ai_generated / rule_based
    generated_at: str  # ISO 8601
