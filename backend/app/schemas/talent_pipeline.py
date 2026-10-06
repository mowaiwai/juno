"""人才梯队建设 Schemas（模块七 P3，spec PRD §模块七）。

口径要点（PRD L586）：
- 梯队厚度 = 每层合格人数 ÷ 标准编制；合格人数 = 在岗 + Σ(active 池籍 × 折算系数)
- 断层率 = 无合格后备的关键层级数 ÷ 关键层级总数；关键层级 = 有关键岗位分布的层级
- 流动率 = 近 365 天 graduated + exited 池籍数 ÷ 当前 active 池籍数
- 全部指标只读计算、不落库、随盘点批次刷新
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# 序列梯队图
# ---------------------------------------------------------------------------


class PipelineLevelCell(BaseModel):
    """序列 × 层级 单元格：在岗 + 池籍折算 + 厚度。"""

    sequence: str
    level_order: int
    level_name: str
    headcount: int = 0  # 标准编制（无配置 0）
    active_count: int = 0  # 在岗人数
    pool_l1: int = 0  # L1 池人数
    pool_l2: int = 0
    pool_l3: int = 0
    qualified: float = 0.0  # 在岗 + Σ(active 池籍 × 折算系数)
    thickness: float | None = None  # qualified / headcount；headcount=0 → None
    is_critical: bool = False  # 关键层级：有关键岗位分布
    has_gap: bool = False  # headcount>0 且 qualified < headcount


class PipelinePyramidOut(BaseModel):
    """序列梯队图：一层一行 + 汇总。"""

    sequence: str
    levels: list[PipelineLevelCell]
    total_headcount: int
    total_active: int
    total_pool: int


# ---------------------------------------------------------------------------
# 梯队健康度
# ---------------------------------------------------------------------------


class PipelineHealthOut(BaseModel):
    """梯队健康度三指标（只读计算）。"""

    thickness: float | None  # 总合格人数 ÷ 总标准编制；无编制配置 → None
    gap_rate: float  # 关键层级中无合格后备的占比（0-1）
    flow_rate: float  # 近 365 天 (graduated+exited) ÷ 当前 active
    critical_levels: int  # 关键层级总数
    gap_levels: int  # 无合格后备的关键层级数
    active_pool: int  # 当前 active 池籍总数
    recent_outflow: int  # 近 365 天流出池数（graduated + exited）
    batch_id: uuid.UUID | None  # 数据基准盘点批次
    batch_name: str | None
    published_at: datetime | None


# ---------------------------------------------------------------------------
# 后备人才识别
# ---------------------------------------------------------------------------


class BackupCandidateOut(BaseModel):
    """后备人才：盘点高潜 + 绩优 + 未入池。"""

    employee_id: uuid.UUID
    name: str
    dept_id: str
    position: str
    sequence: str
    grade: str
    level_order: int | None  # grade → level_order
    perf_label: str  # 盘点绩效标签（S/A）
    ability_score: int | None
    grid_code: str | None
    potential: str  # high
    pool_level: str | None  # 已入池等级（L1/L2/L3）；未入池 → None
    batch_id: uuid.UUID
    batch_name: str


class BackupCandidateListOut(BaseModel):
    batch_id: uuid.UUID | None
    batch_name: str | None
    items: list[BackupCandidateOut]
    total: int


# ---------------------------------------------------------------------------
# 断层预警
# ---------------------------------------------------------------------------


class PipelineGapWarningOut(BaseModel):
    """某层级储备不足预警。"""

    sequence: str
    level_order: int
    level_name: str
    headcount: int
    qualified: float
    shortage: float  # headcount - qualified
    thickness: float | None
    suggestion: str


# ---------------------------------------------------------------------------
# AI 培养计划
# ---------------------------------------------------------------------------


class TrainingPlanIn(BaseModel):
    """AI 培养计划入参。"""

    focus: str | None = Field(default=None, description="HR 关注点（可选）")
    months: int = Field(default=6, ge=1, le=24, description="培养周期（月）")


class TrainingPlanOut(BaseModel):
    """AI 培养计划出参。"""

    employee_id: uuid.UUID
    employee_name: str
    plan: str  # AI 生成文案或规则文案
    source: str  # ai_generated / rule_based
    generated_at: str  # ISO 8601
    milestones: list[str] = []  # 里程碑列表（AI 或规则）

    @field_validator("source")
    @classmethod
    def _validate_source(cls, v):
        if v not in ("ai_generated", "rule_based"):
            raise ValueError("source must be ai_generated/rule_based")
        return v
