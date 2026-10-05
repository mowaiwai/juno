from fastapi import APIRouter, Depends

from sqlalchemy.orm import Session

from app.core.deps import require_perm_user
from app.database import get_db
from app.models.user import User
from app.services.scheduler import run_daily_jobs

router = APIRouter(prefix="/internal", tags=["internal"])

# 认证流程运营（超时推进/催办）：panel.manage（COE·OTD / 管理员）
_ops = require_perm_user("panel.manage")


@router.post("/manager-review-timeouts")
def process_manager_review_timeouts(
    db: Session = Depends(get_db),
    user: User = Depends(_ops),
):
    """手动兜底：推进本租户初审超期单（SUBMITTED 过截止 → IN_COMMITTEE_REVIEW）。

    定时调度在 app.services.scheduler 每日自动执行；本端点供认证运营即时处理。
    """
    result = run_daily_jobs(db, tenant_id=user.tenant_id)
    return {"advanced": result["advanced"]}


@router.post("/manager-review-reminders")
def process_manager_review_reminders(
    db: Session = Depends(get_db),
    user: User = Depends(_ops),
):
    """手动催办：本租户 SUBMITTED 单满 3 / 6 个自然日各提醒经理一次（去重）。"""
    result = run_daily_jobs(db, tenant_id=user.tenant_id)
    return {"reminders_sent": result["reminders_sent"]}
