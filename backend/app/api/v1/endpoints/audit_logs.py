import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import Principal, require_perm
from app.database import get_db
from app.models.audit import AuditLog

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])


class AuditLogOut(BaseModel):
    id: uuid.UUID
    actor_id: uuid.UUID | None
    action: str
    entity_type: str
    entity_id: uuid.UUID
    before: dict | None
    after: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("", response_model=list[AuditLogOut])
def list_audit_logs(
    entity_id: uuid.UUID | None = None,
    action: str | None = None,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_perm("audit.view")),
):
    user = principal.user
    """审计日志查询：本租户内，可按实体与动作过滤。只增不删。"""
    stmt = select(AuditLog).where(AuditLog.tenant_id == user.tenant_id)
    if entity_id is not None:
        stmt = stmt.where(AuditLog.entity_id == entity_id)
    if action is not None:
        stmt = stmt.where(AuditLog.action == action)
    return db.scalars(
        stmt.order_by(AuditLog.created_at.desc())
    ).all()
