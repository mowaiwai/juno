import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import err, require_perm_user
from app.database import get_db
from app.models.employee import Employee
from app.models.review import ReviewPanelTemplate
from app.models.user import User
from app.schemas.review import PanelTemplateIn, PanelTemplateOut
from app.services.review import backfill_for_template

router = APIRouter(prefix="/review-panel-templates", tags=["review-panel-templates"])

_hr = require_perm_user("panel.manage")


def _validate_members(db: Session, tenant_id, body: PanelTemplateIn) -> None:
    # 恰好 2 名评委；评委互不相同；组长不得兼任评委
    reviewers = body.reviewer_ids
    if len(reviewers) != 2 or reviewers[0] == reviewers[1]:
        raise err(
            422,
            "invalid_panel",
            "评审小组必须包含 2 名互不相同的评委，且组长不得兼任评委",
        )
    if body.lead_reviewer_id in reviewers:
        raise err(422, "invalid_panel", "组长不得同时担任评委")

    # 全部成员必须是本租户在职员工
    member_ids = {body.lead_reviewer_id, *reviewers}
    found = {
        e.id
        for e in db.scalars(
            select(Employee).where(
                Employee.tenant_id == tenant_id,
                Employee.is_active.is_(True),
                Employee.id.in_(member_ids),
            )
        ).all()
    }
    missing = member_ids - found
    if missing:
        raise err(
            422,
            "member_not_found",
            "所选评审成员不存在或已离职",
            details=sorted(str(m) for m in missing),
        )


def _get_owned(db, template_id, tenant_id) -> ReviewPanelTemplate:
    row = db.scalar(
        select(ReviewPanelTemplate).where(
            ReviewPanelTemplate.id == template_id,
            ReviewPanelTemplate.tenant_id == tenant_id,
        )
    )
    if row is None:
        raise err(404, "not_found", "评审小组模板不存在")
    return row


@router.post("", response_model=PanelTemplateOut, status_code=201)
def create_template(
    body: PanelTemplateIn,
    db: Session = Depends(get_db),
    user: User = Depends(_hr),
):
    _validate_members(db, user.tenant_id, body)

    # 同序列已有 active 模板 → 拒绝（避免歧义）；更新走 PUT
    existing = db.scalar(
        select(ReviewPanelTemplate.id).where(
            ReviewPanelTemplate.tenant_id == user.tenant_id,
            ReviewPanelTemplate.sequence == body.sequence,
            ReviewPanelTemplate.is_active.is_(True),
        )
    )
    if existing:
        raise err(
            409,
            "active_template_exists",
            "该序列已存在生效中的评审小组模板，请先修改原模板",
        )

    template = ReviewPanelTemplate(
        tenant_id=user.tenant_id,
        sequence=body.sequence,
        lead_reviewer_id=body.lead_reviewer_id,
        reviewer_ids=list(body.reviewer_ids),
        is_active=body.is_active,
    )
    db.add(template)
    db.flush()

    if template.is_active:
        backfill_for_template(db, template)

    db.commit()
    db.refresh(template)
    return template


@router.get("", response_model=list[PanelTemplateOut])
def list_templates(
    sequence: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(_hr),
):
    stmt = select(ReviewPanelTemplate).where(
        ReviewPanelTemplate.tenant_id == user.tenant_id
    )
    if sequence:
        stmt = stmt.where(ReviewPanelTemplate.sequence == sequence)
    return db.scalars(
        stmt.order_by(ReviewPanelTemplate.sequence)
    ).all()


@router.put("/{template_id}", response_model=PanelTemplateOut)
def update_template(
    template_id: uuid.UUID,
    body: PanelTemplateIn,
    db: Session = Depends(get_db),
    user: User = Depends(_hr),
):
    template = _get_owned(db, template_id, user.tenant_id)
    _validate_members(db, user.tenant_id, body)

    # 改为新序列且新序列已有 active 模板 → 冲突
    if body.sequence != template.sequence:
        clash = db.scalar(
            select(ReviewPanelTemplate.id).where(
                ReviewPanelTemplate.tenant_id == user.tenant_id,
                ReviewPanelTemplate.sequence == body.sequence,
                ReviewPanelTemplate.is_active.is_(True),
            )
        )
        if clash:
            raise err(409, "active_template_exists", "目标序列已存在生效模板")

    template.sequence = body.sequence
    template.lead_reviewer_id = body.lead_reviewer_id
    template.reviewer_ids = list(body.reviewer_ids)
    template.is_active = body.is_active
    db.flush()

    if template.is_active:
        backfill_for_template(db, template)

    db.commit()
    db.refresh(template)
    return template
