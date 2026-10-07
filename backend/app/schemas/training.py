"""培训管理 / 经验萃取 / 学习地图 Pydantic 模型。"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

CourseType = Literal["internal", "micro", "bootcamp", "external"]
CourseStatus = Literal["enrolling", "ongoing", "completed"]
ExtractWay = Literal["interview", "ai"]
KnowledgeStatus = Literal["draft", "extracting", "published"]


# ---------- 课程 ----------

class CourseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    type: CourseType
    category: str = Field(max_length=64)
    instructor_name: str = Field(max_length=64)
    hours: float = Field(default=0, ge=0)
    enrolled: int = Field(default=0, ge=0)
    completion: int = Field(default=0, ge=0, le=100)
    status: CourseStatus = "enrolling"
    started_at: str | None = Field(default=None, max_length=10)


class CourseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    type: CourseType | None = None
    category: str | None = Field(default=None, max_length=64)
    instructor_name: str | None = Field(default=None, max_length=64)
    hours: float | None = Field(default=None, ge=0)
    enrolled: int | None = Field(default=None, ge=0)
    completion: int | None = Field(default=None, ge=0, le=100)
    status: CourseStatus | None = None
    started_at: str | None = Field(default=None, max_length=10)


class CourseOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    type: CourseType
    category: str
    instructor_name: str
    hours: float
    enrolled: int
    completion: int
    status: CourseStatus
    started_at: str | None
    created_at: datetime


# ---------- 讲师 ----------

class InstructorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    field: str = Field(max_length=64)
    rating: float = Field(default=5.0, ge=0, le=5)
    internal: bool = True


class InstructorUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=64)
    field: str | None = Field(default=None, max_length=64)
    rating: float | None = Field(default=None, ge=0, le=5)
    internal: bool | None = None


class InstructorOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    field: str
    rating: float
    internal: bool


# ---------- 知识条目 ----------

class KnowledgeCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    category: str = Field(max_length=64)
    author: str = Field(max_length=64)
    way: ExtractWay = "interview"
    summary: str = ""
    status: KnowledgeStatus = "draft"


class KnowledgeUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    category: str | None = Field(default=None, max_length=64)
    author: str | None = Field(default=None, max_length=64)
    way: ExtractWay | None = None
    summary: str | None = None
    status: KnowledgeStatus | None = None


class KnowledgeOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    title: str
    category: str
    author: str
    way: ExtractWay
    status: KnowledgeStatus
    summary: str
    reads: int
    likes: int
    created_at: datetime


# ---------- 学习地图 ----------

class LearningPathCreate(BaseModel):
    position: str = Field(min_length=1, max_length=64)
    grade: str = Field(min_length=1, max_length=16)
    course_name: str = Field(min_length=1, max_length=255)
    learn_type: int = Field(default=1, ge=1, le=3)
    mastery: int = Field(default=2, ge=1, le=4)
    exam_mode: str = Field(max_length=32)
    duration: str = Field(default="", max_length=32)


class LearningPathUpdate(BaseModel):
    position: str | None = Field(default=None, min_length=1, max_length=64)
    grade: str | None = Field(default=None, min_length=1, max_length=16)
    course_name: str | None = Field(default=None, min_length=1, max_length=255)
    learn_type: int | None = Field(default=None, ge=1, le=3)
    mastery: int | None = Field(default=None, ge=1, le=4)
    exam_mode: str | None = Field(default=None, max_length=32)
    duration: str | None = Field(default=None, max_length=32)


class LearningPathOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    position: str
    grade: str
    course_name: str
    learn_type: int
    mastery: int
    exam_mode: str
    duration: str
