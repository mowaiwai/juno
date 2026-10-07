"""离职风险预警模型（P3 远期能力）。

PRD 口径：演示库无历史离职样本，不训练概率模型；采用「显式信号规则 + 风险分档」，
阈值/权重租户可配，输出仅标注规则参考、不自动触发任何动作。
"""
import uuid

from sqlalchemy import Boolean, JSON, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


# 默认信号阈值（月数 / 等级集合）
DEFAULT_THRESHOLDS = {
    "low_perf_grades": ["C", "D"],
    "high_perf_grades": ["S", "A"],
    "stale_raise_months": 18,
    "stale_promotion_months": 36,
}

# 默认信号权重（命中即累加）
DEFAULT_WEIGHTS = {
    "low_perf": 2,            # 当期低绩效
    "stale_raise": 1,         # 久未调薪
    "high_perf_stale_raise": 2,  # 高绩效却久未调薪（薪酬倒挂）
    "stale_promotion": 1,     # 同职级停留过久
}

# 风险分档阈值（score >= high → 高风险；>= medium → 中风险）
DEFAULT_BUCKETS = {"medium": 2, "high": 4}


class TurnoverSignalConfig(Base):
    """租户级离职信号配置（每租户一行）。"""

    __tablename__ = "turnover_signal_configs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, unique=True, index=True)
    thresholds: Mapped[dict] = mapped_column(JSON, default=lambda: dict(DEFAULT_THRESHOLDS))
    weights: Mapped[dict] = mapped_column(JSON, default=lambda: dict(DEFAULT_WEIGHTS))
    buckets: Mapped[dict] = mapped_column(JSON, default=lambda: dict(DEFAULT_BUCKETS))
    is_default: Mapped[bool] = mapped_column(Boolean, default=True)
