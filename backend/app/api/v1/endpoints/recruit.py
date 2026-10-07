"""招聘面试端点。

在招需求、候选人管道、面试题库（履职表即题库）。
AI 生成面试题需人工审核；面试记录与候选人画像比对。
"""

import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import err, get_current_user, require_perm_user
from app.core.security import hash_password
from app.database import get_db
from app.models.employee import Employee
from app.models.org import Department
from app.models.recruit import (
    Candidate,
    CandStage,
    DIMENSION_KEY_MAP,
    DIMENSION_LABEL_MAP,
    InterviewQuestion,
    InterviewRecord,
    QuestionSource,
    QuestionStatus,
    Requisition,
)
from app.models.user import Role, User
from app.schemas.recruit import (
    CandidateIn,
    CandidateOut,
    CandidateStageIn,
    InterviewQuestionOut,
    InterviewRecordIn,
    InterviewRecordOut,
    OnboardOut,
    PrescreenOut,
    QuestionGenerateIn,
    QuestionReviewIn,
    RequisitionIn,
    RequisitionOut,
)
from app.services.audit import audit_as
from app.services.match_config import get_match_config
from app.services.match_interview import interview_dimension_actual

router = APIRouter(tags=["recruit"])

# 漏斗阶段顺序（与 FUNNEL_LABEL 对应）
_FUNNEL_STAGES = [
    CandStage.SCREEN,
    CandStage.FIRST,
    CandStage.FINAL,
    CandStage.OFFER,
    CandStage.ONBOARD,
]


# ============ 在招需求 ============

def _compute_funnel(db: Session, req_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[int]]:
    """按需求聚合候选人 stage 计数，返回 {req_id: [screen, first, final, offer, onboard]}。"""
    if not req_ids:
        return {}
    rows = db.execute(
        select(Candidate.req_id, Candidate.stage, func.count())
        .where(Candidate.req_id.in_(req_ids))
        .group_by(Candidate.req_id, Candidate.stage)
    ).all()
    result: dict[uuid.UUID, list[int]] = {rid: [0] * 5 for rid in req_ids}
    for rid, stage, cnt in rows:
        idx = _FUNNEL_STAGES.index(stage) if stage in _FUNNEL_STAGES else -1
        if idx >= 0:
            result[rid][idx] = int(cnt)
    return result


@router.get("/requisitions", response_model=list[RequisitionOut])
def list_requisitions(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """在招需求列表（漏斗实时计算）。"""
    stmt = (
        select(Requisition)
        .where(Requisition.tenant_id == user.tenant_id)
        .order_by(Requisition.opened_at.desc())
    )
    reqs = db.scalars(stmt).all()
    funnel_map = _compute_funnel(db, [r.id for r in reqs])
    out = []
    for r in reqs:
        r.funnel = funnel_map.get(r.id, [0] * 5)
        out.append(RequisitionOut.model_validate(r))
    return out


@router.post("/requisitions", response_model=RequisitionOut, status_code=201)
def create_requisition(
    body: RequisitionIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_perm_user("recruit.manage")),
):
    """创建在招需求。"""
    dept = db.scalar(
        select(Department).where(
            Department.id == body.dept_id,
            Department.tenant_id == user.tenant_id,
        )
    )
    if dept is None:
        raise err(404, "dept_not_found", "部门不存在")
    opened = body.opened_at or date.today().isoformat()
    req = Requisition(
        tenant_id=user.tenant_id,
        position=body.position,
        dept_id=body.dept_id,
        grade=body.grade,
        headcount=body.headcount,
        funnel=[0, 0, 0, 0, 0],
        owner=body.owner,
        priority=body.priority,
        opened_at=opened,
    )
    db.add(req)
    db.flush()
    audit_as(
        db, user, "requisition_created", "requisition", req.id, None,
        {"position": body.position, "dept_id": body.dept_id,
         "grade": body.grade, "headcount": body.headcount},
    )
    db.commit()
    db.refresh(req)
    return RequisitionOut.model_validate(req)


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


@router.post("/candidates", response_model=CandidateOut, status_code=201)
def create_candidate(
    body: CandidateIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_perm_user("recruit.manage")),
):
    """投递候选人。"""
    req = db.get(Requisition, body.req_id)
    if req is None or req.tenant_id != user.tenant_id:
        raise err(404, "requisition_not_found", "在招需求不存在")
    cand = Candidate(
        tenant_id=user.tenant_id,
        req_id=body.req_id,
        name=body.name,
        stage=CandStage.SCREEN,
        source=body.source,
        match_score=0,
        years=body.years,
        last_title=body.last_title,
        expected_salary=body.expected_salary,
        tags=body.tags,
        applied_at=date.today().isoformat(),
    )
    db.add(cand)
    db.flush()
    audit_as(
        db, user, "candidate_created", "candidate", cand.id, None,
        {"req_id": str(body.req_id), "name": body.name, "source": body.source},
    )
    db.commit()
    db.refresh(cand)
    return CandidateOut.model_validate(cand)


@router.put("/candidates/{candidate_id}/stage", response_model=CandidateOut)
def update_candidate_stage(
    candidate_id: uuid.UUID,
    body: CandidateStageIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_perm_user("recruit.manage")),
):
    """候选人阶段流转。"""
    cand = db.get(Candidate, candidate_id)
    if cand is None or cand.tenant_id != user.tenant_id:
        raise err(404, "candidate_not_found", "候选人不存在")
    try:
        target = CandStage(body.stage)
    except ValueError:
        raise err(422, "invalid_stage", f"无效阶段：{body.stage}")
    if target == CandStage.SCREEN:
        raise err(422, "invalid_transition", "不可回退到简历初筛")
    before = {"stage": cand.stage.value}
    cand.stage = target
    audit_as(
        db, user, "candidate_stage_changed", "candidate", cand.id,
        before, {"stage": target.value},
    )
    db.commit()
    db.refresh(cand)
    return CandidateOut.model_validate(cand)


@router.post("/candidates/{candidate_id}/onboard", response_model=OnboardOut, status_code=201)
def onboard_candidate(
    candidate_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_perm_user("recruit.manage")),
):
    """候选人入职：创建 User + Employee，候选人 stage 置为 onboard。"""
    cand = db.get(Candidate, candidate_id)
    if cand is None or cand.tenant_id != user.tenant_id:
        raise err(404, "candidate_not_found", "候选人不存在")
    if cand.stage == CandStage.ONBOARD:
        raise err(409, "already_onboarded", "该候选人已入职")
    req = db.get(Requisition, cand.req_id)
    if req is None:
        raise err(404, "requisition_not_found", "关联需求不存在")

    # 创建登录账号
    short_id = uuid.uuid4().hex[:8]
    email = f"{cand.name}.{short_id}@juno.new"
    new_user = User(
        tenant_id=user.tenant_id,
        email=email,
        name=cand.name,
        role=Role.EMPLOYEE,
        roles=["employee"],
        hashed_password=hash_password("Juno12345"),
    )
    db.add(new_user)
    db.flush()

    # 创建员工档案
    employee_no = f"E{short_id.upper()}"
    emp = Employee(
        tenant_id=user.tenant_id,
        user_id=new_user.id,
        employee_no=employee_no,
        name=cand.name,
        dept_id=req.dept_id,
        position=req.position,
        family="",
        sequence="",
        grade=req.grade,
        grade_since=date.today(),
        is_active=True,
    )
    db.add(emp)
    db.flush()

    cand.stage = CandStage.ONBOARD
    audit_as(
        db, user, "candidate_onboarded", "candidate", cand.id, None,
        {"employee_id": str(emp.id), "employee_no": employee_no,
         "user_id": str(new_user.id)},
    )
    db.commit()
    return OnboardOut(
        candidate_id=cand.id,
        employee_id=emp.id,
        user_id=new_user.id,
        employee_no=employee_no,
    )


# 职级 → 期望工作年限区间（平台默认）
_GRADE_YEARS = {
    "P1": (0, 0), "P2": (0, 1), "P3": (2, 3), "P4": (4, 5), "P5": (6, 8), "P6": (9, 99),
    "M1": (0, 1), "M2": (2, 4), "M3": (5, 7), "M4": (8, 99),
    "S1": (0, 1), "S2": (2, 3), "S3": (4, 6), "S4": (7, 99),
}

# 序列 → 关键词（用于标签匹配）
_SEQ_KEYWORDS = {
    "SW": ["分布式", "微服务", "高并发", "Java", "Python", "Go", "数据库", "架构"],
    "ENG": ["结构设计", "机械", "仿真", "CAD", "工艺", "材料"],
    "SAL": ["客户", "销售", "谈判", "渠道", "业绩", "大客户"],
    "MGT": ["团队管理", "项目管理", "战略", "组织", "绩效"],
}

# 部门 → 序列（用于预匹配时推断岗位序列）
_DEPT_SEQ = {
    "305": "SW", "306": "ENG", "601": "SAL",
    "201": "MGT", "200": "MGT", "300": "SW", "400": "ENG", "500": "ENG",
}


def _prescreen_score(cand: Candidate, req: Requisition) -> tuple[int, dict]:
    """简历-岗位预匹配打分（确定性启发式，0-100）。

    返回 (总分, breakdown)。无数据的分项不计入分母。
    """
    items: list[tuple[str, float, float]] = []  # (name, score, weight)

    # 1. 年限匹配（权重 30）
    grade = req.grade
    if grade in _GRADE_YEARS:
        lo, hi = _GRADE_YEARS[grade]
        y = cand.years or 0
        if lo <= y <= hi:
            items.append(("years", 30.0, 30.0))
        else:
            diff = min(abs(y - lo), abs(y - hi))
            items.append(("years", max(0.0, 30.0 - diff * 5), 30.0))

    # 2. 前职位相关（权重 20）
    if cand.last_title and req.position:
        title = cand.last_title.lower()
        pos = req.position.lower()
        # 简单关键词重合
        hit = any(ch in title for ch in pos if len(ch) > 1)
        items.append(("title", 20.0 if hit else 8.0, 20.0))

    # 3. 标签匹配（权重 30，命中数 × 10，封顶 30）
    if cand.tags:
        seq = _DEPT_SEQ.get(req.dept_id, "")
        seq_keywords = _SEQ_KEYWORDS.get(seq, [])
        hits = sum(1 for t in cand.tags if any(kw in str(t) for kw in seq_keywords))
        items.append(("tags", min(30.0, hits * 10.0), 30.0))

    # 4. 期望薪资（权重 20，无带宽数据时跳过，不造分）
    # 用 grade 粗略估算带宽中点，期望薪资在 ±30% 内得满分
    if cand.expected_salary and grade:
        # 粗略职级薪资基准（元/月）
        base_by_grade = {
            "P1": 10000, "P2": 15000, "P3": 22000, "P4": 32000, "P5": 45000, "P6": 60000,
            "M1": 18000, "M2": 28000, "M3": 42000, "M4": 60000,
            "S1": 12000, "S2": 20000, "S3": 30000, "S4": 45000,
        }
        base = base_by_grade.get(grade)
        if base:
            ratio = cand.expected_salary / base
            if 0.7 <= ratio <= 1.3:
                items.append(("salary", 20.0, 20.0))
            else:
                items.append(("salary", max(0.0, 20.0 - abs(ratio - 1.0) * 40), 20.0))

    if not items:
        return 0, {}
    total_score = sum(s for _, s, _ in items)
    total_weight = sum(w for _, _, w in items)
    score = round(total_score / total_weight * 100) if total_weight > 0 else 0
    breakdown = {name: round(s, 1) for name, s, _ in items}
    return score, breakdown


@router.post("/candidates/{candidate_id}/prescreen", response_model=PrescreenOut)
def prescreen_candidate(
    candidate_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_perm_user("recruit.manage")),
):
    """候选人简历-岗位预匹配（确定性启发式打分）。"""
    cand = db.get(Candidate, candidate_id)
    if cand is None or cand.tenant_id != user.tenant_id:
        raise err(404, "candidate_not_found", "候选人不存在")
    req = db.get(Requisition, cand.req_id)
    if req is None:
        raise err(404, "requisition_not_found", "关联需求不存在")

    score, breakdown = _prescreen_score(cand, req)
    cand.prescreen_score = score
    if score >= 80:
        level = "good"
    elif score >= 60:
        level = "watch"
    else:
        level = "mismatch"
    audit_as(
        db, user, "candidate_prescreened", "candidate", cand.id, None,
        {"prescreen_score": score, "level": level},
    )
    db.commit()
    return PrescreenOut(
        candidate_id=cand.id,
        prescreen_score=score,
        breakdown=breakdown,
        level=level,
    )


# ============ 面试题库 ============

@router.get("/interview-questions", response_model=list[InterviewQuestionOut])
def list_questions(
    dimension: int | None = Query(None, ge=1, le=5),
    position: str | None = None,
    sequence: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """题库查询，可按维度/岗位/序列筛选。"""
    stmt = select(InterviewQuestion).where(
        InterviewQuestion.tenant_id == user.tenant_id
    )
    if dimension is not None:
        stmt = stmt.where(InterviewQuestion.dimension == dimension)
    if position:
        stmt = stmt.where(InterviewQuestion.position == position)
    if sequence:
        stmt = stmt.where(InterviewQuestion.sequence == sequence)
    stmt = stmt.order_by(InterviewQuestion.dimension, InterviewQuestion.created_at.desc())
    rows = db.scalars(stmt).all()
    # 历史数据回填 dimension_key
    for q in rows:
        if not q.dimension_key:
            q.dimension_key = DIMENSION_KEY_MAP.get(q.dimension, "")
    return [InterviewQuestionOut.model_validate(q) for q in rows]


# 五维题目模板 + L1-L5 评分锚点
_DIM_TEMPLATES = {
    1: {
        "question": "请讲一次你独立完成{position}核心模块的经历：设计中最难的取舍是什么？评审收到了哪些意见？",
        "answer_point": "取舍有依据、评审意见被采纳、无重大返工",
        "rubric": [
            {"level": 1, "desc": "无法独立完成模块，依赖他人指导"},
            {"level": 2, "desc": "能完成模块，但设计取舍缺乏依据"},
            {"level": 3, "desc": "独立完成，设计有基本依据，评审有少量修改"},
            {"level": 4, "desc": "独立完成，取舍清晰有据，评审意见被采纳"},
            {"level": 5, "desc": "方案被复用为团队标准，无重大返工"},
        ],
    },
    2: {
        "question": "{grade} 级{position}需要掌握的核心知识有哪些？举一个你在实际项目中应用的案例。",
        "answer_point": "概念准确、决策与业务约束挂钩",
        "rubric": [
            {"level": 1, "desc": "核心知识概念模糊，无法应用"},
            {"level": 2, "desc": "了解基础概念，但应用生硬"},
            {"level": 3, "desc": "掌握核心知识，能在项目中正确应用"},
            {"level": 4, "desc": "知识扎实，能结合业务约束做决策"},
            {"level": 5, "desc": "知识体系完整，能指导他人并推动知识沉淀"},
        ],
    },
    3: {
        "question": "跨团队推进一个有分歧的方案时，你作为{position}怎么让信息同步、承诺兑现？",
        "answer_point": "协同推进关键行为：信息同步及时、承诺可兑现",
        "rubric": [
            {"level": 1, "desc": "遇到分歧退缩，无法推进"},
            {"level": 2, "desc": "能表达观点，但协调被动"},
            {"level": 3, "desc": "主动协调，信息基本同步，承诺基本兑现"},
            {"level": 4, "desc": "有效化解分歧，信息同步及时，承诺按期兑现"},
            {"level": 5, "desc": "建立协同机制，跨团队目标对齐，超预期交付"},
        ],
    },
    4: {
        "question": "最近 6–12 个月你作为{position}优化了哪个点？产出什么效果，用数据说明。",
        "answer_point": "优化点具体、效果可量化、个人贡献边界清楚",
        "rubric": [
            {"level": 1, "desc": "无优化经历或无法量化效果"},
            {"level": 2, "desc": "有优化但效果微弱，数据不充分"},
            {"level": 3, "desc": "优化点合理，效果可量化，个人贡献清楚"},
            {"level": 4, "desc": "优化产出显著效果，数据支撑充分"},
            {"level": 5, "desc": "优化带来跨团队收益，形成可复用方法论"},
        ],
    },
    5: {
        "question": "你在团队中承担过哪些协作角色？举一个你帮助团队达成目标的具体事例。",
        "answer_point": "团队协作主动、能补位、对团队结果有正向贡献",
        "rubric": [
            {"level": 1, "desc": "仅完成本职，不参与团队协作"},
            {"level": 2, "desc": "被动响应协作请求，贡献有限"},
            {"level": 3, "desc": "主动配合团队，能完成分配的协作任务"},
            {"level": 4, "desc": "主动补位，推动团队协作，对结果有正向贡献"},
            {"level": 5, "desc": "引领团队协作，化解内耗，显著提升团队产出"},
        ],
    },
}


@router.post("/interview-questions/generate", response_model=list[InterviewQuestionOut], status_code=201)
def generate_questions(
    body: QuestionGenerateIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_perm_user("recruit.manage")),
):
    """AI 按职级生成五维度面试题（待审核状态，含 L1-L5 评分锚点）。"""
    dims = [body.dimension] if body.dimension else [1, 2, 3, 4, 5]
    created = []
    for dim in dims:
        tpl = _DIM_TEMPLATES[dim]
        q = InterviewQuestion(
            tenant_id=user.tenant_id,
            dimension=dim,
            dimension_key=DIMENSION_KEY_MAP[dim],
            position=body.position,
            grade=body.grade,
            sequence=body.sequence,
            question=tpl["question"].format(position=body.position, grade=body.grade),
            answer_point=tpl["answer_point"],
            rubric=tpl["rubric"],
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
        {"position": body.position, "grade": body.grade, "sequence": body.sequence,
         "count": len(created)},
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
    # 录用建议：规则判定，AI 文案留 P2
    gap_count = sum(1 for d in result.dims if d.is_gap)
    if result.score is not None and result.score >= 80 and gap_count <= 1:
        recommendation = "建议录用"
    elif result.score is not None and result.score >= 60:
        recommendation = "可培养，建议复试"
    else:
        recommendation = "建议暂缓"
    return {
        "candidate_id": str(candidate_id),
        "name": cand.name,
        "match_score": result.score,
        "level": result.level,
        "missing_dims": result.missing_dims,
        "recommendation": recommendation,
        "prescreen_score": cand.prescreen_score,
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
