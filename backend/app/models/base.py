from datetime import datetime

from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.models.types import UTCDateTime


def _utcnow() -> datetime:
    from datetime import timezone

    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    # 所有业务表统一带创建/更新时间（spec：所有业务表含 created_at、updated_at）
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=_utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=_utcnow, onupdate=_utcnow, nullable=False
    )
