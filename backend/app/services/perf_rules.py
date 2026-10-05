"""绩效 SABC 规则常量与计算服务（ADR-0016 / P1 绩效内生 spec）。

- PLATFORM_PERF_CONSTANTS：平台默认（分数线/系数/C 档分母/分布区间/小团队阈值）。
- 租户覆盖存 tenant_configs.values["perf_constants"]，按叶子键合并，
  未配置项回落平台默认；配置变更写审计。
"""
from __future__ import annotations

import copy
import numbers
import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.models.tenant_config import TenantConfig
from app.services.audit import audit

PERF_GRADES = ("S", "A", "B", "C", "D")

CONFIG_KEY = "perf_constants"

PLATFORM_PERF_CONSTANTS: dict[str, Any] = {
    # 分数带：score >= 该档分数线即落该档（D 兜底）
    "score_cutoffs": {"S": 95, "A": 90, "B": 80, "C": 65, "D": 0},
    # 固定系数；C 档不用此表，按 score / c_divisor 计算
    "coefficients": {"S": 1.5, "A": 1.2, "B": 1.0, "D": 0.5},
    "c_divisor": 80,
    # 强制分布建议区间（占比上下限）；CD 为 C+D 合计
    "distribution": {
        "S": [0.0, 0.05],
        "A": [0.0, 0.15],
        "B": [0.15, 0.80],
        "CD": [0.0, 0.10],
    },
    # 名册人数小于该值时分布仅提示、不要求覆盖理由（spec AS-3）
    "small_roster_threshold": 10,
}

_GRADE_ORDER = ("S", "A", "B", "C")


def resolve_constants(db: Session, tenant_id: uuid.UUID) -> dict[str, Any]:
    """生效常量：平台默认 ← 租户覆盖（一层叶子合并）。"""
    merged = copy.deepcopy(PLATFORM_PERF_CONSTANTS)
    row = db.get(TenantConfig, tenant_id)
    override = (row.values or {}).get(CONFIG_KEY) if row else None
    if isinstance(override, dict):
        for key, value in override.items():
            if key not in PLATFORM_PERF_CONSTANTS:
                continue
            if isinstance(PLATFORM_PERF_CONSTANTS[key], dict) and isinstance(value, dict):
                merged[key].update(value)
            else:
                merged[key] = value
    return merged


def update_constants(
    db: Session,
    tenant_id: uuid.UUID,
    actor_id: uuid.UUID | None,
    patch: dict[str, Any],
) -> dict[str, Any]:
    """校验并写入租户覆盖；返回更新后的完整生效常量。变更留审计。"""
    if not patch:
        raise ValueError("覆盖内容为空")
    unknown = set(patch) - set(PLATFORM_PERF_CONSTANTS)
    if unknown:
        raise ValueError(f"未知配置项: {sorted(unknown)}")
    _validate_patch(patch)

    row = db.get(TenantConfig, tenant_id)
    before_full = resolve_constants(db, tenant_id)
    if row is None:
        row = TenantConfig(tenant_id=tenant_id, values={})
        db.add(row)
    current = dict(row.values or {})
    stored = dict(current.get(CONFIG_KEY) or {})
    stored.update(patch)
    current[CONFIG_KEY] = stored
    row.values = current
    db.flush()

    after_full = resolve_constants(db, tenant_id)
    audit(
        db, tenant_id, actor_id,
        "perf_constants_updated", "tenant_config", tenant_id,
        {k: before_full[k] for k in patch},
        {k: after_full[k] for k in patch},
    )
    return after_full


def _validate_patch(patch: dict[str, Any]) -> None:
    if "score_cutoffs" in patch:
        val = patch["score_cutoffs"]
        if not isinstance(val, dict):
            raise ValueError("score_cutoffs 必须为各档分数线对象")
        for grade, num in val.items():
            if grade not in PERF_GRADES or not _is_number(num) or not (0 <= num <= 100):
                raise ValueError(f"非法分数线: {grade}={num}")
    if "coefficients" in patch:
        val = patch["coefficients"]
        if not isinstance(val, dict):
            raise ValueError("coefficients 必须为各档系数对象")
        for grade, num in val.items():
            if grade not in ("S", "A", "B", "D") or not _is_number(num) or num < 0:
                raise ValueError(f"非法系数: {grade}={num}")
    if "c_divisor" in patch:
        num = patch["c_divisor"]
        if not _is_number(num) or num <= 0:
            raise ValueError("c_divisor 必须为正数")
    if "distribution" in patch:
        val = patch["distribution"]
        if not isinstance(val, dict):
            raise ValueError("distribution 必须为区间对象")
        for grade, rng in val.items():
            if grade not in ("S", "A", "B", "CD"):
                raise ValueError(f"未知分布档: {grade}")
            if (
                not isinstance(rng, (list, tuple)) or len(rng) != 2
                or not all(_is_number(x) and 0 <= x <= 1 for x in rng)
                or rng[0] > rng[1]
            ):
                raise ValueError(f"非法分布区间: {grade}={rng}")
    if "small_roster_threshold" in patch:
        num = patch["small_roster_threshold"]
        if not isinstance(num, int) or num < 0:
            raise ValueError("small_roster_threshold 必须为非负整数")


def _is_number(value: Any) -> bool:
    return isinstance(value, numbers.Number) and not isinstance(value, bool)


def grade_for_score(constants: dict[str, Any], score: float) -> str:
    """按生效分数线定档：从 S 起逐档比较，均不满足则 D。"""
    cutoffs = constants["score_cutoffs"]
    for grade in _GRADE_ORDER:
        if score >= cutoffs[grade]:
            return grade
    return "D"


def coefficient_for(
    constants: dict[str, Any], grade: str, score: float | None = None
) -> float:
    """绩效系数：S/A/B/D 取常量表；C=score÷c_divisor（C 必须提供分数）。"""
    if grade not in PERF_GRADES:
        raise ValueError(f"未知绩效等级: {grade}")
    if grade == "C":
        if score is None:
            raise ValueError("C 档必须提供分数才能计算系数")
        return round(score / constants["c_divisor"], 4)
    return float(constants["coefficients"][grade])
