import uuid

from sqlalchemy import JSON, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AuditLog(Base):
    """审计日志：只增不删，随认证记录同生命周期。"""

    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("employees.id"), nullable=True, index=True
    )
    # application.submit / application.withdraw / manager_review.submit /
    # review.claim / review.release / review.opinion / decision.final / publish /
    # evidence.upload / ai.generate
    action: Mapped[str] = mapped_column(String(64), index=True)
    entity_type: Mapped[str] = mapped_column(String(64))
    # 批量动作（如 gaps_analyzed、role_granted）无单一实体，可空（ADR-0014）
    entity_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, index=True, nullable=True
    )
    before: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    after: Mapped[dict | None] = mapped_column(JSON, nullable=True)
