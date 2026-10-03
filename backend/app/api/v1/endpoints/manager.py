import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import err, require_roles
from app.database import get_db
from app.models.application import (
    Application,
    ApplicationStatus,
    ManagerReview,
)
from app.models.employee import Employee
from app.models.user import Role, User
from app.schemas.application import ApplicationListItem
from app.services.audit import application_status_audit
from app.services.notification import manager_review_decided
from app.services.review import ensure_review_tasks
from app.workers.ai_worker import run_ai_generation

router = APIRouter(tags=["manager"])

# 预设驳回类别（Q2：结构化驳回原因）
REJECT_CATEGORIES = {
    "evidence_insufficient",   # 举证不足
    "self_assessment_mismatch",  # 自评与实际明显不符
    "ability_gap",             # 能力差距较大
    "tenure_not_ready",        # 历练不足
    "other",
}


class ManagerReviewIn(BaseModel):
    decision: str  # approved / rejected
    reject_category: str | None = None
    comment: str | None = None


def _manager_employee(db: Session, user: User) -> Employee:
    employee = db.scalar(select(Employee).where(Employee.user_id == user.id))
    if employee is None or not user.has_any(Role.MANAGER):
        raise err(403, "forbidden", "仅部门经理可执行此操作")
    return employee


@router.get("/manager/applications", response_model=list[ApplicationListItem])
def list_for_manager(
    status: ApplicationStatus = ApplicationStatus.SUBMITTED,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.MANAGER)),
):
    """我名下处于某状态（默认待初审）的申请。"""
    manager = _manager_employee(db, user)
    rows = db.scalars(
        select(Application)
        .where(Application.manager_id == manager.id, Application.status == status)
        .order_by(Application.submitted_at)
    ).all()
    items = []
    for a in rows:
        employee = db.get(Employee, a.employee_id)
        items.append(
            ApplicationListItem(
                id=a.id,
                target_sequence=a.target_sequence,
                target_grade=a.target_grade,
                status=a.status.value,
                submitted_at=a.submitted_at,
                decided_at=a.decided_at,
                published_at=a.published_at,
                employee_name=employee.name if employee else None,
            )
        )
    return items


@router.post(
    "/applications/{application_id}/manager-review",
    response_model=ApplicationListItem,
)
def submit_manager_review(
    application_id: uuid.UUID,
    body: ManagerReviewIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.MANAGER)),
):
    """经理初审：原子完成"领取 + 决策"。初审经理唯一，无评审竞争。"""
    manager = _manager_employee(db, user)
    application = db.scalar(
        select(Application).where(
            Application.id == application_id,
            Application.tenant_id == user.tenant_id,
        )
    )
    if application is None:
        raise err(404, "not_found", "申请单不存在")
    if application.manager_id != manager.id:
        raise err(403, "forbidden", "该申请不归属你处理")
    if application.status != ApplicationStatus.SUBMITTED:
        raise err(409, "not_submitted", "该申请当前不可初审")

    if body.decision not in {"approved", "rejected"}:
        raise err(422, "invalid_decision", "decision 仅支持 approved/rejected")

    # 驳回：类别必须属于预设枚举，且必须有文字说明
    if body.decision == "rejected":
        comment = (body.comment or "").strip()
        if not body.reject_category or not comment:
            raise err(
                422,
                "reject_reason_required",
                "驳回必须选择原因类别并填写说明",
            )
        if body.reject_category not in REJECT_CATEGORIES:
            raise err(
                422,
                "invalid_reject_category",
                "驳回类别不在允许范围内",
                details=sorted(REJECT_CATEGORIES),
            )

    db.add(
        ManagerReview(
            application_id=application.id,
            decision=body.decision,
            reject_category=body.reject_category if body.decision == "rejected" else None,
            comment=(body.comment or "").strip() or None,
            reviewer_id=manager.id,
        )
    )
    now = datetime.now(timezone.utc)
    application.manager_reviewed_at = now
    application.status = (
        ApplicationStatus.IN_COMMITTEE_REVIEW
        if body.decision == "approved"
        else ApplicationStatus.REJECTED
    )
    db.flush()

    if body.decision == "approved":
        # 模板已配置则立即派单；未配置则等 HR 建模板后补派
        ensure_review_tasks(db, application)

    # 审计初审动作（before submitted → after 新状态）
    application_status_audit(
        db, application, manager.id,
        "manager_review.submit", "submitted", application.status.value,
    )
    # 通知员工初审结果（驳回时携带结构化原因）
    manager_review_decided(
        db, application,
        body.reject_category if body.decision == "rejected" else None,
        (body.comment or "").strip() or None,
    )

    db.commit()

    if body.decision == "approved":
        # AI 异步出题（独立会话执行；无模板/无 key/失败均不阻塞人工评审）
        background_tasks.add_task(run_ai_generation, application.id)

    return ApplicationListItem(
        id=application.id,
        target_sequence=application.target_sequence,
        target_grade=application.target_grade,
        status=application.status.value,
        submitted_at=application.submitted_at,
    )
