"""驾驶舱问答端点。"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import Principal, err, require_perm
from app.database import get_db
from app.schemas.cockpit import AskIn, AskOut
from app.services.cockpit import answer_question

router = APIRouter(prefix="/cockpit", tags=["cockpit"])


@router.post("/ask", response_model=AskOut)
def ask_endpoint(
    body: AskIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_perm("cockpit.ask")),
):
    user = principal.user
    try:
        result = answer_question(db, user.tenant_id, body.question)
    except ValueError as exc:
        if str(exc) == "ai_not_configured":
            raise err(503, "ai_not_configured", "AI 助手未配置，请联系管理员设置模型密钥")
        raise
    except RuntimeError as exc:
        if str(exc) == "monthly_token_quota_exceeded":
            raise err(429, "quota_exceeded", "本月 AI 用量已达配额上限")
        raise err(502, "ai_request_failed", "AI 服务暂时不可用，请稍后重试")
    db.commit()
    return result
