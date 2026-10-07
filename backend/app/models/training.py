"""人才发展模块数据模型（培训管理 + 经验萃取库 + 学习地图）。

- TrainingCourse：课程项目（内训/微课/训练营/外训）。
- TrainingInstructor：认证讲师（内/外部）。
- KnowledgeItem：经验萃取条目（访谈/AI 萃取，草稿→萃取中→发布）。
- LearningPath：学习地图（岗位×职级→课程要求，含知识四档与题型映射）。
"""
import enum
import uuid

from sqlalchemy import Date, Float, ForeignKey, Integer, JSON, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class CourseType(str, enum.Enum):
    INTERNAL = "internal"     # 内训
    MICRO = "micro"           # 微课
    BOOTCAMP = "bootcamp"     # 训练营
    EXTERNAL = "external"     # 外训


class CourseStatus(str, enum.Enum):
    ENROLLING = "enrolling"   # 招生中
    ONGOING = "ongoing"       # 进行中
    COMPLETED = "completed"   # 已结项


class KnowledgeStatus(str, enum.Enum):
    DRAFT = "draft"
    EXTRACTING = "extracting"
    PUBLISHED = "published"


class ExtractWay(str, enum.Enum):
    INTERVIEW = "interview"   # 专家访谈
    AI = "ai"                 # AI 自动萃取


class TrainingCourse(Base):
    __tablename__ = "training_courses"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    name: Mapped[str] = mapped_column(String(255))
    type: Mapped[str] = mapped_column(String(16), index=True)
    category: Mapped[str] = mapped_column(String(64))
    instructor_name: Mapped[str] = mapped_column(String(64))
    hours: Mapped[float] = mapped_column(Float, default=0)
    enrolled: Mapped[int] = mapped_column(Integer, default=0)
    completion: Mapped[int] = mapped_column(Integer, default=0)  # 0-100
    status: Mapped[str] = mapped_column(String(16), default=CourseStatus.ENROLLING.value)
    started_at: Mapped[str | None] = mapped_column(String(10), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)


class TrainingInstructor(Base):
    __tablename__ = "training_instructors"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    name: Mapped[str] = mapped_column(String(64))
    field: Mapped[str] = mapped_column(String(64))
    rating: Mapped[float] = mapped_column(Float, default=5.0)
    internal: Mapped[bool] = mapped_column(default=True)


class KnowledgeItem(Base):
    __tablename__ = "knowledge_items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    title: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(64))
    author: Mapped[str] = mapped_column(String(64))
    way: Mapped[str] = mapped_column(String(16), default=ExtractWay.INTERVIEW.value)
    status: Mapped[str] = mapped_column(String(16), default=KnowledgeStatus.DRAFT.value, index=True)
    summary: Mapped[str] = mapped_column(Text, default="")
    reads: Mapped[int] = mapped_column(Integer, default=0)
    likes: Mapped[int] = mapped_column(Integer, default=0)
    created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)


class LearningPath(Base):
    """学习地图条目：岗位×职级 → 一门课程要求。

    learn_type: 1 必修 / 2 选修 / 3 认证前置
    mastery: 1 了解 / 2 掌握 / 3 熟练掌握 / 4 精通（对应考试题型）
    """

    __tablename__ = "learning_paths"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    position: Mapped[str] = mapped_column(String(64), index=True)
    grade: Mapped[str] = mapped_column(String(16))
    course_name: Mapped[str] = mapped_column(String(255))
    learn_type: Mapped[int] = mapped_column(Integer, default=1)
    mastery: Mapped[int] = mapped_column(Integer, default=2)
    exam_mode: Mapped[str] = mapped_column(String(32))
    duration: Mapped[str] = mapped_column(String(32), default="")
    created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
