"""P3 远期能力端点：岗位价值评估 / 激励记录 / 问卷生成。"""
import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import err, require_perm_user
from app.database import get_db
from app.models.incentive_questionnaire import (
    IncentiveCategory,
    IncentiveRecord,
    Questionnaire,
    QuestionnaireType,
)
from app.models.job_evaluation import DEFAULT_FACTORS, JobEvaluation, JobEvalStatus
from app.models.user import User
from app.schemas.p3_forward import (
    FactorScoreIn,
    IncentiveCreate,
    IncentiveOut,
    IncentiveUpdate,
    JobEvalCreate,
    JobEvalOut,
    JobEvalUpdate,
    QuestionnaireCreate,
    QuestionnaireOut,
    TurnoverConfigOut,
    TurnoverConfigUpdate,
    TurnoverRiskReport,
)
from app.services.audit import audit

router = APIRouter(prefix="/p3", tags=["p3-forward"])

_jobeval = require_perm_user("comp.jobeval.manage")
_incentive = require_perm_user("employee.salary.edit")
_questionnaire = require_perm_user("perf.standard.manage")


# ============================================================================
# 岗位价值评估
# ============================================================================

def _compute_total(factor_scores: list[dict]) -> float:
    return round(sum(f["score"] * f["weight"] for f in factor_scores), 2)


def _enrich_factors(factor_scores: list[dict]) -> list[dict]:
    name_map = {f["key"]: f["name"] for f in DEFAULT_FACTORS}
    enriched = []
    for f in factor_scores:
        name = name_map.get(f["key"], f["key"])
        enriched.append({
            **f,
            "name": name,
            "weighted": round(f["score"] * f["weight"], 2),
        })
    return enriched


@router.get("/job-eval/default-factors")
def default_factors():
    """返回点因素法默认五维度及权重。"""
    return DEFAULT_FACTORS


@router.get("/job-evals", response_model=list[JobEvalOut])
def list_job_evals(
    db: Session = Depends(get_db),
    user: User = Depends(_jobeval),
):
    rows = db.scalars(
        select(JobEvaluation).where(JobEvaluation.tenant_id == user.tenant_id)
    ).all()
    return [JobEvalOut.model_validate(r) for r in rows]


@router.post("/job-evals", response_model=JobEvalOut, status_code=201)
def create_job_eval(
    body: JobEvalCreate,
    db: Session = Depends(get_db),
    user: User = Depends(_jobeval),
):
    ev = JobEvaluation(
        tenant_id=user.tenant_id,
        position_name=body.position_name,
        dept_id=body.dept_id,
        factor_scores=[f.model_dump() for f in body.factor_scores],
        total_score=_compute_total([f.model_dump() for f in body.factor_scores]),
        grade=body.grade,
        notes=body.notes,
        evaluated_by=user.id,
        evaluated_at=datetime.now(timezone.utc),
    )
    db.add(ev)
    audit(db, user.tenant_id, user.id, "job_eval_created", "job_evaluation", ev.id)
    db.commit()
    db.refresh(ev)
    return JobEvalOut.model_validate(ev)


@router.put("/job-evals/{eval_id}", response_model=JobEvalOut)
def update_job_eval(
    eval_id: uuid.UUID,
    body: JobEvalUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(_jobeval),
):
    ev = db.scalar(
        select(JobEvaluation).where(
            JobEvaluation.id == eval_id, JobEvaluation.tenant_id == user.tenant_id
        )
    )
    if ev is None:
        raise err(404, "not_found", "评估记录不存在")
    data = body.model_dump(exclude_unset=True)
    if "factor_scores" in data and data["factor_scores"] is not None:
        ev.factor_scores = [f if isinstance(f, dict) else f for f in data["factor_scores"]]
        ev.total_score = _compute_total(ev.factor_scores)
        del data["factor_scores"]
    for k, v in data.items():
        setattr(ev, k, v)
    ev.evaluated_by = user.id
    ev.evaluated_at = datetime.now(timezone.utc)
    audit(db, user.tenant_id, user.id, "job_eval_updated", "job_evaluation", eval_id)
    db.commit()
    db.refresh(ev)
    return JobEvalOut.model_validate(ev)


@router.delete("/job-evals/{eval_id}", status_code=204)
def delete_job_eval(
    eval_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(_jobeval),
):
    ev = db.scalar(
        select(JobEvaluation).where(
            JobEvaluation.id == eval_id, JobEvaluation.tenant_id == user.tenant_id
        )
    )
    if ev:
        db.delete(ev)
        audit(db, user.tenant_id, user.id, "job_eval_deleted", "job_evaluation", eval_id)
        db.commit()
    return None


# ============================================================================
# 激励记录（津贴福利/股权/荣誉）
# ============================================================================

@router.get("/incentives", response_model=list[IncentiveOut])
def list_incentives(
    employee_id: uuid.UUID | None = Query(default=None),
    category: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(_incentive),
):
    q = select(IncentiveRecord).where(IncentiveRecord.tenant_id == user.tenant_id)
    if employee_id:
        q = q.where(IncentiveRecord.employee_id == employee_id)
    if category:
        q = q.where(IncentiveRecord.category == category)
    rows = db.scalars(q.order_by(IncentiveRecord.granted_at.desc())).all()
    return [IncentiveOut.model_validate(r) for r in rows]


@router.post("/incentives", response_model=IncentiveOut, status_code=201)
def create_incentive(
    body: IncentiveCreate,
    db: Session = Depends(get_db),
    user: User = Depends(_incentive),
):
    rec = IncentiveRecord(
        tenant_id=user.tenant_id,
        **body.model_dump(),
        created_by=user.id,
    )
    db.add(rec)
    audit(db, user.tenant_id, user.id, "incentive_created", "incentive_record", rec.id)
    db.commit()
    db.refresh(rec)
    return IncentiveOut.model_validate(rec)


@router.put("/incentives/{incentive_id}", response_model=IncentiveOut)
def update_incentive(
    incentive_id: uuid.UUID,
    body: IncentiveUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(_incentive),
):
    rec = db.scalar(
        select(IncentiveRecord).where(
            IncentiveRecord.id == incentive_id,
            IncentiveRecord.tenant_id == user.tenant_id,
        )
    )
    if rec is None:
        raise err(404, "not_found", "激励记录不存在")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(rec, k, v)
    audit(db, user.tenant_id, user.id, "incentive_updated", "incentive_record", incentive_id)
    db.commit()
    db.refresh(rec)
    return IncentiveOut.model_validate(rec)


@router.delete("/incentives/{incentive_id}", status_code=204)
def delete_incentive(
    incentive_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(_incentive),
):
    rec = db.scalar(
        select(IncentiveRecord).where(
            IncentiveRecord.id == incentive_id,
            IncentiveRecord.tenant_id == user.tenant_id,
        )
    )
    if rec:
        db.delete(rec)
        audit(db, user.tenant_id, user.id, "incentive_deleted", "incentive_record", incentive_id)
        db.commit()
    return None


# ============================================================================
# 问卷生成
# ============================================================================

def _rule_questions(q_type: str, focus: str | None) -> list[dict]:
    """无 LLM 时的规则模板问卷。"""
    base = [
        {"text": f"请描述该岗位{f'{focus}方面' if focus else ''}的核心职责与关键任务。", "dimension": "responsibility", "level": 1, "options": []},
        {"text": "该岗位所需的知识技能等级（1-5），请举例说明。", "dimension": "knowledge", "level": 2, "options": []},
        {"text": "该岗位的工作复杂度如何？请从决策范围、问题非常规性说明。", "dimension": "complexity", "level": 3, "options": []},
        {"text": "该岗位对内外部的沟通与影响范围。", "dimension": "impact", "level": 2, "options": []},
        {"text": "该岗位的工作条件与环境压力。", "dimension": "conditions", "level": 1, "options": []},
    ]
    return base


@router.get("/questionnaires", response_model=list[QuestionnaireOut])
def list_questionnaires(
    db: Session = Depends(get_db),
    user: User = Depends(_questionnaire),
):
    rows = db.scalars(
        select(Questionnaire).where(Questionnaire.tenant_id == user.tenant_id)
    ).all()
    return [QuestionnaireOut.model_validate(r) for r in rows]


@router.post("/questionnaires/generate", response_model=QuestionnaireOut, status_code=201)
def generate_questionnaire(
    body: QuestionnaireCreate,
    db: Session = Depends(get_db),
    user: User = Depends(_questionnaire),
):
    from app.config import settings
    from app.services.ai import _ai_settings, _tenant_config
    from app.services.llm import get_client

    config = _tenant_config(db, user.tenant_id)
    ai = _ai_settings(config)

    questions = _rule_questions(body.q_type, body.focus)
    source = "rule_based"

    if ai["api_key"]:
        prompt = (
            f"请生成一份{body.q_type}问卷，标题方向：{body.title}。"
            f"{'关注点：' + body.focus if body.focus else ''}"
            "输出 JSON 数组，每题含 text(题干)、dimension(维度)、level(难度1-3)、options(选项数组，可空)。"
            "5-8 题，中文。"
        )
        client = get_client(base_url=ai["base_url"], api_key=ai["api_key"], model=ai["model"])
        try:
            result = client.chat([
                {"role": "system", "content": "你是资深 HR 问卷设计专家。"},
                {"role": "user", "content": prompt},
            ])
            text = (result.content or "").strip()
            if text:
                import json
                # 尝试解析 JSON；失败则保留规则模板
                try:
                    parsed = json.loads(text)
                    if isinstance(parsed, list):
                        questions = parsed
                        source = "ai_generated"
                except Exception:
                    pass
        except Exception:
            pass

    q = Questionnaire(
        tenant_id=user.tenant_id,
        title=body.title,
        q_type=body.q_type,
        questions=questions,
        source=source,
        created_by=user.id,
    )
    db.add(q)
    audit(db, user.tenant_id, user.id, "questionnaire_created", "questionnaire", q.id)
    db.commit()
    db.refresh(q)
    return QuestionnaireOut.model_validate(q)


@router.delete("/questionnaires/{q_id}", status_code=204)
def delete_questionnaire(
    q_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(_questionnaire),
):
    q = db.scalar(
        select(Questionnaire).where(
            Questionnaire.id == q_id, Questionnaire.tenant_id == user.tenant_id
        )
    )
    if q:
        db.delete(q)
        db.commit()
    return None


# ============================================================================
# 判断辅助：晋升认证材料预审 + 调薪资格初筛
# ============================================================================

from app.models.employee import Employee
from app.models.application import Application
from app.models.perf import PerfResult


@router.post("/judge/promotion-prescreen")
def promotion_prescreen(
    application_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_perm_user("panel.manage")),
):
    """晋升认证材料 AI 预审：检查举证材料完整性，提示缺漏，生成答辩问题。"""
    app = db.scalar(
        select(Application).where(
            Application.id == application_id, Application.tenant_id == user.tenant_id
        )
    )
    if app is None:
        raise err(404, "not_found", "认证申请不存在")

    evidence_list = getattr(app, "evidences", None) or []
    missing = []
    # 检查举证材料数量（关系表）
    if not evidence_list:
        missing.append("evidence_files")
    required_fields = ["key_achievements", "standard_items", "self_summary"]
    # 若 application 有 JSON 字段则一并检查
    meta = getattr(app, "meta", None) or {}
    for f in required_fields:
        if not meta.get(f):
            missing.append(f)

    from app.config import settings
    from app.services.ai import _ai_settings, _tenant_config
    from app.services.llm import get_client

    config = _tenant_config(db, user.tenant_id)
    ai = _ai_settings(config)
    suggested_questions = []
    ai_review = ""

    if ai["api_key"]:
        prompt = (
            f"作为认证小组专家，预审以下晋升材料并给出意见。\n"
            f"申请岗位：{getattr(app, 'position', '')}\n"
            f"举证材料数：{len(evidence_list)}\n"
            f"缺失项：{missing}\n"
            "请输出 JSON：{\"review\":\"预审意见(200字内)\", \"questions\":[\"答辩问题1\",...]}"
        )
        client = get_client(base_url=ai["base_url"], api_key=ai["api_key"], model=ai["model"])
        try:
            result = client.chat([
                {"role": "system", "content": "你是严谨的任职资格认证专家。"},
                {"role": "user", "content": prompt},
            ])
            text = (result.content or "").strip()
            if text:
                import json
                try:
                    parsed = json.loads(text)
                    ai_review = parsed.get("review", "")
                    suggested_questions = parsed.get("questions", [])
                except Exception:
                    ai_review = text[:200]
        except Exception:
            pass

    if not ai_review:
        ai_review = "材料基本齐备，建议关注关键任务完成标准与知识技能等级的对应关系。" if not missing else f"存在 {len(missing)} 项材料缺失，建议补充后提交评审。"

    return {
        "application_id": str(application_id),
        "missing_fields": missing,
        "complete": len(missing) == 0,
        "ai_review": ai_review,
        "suggested_questions": suggested_questions[:5],
        "source": "ai" if ai["api_key"] else "rule_based",
    }


@router.get("/judge/salary-adjust-eligibility/{employee_id}")
def salary_adjust_eligibility(
    employee_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_perm_user("comp.rule.manage")),
):
    """调薪资格初筛：基于绩效等级、带宽渗透率、距上次调薪月数的规则判定。"""
    emp = db.scalar(
        select(Employee).where(
            Employee.id == employee_id, Employee.tenant_id == user.tenant_id
        )
    )
    if emp is None:
        raise err(404, "not_found", "员工不存在")

    # 取最近绩效结果
    perf = db.scalar(
        select(PerfResult)
        .where(PerfResult.employee_id == employee_id)
        .order_by(PerfResult.created_at.desc())
    )
    perf_grade = getattr(perf, "grade", None) if perf else None

    # 规则判定
    eligible = True
    reasons = []

    if perf_grade and perf_grade.upper() in ("D", "E"):
        eligible = False
        reasons.append(f"最近绩效 {perf_grade}，未达调薪门槛（需 C 及以上）")

    # 距上次调薪月数
    last_adjust = getattr(emp, "salary_updated_at", None)
    if last_adjust:
        months = (date.today() - last_adjust.date()).days / 30.44
        if months < 12:
            reasons.append(f"距上次调薪仅 {months:.0f} 个月（建议满 12 个月）")

    # 带宽渗透率：base_salary / band_max（简化判断）
    salary = getattr(emp, "base_salary", None)
    if salary:
        reasons.append("带宽渗透率已纳入调薪矩阵测算，75 分位以上触发停涨纠偏")

    if not reasons:
        reasons.append("满足调薪基本条件，可进入调薪矩阵测算")

    return {
        "employee_id": str(employee_id),
        "eligible": eligible,
        "perf_grade": perf_grade,
        "reasons": reasons,
        "rule_source": "comp_rule_config",
    }


# ============================================================================
# 五体系全景聚合
# ============================================================================

@router.get("/panorama/summary")
def panorama_summary(
    db: Session = Depends(get_db),
    user: User = Depends(require_perm_user("employee.view")),
):
    """五体系（标准/选聘/评价/激励/发展）核心指标聚合，供全景页展示。"""
    from app.models.standard import StandardSet
    from app.models.recruit import Requisition
    from app.models.inventory import InventoryBatch
    from app.models.compensation import AdjustmentPlan

    from sqlalchemy import func

    tenant = user.tenant_id

    def _count(model) -> int:
        return db.scalar(select(func.count()).select_from(model).where(model.tenant_id == tenant)) or 0

    standards = _count(StandardSet)
    recruits = _count(Requisition)
    inventories = _count(InventoryBatch)
    adjustments = _count(AdjustmentPlan)

    employees = db.scalar(select(func.count()).select_from(Employee).where(Employee.tenant_id == tenant)) or 0

    # 发展：IDP 数量
    from app.models.idp import IDP
    idps = _count(IDP)

    return {
        "tenant_id": str(tenant),
        "systems": {
            "standard": {"name": "标准体系", "metric": "标准集数", "value": standards},
            "selection": {"name": "选聘体系", "metric": "招聘需求数", "value": recruits},
            "evaluation": {"name": "评价体系", "metric": "盘点批次数", "value": inventories},
            "incentive": {"name": "激励体系", "metric": "调薪方案数", "value": adjustments},
            "development": {"name": "发展体系", "metric": "IDP 数", "value": idps},
        },
        "total_employees": employees,
    }


# ============================================================================
# 离职风险预警：显式信号规则 + 风险分档（不产出概率，不触发动作）
# ============================================================================

from app.services.turnover_risk import evaluate_employee, get_turnover_config

_turnover = require_perm_user("gap.manage")

_TURNOVER_DISCLAIMER = (
    "本结果由显式信号规则计算（绩效/调薪间隔/职级停留等），非概率预测，"
    "仅供 HR 参考，不自动触发任何人事动作；正式结论需人工判断。"
)


@router.get("/turnover/config", response_model=TurnoverConfigOut)
def get_turnover_cfg(
    db: Session = Depends(get_db),
    user: User = Depends(_turnover),
):
    cfg = get_turnover_config(db, user.tenant_id)
    return TurnoverConfigOut(
        thresholds=cfg.thresholds,
        weights=cfg.weights,
        buckets=cfg.buckets,
        is_default=cfg.is_default,
    )


@router.put("/turnover/config", response_model=TurnoverConfigOut)
def update_turnover_cfg(
    body: TurnoverConfigUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(_turnover),
):
    cfg = get_turnover_config(db, user.tenant_id)
    before = {"thresholds": cfg.thresholds, "weights": cfg.weights, "buckets": cfg.buckets}
    if body.thresholds is not None:
        cfg.thresholds = {**cfg.thresholds, **body.thresholds}
    if body.weights is not None:
        cfg.weights = {**cfg.weights, **body.weights}
    if body.buckets is not None:
        cfg.buckets = {**cfg.buckets, **body.buckets}
    cfg.is_default = False
    audit(
        db, user.tenant_id, user.id,
        "turnover_config_updated", "turnover_signal_config", cfg.id,
        before=before,
        after={"thresholds": cfg.thresholds, "weights": cfg.weights, "buckets": cfg.buckets},
    )
    db.commit()
    db.refresh(cfg)
    return TurnoverConfigOut(
        thresholds=cfg.thresholds, weights=cfg.weights, buckets=cfg.buckets,
        is_default=cfg.is_default,
    )


@router.get("/turnover/risks", response_model=TurnoverRiskReport)
def turnover_risks(
    bucket: str | None = Query(default=None, pattern="^(low|medium|high)$"),
    db: Session = Depends(get_db),
    user: User = Depends(_turnover),
):
    cfg = get_turnover_config(db, user.tenant_id)
    today = date.today()
    emps = db.scalars(
        select(Employee)
        .where(Employee.tenant_id == user.tenant_id, Employee.is_active.is_(True))
        .order_by(Employee.name)
    ).all()

    items = []
    for emp in emps:
        result = evaluate_employee(emp, cfg, today)
        if result is None:
            continue
        if bucket and result["bucket"] != bucket:
            continue
        items.append({
            "employee_id": emp.id,
            "name": emp.name,
            "dept_id": emp.dept_id,
            "position": emp.position,
            "grade": emp.grade,
            "perf_grade": emp.perf_grade,
            "score": result["score"],
            "bucket": result["bucket"],
            "signals": result["signals"],
        })

    # 高风险优先排序
    order = {"high": 0, "medium": 1, "low": 2}
    items.sort(key=lambda x: (order[x["bucket"]], -x["score"]))

    summary = {
        "high": sum(1 for i in items if i["bucket"] == "high"),
        "medium": sum(1 for i in items if i["bucket"] == "medium"),
        "low": sum(1 for i in items if i["bucket"] == "low"),
        "total_scanned": len(emps),
    }

    return TurnoverRiskReport(
        generated_at=datetime.now(timezone.utc).isoformat(),
        engine="rule_based",
        disclaimer=_TURNOVER_DISCLAIMER,
        summary=summary,
        items=items,
    )

