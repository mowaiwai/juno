"""租户自定义角色与数据范围授权（ADR-0014）。

内置角色模板（三支柱七角色、MANAGER 等）存代码常量 app.core.permissions，
不落库；租户克隆模板或在权限点目录内组合出的自定义角色存本表。
"""

import uuid

from sqlalchemy import Boolean, ForeignKey, JSON, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TenantRole(Base):
    """租户自定义角色。"""

    __tablename__ = "tenant_roles"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    name: Mapped[str] = mapped_column(String(64))
    # self / subtree / assigned_depts / global（见 app.core.permissions.ScopeType）
    scope_type: Mapped[str] = mapped_column(String(16), default="global")
    # 权限点 code 列表；平台新增权限点对自定义角色默认拒绝（不会出现在此）
    permissions: Mapped[list[str]] = mapped_column(JSON, default=list)
    # 克隆自哪个内置模板（用于展示与排查，可为空）
    cloned_from: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)


class RoleScope(Base):
    """ASSIGNED_DEPTS 型角色的部门授权（HRBP 一人可服务多个不相邻部门）。

    role_ref 为内置枚举值（如 "hrbp"）或 "custom:<uuid>"；
    include_subtree=False 时仅授权该部门本身。
    """

    __tablename__ = "role_scopes"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), index=True
    )
    role_ref: Mapped[str] = mapped_column(String(64), index=True)
    dept_id: Mapped[str] = mapped_column(String(32), index=True)
    include_subtree: Mapped[bool] = mapped_column(Boolean, default=True)
