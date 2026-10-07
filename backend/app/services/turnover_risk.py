"""离职风险：配置读取/更新 + 显式信号评估服务。"""
from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.models.turnover_risk import (
    DEFAULT_BUCKETS,
    DEFAULT_THRESHOLDS,
    DEFAULT_WEIGHTS,
    TurnoverSignalConfig,
)

SIGNAL_LABELS = {
    "low_perf": "当期绩效偏低",
    "stale_raise": "久未调薪",
    "high_perf_stale_raise": "高绩效却久未调薪（薪酬倒挂）",
    "stale_promotion": "同职级停留过久",
}


def get_turnover_config(db: Session, tenant_id) -> TurnoverSignalConfig:
    cfg = db.scalar(
        select(TurnoverSignalConfig).where(TurnoverSignalConfig.tenant_id == tenant_id)
    )
    if cfg is None:
        cfg = TurnoverSignalConfig(
            tenant_id=tenant_id,
            thresholds=dict(DEFAULT_THRESHOLDS),
            weights=dict(DEFAULT_WEIGHTS),
            buckets=dict(DEFAULT_BUCKETS),
            is_default=True,
        )
        db.add(cfg)
        db.flush()
    return cfg


def _months_between(d: date, today: date) -> float:
    return (today - d).days / 30.44


def evaluate_employee(emp: Employee, cfg: TurnoverSignalConfig, today: date) -> dict | None:
    """评估单个在職员工，返回 {score, bucket, signals:[{key,label,detail}]}。

    数据缺失的信号不计入（守「绝不造分」），不产生概率。
    """
    if not emp.is_active:
        return None

    t = cfg.thresholds
    w = cfg.weights
    fired: list[dict] = []

    perf = (emp.perf_grade or "").upper()
    is_low = perf in [g.upper() for g in t.get("low_perf_grades", [])]
    is_high = perf in [g.upper() for g in t.get("high_perf_grades", [])]

    if is_low:
        fired.append({
            "key": "low_perf",
            "label": SIGNAL_LABELS["low_perf"],
            "detail": f"当期绩效 {perf or '—'}",
        })

    # 久未调薪：需要有调薪时间，缺失则该信号不计入
    stale_raise = False
    raise_months = None
    if emp.salary_updated_at is not None:
        raise_months = _months_between(emp.salary_updated_at.date(), today)
        if raise_months >= t.get("stale_raise_months", 18):
            stale_raise = True
            fired.append({
                "key": "stale_raise",
                "label": SIGNAL_LABELS["stale_raise"],
                "detail": f"距上次调薪 {raise_months:.0f} 个月",
            })

    if is_high and stale_raise:
        fired.append({
            "key": "high_perf_stale_raise",
            "label": SIGNAL_LABELS["high_perf_stale_raise"],
            "detail": f"绩效 {perf} 但 {raise_months:.0f} 个月未调薪",
        })

    # 同职级停留时长
    grade_months = _months_between(emp.grade_since, today)
    if grade_months >= t.get("stale_promotion_months", 36):
        fired.append({
            "key": "stale_promotion",
            "label": SIGNAL_LABELS["stale_promotion"],
            "detail": f"{emp.grade} 职级已停留 {grade_months:.0f} 个月",
        })

    score = sum(w.get(s["key"], 0) for s in fired)
    high = cfg.buckets.get("high", 4)
    medium = cfg.buckets.get("medium", 2)
    bucket = "high" if score >= high else ("medium" if score >= medium else "low")

    return {"score": score, "bucket": bucket, "signals": fired}
