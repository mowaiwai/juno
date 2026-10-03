"""通知服务：站内落库 +（租户配置 SMTP 时）同事件邮件外发。

事件函数封装各业务节点的标题与 payload 契约，端点只调一行；
payload 统一含 application_id 与行动指引 action。
"""
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.application import Application
from app.models.employee import Employee
from app.models.notification import Notification
from app.models.tenant_config import TenantConfig
from app.services.email import get_sender
from app.models.user import User

# 通知标题模板
_TITLES = {
    "task_assigned": "有一条新的认证申请待初审",
    "manager_review_approved": "初审通过，申请进入认证评审",
    "manager_review_rejected": "认证申请初审未通过",
    "decision_approved": "认证评审已通过，待 HR 发布",
    "decision_rejected": "认证评审未通过",
    "decision_published": "认证结果已发布",
    "review_reminder": "认证申请初审即将超期，请尽快处理",
}


def _tenant_values(db: Session, tenant_id) -> dict:
    row = db.get(TenantConfig, tenant_id)
    return row.values if row and row.values else {}


def _recipient_email(db: Session, recipient_id) -> str | None:
    employee = db.get(Employee, recipient_id)
    if employee is None:
        return None
    user = db.scalar(select(User).where(User.id == employee.user_id))
    return user.email if user else None


def notify(
    db: Session,
    tenant_id,
    recipient_id,
    type_: str,
    payload: dict,
    *,
    send_email: bool = True,
) -> Notification:
    notification = Notification(
        tenant_id=tenant_id,
        recipient_id=recipient_id,
        type=type_,
        title=_TITLES[type_],
        payload=payload,
    )
    db.add(notification)
    db.flush()

    if send_email:
        config = _tenant_values(db, tenant_id)
        if config.get("smtp_host"):
            to = _recipient_email(db, recipient_id)
            if to:
                try:
                    get_sender(config=config).send(
                        to=to,
                        subject=_TITLES[type_],
                        text=_email_text(type_, payload),
                        from_=config.get("smtp_from"),
                    )
                except Exception:
                    # 邮件外发失败不影响站内通知与主业务
                    pass

    return notification


def _email_text(type_: str, payload: dict) -> str:
    lines = [_TITLES[type_], ""]
    for key, value in payload.items():
        lines.append(f"{key}: {value}")
    lines += ["", "— Juno 智能 HR 系统"]
    return "\n".join(lines)


# ---- 业务事件函数 ----

def application_submitted(db: Session, application: Application) -> None:
    if application.manager_id is None:
        return
    notify(
        db,
        application.tenant_id,
        application.manager_id,
        "task_assigned",
        {
            "application_id": str(application.id),
            "target_grade": application.target_grade,
            "action": "manager_review",
        },
    )


def manager_review_decided(
    db: Session, application: Application, category, comment
) -> None:
    if application.status.value == "in_committee_review":
        notify(
            db, application.tenant_id, application.employee_id,
            "manager_review_approved",
            {"application_id": str(application.id),
             "target_grade": application.target_grade,
             "action": "wait_committee"},
        )
    else:
        notify(
            db, application.tenant_id, application.employee_id,
            "manager_review_rejected",
            {"application_id": str(application.id),
             "reject_category": category, "comment": comment,
             "action": "edit_and_resubmit"},
        )


def lead_decision_decided(db: Session, application: Application) -> None:
    approved = application.status.value == "approved"
    notify(
        db, application.tenant_id, application.employee_id,
        "decision_approved" if approved else "decision_rejected",
        {"application_id": str(application.id),
         "target_grade": application.target_grade,
         "action": "wait_publish" if approved else "edit_and_resubmit"},
    )


def application_published(db: Session, application: Application) -> None:
    notify(
        db, application.tenant_id, application.employee_id,
        "decision_published",
        {"application_id": str(application.id),
         "new_grade": application.target_grade,
         "action": "view_certificate"},
    )


def manager_reminder(
    db: Session, application: Application, day: int
) -> None:
    if application.manager_id is None:
        return
    notify(
        db, application.tenant_id, application.manager_id,
        "review_reminder",
        {"application_id": str(application.id), "day": day,
         "action": "manager_review"},
    )
