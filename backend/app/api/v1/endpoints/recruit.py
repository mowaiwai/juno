"""招聘面试端点。

在招需求、候选人管道、面试题库（履职表即题库）。
AI 生成面试题需人工审核；面试记录与候选人画像比对。
"""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import err, get_current_user, require_perm_user
from app.database import get_db
from app.models.recruit import (
    Candidate,
    CandStage,
    InterviewQuestion,
    InterviewRecord,
    QuestionSource,
    QuestionStatus,
    Requisition,
)
from app.models.user import User
from app.schemas.recruit import (
    CandidateOut,
    InterviewQuestionOut,
    InterviewRecordIn,
    InterviewRecordOut,
    QuestionGenerateIn,
    QuestionReviewIn,
    RequisitionOut,
)
from app.services.audit import audit_as
from app.services.match_config import get_match_config
from app.services.match_interview import interview_dimension_actual

router = APIRouter(tags=["recruit"])


# ============ 在招需求 ============

@router.get("/requisitions", response_model=list[RequisitionOut])
def list_requisitions(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """在招需求列表。"""
    stmt = (
        select(Requisition)
        .where(Requisition.tenant_id == user.tenant_id)
        .order_by(Requisition.opened_at.desc())
    )
    return [RequisitionOut.model_validate(r) for r in db.scalars(stmt).all()]


# ============ 候选人 ============

@router.get("/candidates", response_model=list[CandidateOut])
def list_candidates(
    req_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """候选人列表，可按需求筛选。"""
    stmt = select(Candidate).where(Candidate.tenant_id == user.tenant_id)
    if req_id is not None:
        stmt = stmt.where(Candidate.req_id == req_id)
    stmt = stmt.order_by(Candidate.applied_at.desc())
    return [CandidateOut.model_validate(c) for c in db.scalars(stmt).all()]


# ============ 面试题库 ============

@router.get("/interview-questions", response_model=list[InterviewQuestionOut])
def list_questions(
    dimension: int | None = Query(None, ge=1, le=4),
    position: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """题库查询，可按维度/岗位筛选。"""
    stmt = select(InterviewQuestion).where(
        InterviewQuestion.tenant_id == user.tenant_id
    )
    if dimension is not None:
        stmt = stmt.where(InterviewQuestion.dimension == dimension)
    if position:
        stmt = stmt.where(InterviewQuestion.position == position)
    stmt = stmt.order_by(InterviewQuestion.dimension, InterviewQuestion.created_at.desc())
    return [InterviewQuestionOut.model_validate(q) for q in db.scalars(stmt).all()]


@router.post("/interview-questions/generate", response_model=list[InterviewQuestionOut], status_code=201)
def generate_questions(
    body: QuestionGenerateIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_perm_user("recruit.manage")),
):
    """AI 按职级生成面试题（待审核状态）。

    逻辑：根据岗位与职级，按四维度生成面试题，全部进入 pending_review。
    """
    dims = [body.dimension] if body.dimension else [1, 2, 3, 4]
    dim_templates = {
        1: "请讲一次你独立完成{position}核心模块的经历：设计中最难的取舍是什么？评审收到了哪些意见？",
        2: "{grade} 级{position}需要掌握的核心知识有哪些？举一个你在实际项目中应用的案例。",
        3: "跨团队推进一个有分歧的方案时，你作为{position}怎么让信息同步、承诺兑现？",
        4: "最近 6–12 个月你作为{position}优化了哪个点？产出什么效果，用数据说明。",
    }
    dim_answer_points = {
        1: "取舍有依据、评审意见被采纳、无重大返工",
        2: "概念准确、决策与业务约束挂钩",
        3: "协同推进关键行为：信息同步及时、承诺可兑现",
        4: "优化点具体、效果可量化、个人贡献边界清楚",
    }

    created = []
    for dim in dims:
        q = InterviewQuestion(
            tenant_id=user.tenant_id,
            dimension=dim,
            position=body.position,
            grade=body.grade,
            question=dim_templates[dim].format(position=body.position, grade=body.grade),
            answer_point=dim_answer_points[dim],
            source=QuestionSource.AI,
            status=QuestionStatus.PENDING_REVIEW,
            created_by=user.id,
        )
        db.add(q)
        db.flush()
        created.append(q)

    audit_as(
        db, user, "interview_questions_generated", "interview_question",
        created[0].id if created else uuid.UUID(int=0), None,
        {"position": body.position, "grade": body.grade, "count": len(created)},
    )
    db.commit()
    for q in created:
        db.refresh(q)
    return [InterviewQuestionOut.model_validate(q) for q in created]


@router.put("/interview-questions/{question_id}/review", response_model=InterviewQuestionOut)
def review_question(
    question_id: uuid.UUID,
    body: QuestionReviewIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_perm_user("recruit.manage")),
):
    """审核面试题：通过 → approved，驳回 → rejected。"""
    q = db.get(InterviewQuestion, question_id)
    if q is None or q.tenant_id != user.tenant_id:
        raise err(404, "question_not_found", "面试题不存在")
    if q.status != QuestionStatus.PENDING_REVIEW:
        raise err(409, "already_reviewed", "该题目已审核")
    before = {"status": q.status.value}
    q.status = QuestionStatus.APPROVED if body.approved else QuestionStatus.REJECTED
    audit_as(db, user, "interview_question_reviewed", "interview_question",
             q.id, before, {"status": q.status.value})
    db.commit()
    db.refresh(q)
    return InterviewQuestionOut.model_validate(q)


# ============ 面试记录 ============

@router.post("/interview-records", response_model=InterviewRecordOut, status_code=201)
def save_record(
    body: InterviewRecordIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """保存面试记录。"""
    cand = db.get(Candidate, body.candidate_id)
    if cand is None or cand.tenant_id != user.tenant_id:
        raise err(404, "candidate_not_found", "候选人不存在")
    rec = InterviewRecord(
        tenant_id=user.tenant_id,
        candidate_id=body.candidate_id,
        req_id=body.req_id,
        interviewer_id=user.id,
        dimension_scores=body.dimension_scores,
        comment=body.comment,
        rating=body.rating,
        stage=body.stage,
    )
    db.add(rec)
    audit_as(db, user, "interview_record_saved", "interview_record",
             rec.id, None, {"candidate_id": str(body.candidate_id), "stage": body.stage})
    db.commit()
    db.refresh(rec)
    return InterviewRecordOut.model_validate(rec)


@router.get("/interview-records/compare")
def compare_candidate(
    candidate_id: uuid.UUID,
    position: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """候选人画像比对：返回候选人面试评分与岗位画像匹配度。"""
    cand = db.get(Candidate, candidate_id)
    if cand is None or cand.tenant_id != user.tenant_id:
        raise err(404, "candidate_not_found", "候选人不存在")
    records = db.scalars(
        select(InterviewRecord)
        .where(
            InterviewRecord.tenant_id == user.tenant_id,
            InterviewRecord.candidate_id == candidate_id,
        )
        # created_at 并列时按 id 降序确定性取舍（Minor-6）
        .order_by(InterviewRecord.created_at.desc(), InterviewRecord.id.desc())
    ).all()
    # 匹配度取「最新面试记录」评分，经统一引擎实时计算；
    # 不读 Candidate.match_score 静态列（列保留供列表展示）
    latest = records[0] if records else None
    cfg = get_match_config(db, user.tenant_id)
    result = cfg.score(
        interview_dimension_actual(latest.dimension_scores if latest else None)
    )
    return {
        "candidate_id": str(candidate_id),
        "name": cand.name,
        "match_score": result.score,
        "level": result.level,
        "missing_dims": result.missing_dims,
        "dims": [
            {
                "key": d.key,
                "actual": d.actual,
                "required": d.required,
                "ratio": d.ratio,
                "is_gap": d.is_gap,
            }
            for d in result.dims
        ],
        "rating": cand.rating,
        "stage": cand.stage.value,
        "records": [
            {
                "stage": r.stage,
                "rating": r.rating,
                "comment": r.comment,
                "dimension_scores": r.dimension_scores,
            }
            for r in records
        ],
    }
