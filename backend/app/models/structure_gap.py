"""人才缺口预测配置数据模型（spec structure-gap-forecast）。

两张轻量配置表：
- SequenceLevelHeadcount：序列 × 层级标准编制（需求侧唯一事实源）；
- StructureGapConfig：梯队折算系数（每租户至多一行，无记录走平台默认）。
"""

import uuid

from sqlalchemy import Float, Integer, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SequenceLevelHeadcount(Base):
    """序列 × 层级标准编制（租户维护，整体替换式更新）。"""

    __tablename__ = "sequence_level_headcounts"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "sequence", "level_order",
            name="seq_level_headcounts_tenant_seq_level_uc",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    sequence: Mapped[str] = mapped_column(String(32))
    level_order: Mapped[int] = mapped_column(Integer)
    headcount: Mapped[int] = mapped_column(Integer)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)


class StructureGapConfig(Base):
    """梯队折算系数（L1/L2/L3 池级 → 供给当量），每租户至多一行。"""

    __tablename__ = "structure_gap_configs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, unique=True, index=True)
    factor_l1: Mapped[float] = mapped_column(Float)
    factor_l2: Mapped[float] = mapped_column(Float)
    factor_l3: Mapped[float] = mapped_column(Float)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
