"""在线考试端点。"""
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import (
    Principal,
    err,
    get_current_user,
    get_principal,
    require_perm_user,
)
from app.database import get_db
from app.models.exam import AttemptStatus, ExamPaper
from app.models.user import User
from app.schemas.exam import (
    AttemptOut,
    GeneratePaperIn,
    GradedQuestionOut,
    PaperOut,
    QuestionForExam,
    QuestionOut,
    RejectIn,
    StartOut,
    SubmitIn,
)
from app.services import exam

router = APIRouter(prefix="/exam", tags=["exam"])

# 题库/试卷管理（含 AI 组卷与审核）：COE·组织与人才发展
_paper_admin = require_perm_user("exam.paper.manage")


def _is_exam_staff(principal: Principal) -> bool:
    """题库管理或考试运营角色可见未发布试卷/答案与全员成绩。"""
    return principal.can("exam.paper.manage", "exam.operate")


# ---------------------------------------------------------------------------
# 序列化
# ---------------------------------------------------------------------------

def _question_out(q) -> QuestionOut:
    return QuestionOut(
        id=q.id,
        sort_order=q.sort_order,
        type=q.type,
        stem=q.stem,
        options=q.options,
        answer_index=q.answer_index,
        score=q.score,
        analysis=q.analysis,
    )


def _paper_out(paper: ExamPaper, *, include_questions: bool) -> PaperOut:
    return PaperOut(
        id=paper.id,
        title=paper.title,
        description=paper.description,
        target_position=paper.target_position,
        target_sequence=paper.target_sequence,
        target_grade=paper.target_grade,
        status=paper.status.value if hasattr(paper.status, "value") else paper.status,
        source=paper.source,
        model=paper.model,
        duration_minutes=paper.duration_minutes,
        pass_score=paper.pass_score,
        total_score=paper.total_score,
        reject_reason=paper.reject_reason,
        created_at=paper.created_at,
        published_at=paper.published_at,
        question_count=len(paper.questions),
        questions=[_question_out(q) for q in paper.questions]
        if include_questions
        else None,
    )


def _attempt_out(attempt, *, paper_title: str, include_detail, paper_questions=None) -> AttemptOut:
    questions = None
    if include_detail:
        questions = []
        for q in sorted(paper_questions, key=lambda x: x.sort_order):
            selected = attempt.answers.get(str(q.id))
            questions.append(
                GradedQuestionOut(
                    id=q.id,
                    sort_order=q.sort_order,
                    stem=q.stem,
                    options=q.options,
                    score=q.score,
                    selected_index=selected,
                    answer_index=q.answer_index,
                    correct=selected == q.answer_index,
                )
            )
    return AttemptOut(
        id=attempt.id,
        paper_id=attempt.paper_id,
        paper_title=paper_title,
        status=attempt.status.value
        if hasattr(attempt.status, "value")
        else attempt.status,
        score=attempt.score,
        total_score=attempt.total_score,
        passed=attempt.passed,
        started_at=attempt.started_at,
        submitted_at=attempt.submitted_at,
        questions=questions,
    )


# ---------------------------------------------------------------------------
# HR：组卷与审核
# ---------------------------------------------------------------------------

@router.post("/papers/generate", response_model=PaperOut, status_code=201)
def generate_endpoint(
    body: GeneratePaperIn,
    db: Session = Depends(get_db),
    user: User = Depends(_paper_admin),
):
    try:
        paper = exam.generate_paper(db, user, body)
    except ValueError as exc:
        code = str(exc)
        if code == "ai_not_configured":
            raise err(503, code, "AI 未配置，请先设置模型密钥")
        if code == "pass_score_exceeds_total":
            raise err(422, code, "合格分不能超过试卷总分")
        raise
    except RuntimeError as exc:
        if str(exc) == "monthly_token_quota_exceeded":
            raise err(429, "quota_exceeded", "本月 AI 用量已达配额上限")
        raise err(502, "ai_request_failed", "AI 组卷失败，请稍后重试")
    db.commit()
    db.refresh(paper)
    return _paper_out(paper, include_questions=True)


@router.post("/papers/{paper_id}/approve", response_model=PaperOut)
def approve_endpoint(
    paper_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(_paper_admin),
):
    paper = db.get(ExamPaper, paper_id)
    if paper is None or paper.tenant_id != user.tenant_id:
        raise err(404, "paper_not_found", "试卷不存在")
    try:
        exam.approve_paper(db, paper)
    except ValueError:
        raise err(409, "paper_not_pending", "仅待审核试卷可执行该操作")
    db.commit()
    return _paper_out(paper, include_questions=True)


@router.post("/papers/{paper_id}/reject", response_model=PaperOut)
def reject_endpoint(
    paper_id: uuid.UUID,
    body: RejectIn,
    db: Session = Depends(get_db),
    user: User = Depends(_paper_admin),
):
    paper = db.get(ExamPaper, paper_id)
    if paper is None or paper.tenant_id != user.tenant_id:
        raise err(404, "paper_not_found", "试卷不存在")
    try:
        exam.reject_paper(db, paper, body.reason)
    except ValueError:
        raise err(409, "paper_not_pending", "仅待审核试卷可执行该操作")
    db.commit()
    return _paper_out(paper, include_questions=True)


# ---------------------------------------------------------------------------
# 通用：试卷列表/详情
# ---------------------------------------------------------------------------

@router.get("/papers", response_model=list[PaperOut])
def list_papers_endpoint(
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    return [
        _paper_out(p, include_questions=False)
        for p in exam.list_papers(
            db, principal.user, include_unpublished=_is_exam_staff(principal)
        )
    ]


@router.get("/papers/{paper_id}", response_model=PaperOut)
def get_paper_endpoint(
    paper_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    staff = _is_exam_staff(principal)
    paper = exam.get_paper_for_user(
        db, paper_id, principal.user, include_unpublished=staff
    )
    if paper is None:
        raise err(404, "paper_not_found", "试卷不存在或不可见")
    # 考试运营/题库管理详情含题目与答案；考生不在此看答案（走 start/attempt 流程）
    return _paper_out(paper, include_questions=staff)


# ---------------------------------------------------------------------------
# 考生：开始 / 交卷 / 成绩
# ---------------------------------------------------------------------------

@router.post("/papers/{paper_id}/start", response_model=StartOut)
def start_endpoint(
    paper_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    paper = exam.get_paper_for_user(db, paper_id, user)
    if paper is None:
        raise err(404, "paper_not_found", "试卷不存在或不可见")
    try:
        attempt = exam.start_attempt(db, paper, user)
    except ValueError as exc:
        if str(exc) == "employee_profile_missing":
            raise err(403, "employee_profile_missing", "缺少员工档案，无法参加考试")
        raise
    db.commit()
    db.refresh(attempt)
    return StartOut(
        attempt_id=attempt.id,
        paper_id=paper.id,
        title=paper.title,
        duration_minutes=paper.duration_minutes,
        pass_score=paper.pass_score,
        total_score=paper.total_score,
        started_at=attempt.started_at,
        questions=[
            QuestionForExam(
                id=q.id,
                sort_order=q.sort_order,
                stem=q.stem,
                options=q.options,
                score=q.score,
            )
            for q in sorted(paper.questions, key=lambda x: x.sort_order)
        ],
    )


@router.post("/attempts/{attempt_id}/submit", response_model=AttemptOut)
def submit_endpoint(
    attempt_id: uuid.UUID,
    body: SubmitIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    attempt = exam.get_owned_attempt(db, attempt_id, user)
    if attempt is None:
        raise err(404, "attempt_not_found", "考试记录不存在或无权访问")
    try:
        exam.submit_attempt(db, attempt, body.answers)
    except ValueError:
        raise err(409, "attempt_not_in_progress", "该考试已提交，不能重复交卷")
    paper = db.get(ExamPaper, attempt.paper_id)
    db.commit()
    db.refresh(attempt)
    return _attempt_out(
        attempt,
        paper_title=paper.title,
        include_detail=attempt.status == AttemptStatus.SUBMITTED,
        paper_questions=paper.questions,
    )


@router.get("/attempts", response_model=list[AttemptOut])
def list_attempts_endpoint(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = []
    for attempt in exam.list_my_attempts(db, user):
        paper = db.get(ExamPaper, attempt.paper_id)
        result.append(
            _attempt_out(
                attempt,
                paper_title=paper.title,
                include_detail=False,
            )
        )
    return result


@router.get("/attempts/{attempt_id}", response_model=AttemptOut)
def get_attempt_endpoint(
    attempt_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    user = principal.user
    attempt = exam.get_owned_attempt(
        db, attempt_id, user, is_admin=_is_exam_staff(principal)
    )
    if attempt is None:
        raise err(404, "attempt_not_found", "考试记录不存在或无权访问")
    paper = db.get(ExamPaper, attempt.paper_id)
    # 交卷后才下发含正确答案的逐题明细
    include = attempt.status == AttemptStatus.SUBMITTED
    return _attempt_out(
        attempt,
        paper_title=paper.title,
        include_detail=include,
        paper_questions=paper.questions,
    )
