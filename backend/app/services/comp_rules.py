"""薪酬激励规则配置服务（ADR-0016 / P2 薪酬激励 spec）。

平台默认：
- adjust_matrix：SABC 五档 × 渗透率四档 的建议涨薪%矩阵。
- penetration_bands：渗透率分档分界 [0.40, 0.70, 0.90]。
- market_stop：停涨市场分位线（默认 p75），现薪≥该分位市场薪点时覆写建议 0%。
- pay_mix：序列→目标奖金月数（SW=3/MGT=4/SALES=6/默认 3）。
- pip_fail_adjust_pct：D+PIP 不通过降薪比例（默认 -10%）。

租户覆盖存 tenant_configs.values["comp_rules"]，按叶子键合并，
未配置项回落平台默认；配置变更写审计。
"""
from __future__ import annotations

import copy
import numbers
import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.models.tenant_config import TenantConfig
from app.services.audit import audit

CONFIG_KEY = "comp_rules"

MATRIX_GRADES = ("S", "A", "B", "C", "D")
# 渗透率四档：<0.40 / 0.40–0.70 / 0.70–0.90 / ≥0.90
PENETRATION_BANDS = (0.40, 0.70, 0.90)
# 可配的停涨市场分位线（对应 tenant_salary_bands 列名）
MARKET_STOP_KEYS = ("p25", "p50", "p75", "p90")

PLATFORM_COMP_RULES: dict[str, Any] = {
    "adjust_matrix": {
        "S": [8, 10, 12, 15],
        "A": [5, 6, 8, 10],
        "B": [0, 2, 3, 5],
        "C": [0, 0, 0, 0],
        "D": [0, 0, 0, 0],
    },
    "penetration_bands": list(PENETRATION_BANDS),
    "market_stop": "p75",
    "pay_mix": {"SW": 3, "MGT": 4, "SALES": 6, "default": 3},
    "pip_fail_adjust_pct": -10,
}


def resolve_comp_rules(db: Session, tenant_id: uuid.UUID) -> dict[str, Any]:
    """生效规则：平台默认 ← 租户覆盖（一层叶子合并）。"""
    merged = copy.deepcopy(PLATFORM_COMP_RULES)
    row = db.get(TenantConfig, tenant_id)
    override = (row.values or {}).get(CONFIG_KEY) if row else None
    if isinstance(override, dict):
        for key, value in override.items():
            if key not in PLATFORM_COMP_RULES:
                continue
            if isinstance(PLATFORM_COMP_RULES[key], dict) and isinstance(value, dict):
                merged[key].update(value)
            else:
                merged[key] = value
    return merged


def update_comp_rules(
    db: Session,
    tenant_id: uuid.UUID,
    actor_id: uuid.UUID | None,
    patch: dict[str, Any],
) -> dict[str, Any]:
    """校验并写入租户覆盖；返回更新后的完整生效规则。变更留审计。"""
    if not patch:
        raise ValueError("覆盖内容为空")
    unknown = set(patch) - set(PLATFORM_COMP_RULES)
    if unknown:
        raise ValueError(f"未知配置项: {sorted(unknown)}")
    _validate_patch(patch)

    row = db.get(TenantConfig, tenant_id)
    before_full = resolve_comp_rules(db, tenant_id)
    if row is None:
        row = TenantConfig(tenant_id=tenant_id, values={})
        db.add(row)
    current = dict(row.values or {})
    stored = dict(current.get(CONFIG_KEY) or {})
    stored.update(patch)
    current[CONFIG_KEY] = stored
    row.values = current
    db.flush()

    after_full = resolve_comp_rules(db, tenant_id)
    audit(
        db, tenant_id, actor_id,
        "comp_rules_updated", "tenant_config", tenant_id,
        {k: before_full[k] for k in patch},
        {k: after_full[k] for k in patch},
    )
    return after_full


def _validate_patch(patch: dict[str, Any]) -> None:
    if "adjust_matrix" in patch:
        val = patch["adjust_matrix"]
        if not isinstance(val, dict):
            raise ValueError("adjust_matrix 必须为 SABC 五档矩阵对象")
        for grade, row in val.items():
            if grade not in MATRIX_GRADES:
                raise ValueError(f"未知矩阵行: {grade}")
            if (
                not isinstance(row, (list, tuple)) or len(row) != 4
                or not all(_is_number(x) for x in row)
            ):
                raise ValueError(f"矩阵行必须为 4 个数字: {grade}={row}")
    if "penetration_bands" in patch:
        val = patch["penetration_bands"]
        if (
            not isinstance(val, (list, tuple)) or len(val) != 3
            or not all(_is_number(x) and 0 < x < 1 for x in val)
            or not (val[0] < val[1] < val[2])
        ):
            raise ValueError("penetration_bands 必须为 3 个递增的 (0,1) 浮点数")
    if "market_stop" in patch:
        key = patch["market_stop"]
        if not isinstance(key, str) or key not in MARKET_STOP_KEYS:
            raise ValueError(
                f"market_stop 必须为分位线键之一: {', '.join(MARKET_STOP_KEYS)}"
            )
    if "pay_mix" in patch:
        val = patch["pay_mix"]
        if not isinstance(val, dict):
            raise ValueError("pay_mix 必须为序列→月数对象")
        for seq, months in val.items():
            if not isinstance(seq, str) or not _is_number(months) or months < 0:
                raise ValueError(f"非法固浮比: {seq}={months}")
    if "pip_fail_adjust_pct" in patch:
        num = patch["pip_fail_adjust_pct"]
        if not _is_number(num) or num > 0:
            raise ValueError("pip_fail_adjust_pct 必须为非正数（降薪）")


def _is_number(value: Any) -> bool:
    return isinstance(value, numbers.Number) and not isinstance(value, bool)


def penetration_band_index(penetration: float, bands: list[float]) -> int:
    """渗透率落档索引：0=<b0 / 1=b0–b1 / 2=b1–b2 / 3=≥b2。"""
    b0, b1, b2 = bands[0], bands[1], bands[2]
    if penetration < b0:
        return 0
    if penetration < b1:
        return 1
    if penetration < b2:
        return 2
    return 3


def suggest_adjust_pct(
    rules: dict[str, Any], grade: str, penetration: float, pip_failed: bool
) -> tuple[float, str | None]:
    """返回 (建议涨薪%, 标记)。D+PIP 不通过降薪；停涨硬覆写在测算服务按市场薪点判定。"""
    if pip_failed:
        return float(rules["pip_fail_adjust_pct"]), "pip_fail"
    matrix = rules["adjust_matrix"]
    if grade not in matrix:
        return 0.0, None
    idx = penetration_band_index(penetration, rules["penetration_bands"])
    return float(matrix[grade][idx]), None


def hits_market_stop(salary, stop_value) -> bool:
    """现薪是否命中停涨市场分位线（现薪 ≥ 该分位市场薪点）。

    无市场分位数据（stop_value 为 None）时不触发停涨。
    """
    if stop_value is None:
        return False
    return Decimal(str(salary)) >= Decimal(str(stop_value))


def pay_mix_months(rules: dict[str, Any], sequence: str) -> float:
    """序列目标奖金月数，未配置序列回落 default。"""
    pm = rules["pay_mix"]
    return float(pm.get(sequence, pm.get("default", 3)))


def penetration_rate(salary: int | float, min_value: int, max_value: int) -> float:
    """现薪在带宽中的渗透率 (现薪-下限)/(上限-下限)，截断到 [0, 1]。"""
    if max_value <= min_value:
        return 0.0
    p = (float(salary) - min_value) / (max_value - min_value)
    return max(0.0, min(1.0, p))
