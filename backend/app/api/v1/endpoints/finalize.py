import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import (
    err,
    require_active_roles_user,
    require_perm_user,
)
from app.database import get_db
from app.models.ai import AISuggestion
from app.models.application import Application, ApplicationStatus, Decision
from app.models.employee import Employee
from app.models.review import ReviewTask
from app.models.user import Role, User
from app.schemas.application import ApplicationListItem, DecisionIn
from app.services.audit import application_status_audit
from app.services.notification import (
    application_published,
    lead_decision_decided,
)
from app.services.review import is_lock_holder

router = APIRouter(tags=["finalize"])

# 认证全租户列表与发布：COE·组织与人才发展 / 任职资格管理委员会（panel.manage）
_cert_admin = require_perm_user("panel.manage")


def _employee_of(db: Session, user: User) -> Employee:
    return db.scalar(select(Employee).where(Employee.user_id == user.id))


def _get_owned_application(
    db: Session, application_id, tenant_id
) -> Application:
    application = db.scalar(
        select(Application).where(
            Application.id == application_id,
            Application.tenant_id == tenant_id,
        )
    )
    if application is None:
        raise err(404, "not_found", "申请单不存在")
    return application


def _list_item(application: Application) -> ApplicationListItem:
    return ApplicationListItem(
        id=application.id,
        target_sequence=application.target_sequence,
        target_grade=application.target_grade,
        status=application.status.value,
        submitted_at=application.submitted_at,
        decided_at=application.decided_at,
        published_at=application.published_at,
    )


def _list_item_with_name(db: Session, application: Application) -> ApplicationListItem:
    item = _list_item(application)
    employee = db.get(Employee, application.employee_id)
    item.employee_name = employee.name if employee else None
    return item


# ---- 认证管理：全租户申请列表 ----

@router.get("/applications", response_model=list[ApplicationListItem])
def list_all_applications(
    status: ApplicationStatus | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(_cert_admin),
):
    stmt = select(Application).where(
        Application.tenant_id == user.tenant_id
    )
    if status is not None:
        stmt = stmt.where(Application.status == status)
    rows = db.scalars(
        stmt.order_by(Application.created_at.desc())
    ).all()
    return [_list_item_with_name(db, a) for a in rows]


# ---- 组长终裁 ----

@router.post(
    "/applications/{application_id}/decision",
    response_model=ApplicationListItem,
)
def submit_decision(
    application_id: uuid.UUID,
    body: DecisionIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_active_roles_user(Role.LEAD_REVIEWER)),
):
    lead = _employee_of(db, user)
    application = _get_owned_application(db, application_id, user.tenant_id)

    if application.status != ApplicationStatus.IN_COMMITTEE_REVIEW:
        raise err(409, "not_in_review", "仅评审中的申请可终裁")

    # 必须是被派单给本单的 lead（其他组长/评委不可越权）
    lead_task = db.scalar(
        select(ReviewTask).where(
            ReviewTask.application_id == application.id,
            ReviewTask.assignee_id == lead.id if lead else None,
            ReviewTask.role == "lead",
        )
    )
    if lead_task is None:
        raise err(403, "forbidden", "你不是该申请的评审组长")

    if not is_lock_holder(application, lead.id):
        raise err(409, "not_lock_holder", "请先认领并在持锁期间提交终裁")

    comment = body.comment.strip()
    if not comment:
        raise err(422, "comment_required", "终裁必须填写意见说明")

    ai_suggestion_id = None
    if body.ai_suggestion_id is not None:
        ai_row = db.scalar(
            select(AISuggestion).where(
                AISuggestion.id == body.ai_suggestion_id,
                AISuggestion.application_id == application.id,
            )
        )
        if ai_row is None:
            raise err(
                422,
                "ai_suggestion_not_found",
                "引用的 AI 产出不存在或不属于本申请",
            )
        ai_suggestion_id = ai_row.id

    db.add(
        Decision(
            application_id=application.id,
            decision=body.decision,
            comment=comment,
            interview_notes=(
                body.interview_notes.strip() or None
                if body.interview_notes
                else None
            ),
            ai_suggestion_id=ai_suggestion_id,
            reviewer_id=lead.id,
        )
    )
    application.status = (
        ApplicationStatus.APPROVED
        if body.decision == "approved"
        else ApplicationStatus.REJECTED
    )
    application.decided_at = datetime.now(timezone.utc)
    # 终裁后锁无意义，立即释放
    application.review_locked_by = None
    application.review_locked_until = None
    db.flush()

    # 审计终裁；通知员工评审结果
    application_status_audit(
        db, application, lead.id,
        "decision.final", "in_committee_review", application.status.value,
    )
    lead_decision_decided(db, application)

    db.commit()
    db.refresh(application)
    return _list_item(application)


# ---- 认证管理：发布 ----

@router.post(
    "/applications/{application_id}/publish",
    response_model=ApplicationListItem,
)
def publish_application(
    application_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(_cert_admin),
):
    application = _get_owned_application(db, application_id, user.tenant_id)
    if application.status != ApplicationStatus.APPROVED:
        raise err(
            409,
            "not_approved",
            "仅评审通过、待发布的申请可执行发布",
        )

    employee = db.get(Employee, application.employee_id)
    employee.grade = application.target_grade
    employee.grade_since = date.today()

    application.status = ApplicationStatus.PUBLISHED
    application.published_at = datetime.now(timezone.utc)
    db.flush()

    # 审计发布；通知员工结果已发布
    application_status_audit(
        db, application, None,
        "publish", "approved", "published",
    )
    application_published(db, application)

    # C1：认证发布回写画像（生成 cert_writeback 完整新版，不另记审计）
    from app.services.profile import writeback_on_publish

    writeback_on_publish(db, application)

    db.commit()
    db.refresh(application)
    return _list_item(application)
