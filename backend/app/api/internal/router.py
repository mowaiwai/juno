from fastapi import APIRouter, Depends

from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.database import get_db
from app.models.user import Role, User
from app.services.scheduler import run_daily_jobs

router = APIRouter(prefix="/internal", tags=["internal"])


@router.post("/manager-review-timeouts")
def process_manager_review_timeouts(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.HR)),
):
    """手动兜底：推进本租户初审超期单（SUBMITTED 过截止 → IN_COMMITTEE_REVIEW）。

    定时调度在 app.services.scheduler 每日自动执行；本端点供 HR 即时处理。
    """
    result = run_daily_jobs(db, tenant_id=user.tenant_id)
    return {"advanced": result["advanced"]}


@router.post("/manager-review-reminders")
def process_manager_review_reminders(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.HR)),
):
    """手动催办：本租户 SUBMITTED 单满 3 / 6 个自然日各提醒经理一次（去重）。"""
    result = run_daily_jobs(db, tenant_id=user.tenant_id)
    return {"reminders_sent": result["reminders_sent"]}
