"""招聘场景的匹配数据装配：面试记录评分 → 引擎五维实际分。"""

from app.services.match import (
    MATCH_DIMENSION_SET,
    normalize_dimension_key,
    to_score,
)


def interview_dimension_actual(dimension_scores: list | None) -> dict:
    """面试评分项 → 引擎五维实际分。

    项形如 {"dimension"/"key"/"dim"/"label"/"name": 标签或 key,
    "score"/"value": 0-100}；无法归一到五维的键忽略，缺键按缺维处理，不补零。
    """
    actual: dict[str, float] = {}
    for item in dimension_scores or []:
        if not isinstance(item, dict):
            continue
        ident = (
            item.get("key")
            or item.get("dimension")
            or item.get("dim")
            or item.get("label")
            or item.get("name")
        )
        if ident is None:
            continue
        key = normalize_dimension_key(str(ident))
        # score 键显式为 None 时回退 value（Minor-3）
        raw = item.get("score")
        if raw is None:
            raw = item.get("value")
        score = to_score(raw)
        if key in MATCH_DIMENSION_SET and score is not None:
            actual[key] = score
    return actual
