"""在线考试 Schemas。

字段一律 snake_case（与全站后端契约一致）。
题目答案（answer_index）绝不出现在开始考试的下发结构中。
"""
import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# 试卷
# ---------------------------------------------------------------------------

class GeneratePaperIn(BaseModel):
    title: str = Field(min_length=1, max_length=128)
    description: str = ""
    target_position: str = ""
    target_sequence: str = ""
    target_grade: str = ""
    # 每题固定 10 分；total_score = question_count * 10
    question_count: int = Field(default=5, ge=1, le=10)
    duration_minutes: int = Field(default=60, ge=5, le=300)
    pass_score: int = Field(default=60, ge=1)


class RejectIn(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class QuestionOut(BaseModel):
    """题目（含答案）——仅 HR 审核与员工交卷后回顾可见。"""

    id: uuid.UUID
    sort_order: int
    type: str
    stem: str
    options: list[str]
    answer_index: int
    score: int
    analysis: str


class PaperOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    target_position: str
    target_sequence: str
    target_grade: str
    status: str
    source: str
    model: str | None
    duration_minutes: int
    pass_score: int
    total_score: int
    reject_reason: str | None
    created_at: datetime
    published_at: datetime | None
    question_count: int
    questions: list[QuestionOut] | None = None


# ---------------------------------------------------------------------------
# 开始考试（无答案下发）
# ---------------------------------------------------------------------------

class QuestionForExam(BaseModel):
    id: uuid.UUID
    sort_order: int
    stem: str
    options: list[str]
    score: int


class StartOut(BaseModel):
    attempt_id: uuid.UUID
    paper_id: uuid.UUID
    title: str
    duration_minutes: int
    pass_score: int
    total_score: int
    started_at: datetime
    questions: list[QuestionForExam]


# ---------------------------------------------------------------------------
# 交卷与成绩
# ---------------------------------------------------------------------------

class SubmitIn(BaseModel):
    # question_id(str) -> option_index(0-3)
    answers: dict[str, int]


class GradedQuestionOut(BaseModel):
    id: uuid.UUID
    sort_order: int
    stem: str
    options: list[str]
    score: int
    selected_index: int | None
    answer_index: int
    correct: bool


class AttemptOut(BaseModel):
    id: uuid.UUID
    paper_id: uuid.UUID
    paper_title: str
    status: str
    score: int
    total_score: int
    passed: bool
    started_at: datetime
    submitted_at: datetime | None
    questions: list[GradedQuestionOut] | None = None
