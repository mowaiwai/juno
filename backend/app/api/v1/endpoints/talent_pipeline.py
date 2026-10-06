"""人才梯队建设端点（模块七 P3，spec PRD §模块七）。

只读计算 + AI 培养计划，全部端点挂 /talent-pipeline/*。
权限：succession.manage（COE·干部管理 / OTD）读写；员工/HRBP 只读 pyramid/health。
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import Principal, err, get_principal, require_perm_user
from app.database import get_db
from app.models.employee import Employee
from app.models.user import User
from app.schemas.talent_pipeline import (
    BackupCandidateListOut,
    BackupCandidateOut,
    PipelineGapWarningOut,
    PipelineHealthOut,
    PipelineLevelCell,
    PipelinePyramidOut,
    TrainingPlanIn,
    TrainingPlanOut,
)
from app.services.talent_pipeline import (
    build_pyramid,
    compute_health,
    list_backup_candidates,
    list_gap_warnings,
)

router = APIRouter(tags=["talent-pipeline"])

_manage = require_perm_user("succession.manage")


def _can_read(principal: Principal) -> bool:
    return principal.can(
        "succession.manage", "succession.nominate", "inventory.calibrate",
        "gap.manage",
    )


@router.get(
    "/talent-pipeline/pyramid",
    response_model=PipelinePyramidOut,
)
def pyramid_endpoint(
    sequence: str,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    """序列×层级梯队图。sequence 必填，避免一次返回全部序列过大。"""
    if not _can_read(principal):
        raise err(403, "forbidden", "无权查看梯队图")
    if not sequence or not sequence.strip():
        raise err(422, "invalid_request", "sequence 不能为空")
    data = build_pyramid(db, principal.user.tenant_id, sequence.strip())
    return PipelinePyramidOut(
        sequence=data["sequence"],
        levels=[PipelineLevelCell(**c) for c in data["levels"]],
        total_headcount=data["total_headcount"],
        total_active=data["total_active"],
        total_pool=data["total_pool"],
    )


@router.get("/talent-pipeline/health", response_model=PipelineHealthOut)
def health_endpoint(
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    """梯队健康度三指标（厚度/断层率/流动率）。"""
    if not _can_read(principal):
        raise err(403, "forbidden", "无权查看健康度指标")
    return PipelineHealthOut(**compute_health(db, principal.user.tenant_id))


@router.get(
    "/talent-pipeline/backup-candidates",
    response_model=BackupCandidateListOut,
)
def backup_candidates_endpoint(
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    """后备人才识别：最新发布盘点批次高潜 + 绩优。"""
    if not _can_read(principal):
        raise err(403, "forbidden", "无权查看后备人才")
    data = list_backup_candidates(db, principal.user.tenant_id)
    return BackupCandidateListOut(
        batch_id=data["batch_id"],
        batch_name=data["batch_name"],
        items=[BackupCandidateOut(**i) for i in data["items"]],
        total=data["total"],
    )


@router.get(
    "/talent-pipeline/gap-warnings",
    response_model=list[PipelineGapWarningOut],
)
def gap_warnings_endpoint(
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    """断层预警：合格供给 < 标准编制 的层级。"""
    if not _can_read(principal):
        raise err(403, "forbidden", "无权查看断层预警")
    return [PipelineGapWarningOut(**w) for w in list_gap_warnings(
        db, principal.user.tenant_id)]


@router.post(
    "/talent-pipeline/training-plan/{employee_id}",
    response_model=TrainingPlanOut,
)
def training_plan_endpoint(
    employee_id: uuid.UUID,
    body: TrainingPlanIn,
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    """AI 培养计划（复用 cockpit/org_diagnosis 的 LLM 调用模式）。"""
    from app.config import settings
    from app.services.ai import _ai_settings, _tenant_config
    from app.services.llm import get_client

    emp = db.get(Employee, employee_id)
    if emp is None or emp.tenant_id != user.tenant_id or not emp.is_active:
        raise err(404, "employee_not_found", "员工不存在或已停用")

    # 数据上下文：员工 + 健康度 + 该员工后备状态
    health = compute_health(db, user.tenant_id)
    candidates = list_backup_candidates(db, user.tenant_id)
    me = next(
        (c for c in candidates["items"] if c["employee_id"] == employee_id),
        None,
    )

    context = (
        f"员工：{emp.name}（{emp.sequence}/{emp.grade}，{emp.position}）。"
        f"梯队厚度 {health['thickness']}, 断层率 {health['gap_rate']}, "
        f"流动率 {health['flow_rate']}。"
    )
    if me:
        context += (
            f"该员工为盘点高潜（绩效 {me['perf_label']}、潜力 high"
            f"{'' if not me['grid_code'] else '、九宫格 ' + me['grid_code']}）。"
        )
    if body.focus:
        context += f"HR 关注点：{body.focus}。"

    prompt = (
        f"请为上述员工生成 {body.months} 个月的后备培养计划。"
        "输出中文，含 3-5 个里程碑（轮岗/项目历练/导师带教/培训/认证），"
        "按时间排序，每里程碑含目标、行动、产出、周期（月）。控制在 300 字内。"
    )

    config = _tenant_config(db, user.tenant_id)
    ai = _ai_settings(config)
    now_iso = datetime.now(timezone.utc).isoformat()

    def _rule_plan() -> TrainingPlanOut:
        plan = (
            f"{emp.name} 后备培养 {body.months} 个月计划（规则模板）："
            f"第 1-2 月完成 {emp.sequence} 序列下一层级任职资格认证；"
            f"第 2-4 月轮岗至关键岗位副手；第 4-{body.months} 月主导跨部门项目。"
        )
        milestones = [
            f"M1-M2：完成 {emp.sequence} 序列高一阶任职资格认证",
            f"M2-M4：关键岗位副手轮岗，输出岗位胜任力报告",
            f"M4-M{body.months}：主导 1 个跨部门项目，沉淀 SOP",
        ]
        return TrainingPlanOut(
            employee_id=emp.id, employee_name=emp.name,
            plan=plan, source="rule_based",
            generated_at=now_iso, milestones=milestones,
        )

    if not ai["api_key"]:
        return _rule_plan()

    client = get_client(
        base_url=ai["base_url"], api_key=ai["api_key"], model=ai["model"],
    )
    messages = [
        {"role": "system",
         "content": "你是资深 HR 顾问，擅长后备人才培养路径设计。"},
        {"role": "user", "content": f"{prompt}\n\n上下文：{context}"},
    ]
    last_error = ""
    for _ in range(max(1, settings.ai_max_attempts)):
        try:
            result = client.chat(messages)
            text = (result.content or "").strip()
            if text:
                return TrainingPlanOut(
                    employee_id=emp.id, employee_name=emp.name,
                    plan=text, source="ai_generated",
                    generated_at=now_iso, milestones=[],
                )
        except Exception as exc:
            last_error = f"{type(exc).__name__}: {exc}"
            continue

    fallback = _rule_plan()
    fallback.plan += f"（AI 生成失败：{last_error}）"
    return fallback
