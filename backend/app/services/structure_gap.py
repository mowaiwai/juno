"""人才缺口预测纯内核（spec structure-gap-forecast FR-1~4）。

确定性减法：缺口 = 标准编制（需求）−（在岗 + 梯队储备按梯队层级折算）（供给）。
纯函数模块：不访问 DB / HTTP / LLM，同输入必同输出。
"""

from dataclasses import dataclass, field

# --- 平台默认折算系数（梯队池级 → 供给当量） ---------------------------------

DEFAULT_FACTOR_L1 = 1.0
DEFAULT_FACTOR_L2 = 0.5
DEFAULT_FACTOR_L3 = 0.2

POOL_LEVEL_FACTORS_DEFAULT: dict[str, float] = {
    "L1": DEFAULT_FACTOR_L1,
    "L2": DEFAULT_FACTOR_L2,
    "L3": DEFAULT_FACTOR_L3,
}

# --- 缺口分级 -----------------------------------------------------------------

SEVERITY_SHORTAGE = "shortage"
SEVERITY_SURPLUS = "surplus"
SEVERITY_BALANCED = "balanced"


@dataclass(frozen=True)
class GapFactors:
    """梯队折算系数三元组。"""

    l1: float = DEFAULT_FACTOR_L1
    l2: float = DEFAULT_FACTOR_L2
    l3: float = DEFAULT_FACTOR_L3

    def for_level(self, pool_level: str) -> float:
        return {
            "L1": self.l1,
            "L2": self.l2,
            "L3": self.l3,
        }.get(pool_level, 0.0)


DEFAULT_FACTORS = GapFactors()


@dataclass(frozen=True)
class CellInput:
    """单单元格（sequence × level_order）的聚合输入。"""

    sequence: str
    level_order: int
    demand: int
    active_count: int
    # 梯队成员 pool_level 列表（已按状态/在职过滤），逐个折算后求和
    pool_levels: tuple[str, ...] = ()


@dataclass(frozen=True)
class GapCell:
    sequence: str
    level_order: int
    demand: int
    supply_active: int
    supply_pool: float
    supply_total: float
    gap: float
    severity: str


@dataclass(frozen=True)
class GapForecastResult:
    cells: list[GapCell] = field(default_factory=list)
    total_demand: int = 0
    total_supply: float = 0.0
    total_gap: float = 0.0
    shortage_cells: int = 0
    surplus_cells: int = 0


def _severity(gap: float) -> str:
    if gap > 0:
        return SEVERITY_SHORTAGE
    if gap < 0:
        return SEVERITY_SURPLUS
    return SEVERITY_BALANCED


def compute_gap_forecast(
    cells: list[CellInput],
    factors: GapFactors = DEFAULT_FACTORS,
) -> GapForecastResult:
    """按单元格聚合输入计算缺口矩阵（纯函数）。

    空单元格（demand == 0 且无任何供给）被裁剪，不进入输出（FR-2）。
    """
    out: list[GapCell] = []
    total_demand = 0
    total_supply = 0.0

    for c in cells:
        supply_pool = sum(factors.for_level(lv) for lv in c.pool_levels)
        supply_total = c.active_count + supply_pool
        if c.demand <= 0 and supply_total <= 0:
            continue
        gap = c.demand - supply_total
        out.append(
            GapCell(
                sequence=c.sequence,
                level_order=c.level_order,
                demand=c.demand,
                supply_active=c.active_count,
                supply_pool=round(supply_pool, 2),
                supply_total=round(supply_total, 2),
                gap=round(gap, 2),
                severity=_severity(gap),
            )
        )
        total_demand += c.demand
        total_supply += supply_total

    total_gap = total_demand - total_supply
    return GapForecastResult(
        cells=out,
        total_demand=total_demand,
        total_supply=round(total_supply, 2),
        total_gap=round(total_gap, 2),
        shortage_cells=sum(1 for c in out if c.severity == SEVERITY_SHORTAGE),
        surplus_cells=sum(1 for c in out if c.severity == SEVERITY_SURPLUS),
    )
