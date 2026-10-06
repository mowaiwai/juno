"""人才缺口预测 API schemas（spec structure-gap-forecast）。"""

from pydantic import BaseModel, Field, model_validator


class HeadcountRow(BaseModel):
    sequence: str = Field(min_length=1, max_length=32)
    level_order: int = Field(ge=1, le=6)
    headcount: int = Field(ge=0)


class HeadcountStandardsIn(BaseModel):
    """标准编制整体替换入参（全量行集；库内不在提交集内的行删除）。"""

    rows: list[HeadcountRow]

    @model_validator(mode="after")
    def _validate(self):
        keys = [(r.sequence, r.level_order) for r in self.rows]
        if len(keys) != len(set(keys)):
            raise ValueError("同一 sequence + level_order 不允许重复行")
        return self


class HeadcountRowOut(HeadcountRow):
    pass


class GapConfigIn(BaseModel):
    """梯队折算系数整体更新入参；要求 0 ≤ f3 ≤ f2 ≤ f1 ≤ 1。"""

    factor_l1: float = Field(ge=0, le=1)
    factor_l2: float = Field(ge=0, le=1)
    factor_l3: float = Field(ge=0, le=1)

    @model_validator(mode="after")
    def _validate(self):
        if not (self.factor_l3 <= self.factor_l2 <= self.factor_l1):
            raise ValueError("折算系数须满足 factor_l3 ≤ factor_l2 ≤ factor_l1")
        return self


class GapConfigOut(BaseModel):
    factor_l1: float
    factor_l2: float
    factor_l3: float
    is_default: bool


class GapCellOut(BaseModel):
    sequence: str
    level_order: int
    level_name: str | None
    demand: int
    supply_active: int
    supply_pool: float
    supply_total: float
    gap: float
    severity: str


class UnmappedOut(BaseModel):
    count: int
    grades: list[str]


class GapSummaryOut(BaseModel):
    total_demand: int
    total_supply: float
    total_gap: float
    shortage_cells: int
    surplus_cells: int


class GapForecastOut(BaseModel):
    cells: list[GapCellOut]
    unmapped: UnmappedOut
    config: GapConfigOut
    summary: GapSummaryOut
