"""薪酬激励规则配置请求模型（P2）。"""
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class CompRulesUpdate(BaseModel):
    """薪酬规则租户覆盖：只更新提供的键。"""

    adjust_matrix: dict[str, list[float]] | None = None
    penetration_bands: list[float] | None = None
    market_stop: Literal["p25", "p50", "p75", "p90"] | None = None
    pay_mix: dict[str, float] | None = None
    pip_fail_adjust_pct: float | None = Field(default=None, le=0)

    def patch_dict(self) -> dict[str, Any]:
        return {k: v for k, v in self.model_dump().items() if v is not None}


# ---------- 调薪方案 ----------

class AdjustmentItemIn(BaseModel):
    employee_id: str
    current_salary: int
    suggested_pct: float
    suggested_salary: int
    mark: str | None = None
    # 快照展示字段（来自测算服务，可选）
    name: str | None = None
    employee_no: str | None = None
    grade: str | None = None
    sequence: str | None = None
    dept_id: str | None = None
    perf_grade: str | None = None
    penetration: float | None = None
    delta: int | None = None


class AdjustmentPreviewIn(BaseModel):
    scope_depts: list[str] = []


class AdjustmentPlanCreate(BaseModel):
    plan_name: str = Field(min_length=1)
    scope_depts: list[str] = []
    items: list[AdjustmentItemIn]


class AdjustmentItemOut(BaseModel):
    employee_id: str
    current_salary: int
    suggested_pct: float
    suggested_salary: int
    mark: str | None = None


class AdjustmentTune(BaseModel):
    employee_id: str
    new_pct: float = Field(ge=-100, le=100)


class RejectIn(BaseModel):
    reason: str = Field(min_length=5)

    @field_validator("reason")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 5:
            raise ValueError("驳回理由至少 5 个字")
        return v


# ---------- 奖金方案 ----------

class BonusPlanCreate(BaseModel):
    perf_plan_id: str
    plan_name: str = Field(min_length=1)
    scope_depts: list[str] = []
    proration_enabled: bool = True
    bonus_pool_total: float = Field(default=0, ge=0)


class DeptPoolTune(BaseModel):
    pool_amount: float = Field(ge=0)
    adjust_reason: str = Field(min_length=1)

    @field_validator("adjust_reason")
    @classmethod
    def _strip_reason(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("部门包调整理由必填")
        return v


class BonusItemTune(BaseModel):
    """个人目标奖金覆盖（留痕）。"""

    target_bonus: float = Field(gt=0)
    reason: str = Field(min_length=1)

    @field_validator("reason")
    @classmethod
    def _strip_reason(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("覆盖理由必填")
        return v
