import enum
import uuid

from sqlalchemy import JSON, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Role(str, enum.Enum):
    EMPLOYEE = "employee"
    MANAGER = "manager"
    REVIEWER = "reviewer"
    LEAD_REVIEWER = "lead_reviewer"
    HR = "hr"
    EXECUTIVE = "exec"
    COMMITTEE = "committee"
    TENANT_ADMIN = "tenant_admin"
    PLATFORM_ADMIN = "platform_admin"


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(128))

    users: Mapped[list["User"]] = relationship(back_populates="tenant")


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tenants.id"), index=True
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(64))
    hashed_password: Mapped[str] = mapped_column(String(128))
    # 主角色：登录后的默认视角，也用于角色集合为空时的兜底
    role: Mapped[Role] = mapped_column(default=Role.EMPLOYEE)
    # 全量角色集（含主角色）：支撑"一人多角色、前端切换视角"
    roles: Mapped[list[str]] = mapped_column(JSON, default=list)

    tenant: Mapped[Tenant] = relationship(back_populates="users")

    def role_set(self) -> set[Role]:
        """全量角色集合；roles 为空时回落到主角色。"""
        codes = self.roles or [self.role.value]
        return {Role(c) for c in codes}

    def has_any(self, *roles: Role) -> bool:
        """是否拥有任一给定角色（权限判断一律用集合语义，宽权限优先）。"""
        return bool(self.role_set() & set(roles))
