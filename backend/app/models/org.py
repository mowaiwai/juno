"""组织主数据：部门树（ADR-0014 将原 org.py 静态树扶正）。"""

import uuid

from sqlalchemy import (
    ForeignKey,
    ForeignKeyConstraint,
    PrimaryKeyConstraint,
    String,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Department(Base):
    __tablename__ = "departments"

    # 部门编码沿用原静态树（"100"/"305" ...），各租户独立编号空间，
    # 故与 tenant_id 组成复合主键
    __table_args__ = (
        PrimaryKeyConstraint("id", "tenant_id", name="pk_departments"),
        ForeignKeyConstraint(
            ["parent_id", "tenant_id"],
            ["departments.id", "departments.tenant_id"],
            name="fk_departments_parent",
        ),
    )

    id: Mapped[str] = mapped_column(String(32))
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    name: Mapped[str] = mapped_column(String(128))
    parent_id: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    # biz 业务 / func 职能 / tech 技术
    type: Mapped[str] = mapped_column(String(16), default="func")
    # 部门领导：设置/变更时由服务层同步授予/回收该员工的 MANAGER 角色
    leader_employee_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("employees.id"), nullable=True
    )
