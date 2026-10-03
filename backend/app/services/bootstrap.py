"""生产环境首个租户与租户管理员的幂等初始化。

替代开发用 seed_data.py：只创建租户与一个 TENANT_ADMIN 用户，
由 JUNO_INIT_* 环境变量驱动（见 app.config.Settings）。
租户或管理员已存在时跳过，可安全重复执行。

手动执行（在 backend 目录，.env 已配置时）：
    python -m app.services.bootstrap
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import hash_password
from app.database import SessionLocal
from app.models.user import Role, Tenant, User

MIN_PASSWORD_LENGTH = 8


def init_first_tenant(
    db: Session,
    *,
    tenant_name: str,
    admin_name: str,
    admin_email: str,
    admin_password: str,
) -> str:
    """返回 created（新建租户/管理员）或 existed（已存在，跳过）。"""
    if len(admin_password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"管理员密码至少 {MIN_PASSWORD_LENGTH} 位")

    tenant = db.scalar(select(Tenant).where(Tenant.name == tenant_name))
    if tenant is None:
        tenant = Tenant(name=tenant_name)
        db.add(tenant)
        db.flush()

    user = db.scalar(select(User).where(User.email == admin_email))
    if user is None:
        db.add(
            User(
                tenant_id=tenant.id,
                email=admin_email,
                name=admin_name,
                role=Role.TENANT_ADMIN,
                roles=[Role.TENANT_ADMIN.value],
                hashed_password=hash_password(admin_password),
            )
        )
        db.commit()
        return "created"

    db.rollback()
    return "existed"


def main() -> None:
    # 平台全局资产：层级框架 v1（幂等），与租户数据独立
    from app.services.level_framework import seed_v1_framework

    fw_db = SessionLocal()
    try:
        if seed_v1_framework(fw_db) is not None:
            fw_db.commit()
            print("平台资产：层级框架 v1 已发布")
    finally:
        fw_db.close()

    if not all(
        [
            settings.init_tenant_name,
            settings.init_admin_name,
            settings.init_admin_email,
            settings.init_admin_password,
        ]
    ):
        print("JUNO_INIT_* 未完整配置，跳过首个租户初始化")
        return

    db = SessionLocal()
    try:
        result = init_first_tenant(
            db,
            tenant_name=settings.init_tenant_name,
            admin_name=settings.init_admin_name,
            admin_email=settings.init_admin_email,
            admin_password=settings.init_admin_password,
        )
        if result == "created":
            print(f"已创建租户「{settings.init_tenant_name}」及管理员 {settings.init_admin_email}")
        else:
            print(f"租户/管理员 {settings.init_admin_email} 已存在，跳过")
    finally:
        db.close()


if __name__ == "__main__":
    main()
