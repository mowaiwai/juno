"""审计日志服务：统一入口，只增不删。"""
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.audit import AuditLog
from app.models.employee import Employee
from app.models.user import User


def audit(
    db: Session,
    tenant_id,
    actor_id,
    action: str,
    entity_type: str,
    entity_id,
    before: dict | None = None,
    after: dict | None = None,
) -> AuditLog:
    log = AuditLog(
        tenant_id=tenant_id,
        actor_id=actor_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        before=before,
        after=after,
    )
    db.add(log)
    db.flush()
    return log


def audit_as(
    db: Session,
    user: User,
    action: str,
    entity_type: str,
    entity_id,
    before: dict | None = None,
    after: dict | None = None,
) -> AuditLog:
    """以登录用户身份记审计：actor_id 解析为其 Employee.id，无档案则 None。"""
    actor_id = db.scalar(
        select(Employee.id).where(Employee.user_id == user.id)
    )
    return audit(
        db, user.tenant_id, actor_id, action, entity_type, entity_id,
        before, after,
    )


def application_status_audit(
    db: Session,
    application,
    actor_id,
    action: str,
    before_status: str,
    after_status: str,
) -> None:
    audit(
        db,
        application.tenant_id,
        actor_id,
        action,
        "application",
        application.id,
        {"status": before_status},
        {"status": after_status},
    )
