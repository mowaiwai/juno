"""租户匹配度配置数据模型（PRD 模块四 P3）。

每租户至多一行：五维权重、五维要求基准、good/warn 阈值。
无记录时引擎使用 services.match.DEFAULT_CONFIG 平台默认。
"""

import uuid

from sqlalchemy import JSON, Integer, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class MatchTenantConfig(Base):
    """租户匹配配置（整体替换式更新）。"""

    __tablename__ = "match_tenant_configs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, unique=True, index=True)
    weights: Mapped[dict] = mapped_column(JSON, default=dict)
    required: Mapped[dict] = mapped_column(JSON, default=dict)
    good_threshold: Mapped[int] = mapped_column(Integer)
    warn_threshold: Mapped[int] = mapped_column(Integer)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
