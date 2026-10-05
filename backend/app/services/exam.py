"""在线考试服务：AI 组卷 / 审核 / 开始 / 交卷判分。

沿用 ai.py 的防错链：配额熔断 → LLM 调用 → JSON 质量门 → 计量。
LLM 产出先在内存过质量门，通过后才落库，避免半成品试卷残留。
"""
import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.ai import AIUsage
from app.models.employee import Employee
from app.models.exam import (
    AttemptStatus,
    ExamAttempt,
    ExamPaper,
    ExamQuestion,
    PaperStatus,
)
from app.models.user import User
from app.services.ai import _ai_settings, _month_used, _tenant_config
from app.services.llm import get_client

FEATURE = "exam_paper_generation"
POINTS_PER_QUESTION = 10


# ---------------------------------------------------------------------------
# AI 组卷
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = (
    "你是企业岗位知识考试的命题专家。请严格只输出一个 JSON 对象，"
    "不要输出 JSON 以外的任何文字，格式：\n"
    '{"questions": [\n'
    '  {"stem": "题干", "options": ["选项A","选项B","选项C","选项D"],'
    ' "answer_index": 0, "analysis": "答案解析"}\n'
    "]}\n"
    "要求：1) 题目面向指定岗位/序列/职级应掌握的知识，难度与职级匹配；"
    "2) 每题恰好 4 个互不相同且非空的选项，干扰项要合理；"
    "3) answer_index 为 0-3 的正确选项下标；4) analysis 简述依据。"
)


def _gate_paper_questions(content: str, expected_count: int) -> list[dict]:
    text = content.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"输出不是合法 JSON：{exc}") from exc

    questions = data.get("questions")
    if not isinstance(questions, list):
        raise ValueError("questions 必须是数组")
    if len(questions) != expected_count:
        raise ValueError(f"题目必须恰好 {expected_count} 道，实际 {len(questions)} 道")

    gated = []
    for i, q in enumerate(questions):
        stem = q.get("stem")
        options = q.get("options")
        answer_index = q.get("answer_index")
        analysis = q.get("analysis", "")
        if not isinstance(stem, str) or not stem.strip():
            raise ValueError(f"第 {i+1} 题题干必须非空")
        if not isinstance(options, list) or len(options) != 4:
            raise ValueError(f"第 {i+1} 题必须恰好 4 个选项")
        if not all(isinstance(o, str) and o.strip() for o in options):
            raise ValueError(f"第 {i+1} 题选项必须均为非空字符串")
        if len(set(options)) != 4:
            raise ValueError(f"第 {i+1} 题选项不得重复")
        if not isinstance(answer_index, int) or isinstance(answer_index, bool):
            raise ValueError(f"第 {i+1} 题 answer_index 必须为整数")
        if not 0 <= answer_index <= 3:
            raise ValueError(f"第 {i+1} 题 answer_index 必须在 0-3")
        if not isinstance(analysis, str):
            raise ValueError(f"第 {i+1} 题 analysis 必须为字符串")
        gated.append(
            {
                "stem": stem.strip(),
                "options": [o.strip() for o in options],
                "answer_index": answer_index,
                "analysis": analysis.strip(),
            }
        )
    return gated


def generate_paper(db: Session, actor, body) -> ExamPaper:
    total_score = body.question_count * POINTS_PER_QUESTION
    if body.pass_score > total_score:
        raise ValueError("pass_score_exceeds_total")

    config = _tenant_config(db, actor.tenant_id)
    ai = _ai_settings(config)
    if not ai["api_key"]:
        raise ValueError("ai_not_configured")

    quota = ai["monthly_token_quota"]
    if quota is not None and _month_used(db, actor.tenant_id) >= int(quota):
        raise RuntimeError("monthly_token_quota_exceeded")

    user_message = (
        f"请命制 {body.question_count} 道单选题。\n"
        f"岗位：{body.target_position or '（未指定）'}\n"
        f"序列：{body.target_sequence or '（未指定）'}\n"
        f"目标职级：{body.target_grade or '（未指定）'}"
    )
    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]
    client = get_client(
        base_url=ai["base_url"], api_key=ai["api_key"], model=ai["model"]
    )

    last_error = ""
    for _ in range(max(1, settings.ai_max_attempts)):
        try:
            result = client.chat(messages)
            gated = _gate_paper_questions(result.content, body.question_count)
        except Exception as exc:
            last_error = f"{type(exc).__name__}: {exc}"
            continue

        # 质量门通过，一次性落库
        paper = ExamPaper(
            tenant_id=actor.tenant_id,
            title=body.title,
            description=body.description,
            target_position=body.target_position,
            target_sequence=body.target_sequence,
            target_grade=body.target_grade,
            status=PaperStatus.PENDING_REVIEW,
            source="ai",
            model=ai["model"],
            duration_minutes=body.duration_minutes,
            pass_score=body.pass_score,
            total_score=total_score,
            created_by=actor.id,
        )
        paper.questions = [
            ExamQuestion(
                sort_order=i + 1,
                type="single_choice",
                stem=q["stem"],
                options=q["options"],
                answer_index=q["answer_index"],
                score=POINTS_PER_QUESTION,
                analysis=q["analysis"],
            )
            for i, q in enumerate(gated)
        ]
        db.add(paper)
        db.flush()

        db.add(
            AIUsage(
                tenant_id=actor.tenant_id,
                feature=FEATURE,
                model=ai["model"],
                prompt_tokens=result.prompt_tokens,
                completion_tokens=result.completion_tokens,
                total_tokens=result.prompt_tokens + result.completion_tokens,
            )
        )
        db.flush()
        return paper

    raise RuntimeError(last_error or "ai_request_failed")


# ---------------------------------------------------------------------------
# 审核
# ---------------------------------------------------------------------------

def approve_paper(db: Session, paper: ExamPaper) -> ExamPaper:
    if paper.status != PaperStatus.PENDING_REVIEW:
        raise ValueError("paper_not_pending")
    paper.status = PaperStatus.PUBLISHED
    from datetime import datetime, timezone

    paper.published_at = datetime.now(timezone.utc)
    return paper


def reject_paper(db: Session, paper: ExamPaper, reason: str) -> ExamPaper:
    if paper.status != PaperStatus.PENDING_REVIEW:
        raise ValueError("paper_not_pending")
    paper.status = PaperStatus.REJECTED
    paper.reject_reason = reason
    return paper


# ---------------------------------------------------------------------------
# 查询
# ---------------------------------------------------------------------------

def list_papers(
    db: Session, user: User, *, include_unpublished: bool = False
) -> list[ExamPaper]:
    stmt = select(ExamPaper).where(ExamPaper.tenant_id == user.tenant_id)
    papers = db.scalars(stmt.order_by(ExamPaper.created_at.desc())).all()
    if include_unpublished:
        return list(papers)
    # 其余角色只看已发布
    return [p for p in papers if p.status == PaperStatus.PUBLISHED]


def get_paper_for_user(
    db: Session, paper_id, user: User, *, include_unpublished: bool = False
) -> ExamPaper:
    paper = db.get(ExamPaper, paper_id)
    if paper is None or paper.tenant_id != user.tenant_id:
        return None
    if paper.status != PaperStatus.PUBLISHED and not include_unpublished:
        return None
    return paper


# ---------------------------------------------------------------------------
# 开始 / 交卷
# ---------------------------------------------------------------------------

def _employee_for_user(db: Session, user) -> Employee | None:
    return db.scalar(select(Employee).where(Employee.user_id == user.id))


def start_attempt(db: Session, paper: ExamPaper, user) -> ExamAttempt:
    if paper.status != PaperStatus.PUBLISHED:
        raise ValueError("paper_not_published")
    employee = _employee_for_user(db, user)
    if employee is None:
        raise ValueError("employee_profile_missing")

    # 幂等：已有进行中的考试直接复用（防刷新/重复开始）
    existing = db.scalar(
        select(ExamAttempt).where(
            ExamAttempt.paper_id == paper.id,
            ExamAttempt.examinee_id == employee.id,
            ExamAttempt.status == AttemptStatus.IN_PROGRESS,
        )
    )
    if existing is not None:
        return existing

    attempt = ExamAttempt(
        tenant_id=user.tenant_id,
        paper_id=paper.id,
        examinee_id=employee.id,
        status=AttemptStatus.IN_PROGRESS,
        answers={},
        total_score=paper.total_score,
    )
    db.add(attempt)
    db.flush()
    return attempt


def get_owned_attempt(
    db: Session, attempt_id, user, *, is_admin: bool = False
) -> ExamAttempt | None:
    attempt = db.get(ExamAttempt, attempt_id)
    if attempt is None or attempt.tenant_id != user.tenant_id:
        return None
    employee = _employee_for_user(db, user)
    is_owner = employee is not None and attempt.examinee_id == employee.id
    if not (is_owner or is_admin):
        return None
    return attempt


def submit_attempt(
    db: Session, attempt: ExamAttempt, raw_answers: dict
) -> ExamAttempt:
    if attempt.status != AttemptStatus.IN_PROGRESS:
        raise ValueError("attempt_not_in_progress")

    paper = db.get(ExamPaper, attempt.paper_id)
    valid_ids = {str(q.id) for q in paper.questions}
    answers: dict[str, int] = {}
    for key, value in raw_answers.items():
        if key in valid_ids and isinstance(value, int) and 0 <= value <= 3:
            answers[key] = value

    score = 0
    for q in paper.questions:
        if answers.get(str(q.id)) == q.answer_index:
            score += q.score

    attempt.answers = answers
    attempt.score = score
    attempt.passed = score >= paper.pass_score
    attempt.status = AttemptStatus.SUBMITTED
    from datetime import datetime, timezone

    attempt.submitted_at = datetime.now(timezone.utc)
    return attempt


def list_my_attempts(db: Session, user) -> list[ExamAttempt]:
    employee = _employee_for_user(db, user)
    if employee is None:
        return []
    return list(
        db.scalars(
            select(ExamAttempt)
            .where(ExamAttempt.examinee_id == employee.id)
            .order_by(ExamAttempt.started_at.desc())
        ).all()
    )
