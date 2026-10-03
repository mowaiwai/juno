"""组织诊断数据模型（spec org-diagnosis）。

液态组队项目：HR 维护跨部门项目所需能力清单，用于人岗匹配。
状态流转：forming → running。
"""

import enum
import uuid

from sqlalchemy import JSON, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class LiquidProjectStatus(str, enum.Enum):
    FORMING = "forming"
    RUNNING = "running"


class LiquidProject(Base):
    """液态组队项目：记录跨部门项目所需能力与截止时间。"""

    __tablename__ = "liquid_projects"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    name: Mapped[str] = mapped_column(String(128))
    dept_name: Mapped[str] = mapped_column(String(64))
    needs: Mapped[list] = mapped_column(JSON, default=list)
    deadline: Mapped[str] = mapped_column(String(32))
    status: Mapped[LiquidProjectStatus] = mapped_column(
        default=LiquidProjectStatus.FORMING
    )
