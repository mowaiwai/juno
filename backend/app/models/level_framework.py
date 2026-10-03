"""任职资格层级框架数据模型（spec 第 6 节）。

平台表不带 tenant_id（全局资产）；租户映射表带 tenant_id。
纯增量模块：不写任何到 standard_sets / applications 的外键。
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    ForeignKey,
    Integer,
    JSON,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.types import UTCDateTime


class FrameworkStatus(str, enum.Enum):
    # spec 枚举为 draft/published；归档状态用于发布后旧版本只读保留
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class LevelFrameworkVersion(Base):
    """框架版本头：同时至多一个 draft、一个 published。"""

    __tablename__ = "level_framework_versions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    version: Mapped[int] = mapped_column(Integer, unique=True)
    status: Mapped[FrameworkStatus] = mapped_column(default=FrameworkStatus.DRAFT)
    published_at: Mapped[datetime | None] = mapped_column(
        UTCDateTime, nullable=True
    )

    levels: Mapped[list["LevelDefinition"]] = relationship(
        cascade="all, delete-orphan",
        order_by="LevelDefinition.level_order",
    )
    anchors: Mapped[list["BehaviorAnchor"]] = relationship(
        cascade="all, delete-orphan",
        order_by="BehaviorAnchor.code",
    )
    conditions: Mapped[list["BaseConditionTemplate"]] = relationship(
        cascade="all, delete-orphan",
        order_by="BaseConditionTemplate.level_order",
    )
    bonus_items: Mapped[list["BonusItemCatalog"]] = relationship(
        cascade="all, delete-orphan",
        order_by="BonusItemCatalog.sort_order",
    )
    tenant_mappings: Mapped[list["TenantLevelMapping"]] = relationship(
        cascade="all, delete-orphan",
    )


class LevelDefinition(Base):
    """六层定义，挂框架版本。"""

    __tablename__ = "level_definitions"
    __table_args__ = (
        UniqueConstraint("framework_version_id", "level_order",
                         name="level_definitions_version_order_uc"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    framework_version_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("level_framework_versions.id"), index=True
    )
    level_order: Mapped[int] = mapped_column(SmallInteger)
    code: Mapped[str] = mapped_column(String(32))
    name: Mapped[str] = mapped_column(String(64))
    role_definition: Mapped[str] = mapped_column(Text)
    performance_level: Mapped[str] = mapped_column(Text)
    key_behaviors: Mapped[list] = mapped_column(JSON)
    influence_scope: Mapped[str] = mapped_column(Text)
    target_anchor: Mapped[str] = mapped_column(String(8))


class BehaviorAnchor(Base):
    """L1–L3 行为锚点，挂框架版本。"""

    __tablename__ = "behavior_anchors"
    __table_args__ = (
        UniqueConstraint("framework_version_id", "code",
                         name="behavior_anchors_version_code_uc"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    framework_version_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("level_framework_versions.id"), index=True
    )
    code: Mapped[str] = mapped_column(String(8))
    name: Mapped[str] = mapped_column(String(32))
    description: Mapped[str] = mapped_column(Text)


class BaseConditionTemplate(Base):
    """基础条件模板，挂版本 + 层级。MVP 只记录展示，不做自动拦截。"""

    __tablename__ = "base_condition_templates"
    __table_args__ = (
        UniqueConstraint("framework_version_id", "level_order",
                         name="base_condition_templates_version_order_uc"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    framework_version_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("level_framework_versions.id"), index=True
    )
    level_order: Mapped[int] = mapped_column(SmallInteger)
    education_min: Mapped[str] = mapped_column(String(16))
    min_work_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    min_company_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    certificates: Mapped[list] = mapped_column(JSON)


class BonusItemCatalog(Base):
    """加分项类型目录：计量口径平台定义，分值与启用租户定。"""

    __tablename__ = "bonus_item_catalog"
    __table_args__ = (
        UniqueConstraint("framework_version_id", "code",
                         name="bonus_item_catalog_version_code_uc"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    framework_version_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("level_framework_versions.id"), index=True
    )
    code: Mapped[str] = mapped_column(String(64))
    name: Mapped[str] = mapped_column(String(128))
    measure_unit: Mapped[str] = mapped_column(String(32))
    sort_order: Mapped[int] = mapped_column(Integer)


class TenantLevelMapping(Base):
    """租户映射差异行：仅存与平台默认不同的职级归属。"""

    __tablename__ = "tenant_level_mappings"
    __table_args__ = (
        UniqueConstraint("tenant_id", "framework_version_id", "grade_code",
                         name="tenant_level_mappings_uc"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    framework_version_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("level_framework_versions.id"), index=True
    )
    grade_code: Mapped[str] = mapped_column(String(32))
    level_order: Mapped[int] = mapped_column(SmallInteger)
