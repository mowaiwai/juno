import uuid

from sqlalchemy import JSON, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

# 租户配置默认值（spec §4.14）
DEFAULT_TENANT_CONFIG = {
    "manager_review_deadline_days": 7,
    "resubmit_window_days": 30,
    "resubmit_max_count": 2,
    "min_years_in_grade": 1,
    "min_perf_grade": "B",
    "review_lock_minutes": 30,
}


class TenantConfig(Base):
    """每租户一行的键值配置；无记录时使用 DEFAULT_TENANT_CONFIG。"""

    __tablename__ = "tenant_configs"

    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    values: Mapped[dict] = mapped_column(JSON, default=dict)
