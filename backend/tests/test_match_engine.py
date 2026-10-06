"""统一匹配度引擎纯函数内核测试（PRD 模块四 / spec match-engine AC-1~4、AC-10）。"""

import pathlib

import pytest

from app.services import match
from app.services.match import (
    DEFAULT_GOOD,
    DEFAULT_REQUIRED,
    DEFAULT_WARN,
    DEFAULT_WEIGHTS,
    MATCH_DIMENSIONS,
    grade_to_score,
    normalize_dimension_key,
    score_match,
)


# --- TR-1.1 加权算分公式 -----------------------------------------------------

def test_weighted_score_exact_value():
    """AC-1：spec 给定用例，总分必须为 96.7。"""
    actual = {
        "perf": 90, "duty": 75, "ability": 60,
        "contribution": 80, "knowledge": 70,
    }
    result = score_match(actual, DEFAULT_REQUIRED, DEFAULT_WEIGHTS)
    assert result.score == 96.7
    assert result.level == "good"
    # ability 60/72 是唯一缺口
    gap_dims = [d.key for d in result.dims if d.is_gap]
    assert gap_dims == ["ability"]
    ratios = {d.key: d.ratio for d in result.dims}
    assert ratios["perf"] == 1.0
    assert ratios["duty"] == 1.0
    assert ratios["knowledge"] == 1.0
    assert ratios["ability"] == pytest.approx(0.833, abs=0.001)


def test_over_achievement_is_capped_at_one():
    """实际远超要求不加分：单维 100/50 封顶为 1。"""
    actual = {k: 100 for k in MATCH_DIMENSIONS}
    required = {
        "perf": 50, "duty": 50, "ability": 50,
        "contribution": 50, "knowledge": 50,
    }
    result = score_match(actual, required, DEFAULT_WEIGHTS)
    assert result.score == 100.0
    assert all(d.ratio == 1.0 for d in result.dims)
    assert all(not d.is_gap for d in result.dims)


# --- TR-1.2 缺维规则 ----------------------------------------------------------

def test_missing_dimensions_renormalize_weights():
    """缺 2 维：分母只含 3 维权重并归一，参与计算权重和为 1。"""
    actual = {"perf": 80, "duty": 75, "ability": 72}  # contribution/knowledge 缺
    result = score_match(actual, DEFAULT_REQUIRED, DEFAULT_WEIGHTS)
    participating = [d for d in result.dims if d.ratio is not None]
    assert {d.key for d in participating} == {"perf", "duty", "ability"}
    assert result.missing_dims == ["contribution", "knowledge"]
    # 三维恰好全部达标 → 归一后仍为 100，而不是被缺维拖成 60
    assert result.score == 100.0


def test_renormalization_precise_with_unequal_weights():
    """非等权 + 缺维：分母只在可算维内归一。

    perf 权重 0.4（ratio 1.0）、duty 权重 0.2（ratio 0.5），其余三维缺失：
    (0.4×1 + 0.2×0.5) / 0.6 = 83.3
    """
    weights = {
        "perf": 0.4, "duty": 0.2, "ability": 0.2,
        "contribution": 0.1, "knowledge": 0.1,
    }
    actual = {"perf": 80, "duty": 37.5}  # duty 37.5/75 = 0.5
    result = score_match(actual, DEFAULT_REQUIRED, weights)
    assert result.missing_dims == ["ability", "contribution", "knowledge"]
    assert result.score == 83.3


def test_all_missing_returns_insufficient_data_not_zero():
    """五维全缺：score=None、insufficient_data，绝不返回 0。"""
    result = score_match({}, DEFAULT_REQUIRED, DEFAULT_WEIGHTS)
    assert result.score is None
    assert result.level == "insufficient_data"
    assert result.missing_dims == list(MATCH_DIMENSIONS)
    assert "数据不足" in result.reason


def test_explicit_none_values_treated_as_missing():
    actual = {k: None for k in MATCH_DIMENSIONS}
    result = score_match(actual, DEFAULT_REQUIRED, DEFAULT_WEIGHTS)
    assert result.score is None
    assert result.level == "insufficient_data"


# --- TR-1.3 阈值分级 ----------------------------------------------------------

@pytest.mark.parametrize(
    "score_value,expected_level",
    [
        (80.0, "good"),       # 上含
        (79.9, "watch"),
        (60.0, "watch"),      # 下含
        (59.9, "mismatch"),
    ],
)
def test_threshold_boundaries(score_value, expected_level):
    # 五维同值（浮点）即可构造精确目标总分；要求统一 100
    required = {k: 100 for k in MATCH_DIMENSIONS}
    actual = {k: score_value for k in MATCH_DIMENSIONS}
    result = score_match(actual, required, DEFAULT_WEIGHTS)
    assert result.score == score_value
    assert result.level == expected_level


def test_custom_thresholds_take_effect():
    """自定义 warn=70/good=85 立即生效。"""
    required = {k: 100 for k in MATCH_DIMENSIONS}
    actual = {k: 72 for k in MATCH_DIMENSIONS}  # 72 分
    default_result = score_match(actual, required, DEFAULT_WEIGHTS)
    assert default_result.level == "watch"
    custom_result = score_match(
        actual, required, DEFAULT_WEIGHTS, good=85, warn=70
    )
    assert custom_result.level == "watch"  # 72 仍 ≥70
    low_result = score_match(actual, required, DEFAULT_WEIGHTS, good=85, warn=75)
    assert low_result.level == "mismatch"  # 72 < 75


# --- TR-1.4 绩效等级映射 ------------------------------------------------------

@pytest.mark.parametrize(
    "grade,score",
    [("S", 95), ("A", 90), ("B", 80), ("C", 70), ("D", 60)],
)
def test_grade_to_score(grade, score):
    assert grade_to_score(grade) == score


def test_grade_to_score_case_insensitive_and_unknown():
    assert grade_to_score("s") == 95
    assert grade_to_score("  a ") == 90
    assert grade_to_score("X") is None
    assert grade_to_score(None) is None


def test_unknown_grade_counts_as_missing_in_engine():
    """perf 给无法映射的等级（经 grade_to_score 得 None）→ 该维不计分母。"""
    actual = {"duty": 75, "ability": 72, "contribution": 65, "knowledge": 70}
    result = score_match(actual, DEFAULT_REQUIRED, DEFAULT_WEIGHTS)
    assert result.missing_dims == ["perf"]
    assert result.score is not None  # 其余四维可算，不整体失败


def test_subset_dimensions_for_project_needs():
    """项目组队只需 2 维：其余维（即便有默认要求）不参与分母。"""
    required = {"ability": 80, "duty": 75}
    # 只提供 ability，且达标 → 单一可算维 → 100，而非被 duty 拖低
    result = score_match(
        {"ability": 80, "perf": 90},  # perf 不在子集内，忽略
        required=required,
        dimensions=("ability", "duty"),
    )
    assert result.score == 100.0
    assert result.missing_dims == ["duty"]


# --- 标签归一 -----------------------------------------------------------------

def test_normalize_dimension_key():
    assert normalize_dimension_key("能力素质") == "ability"
    assert normalize_dimension_key("ability") == "ability"
    assert normalize_dimension_key("") == ""
    assert normalize_dimension_key("未知能力") == "未知能力"


# --- TR-1.5 确定性与纯度 ------------------------------------------------------

def test_deterministic_across_repeated_calls():
    actual = {
        "perf": 88, "duty": 70, "ability": 60,
        "contribution": 80, "knowledge": 55,
    }
    first = score_match(actual, DEFAULT_REQUIRED, DEFAULT_WEIGHTS)
    for _ in range(100):
        again = score_match(actual, DEFAULT_REQUIRED, DEFAULT_WEIGHTS)
        assert again == first


def test_engine_module_has_no_io_dependencies():
    """引擎模块不得 import DB/HTTP/LLM 任何依赖。"""
    source = (
        pathlib.Path(match.__file__).read_text(encoding="utf-8").lower()
    )
    for forbidden in ("sqlalchemy", "requests", "httpx", "fastapi",
                      "app.database", "app.services.llm", "urllib"):
        assert forbidden not in source, f"引擎不得依赖 {forbidden}"


# --- 默认值 sanity ------------------------------------------------------------

def test_platform_defaults():
    assert set(DEFAULT_WEIGHTS) == set(MATCH_DIMENSIONS)
    assert sum(DEFAULT_WEIGHTS.values()) == pytest.approx(1.0)
    assert DEFAULT_GOOD == 80 and DEFAULT_WARN == 60
    assert DEFAULT_REQUIRED["duty"] == 75
    assert DEFAULT_REQUIRED["ability"] == 72
    assert DEFAULT_REQUIRED["contribution"] == 65
    assert DEFAULT_REQUIRED["knowledge"] == 70
    assert DEFAULT_REQUIRED["perf"] == 80
