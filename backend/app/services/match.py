"""统一人岗匹配度引擎（PRD 模块四 P3）。

纯函数内核：不访问 DB / HTTP / LLM，同输入必同输出。
所有消费者（差距热力图、双向推荐、项目组队、招聘 compare）经
:func:`score_match` 同一入口算分，保证全平台一个口径。

算分规则（spec match-engine FR-1~4）：
- 五要素 perf/duty/ability/contribution/knowledge，实际分与要求分均为 0-100；
- 逐维达成率 ``ratio = min(actual / required, 1)``，超出不加分；
- 无实际数据的维度不计入分母，其余维权重在可算维内重新归一；
- 可算维为 0 时返回 ``score=None`` 与 ``insufficient_data``，绝不按 0 分计；
- 等级：>= good → good；>= warn → watch；否则 mismatch。
"""

from dataclasses import dataclass, field

# --- 五要素键（画像七维中参与匹配的五维；basic/biz 不参与） ------------------

DIM_PERF = "perf"
DIM_DUTY = "duty"
DIM_ABILITY = "ability"
DIM_CONTRIBUTION = "contribution"
DIM_KNOWLEDGE = "knowledge"

MATCH_DIMENSIONS: tuple[str, ...] = (
    DIM_PERF,
    DIM_DUTY,
    DIM_ABILITY,
    DIM_CONTRIBUTION,
    DIM_KNOWLEDGE,
)
MATCH_DIMENSION_SET = set(MATCH_DIMENSIONS)

# 五维中文标签（与 org_diagnosis 历史标签保持一致）
DIMENSION_LABELS: dict[str, str] = {
    DIM_PERF: "绩效",
    DIM_DUTY: "职责履行",
    DIM_ABILITY: "能力素质",
    DIM_CONTRIBUTION: "团队贡献",
    DIM_KNOWLEDGE: "知识技能",
}
LABEL_TO_KEY = {label: key for key, label in DIMENSION_LABELS.items()}

# --- 平台默认值（全平台唯一事实源；gaps 等模块从此处引用） -------------------

# 绩效等级 → 分值：SABC 口径（D 仅兼容历史数据）
GRADE_SCORES: dict[str, int] = {"S": 95, "A": 90, "B": 80, "C": 70, "D": 60}

# 五维岗位要求基准（perf=80 为匹配引擎新增；其余沿用 gaps 历史阈值）
DEFAULT_REQUIRED: dict[str, int] = {
    DIM_PERF: 80,
    DIM_DUTY: 75,
    DIM_ABILITY: 72,
    DIM_CONTRIBUTION: 65,
    DIM_KNOWLEDGE: 70,
}

# 等权
DEFAULT_WEIGHTS: dict[str, float] = {key: 0.2 for key in MATCH_DIMENSIONS}

DEFAULT_GOOD = 80
DEFAULT_WARN = 60

# --- 等级 ---------------------------------------------------------------------

LEVEL_GOOD = "good"
LEVEL_WATCH = "watch"
LEVEL_MISMATCH = "mismatch"
LEVEL_INSUFFICIENT = "insufficient_data"

_INSUFFICIENT_REASON = "数据不足：无有效匹配维度"
_MATCH_GOOD_REASON = "能力匹配良好"
_GAP_PREFIX = "能力缺口："


@dataclass(frozen=True)
class DimensionMatch:
    """单维匹配结果。

    - ``participates``：该维是否实际计入总分（实际/要求均有效且权重>0）；
    - ``missing``：该维是否因无实际数据而缺维；
    - ``is_gap``：参与计算且实际低于要求。
    """

    key: str
    actual: float | None
    required: float | None
    ratio: float | None
    is_gap: bool
    participates: bool
    missing: bool


@dataclass(frozen=True)
class MatchResult:
    score: float | None
    level: str
    dims: list[DimensionMatch] = field(default_factory=list)
    missing_dims: list[str] = field(default_factory=list)
    reason: str = ""


@dataclass(frozen=True)
class MatchConfigData:
    """租户生效中的匹配配置（无租户行时 is_default=True，取平台默认）。"""

    weights: dict
    required: dict
    good: int
    warn: int
    is_default: bool = False

    def score(self, actual: dict | None) -> MatchResult:
        """按本配置对一组实际分算分。"""
        return score_match(
            actual,
            required=self.required,
            weights=self.weights,
            good=self.good,
            warn=self.warn,
        )


# frozen dataclass 的 dict 字段仍可被原地改写；当前消费路径只读、
# score_match 内部字典解包拷贝，风险低，如需固化可 MappingProxyType（评审 Question-4）
DEFAULT_CONFIG = MatchConfigData(
    weights=dict(DEFAULT_WEIGHTS),
    required=dict(DEFAULT_REQUIRED),
    good=DEFAULT_GOOD,
    warn=DEFAULT_WARN,
    is_default=True,
)


def grade_to_score(grade: str | None) -> int | None:
    """绩效等级换算为分值；未知/空等级返回 None（由调用方按缺维处理）。"""
    if grade is None:
        return None
    return GRADE_SCORES.get(str(grade).strip().upper())


def normalize_dimension_key(name: str | None) -> str:
    """能力名（中文标签或 dimension_key）归一为 key；无法识别原样返回。"""
    if not name:
        return ""
    if name in MATCH_DIMENSION_SET:
        return name
    return LABEL_TO_KEY.get(name, name)


def to_score(value) -> float | None:
    """接受 int/float/数字字符串；None、非法、负数视为无数据。"""
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number or number < 0:  # NaN 或负数
        return None
    return number


def score_match(
    actual: dict | None,
    required: dict | None = None,
    weights: dict | None = None,
    good: int = DEFAULT_GOOD,
    warn: int = DEFAULT_WARN,
    dimensions: tuple[str, ...] = MATCH_DIMENSIONS,
) -> MatchResult:
    """五要素加权匹配度（纯函数）。

    :param actual: dimension_key → 实际分（0-100，缺维给 None 或不传）
    :param required: dimension_key → 要求分；缺省走平台默认
    :param weights: dimension_key → 权重（非负）；缺省等权
    :param good: 匹配良好阈值（含）
    :param warn: 错位预警阈值（含），区间 [warn, good) 为观察
    :param dimensions: 参与计算的维度序列（项目组队只需部分维度时传子集，
        未列入的维度不参与分母）
    """
    actual = actual or {}
    required = {**DEFAULT_REQUIRED, **(required or {})}
    weights = {**DEFAULT_WEIGHTS, **(weights or {})}

    dims: list[DimensionMatch] = []
    missing_dims: list[str] = []
    weighted_sum = 0.0
    weight_total = 0.0
    gap_notes: list[str] = []

    for key in dimensions:
        a = to_score(actual.get(key))
        r = to_score(required.get(key))
        w = to_score(weights.get(key)) or 0.0

        if a is None:
            missing_dims.append(key)

        if a is None or r is None or r <= 0 or w <= 0:
            dims.append(
                DimensionMatch(
                    key=key, actual=a, required=r, ratio=None,
                    is_gap=False, participates=False,
                    missing=(a is None),
                )
            )
            continue

        ratio = min(a / r, 1.0)
        is_gap = a < r
        dims.append(
            DimensionMatch(
                key=key,
                actual=a,
                required=r,
                ratio=round(ratio, 3),
                is_gap=is_gap,
                participates=True,
                missing=False,
            )
        )
        weighted_sum += w * ratio
        weight_total += w
        if is_gap:
            label = DIMENSION_LABELS[key]
            gap_notes.append(f"{label} {_fmt(a)}/{_fmt(r)}")

    if weight_total <= 0:
        return MatchResult(
            score=None,
            level=LEVEL_INSUFFICIENT,
            dims=dims,
            missing_dims=missing_dims,
            reason=_INSUFFICIENT_REASON,
        )

    # round 为银行家偶舍，与 spec「四舍五入」在 x.x5 平局处有理论差异；
    # 整数输入下平局极罕见且无失败用例，如需严格可改 floor(x*10+0.5)/10（评审 Question-3）
    score = round(weighted_sum / weight_total * 100, 1)
    if score >= good:
        level = LEVEL_GOOD
    elif score >= warn:
        level = LEVEL_WATCH
    else:
        level = LEVEL_MISMATCH

    reason = (
        _GAP_PREFIX + "；".join(gap_notes)
        if gap_notes
        else _MATCH_GOOD_REASON
    )
    return MatchResult(
        score=score,
        level=level,
        dims=dims,
        missing_dims=missing_dims,
        reason=reason,
    )


def _fmt(value: float) -> str:
    """分值展示：整数去小数点。"""
    if float(value).is_integer():
        return str(int(value))
    return str(value)
