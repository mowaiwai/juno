import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import err, require_active_roles_user
from app.database import get_db
from app.models.ai import AISuggestion
from app.models.application import Application
from app.models.user import Role, User

router = APIRouter(tags=["ai"])


class AISuggestionResponse(BaseModel):
    status: str
    questions: list[str] | None = None
    opinion: str | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


@router.get(
    "/applications/{application_id}/ai-suggestion",
    response_model=AISuggestionResponse,
)
def get_ai_suggestion(
    application_id: uuid.UUID,
    response: Response,
    db: Session = Depends(get_db),
    user: User = Depends(require_active_roles_user(Role.LEAD_REVIEWER)),
):
    """组长查看 AI 产出：pending → 202；completed/skipped/failed → 200；无记录 404。"""
    row = db.scalar(
        select(AISuggestion)
        .join(Application, Application.id == AISuggestion.application_id)
        .where(
            AISuggestion.application_id == application_id,
            Application.tenant_id == user.tenant_id,
        )
    )
    if row is None:
        raise err(404, "not_found", "AI 产出不存在或尚未触发")

    if row.status == "pending":
        response.status_code = 202
    return row
