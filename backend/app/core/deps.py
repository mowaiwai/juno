import uuid

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.database import get_db
from app.models.user import Role, User

bearer_scheme = HTTPBearer()


def err(
    status_code: int,
    code: str,
    message: str,
    details=None,
) -> HTTPException:
    detail: dict = {"code": code, "message": message}
    if details is not None:
        detail["details"] = details
    return HTTPException(status_code=status_code, detail=detail)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise err(401, "invalid_token", "登录凭证无效或已过期")

    user = db.get(User, user_id)
    if user is None or str(user.tenant_id) != payload.get("tenant_id"):
        raise err(401, "invalid_token", "登录凭证无效或已过期")
    return user


def require_roles(*roles: Role):
    """RBAC 守卫：当前用户角色集合与允许列表无交集 → 403。"""

    def checker(user: User = Depends(get_current_user)) -> User:
        if not user.has_any(*roles):
            raise err(403, "forbidden", "当前角色无权执行此操作")
        return user

    return checker
