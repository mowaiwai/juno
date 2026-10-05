import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.deps import err, require_active_roles_user
from app.database import get_db
from app.models.application import Application, ApplicationStatus
from app.models.employee import Employee
from app.models.review import ReviewTask
from app.models.user import Role, User
from app.schemas.review import OpinionIn, ReviewTaskOut
from app.services.audit import audit
from app.services.review import claim_lock, is_lock_holder, release_lock

router = APIRouter(prefix="/review", tags=["review"])

# 评委与组长共用评审端点
_panel_role = require_active_roles_user(Role.REVIEWER, Role.LEAD_REVIEWER)


def _panel_employee(db: Session, user: User) -> Employee:
    employee = db.scalar(select(Employee).where(Employee.user_id == user.id))
    if employee is None:
        raise err(403, "forbidden", "当前账号缺少员工档案")
    return employee


def _get_owned_task(db, task_id, employee_id) -> ReviewTask:
    task = db.scalar(select(ReviewTask).where(ReviewTask.id == task_id))
    if task is None or task.assignee_id != employee_id:
        # 非派给自己的任务统一 404
        raise err(404, "not_found", "评审任务不存在")
    return task


def _load_application(db, task: ReviewTask) -> Application:
    application = db.scalar(
        select(Application)
        .where(Application.id == task.application_id)
        .options(selectinload(Application.self_assessments))
    )
    if application is None:
        raise err(404, "not_found", "申请单不存在")
    return application


def _task_out(task: ReviewTask, application: Application) -> ReviewTaskOut:
    return ReviewTaskOut(
        id=task.id,
        application_id=task.application_id,
        assignee_id=task.assignee_id,
        role=task.role,
        opinion=task.opinion,
        submitted_at=task.submitted_at,
        locked_by=application.review_locked_by,
        locked_until=application.review_locked_until,
    )


@router.get("/tasks", response_model=list[ReviewTaskOut])
def list_my_tasks(
    db: Session = Depends(get_db),
    user: User = Depends(_panel_role),
):
    employee = _panel_employee(db, user)
    tasks = db.scalars(
        select(ReviewTask)
        .where(ReviewTask.assignee_id == employee.id)
        .order_by(ReviewTask.created_at)
    ).all()

    # 批量取出关联申请（只保留评审中的，终态单不在工作台出现）
    app_ids = {t.application_id for t in tasks}
    applications = {
        a.id: a
        for a in db.scalars(
            select(Application).where(Application.id.in_(app_ids))
        ).all()
        if a.status == ApplicationStatus.IN_COMMITTEE_REVIEW
    }
    return [
        _task_out(t, applications[t.application_id])
        for t in tasks
        if t.application_id in applications
    ]


@router.post("/tasks/{task_id}/claim", response_model=ReviewTaskOut)
def claim_task(
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(_panel_role),
):
    employee = _panel_employee(db, user)
    task = _get_owned_task(db, task_id, employee.id)
    application = _load_application(db, task)
    if application.status != ApplicationStatus.IN_COMMITTEE_REVIEW:
        raise err(409, "not_in_review", "该申请当前不在评审阶段")

    locked_until = claim_lock(db, application, employee.id)
    if locked_until is None:
        raise err(409, "review_locked", "该申请正由其他成员评审，请稍后再试")

    audit(
        db, application.tenant_id, employee.id,
        "review.claim", "application", application.id,
        None, {"locked": True},
    )
    db.commit()
    db.refresh(application)
    return _task_out(task, application)


@router.post("/tasks/{task_id}/release", status_code=204)
def release_task(
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(_panel_role),
):
    employee = _panel_employee(db, user)
    task = _get_owned_task(db, task_id, employee.id)
    application = _load_application(db, task)

    if not release_lock(db, application, employee.id):
        raise err(409, "not_lock_holder", "锁不属于你或已超时，无需释放")

    audit(
        db, application.tenant_id, employee.id,
        "review.release", "application", application.id,
        {"locked": True}, {"locked": False},
    )
    db.commit()


@router.post("/tasks/{task_id}/opinion", response_model=ReviewTaskOut)
def submit_opinion(
    task_id: uuid.UUID,
    body: OpinionIn,
    db: Session = Depends(get_db),
    user: User = Depends(_panel_role),
):
    employee = _panel_employee(db, user)
    task = _get_owned_task(db, task_id, employee.id)
    application = _load_application(db, task)

    if task.submitted_at is not None:
        raise err(409, "already_submitted", "评审意见已提交，不可修改")
    if not is_lock_holder(application, employee.id):
        raise err(409, "not_lock_holder", "请先认领并在持锁期间提交意见")

    task.opinion = body.opinion
    task.submitted_at = datetime.now(timezone.utc)
    # 提交即完成本次工作，主动释放锁供下一位成员认领
    application.review_locked_by = None
    application.review_locked_until = None

    audit(
        db, application.tenant_id, employee.id,
        "review.opinion", "application", application.id,
        None, {"has_opinion": True},
    )
    db.commit()
    db.refresh(task)
    db.refresh(application)
    return _task_out(task, application)
