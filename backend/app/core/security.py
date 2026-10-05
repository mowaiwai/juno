import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import settings
from app.models.user import User


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    refs = user.role_refs()
    payload = {
        "sub": str(user.id),
        "tenant_id": str(user.tenant_id),
        # 默认激活角色引用（可能是自定义角色 custom:<uuid>）
        "role": user.default_active_ref(),
        # 全量角色引用：内置角色枚举值 + 自定义角色 custom:<uuid>
        "roles": sorted(set(refs)),
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    """解码 JWT，失败抛 jwt.PyJWTError 由调用方处理。"""
    return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])


def parse_uuid(value: str) -> uuid.UUID:
    return uuid.UUID(value)
