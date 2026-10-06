"""匹配度引擎 API schemas（PRD 模块四 P3）。"""

import uuid

from pydantic import BaseModel, Field, model_validator

from app.services.match import MATCH_DIMENSIONS


class MatchConfigIn(BaseModel):
    """租户匹配配置整体替换入参（五维全量）。"""

    weights: dict[str, float]
    required: dict[str, int]
    good_threshold: int = Field(ge=0, le=100)
    warn_threshold: int = Field(ge=0, le=100)

    @model_validator(mode="after")
    def _validate(self):
        dims = set(MATCH_DIMENSIONS)
        if set(self.weights) != dims:
            raise ValueError("weights 必须且只能包含五要素键")
        if set(self.required) != dims:
            raise ValueError("required 必须且只能包含五要素键")
        if any(w < 0 for w in self.weights.values()):
            raise ValueError("权重不得为负")
        if sum(self.weights.values()) <= 0:
            raise ValueError("权重总和必须大于 0")
        if any(not (1 <= r <= 100) for r in self.required.values()):
            raise ValueError("要求分必须在 1-100 之间")
        if not (0 <= self.warn_threshold < self.good_threshold <= 100):
            raise ValueError("阈值须满足 0 ≤ warn < good ≤ 100")
        return self


class MatchConfigOut(BaseModel):
    weights: dict[str, float]
    required: dict[str, int]
    good_threshold: int
    warn_threshold: int
    is_default: bool


class HeatmapIn(BaseModel):
    """热力图范围：部门或批次恰好给一个（互斥）。"""

    dept_id: str | None = None
    batch_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def _require_scope(self):
        if not self.dept_id and self.batch_id is None:
            raise ValueError("dept_id 与 batch_id 必须提供一个")
        if self.dept_id and self.batch_id is not None:
            raise ValueError("dept_id 与 batch_id 只能二选一")
        return self


class HeatmapDimOut(BaseModel):
    key: str
    actual: float | None
    required: float | None
    ratio: float | None
    is_gap: bool


class HeatmapRowOut(BaseModel):
    employee_id: uuid.UUID
    name: str
    position: str | None = None
    score: float | None
    level: str
    reason: str
    missing_dims: list[str]
    dims: list[HeatmapDimOut]


class RecommendIn(BaseModel):
    """双向推荐：employee_id（一人多岗）与岗位定位（一岗多人）互斥。"""

    employee_id: uuid.UUID | None = None
    standard_set_id: uuid.UUID | None = None
    sequence: str | None = None
    target_grade: str | None = None
    limit: int = Field(default=5, ge=1, le=20)

    @model_validator(mode="after")
    def _validate_direction(self):
        employee_side = self.employee_id is not None
        position_ref = self.standard_set_id is not None or bool(
            self.sequence and self.target_grade
        )
        if employee_side and position_ref:
            raise ValueError("员工方向与岗位方向只能二选一")
        if not employee_side and not position_ref:
            raise ValueError("必须提供 employee_id 或岗位定位")
        if (self.sequence is None) != (self.target_grade is None):
            raise ValueError("sequence 与 target_grade 必须同时提供")
        return self


class RecommendItemOut(BaseModel):
    """岗位方向项带 set 定位；员工方向项带员工定位；其余字段可空。"""

    # 岗位项
    set_id: uuid.UUID | None = None
    sequence: str | None = None
    target_grade: str | None = None
    # 员工项
    employee_id: uuid.UUID | None = None
    name: str | None = None
    position: str | None = None
    # 共有
    score: float | None
    level: str
    missing_dims: list[str] = []


class RecommendOut(BaseModel):
    direction: str  # positions | employees
    items: list[RecommendItemOut]
