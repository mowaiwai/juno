from datetime import datetime, timedelta, timezone
import uuid

from sqlalchemy import func, select, update

from app.models.application import Application, ApplicationStatus
from app.models.review import ReviewPanelTemplate, ReviewTask
from app.models.tenant_config import DEFAULT_TENANT_CONFIG, TenantConfig


def _config(db, tenant_id) -> dict:
    row = db.get(TenantConfig, tenant_id)
    config = dict(DEFAULT_TENANT_CONFIG)
    if row and row.values:
        config.update(row.values)
    return config


def active_template(db, tenant_id, sequence) -> ReviewPanelTemplate | None:
    return db.scalar(
        select(ReviewPanelTemplate).where(
            ReviewPanelTemplate.tenant_id == tenant_id,
            ReviewPanelTemplate.sequence == sequence,
            ReviewPanelTemplate.is_active.is_(True),
        )
    )


def _create_tasks(db, application: Application, template: ReviewPanelTemplate) -> None:
    db.add_all(
        [
            ReviewTask(
                application_id=application.id,
                assignee_id=template.lead_reviewer_id,
                role="lead",
            ),
            *[
                ReviewTask(
                    application_id=application.id,
                    assignee_id=reviewer_id,
                    role="reviewer",
                )
                for reviewer_id in template.reviewer_ids
            ],
        ]
    )


def ensure_review_tasks(db, application: Application) -> bool:
    """进评审后补派任务：已有任务则跳过；无 active 模板则等待（返回 False）。"""
    existing = db.scalar(
        select(func.count(ReviewTask.id)).where(
            ReviewTask.application_id == application.id
        )
    )
    if existing:
        return True

    template = active_template(
        db, application.tenant_id, application.target_sequence
    )
    if template is None:
        return False

    _create_tasks(db, application, template)
    db.flush()
    return True


def backfill_for_template(db, template: ReviewPanelTemplate) -> int:
    """模板新建/更新后，为在评审中、同序列、无任务的申请补派。返回补派单数。"""
    applications = db.scalars(
        select(Application).where(
            Application.tenant_id == template.tenant_id,
            Application.target_sequence == template.sequence,
            Application.status == ApplicationStatus.IN_COMMITTEE_REVIEW,
        )
    ).all()
    count = 0
    for application in applications:
        existing = db.scalar(
            select(func.count(ReviewTask.id)).where(
                ReviewTask.application_id == application.id
            )
        )
        if not existing:
            _create_tasks(db, application, template)
            count += 1
    db.flush()
    return count


# ---- 申请级悲观锁 ----

def claim_lock(
    db, application: Application, employee_id: uuid.UUID
) -> datetime | None:
    """原子认领：锁空闲/已超时/本来就是自己的 → 加锁 30 分钟，返回截止时间。

    用条件 UPDATE 保证原子，避免先查后写的竞态。
    """
    now = datetime.now(timezone.utc)
    lock_minutes = int(_config(db, application.tenant_id)["review_lock_minutes"])
    until = now + timedelta(minutes=lock_minutes)

    result = db.execute(
        update(Application)
        .where(
            Application.id == application.id,
            (
                Application.review_locked_by.is_(None)
                | (Application.review_locked_by == employee_id)
                | (Application.review_locked_until < now)
            ),
        )
        .values(review_locked_by=employee_id, review_locked_until=until)
    )
    if result.rowcount == 0:
        return None
    db.flush()
    return until


def is_lock_holder(application: Application, employee_id: uuid.UUID) -> bool:
    now = datetime.now(timezone.utc)
    return (
        application.review_locked_by == employee_id
        and application.review_locked_until is not None
        and application.review_locked_until > now
    )


def release_lock(db, application: Application, employee_id: uuid.UUID) -> bool:
    if not is_lock_holder(application, employee_id):
        return False
    application.review_locked_by = None
    application.review_locked_until = None
    db.flush()
    return True
