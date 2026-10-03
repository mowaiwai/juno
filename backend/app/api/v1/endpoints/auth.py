from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, Request

from app.config import settings
from app.core.deps import err
from app.core.rate_limit import login_limiter
from app.core.security import create_access_token, verify_password
from app.database import get_db
from app.models.user import User

router = APIRouter(tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/auth/login", response_model=TokenResponse)
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    # 双维度限流：同一账号每分钟 N 次；同一 IP 每分钟 5N 次（兼容企业 NAT 出口）
    email_key = f"email:{body.email.strip().lower()}"
    client_ip = request.client.host if request.client else "unknown"
    ip_key = f"ip:{client_ip}"
    per_email = settings.login_rate_limit_per_minute
    per_ip = per_email * 5
    if not login_limiter.hit(email_key, per_email) or not login_limiter.hit(ip_key, per_ip):
        raise err(429, "too_many_requests", "登录尝试过于频繁，请稍后再试")

    user = db.scalar(select(User).where(User.email == body.email))
    if user is None or not verify_password(body.password, user.hashed_password):
        raise err(401, "invalid_credentials", "邮箱或密码错误")
    return TokenResponse(access_token=create_access_token(user))
