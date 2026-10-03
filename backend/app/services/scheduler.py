"""每日定时任务：超期单推进 + 经理催办。

逻辑与 /api/internal/* 端点同源（端点按租户手动触发，本模块跨租户定时执行）。
多实例/多 worker 用 PostgreSQL advisory lock 去重，同一时刻只跑一份。
"""
import logging
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.application import Application, ApplicationStatus
from app.models.notification import Notification
from app.services.notification import manager_reminder
from app.services.review import ensure_review_tasks
from app.workers.ai_worker import run_ai_generation

logger = logging.getLogger("juno.scheduler")

# "JUNO" 的十六进制，作为会话级 advisory lock 的固定键
ADVISORY_KEY = 0x4A554E4F


def run_daily_jobs(db: Session, tenant_id=None) -> dict:
    """推进超期单并补发催办；tenant_id 为空时覆盖全部租户。"""
    now = datetime.now(timezone.utc)

    advanced = _advance_timeouts(db, now, tenant_id)
    reminders_sent = _send_reminders(db, now, tenant_id)
    db.commit()

    # 超期单触发 AI 异步生成（独立会话，失败不影响主流程）
    for application_id in advanced:
        try:
            run_ai_generation(application_id)
        except Exception:
            logger.exception("超期单 AI 生成失败 application_id=%s", application_id)

    return {"advanced": len(advanced), "reminders_sent": reminders_sent}


def _advance_timeouts(db: Session, now: datetime, tenant_id) -> list:
    """SUBMITTED 且过经理截止时间 → IN_COMMITTEE_REVIEW（视为无异议通过）。"""
    stmt = select(Application).where(
        Application.status == ApplicationStatus.SUBMITTED,
        Application.manager_deadline_at.is_not(None),
        Application.manager_deadline_at < now,
    )
    if tenant_id is not None:
        stmt = stmt.where(Application.tenant_id == tenant_id)

    expired = db.scalars(stmt).all()
    advanced_ids = []
    for application in expired:
        application.status = ApplicationStatus.IN_COMMITTEE_REVIEW
        advanced_ids.append(application.id)
    db.flush()
    for application in expired:
        ensure_review_tasks(db, application)
    return advanced_ids


def _send_reminders(db: Session, now: datetime, tenant_id) -> int:
    """SUBMITTED 单提交满 3 / 6 个自然日时各提醒经理一次（按天去重）。"""
    stmt = select(Application).where(
        Application.status == ApplicationStatus.SUBMITTED,
        Application.submitted_at.is_not(None),
        Application.manager_id.is_not(None),
    )
    if tenant_id is not None:
        stmt = stmt.where(Application.tenant_id == tenant_id)

    sent = 0
    for application in db.scalars(stmt).all():
        age_days = (now - application.submitted_at).total_seconds() / 86400

        existing_days = {
            n.payload.get("day")
            for n in db.scalars(
                select(Notification).where(
                    Notification.tenant_id == application.tenant_id,
                    Notification.recipient_id == application.manager_id,
                    Notification.type == "review_reminder",
                )
            ).all()
            if n.payload.get("application_id") == str(application.id)
        }

        for day in (6, 3):  # 先补晚的：极端超期时两条都要发
            if age_days >= day and day not in existing_days:
                manager_reminder(db, application, day)
                existing_days.add(day)
                sent += 1
    return sent


def run_daily_jobs_with_lock() -> dict:
    """带 advisory lock 的每日任务，供定时调度调用。

    PostgreSQL：抢不到锁说明另一实例正在执行，直接跳过。
    其他数据库（如本地 SQLite）：不加锁直接执行。
    """
    db = SessionLocal()
    locked = False
    try:
        if db.bind.dialect.name == "postgresql":
            locked = db.execute(select(func.pg_try_advisory_lock(ADVISORY_KEY))).scalar()
            if not locked:
                logger.info("每日任务已在另一实例执行，跳过")
                return {"skipped": "locked"}
        return run_daily_jobs(db)
    finally:
        if locked:
            db.execute(select(func.pg_advisory_unlock(ADVISORY_KEY)))
        db.close()
