import enum
import uuid

from sqlalchemy import Date, Enum as SAEnum, Float, Integer, JSON, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class TenantStatus(str, enum.Enum):
    ACTIVE = "active"
    TRIAL = "trial"
    SUSPENDED = "suspended"

# 自定义角色引用在 roles/active_role_ref 中的前缀
CUSTOM_ROLE_PREFIX = "custom:"


class Role(str, enum.Enum):
    EMPLOYEE = "employee"
    MANAGER = "manager"
    REVIEWER = "reviewer"
    LEAD_REVIEWER = "lead_reviewer"
    # HR 三支柱（ADR-0014）：废弃单一 HR，拆为 COE 五板块 + HRBP + SSC
    HR_COE_CADRE = "hr_coe_cadre"
    HR_COE_PERF = "hr_coe_perf"
    HR_COE_COMP = "hr_coe_comp"
    HR_COE_RECRUIT = "hr_coe_recruit"
    HR_COE_OTD = "hr_coe_otd"
    HRBP = "hrbp"
    SSC = "ssc"
    EXECUTIVE = "exec"
    COMMITTEE = "committee"
    TENANT_ADMIN = "tenant_admin"
    PLATFORM_ADMIN = "platform_admin"


# role 列按枚举【值】（小写：employee/hr_coe_cadre/...）落库，
# 与 roles JSON、active_role_ref 及 PG role 枚举标签（ADR-0014 重建后小写）一致。
# 不加 values_callable 时 SQLAlchemy 默认按枚举成员名（大写）绑定，会与 PG 类型不符。
ROLE_SA_ENUM = SAEnum(
    Role,
    name="role",
    values_callable=lambda enum_cls: [member.value for member in enum_cls],
)


def custom_role_ref(role_id) -> str:
    return f"{CUSTOM_ROLE_PREFIX}{role_id}"


def is_custom_ref(ref: str) -> bool:
    return ref.startswith(CUSTOM_ROLE_PREFIX)


def parse_custom_ref(ref: str) -> uuid.UUID | None:
    if not is_custom_ref(ref):
        return None
    try:
        return uuid.UUID(ref[len(CUSTOM_ROLE_PREFIX):])
    except ValueError:
        return None


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(128))
    # 平台运营字段（仅 platform_admin 可见）
    status: Mapped[str] = mapped_column(String(16), default=TenantStatus.ACTIVE.value, index=True)
    industry: Mapped[str | None] = mapped_column(String(32), nullable=True)
    plan_name: Mapped[str | None] = mapped_column(String(32), nullable=True)
    seats: Mapped[int] = mapped_column(Integer, default=0)
    mrr: Mapped[float] = mapped_column(Float, default=0)
    health: Mapped[int] = mapped_column(Integer, default=100)
    joined_at: Mapped[str | None] = mapped_column(String(10), nullable=True)

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
    # 主角色：内置枚举角色；仅有自定义角色时回落 EMPLOYEE
    role: Mapped[Role] = mapped_column(ROLE_SA_ENUM, default=Role.EMPLOYEE)
    # 全量角色引用（含主角色）：内置角色存枚举值，自定义角色存 "custom:<uuid>"
    roles: Mapped[list[str]] = mapped_column(JSON, default=list)
    # 默认激活角色引用；为空时回落主角色
    active_role_ref: Mapped[str | None] = mapped_column(String(64), nullable=True)

    tenant: Mapped[Tenant] = relationship(back_populates="users")

    def role_refs(self) -> list[str]:
        """全量角色引用；roles 为空时回落到主角色。"""
        return list(self.roles or [self.role.value])

    def role_set(self) -> set[Role]:
        """内置角色集合（自定义角色引用自动忽略）。"""
        result: set[Role] = set()
        for ref in self.role_refs():
            try:
                result.add(Role(ref))
            except ValueError:
                continue
        return result

    def has_any(self, *roles: Role) -> bool:
        """是否拥有任一给定【内置】角色（角色集合语义，宽权限优先）。"""
        return bool(self.role_set() & set(roles))

    def default_active_ref(self) -> str:
        return self.active_role_ref or self.role.value

    def owns_role_ref(self, ref: str) -> bool:
        """某激活角色引用是否确实属于本人。"""
        return ref in self.role_refs()
