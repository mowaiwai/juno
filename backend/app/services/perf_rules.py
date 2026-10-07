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
RULES_CONFIG_KEY = "perf_calibration_rules"

# 平台级等级元数据（label/definition/grid 为固定文案，不租户可配；
# 分数线/系数/分布区间走 resolve_constants）
PLATFORM_GRADE_META: list[dict] = [
    {"grade": "S", "label": "卓越", "definition": "显著超越目标，产出行业级标杆成果",
     "grid": "九宫格 1 格（明星）核心候选"},
    {"grade": "A", "label": "优秀", "definition": "全面达成并部分超越目标",
     "grid": "九宫格 1-2 格候选"},
    {"grade": "B", "label": "称职", "definition": "达成岗位要求的全部关键目标",
     "grid": "九宫格中位区间"},
    {"grade": "C", "label": "待改进", "definition": "部分目标未达成，需辅导与改进计划",
     "grid": "进入绩效改进流程"},
    {"grade": "D", "label": "不合格", "definition": "关键目标严重偏离，连续两期触发调整",
     "grid": "九宫格 9 格 · 调岗或退出"},
]

# 平台默认校准规则（租户可整体覆盖）
PLATFORM_CALIBRATION_RULES: list[dict] = [
    {"title": "建议分布", "desc": "S+A 建议不超过 20%，C+D 建议不少于 10%；人数不足 10 人的团队合并校准。"},
    {"title": "跨部门校准会", "desc": "同级拉通评议，HR 主持；校准结论需 2/3 以上评委同意方可调整等级。"},
    {"title": "绩效-潜力双维校验", "desc": "绩效等级须与潜力评估交叉校验，结果直接映射九宫格位置，禁止单维定档。"},
    {"title": "申诉窗口", "desc": "结果公示后 5 个工作日内可申诉，由 HRBP 复核并在 10 个工作日内给出结论。"},
]

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


def resolve_grade_definitions(db: Session, tenant_id: uuid.UUID) -> list[dict]:
    """等级定义：平台元数据（label/definition/grid）+ 租户生效常量（分数线/系数/分布区间）。"""
    constants = resolve_constants(db, tenant_id)
    cutoffs = constants["score_cutoffs"]
    coeffs = constants["coefficients"]
    dist = constants["distribution"]
    out = []
    for meta in PLATFORM_GRADE_META:
        g = meta["grade"]
        out.append({
            "grade": g,
            "label": meta["label"],
            "definition": meta["definition"],
            "grid": meta["grid"],
            "cutoff": float(cutoffs.get(g, 0)),
            "coefficient": float(coeffs.get(g)) if g in coeffs else None,
            "distribution_range": list(dist.get(g)) if g in dist else None,
        })
    return out


def resolve_calibration_rules(db: Session, tenant_id: uuid.UUID) -> list[dict]:
    """校准规则：平台默认 ← 租户整体覆盖（覆盖则整表替换）。"""
    row = db.get(TenantConfig, tenant_id)
    override = (row.values or {}).get(RULES_CONFIG_KEY) if row else None
    if isinstance(override, list) and override:
        return [r for r in override if isinstance(r, dict) and "title" in r and "desc" in r]
    return [dict(r) for r in PLATFORM_CALIBRATION_RULES]


def update_calibration_rules(
    db: Session,
    tenant_id: uuid.UUID,
    actor_id: uuid.UUID | None,
    rules: list[dict],
) -> list[dict]:
    """整体替换租户校准规则（空列表回落平台默认），变更留审计。"""
    row = db.get(TenantConfig, tenant_id)
    before = resolve_calibration_rules(db, tenant_id)
    if row is None:
        row = TenantConfig(tenant_id=tenant_id, values={})
        db.add(row)
    current = dict(row.values or {})
    if rules:
        current[RULES_CONFIG_KEY] = rules
    else:
        current.pop(RULES_CONFIG_KEY, None)
    row.values = current
    db.flush()
    after = resolve_calibration_rules(db, tenant_id)
    audit(
        db, tenant_id, actor_id,
        "perf_calibration_rules_updated", "tenant_config", tenant_id,
        {"rules": before}, {"rules": after},
    )
    return after
