"""薪酬激励模块端点（P2 薪酬激励，ADR-0016）。"""
import csv
import io
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import (
    Principal,
    err,
    get_current_user,
    get_principal,
    require_perm,
    require_roles,
)
from app.database import get_db
from app.models.compensation import (
    AdjustmentPlan,
    AdjustmentPlanStatus,
    BonusDeptPool,
    BonusPlan,
    BonusPlanItem,
    BonusPlanStatus,
    SalaryAdjustmentHistory,
)
from app.models.employee import Employee
from app.models.org import Department
from app.models.perf import PerfPlan, PerfPlanStatus, PerfResult, PerfToolType
from app.models.user import Role
from app.schemas.comp import (
    AdjustmentPlanCreate,
    AdjustmentPreviewIn,
    AdjustmentTune,
    BonusItemTune,
    BonusPlanCreate,
    CompRulesUpdate,
    DeptPoolTune,
    RejectIn,
)
from app.services.adjustment import calculate_adjustments
from app.services.audit import audit_as
from app.services.bonus import (
    apply_dept_pool_scaling,
    calculate_bonus_items,
    period_months,
)
from app.services.comp_rules import resolve_comp_rules, update_comp_rules
from app.services.money import money, ratio4, yuan

router = APIRouter(tags=["comp"])

_BONUS_CONSUMING_TOOLS = (PerfToolType.KPI.value, PerfToolType.PBC.value)


@router.get("/comp/rules")
def get_comp_rules(
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_perm("comp.rule.manage", "bonus.manage")),
):
    """当前租户生效的薪酬规则（矩阵/固浮比/停涨分位）。"""
    return resolve_comp_rules(db, principal.user.tenant_id)


@router.put("/comp/rules")
def put_comp_rules(
    body: CompRulesUpdate,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_perm("comp.rule.manage")),
):
    """维护薪酬规则租户覆盖（COE·薪酬 / 租户管理员），变更留痕。"""
    patch = body.patch_dict()
    if not patch:
        raise err(422, "invalid_request", "未提供任何配置项")
    try:
        rules = update_comp_rules(
            db, principal.user.tenant_id,
            _actor_emp_id(db, principal.user.id), patch,
        )
    except ValueError as exc:
        raise err(422, "invalid_config", str(exc))
    db.commit()
    return rules


# ---------------------------------------------------------------------------
# 调薪方案
# ---------------------------------------------------------------------------

def _get_plan_or_404(db, tenant_id, plan_id) -> AdjustmentPlan:
    plan = db.scalar(
        select(AdjustmentPlan).where(
            AdjustmentPlan.id == plan_id,
            AdjustmentPlan.tenant_id == tenant_id,
        )
    )
    if plan is None:
        raise err(404, "plan_not_found", "调薪方案不存在")
    return plan


def _actor_emp_id(db, user_id):
    return db.scalar(select(Employee.id).where(Employee.user_id == user_id))


def _comp_viewer(principal: Principal, perm: str) -> tuple[bool, bool]:
    """返回 (可查看, 是否为仅汇总模式)。
    精确持有该薪酬管理权限点 → 可查看完整明细；
    通配管理员（can("*") 但不精确持点）/exec 角色 → 可查看但金额掩码。
    """
    if perm in principal.permissions:
        return True, False
    if principal.can("*") or principal.is_active_role(Role.EXECUTIVE):
        return True, True
    return False, False


_MASKED_ITEM_KEYS = ("current_salary", "suggested_salary", "delta", "base_salary", "new_salary")


def _mask_items(items: list, masked: bool) -> list:
    """exec 仅汇总模式：个人金额字段置 None，保留百分比/标记/姓名。"""
    if not masked:
        return items
    out = []
    for it in items:
        it = dict(it)
        for k in _MASKED_ITEM_KEYS:
            if k in it:
                it[k] = None
        out.append(it)
    return out


def _plan_budget_total(plan: AdjustmentPlan):
    return sum(
        int(it.get("delta") if it.get("delta") is not None
            else (it.get("suggested_salary", 0) - it.get("current_salary", 0)))
        for it in plan.items
    )


@router.post("/comp/adjustment-plans/preview")
def preview_adjustments(
    body: AdjustmentPreviewIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_perm("comp.rule.manage")),
):
    """调薪测算预览：按部门范围返回矩阵建议清单与预算合计（不落库）。"""
    return calculate_adjustments(db, principal.user.tenant_id, body.scope_depts)


@router.post("/comp/adjustment-plans")
def create_adjustment_plan(
    body: AdjustmentPlanCreate,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_perm("comp.rule.manage")),
):
    """COE 创建调薪方案草稿（items 来自测算服务）。"""
    plan = AdjustmentPlan(
        tenant_id=principal.user.tenant_id,
        plan_name=body.plan_name,
        status=AdjustmentPlanStatus.DRAFT.value,
        items=[it.model_dump(exclude_none=True) for it in body.items],
        adjustments=[],
    )
    db.add(plan)
    db.flush()
    audit_as(db, principal.user,
             "adjustment_plan_created", "adjustment_plan", plan.id,
             after={"plan_name": body.plan_name, "headcount": len(body.items)})
    db.commit()
    return {
        "id": str(plan.id), "plan_name": plan.plan_name,
        "status": plan.status, "items": plan.items, "adjustments": plan.adjustments,
    }


@router.get("/comp/adjustment-plans")
def list_adjustment_plans(
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    can_view, _masked = _comp_viewer(principal, "comp.rule.manage")
    if not can_view:
        raise err(403, "forbidden", "当前角色无权查看调薪方案")
    rows = db.scalars(
        select(AdjustmentPlan).where(
            AdjustmentPlan.tenant_id == principal.user.tenant_id
        ).order_by(AdjustmentPlan.created_at.desc())
    ).all()
    return [
        {
            "id": str(p.id), "plan_name": p.plan_name, "status": p.status,
            "headcount": len(p.items),
            "budget_total": _plan_budget_total(p),
            "reject_reason": p.reject_reason, "approved_at": p.approved_at,
        }
        for p in rows
    ]


@router.get("/comp/adjustment-plans/{plan_id}")
def get_adjustment_plan(
    plan_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    can_view, masked = _comp_viewer(principal, "comp.rule.manage")
    if not can_view:
        raise err(403, "forbidden", "当前角色无权查看调薪方案")
    plan = _get_plan_or_404(db, principal.user.tenant_id, plan_id)
    return {
        "id": str(plan.id), "plan_name": plan.plan_name, "status": plan.status,
        "items": _mask_items(plan.items, masked), "adjustments": plan.adjustments,
        "budget_total": _plan_budget_total(plan),
        "reject_reason": plan.reject_reason,
        "approved_at": plan.approved_at, "approved_by": plan.approved_by,
    }


@router.patch("/comp/adjustment-plans/{plan_id}")
def tune_adjustment_plan(
    plan_id: uuid.UUID,
    body: AdjustmentTune,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_perm("comp.rule.manage")),
):
    """COE 微调单名员工涨薪%，仅草稿态可改，留痕（JSON + 审计日志）。"""
    plan = _get_plan_or_404(db, principal.user.tenant_id, plan_id)
    if plan.status != AdjustmentPlanStatus.DRAFT.value:
        raise err(409, "not_draft", "仅草稿态方案可微调")
    old_pct = None
    new_items = []
    for it in plan.items:
        it = dict(it)
        if it["employee_id"] == body.employee_id:
            old_pct = it["suggested_pct"]
            it["suggested_pct"] = body.new_pct
            it["suggested_salary"] = yuan(it["current_salary"] * (1 + body.new_pct / 100))
            it["delta"] = it["suggested_salary"] - it["current_salary"]
        new_items.append(it)
    if old_pct is None:
        raise err(404, "item_not_found", "该员工不在方案名册中")
    new_adjustments = list(plan.adjustments)
    new_adjustments.append({
        "employee_id": body.employee_id,
        "old_pct": old_pct, "new_pct": body.new_pct,
        "operator_id": str(_actor_emp_id(db, principal.user.id)),
        "at": datetime.now(timezone.utc).isoformat(),
    })
    plan.items = new_items
    plan.adjustments = new_adjustments
    audit_as(db, principal.user,
             "adjustment_plan_tuned", "adjustment_plan", plan.id,
             before={"employee_id": body.employee_id, "suggested_pct": old_pct},
             after={"employee_id": body.employee_id, "suggested_pct": body.new_pct})
    db.commit()
    return {"status": plan.status, "items": plan.items, "adjustments": plan.adjustments}


@router.post("/comp/adjustment-plans/{plan_id}/submit")
def submit_adjustment_plan(
    plan_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_perm("comp.rule.manage")),
):
    plan = _get_plan_or_404(db, principal.user.tenant_id, plan_id)
    if plan.status != AdjustmentPlanStatus.DRAFT.value:
        raise err(409, "not_draft", "仅草稿态可提交审批")
    plan.status = AdjustmentPlanStatus.APPROVING.value
    plan.reject_reason = None
    audit_as(db, principal.user,
             "adjustment_plan_submitted", "adjustment_plan", plan.id,
             after={"headcount": len(plan.items)})
    db.commit()
    return {"id": str(plan.id), "status": plan.status}


@router.post("/comp/adjustment-plans/{plan_id}/approve")
def approve_adjustment_plan(
    plan_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_roles(Role.EXECUTIVE)),
):
    """高管批准：逐行写 base_salary + 调薪历史 + 审计。"""
    plan = _get_plan_or_404(db, principal.user.tenant_id, plan_id)
    if plan.status != AdjustmentPlanStatus.APPROVING.value:
        raise err(409, "not_approving", "仅审批中方案可批准")
    today = date.today()
    for it in plan.items:
        emp = db.get(Employee, uuid.UUID(it["employee_id"]))
        if emp is None or emp.tenant_id != principal.user.tenant_id:
            continue
        old_salary = emp.base_salary or it["current_salary"]
        new_salary = it["suggested_salary"]
        if old_salary != new_salary:
            emp.base_salary = new_salary
            emp.salary_updated_at = datetime.now(timezone.utc)
            db.add(SalaryAdjustmentHistory(
                tenant_id=principal.user.tenant_id,
                employee_id=emp.id,
                old_salary=old_salary, new_salary=new_salary,
                effective_date=today,
                source_plan_id=plan.id, source_type="adjustment",
                operator_id=principal.user.id,
            ))
    plan.status = AdjustmentPlanStatus.APPROVED.value
    plan.approved_at = datetime.now(timezone.utc)
    plan.approved_by = principal.user.id
    audit_as(db, principal.user,
             "adjustment_plan_approved", "adjustment_plan", plan.id,
             after={"headcount": len(plan.items)})
    db.commit()
    return {"id": str(plan.id), "status": plan.status, "approved_at": plan.approved_at}


@router.post("/comp/adjustment-plans/{plan_id}/reject")
def reject_adjustment_plan(
    plan_id: uuid.UUID,
    body: RejectIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_roles(Role.EXECUTIVE)),
):
    """高管驳回：回 draft 并记录理由（≥5 字）。"""
    plan = _get_plan_or_404(db, principal.user.tenant_id, plan_id)
    if plan.status != AdjustmentPlanStatus.APPROVING.value:
        raise err(409, "not_approving", "仅审批中方案可驳回")
    plan.status = AdjustmentPlanStatus.DRAFT.value
    plan.reject_reason = body.reason
    audit_as(db, principal.user,
             "adjustment_plan_rejected", "adjustment_plan", plan.id,
             after={"reason": body.reason})
    db.commit()
    return {"id": str(plan.id), "status": plan.status, "reject_reason": plan.reject_reason}


# ---------------------------------------------------------------------------
# 奖金方案
# ---------------------------------------------------------------------------

def _get_bonus_plan_or_404(db, tenant_id, plan_id) -> BonusPlan:
    plan = db.scalar(
        select(BonusPlan).where(
            BonusPlan.id == plan_id, BonusPlan.tenant_id == tenant_id
        )
    )
    if plan is None:
        raise err(404, "plan_not_found", "奖金方案不存在")
    return plan


def _validate_bonus_perf_plan(db, tenant_id, perf_plan_id) -> PerfPlan:
    """奖金只消费已发布 KPI/PBC 考核周期（FR-7 / ADR-0016 §2）。"""
    plan = db.scalar(
        select(PerfPlan).where(
            PerfPlan.id == perf_plan_id, PerfPlan.tenant_id == tenant_id
        )
    )
    if plan is None:
        raise err(404, "perf_plan_not_found", "考核周期不存在")
    if plan.status != PerfPlanStatus.PUBLISHED.value:
        raise err(422, "perf_plan_not_published", "仅已发布的考核周期可计发奖金")
    if plan.tool_type not in _BONUS_CONSUMING_TOOLS:
        raise err(422, "perf_plan_tool_unsupported", "奖金仅消费 KPI/PBC 考核结果，OKR/360 不计发")
    return plan


@router.post("/comp/bonus-plans")
def create_bonus_plan(
    body: BonusPlanCreate,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_perm("bonus.manage")),
):
    perf_plan_id = uuid.UUID(body.perf_plan_id)
    _validate_bonus_perf_plan(db, principal.user.tenant_id, perf_plan_id)
    plan = BonusPlan(
        tenant_id=principal.user.tenant_id,
        perf_plan_id=perf_plan_id,
        plan_name=body.plan_name,
        scope_depts=body.scope_depts,
        proration_enabled=body.proration_enabled,
        bonus_pool_total=body.bonus_pool_total,
        status=BonusPlanStatus.DRAFT.value,
    )
    db.add(plan)
    db.flush()
    audit_as(db, principal.user,
             "bonus_plan_created", "bonus_plan", plan.id,
             after={"plan_name": body.plan_name, "bonus_pool_total": body.bonus_pool_total})
    db.commit()
    return {"id": str(plan.id), "plan_name": plan.plan_name, "status": plan.status}


@router.get("/comp/bonus-plans")
def list_bonus_plans(
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    can_view, _masked = _comp_viewer(principal, "bonus.manage")
    if not can_view:
        raise err(403, "forbidden", "当前角色无权查看奖金方案")
    rows = db.scalars(
        select(BonusPlan).where(BonusPlan.tenant_id == principal.user.tenant_id)
        .order_by(BonusPlan.created_at.desc())
    ).all()
    return [
        {"id": str(p.id), "plan_name": p.plan_name, "status": p.status,
         "bonus_pool_total": float(p.bonus_pool_total or 0)}
        for p in rows
    ]


@router.post("/comp/bonus-plans/{plan_id}/calculate")
def calculate_bonus_plan(
    plan_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_perm("bonus.manage")),
):
    """执行测算：生成 items + 部门包（录入总包时按目标占比预切），状态 → calculated。"""
    plan = _get_bonus_plan_or_404(db, principal.user.tenant_id, plan_id)
    if plan.status not in (BonusPlanStatus.DRAFT.value, BonusPlanStatus.CALCULATED.value):
        raise err(409, "not_draft", "仅草稿/已测算态可重新测算")
    _validate_bonus_perf_plan(db, principal.user.tenant_id, plan.perf_plan_id)
    calc = calculate_bonus_items(
        db, principal.user.tenant_id, plan.perf_plan_id,
        plan.scope_depts, proration_enabled=plan.proration_enabled,
    )
    # 清理旧 items / dept pools
    db.query(BonusPlanItem).filter(BonusPlanItem.plan_id == plan.id).delete()
    db.query(BonusDeptPool).filter(BonusDeptPool.plan_id == plan.id).delete()
    # 部门包：录入奖金包总额时按部门目标基数占比预切；未录总包（0）时 1:1 不缩放
    total_pool = float(plan.bonus_pool_total or 0)
    total_target = sum(p["target_sum"] for p in calc["dept_pools"].values())
    dept_pool_map = {}
    for dept_id, pool in calc["dept_pools"].items():
        if total_pool > 0 and total_target > 0:
            pool_amount = money(
                Decimal(str(total_pool)) * Decimal(str(pool["target_sum"]))
                / Decimal(str(total_target))
            )
        else:
            pool_amount = pool["formula_sum"]
        dp = BonusDeptPool(
            tenant_id=principal.user.tenant_id, plan_id=plan.id, dept_id=dept_id,
            target_sum=pool["target_sum"], formula_sum=pool["formula_sum"],
            pool_amount=pool_amount,
        )
        db.add(dp)
        db.flush()
        dept_pool_map[dept_id] = dp
    # 缩放并写入 items
    pool_amounts = {
        dept_id: {"pool_amount": float(dp.pool_amount), "formula_sum": float(dp.formula_sum)}
        for dept_id, dp in dept_pool_map.items()
    }
    items = apply_dept_pool_scaling(calc["items"], pool_amounts)
    for it in items:
        db.add(BonusPlanItem(
            tenant_id=principal.user.tenant_id, plan_id=plan.id,
            employee_id=uuid.UUID(it["employee_id"]),
            target_bonus=it["target_bonus"],
            perf_coefficient=it["perf_coefficient"],
            org_coefficient=it["org_coefficient"],
            service_months=it["service_months"],
            formula_amount=it["formula_amount"],
            dept_pool_id=dept_pool_map[it["dept_id"]].id,
            scale_ratio=it["scale_ratio"],
            final_amount=it["final_amount"],
        ))
    # excluded 也写入 items（excluded_reason 标记）
    for ex in calc["excluded"]:
        db.add(BonusPlanItem(
            tenant_id=principal.user.tenant_id, plan_id=plan.id,
            employee_id=uuid.UUID(ex["employee_id"]),
            target_bonus=0, perf_coefficient=0, org_coefficient=1.0,
            service_months=None, formula_amount=0,
            scale_ratio=0, final_amount=0,
            excluded_reason=ex["reason"],
        ))
    plan.status = BonusPlanStatus.CALCULATED.value
    plan.bonus_pool_total = money(
        sum(Decimal(str(dp.pool_amount)) for dp in dept_pool_map.values())
    )
    audit_as(db, principal.user,
             "bonus_plan_calculated", "bonus_plan", plan.id,
             after={"headcount": len(items), "excluded": len(calc["excluded"]),
                    "bonus_pool_total": plan.bonus_pool_total})
    db.commit()
    return {"id": str(plan.id), "status": plan.status,
            "headcount": len(items), "excluded": len(calc["excluded"])}


def _bonus_item_payload(i: BonusPlanItem, meta: dict, masked: bool) -> dict:
    if masked:
        return {
            "employee_id": str(i.employee_id),
            **meta,
            "target_bonus": None, "formula_amount": None,
            "final_amount": None,
            "perf_coefficient": float(i.perf_coefficient),
            "org_coefficient": float(i.org_coefficient),
            "service_months": i.service_months,
            "scale_ratio": float(i.scale_ratio),
            "excluded_reason": i.excluded_reason,
        }
    return {
        "employee_id": str(i.employee_id),
        **meta,
        "target_bonus": float(i.target_bonus),
        "perf_coefficient": float(i.perf_coefficient),
        "org_coefficient": float(i.org_coefficient),
        "service_months": i.service_months,
        "formula_amount": float(i.formula_amount),
        "scale_ratio": float(i.scale_ratio),
        "final_amount": float(i.final_amount),
        "excluded_reason": i.excluded_reason,
    }


@router.get("/comp/bonus-plans/{plan_id}")
def get_bonus_plan(
    plan_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    can_view, masked = _comp_viewer(principal, "bonus.manage")
    if not can_view:
        raise err(403, "forbidden", "当前角色无权查看奖金方案")
    plan = _get_bonus_plan_or_404(db, principal.user.tenant_id, plan_id)
    items = db.scalars(
        select(BonusPlanItem).where(BonusPlanItem.plan_id == plan.id)
    ).all()
    pools = db.scalars(
        select(BonusDeptPool).where(BonusDeptPool.plan_id == plan.id)
    ).all()
    emp_rows = db.scalars(
        select(Employee).where(
            Employee.tenant_id == principal.user.tenant_id,
            Employee.id.in_([i.employee_id for i in items]),
        )
    ).all()
    emp_meta = {
        e.id: {"name": e.name, "employee_no": e.employee_no,
               "grade": e.grade, "dept_id": e.dept_id}
        for e in emp_rows
    }
    item_list = [_bonus_item_payload(i, emp_meta.get(i.employee_id, {}), masked) for i in items]
    return {
        "id": str(plan.id), "plan_name": plan.plan_name, "status": plan.status,
        "bonus_pool_total": float(plan.bonus_pool_total or 0),
        "proration_enabled": plan.proration_enabled,
        "items": item_list,
        "dept_pools": [
            {
                "dept_id": p.dept_id,
                "target_sum": float(p.target_sum),
                "formula_sum": float(p.formula_sum),
                "pool_amount": float(p.pool_amount),
                "adjust_reason": p.adjust_reason,
            }
            for p in pools
        ],
        "reject_reason": plan.reject_reason,
        "approved_at": plan.approved_at,
    }


@router.patch("/comp/bonus-plans/{plan_id}/dept-pools/{dept_id}")
def tune_dept_pool(
    plan_id: uuid.UUID,
    dept_id: str,
    body: DeptPoolTune,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_perm("bonus.manage")),
):
    """微调部门包额并重算包内缩放比（仅 calculated），理由必填并审计。"""
    plan = _get_bonus_plan_or_404(db, principal.user.tenant_id, plan_id)
    if plan.status != BonusPlanStatus.CALCULATED.value:
        raise err(409, "not_calculated", "仅已测算态可微调部门包")
    pool = db.scalar(
        select(BonusDeptPool).where(
            BonusDeptPool.plan_id == plan.id, BonusDeptPool.dept_id == dept_id
        )
    )
    if pool is None:
        raise err(404, "pool_not_found", "部门包不存在")
    before = {"pool_amount": float(pool.pool_amount), "adjust_reason": pool.adjust_reason}
    pool.pool_amount = body.pool_amount
    pool.adjust_reason = body.adjust_reason
    _rescale_pool(db, pool)
    plan.bonus_pool_total = money(
        sum(Decimal(str(p.pool_amount))
            for p in db.scalars(select(BonusDeptPool).where(BonusDeptPool.plan_id == plan.id)).all())
    )
    audit_as(db, principal.user,
             "bonus_dept_pool_tuned", "bonus_dept_pool", pool.id,
             before=before,
             after={"pool_amount": body.pool_amount, "adjust_reason": body.adjust_reason})
    db.commit()
    return {"dept_id": dept_id, "pool_amount": body.pool_amount,
            "ratio": ratio4(body.pool_amount / float(pool.formula_sum)) if pool.formula_sum else 1.0}


def _rescale_pool(db: Session, pool: BonusDeptPool) -> None:
    """按部门包当前 formula_sum 重算包内全员缩放比与实发。"""
    ratio = (
        float(pool.pool_amount) / float(pool.formula_sum)
        if pool.formula_sum else 1.0
    )
    items = db.scalars(
        select(BonusPlanItem).where(BonusPlanItem.dept_pool_id == pool.id)
    ).all()
    for it in items:
        if it.excluded_reason:
            continue
        it.scale_ratio = ratio4(ratio)
        it.final_amount = money(Decimal(str(it.formula_amount)) * Decimal(str(ratio)))


@router.patch("/comp/bonus-plans/{plan_id}/items/{employee_id}")
def tune_bonus_item(
    plan_id: uuid.UUID,
    employee_id: uuid.UUID,
    body: BonusItemTune,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_perm("bonus.manage")),
):
    """个人目标奖金覆盖（仅 calculated），按原系数/折算重算公式并留审计痕。"""
    plan = _get_bonus_plan_or_404(db, principal.user.tenant_id, plan_id)
    if plan.status != BonusPlanStatus.CALCULATED.value:
        raise err(409, "not_calculated", "仅已测算态可覆盖个人目标奖金")
    item = db.scalar(
        select(BonusPlanItem).where(
            BonusPlanItem.plan_id == plan.id,
            BonusPlanItem.employee_id == employee_id,
        )
    )
    if item is None or item.excluded_reason:
        raise err(404, "item_not_found", "该员工不在奖金发放明细中")
    pool = db.get(BonusDeptPool, item.dept_pool_id)
    if pool is None:
        raise err(404, "pool_not_found", "部门包不存在")
    perf_plan = db.get(PerfPlan, plan.perf_plan_id)
    months = period_months(perf_plan.period) if perf_plan else 12
    if plan.proration_enabled and item.service_months is not None and months > 0:
        proration = item.service_months / months
    else:
        proration = 1.0
    old_target = float(item.target_bonus)
    old_formula = float(item.formula_amount)
    new_target = money(body.target_bonus)
    new_formula = money(
        Decimal(str(new_target)) * Decimal(str(item.perf_coefficient))
        * Decimal(str(item.org_coefficient)) * Decimal(str(proration))
    )
    item.target_bonus = new_target
    item.formula_amount = new_formula
    pool.target_sum = money(Decimal(str(pool.target_sum)) + Decimal(str(new_target - old_target)))
    pool.formula_sum = money(Decimal(str(pool.formula_sum)) + Decimal(str(new_formula - old_formula)))
    _rescale_pool(db, pool)
    audit_as(db, principal.user,
             "bonus_item_target_overridden", "bonus_plan_item", item.id,
             before={"target_bonus": old_target, "formula_amount": old_formula},
             after={"target_bonus": new_target, "formula_amount": new_formula,
                    "reason": body.reason})
    db.commit()
    return {"employee_id": str(item.employee_id), "target_bonus": new_target,
            "formula_amount": new_formula}


@router.post("/comp/bonus-plans/{plan_id}/submit")
def submit_bonus_plan(
    plan_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_perm("bonus.manage")),
):
    plan = _get_bonus_plan_or_404(db, principal.user.tenant_id, plan_id)
    if plan.status != BonusPlanStatus.CALCULATED.value:
        raise err(409, "not_calculated", "仅已测算态可提交审批")
    plan.status = BonusPlanStatus.APPROVING.value
    plan.reject_reason = None
    audit_as(db, principal.user,
             "bonus_plan_submitted", "bonus_plan", plan.id,
             after={"bonus_pool_total": float(plan.bonus_pool_total or 0)})
    db.commit()
    return {"id": str(plan.id), "status": plan.status}


@router.post("/comp/bonus-plans/{plan_id}/approve")
def approve_bonus_plan(
    plan_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_roles(Role.EXECUTIVE)),
):
    """高管批准 → archived，发放清单只读。"""
    plan = _get_bonus_plan_or_404(db, principal.user.tenant_id, plan_id)
    if plan.status != BonusPlanStatus.APPROVING.value:
        raise err(409, "not_approving", "仅审批中方案可批准")
    plan.status = BonusPlanStatus.ARCHIVED.value
    plan.approved_at = datetime.now(timezone.utc)
    plan.approved_by = principal.user.id
    audit_as(db, principal.user,
             "bonus_plan_approved", "bonus_plan", plan.id,
             after={"bonus_pool_total": float(plan.bonus_pool_total or 0)})
    db.commit()
    return {"id": str(plan.id), "status": plan.status, "approved_at": plan.approved_at}


@router.post("/comp/bonus-plans/{plan_id}/reject")
def reject_bonus_plan(
    plan_id: uuid.UUID,
    body: RejectIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_roles(Role.EXECUTIVE)),
):
    plan = _get_bonus_plan_or_404(db, principal.user.tenant_id, plan_id)
    if plan.status != BonusPlanStatus.APPROVING.value:
        raise err(409, "not_approving", "仅审批中方案可驳回")
    plan.status = BonusPlanStatus.DRAFT.value
    plan.reject_reason = body.reason
    audit_as(db, principal.user,
             "bonus_plan_rejected", "bonus_plan", plan.id,
             after={"reason": body.reason})
    db.commit()
    return {"id": str(plan.id), "status": plan.status, "reject_reason": plan.reject_reason}


@router.get("/comp/bonus-plans/{plan_id}/payout-export")
def export_bonus_payout(
    plan_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_perm("bonus.manage", "audit.export")),
):
    """导出发放清单 CSV（受 bonus.manage / audit.export 权限控制；仅归档方案）。"""
    plan = _get_bonus_plan_or_404(db, principal.user.tenant_id, plan_id)
    if plan.status != BonusPlanStatus.ARCHIVED.value:
        raise err(409, "not_archived", "仅已批准归档的方案可导出发放清单")
    items = db.scalars(
        select(BonusPlanItem).where(
            BonusPlanItem.plan_id == plan.id,
            BonusPlanItem.excluded_reason.is_(None),
        )
    ).all()
    emp_rows = db.scalars(
        select(Employee).where(
            Employee.tenant_id == principal.user.tenant_id,
            Employee.id.in_([i.employee_id for i in items]),
        )
    ).all()
    emp_meta = {e.id: e for e in emp_rows}
    pools = db.scalars(
        select(BonusDeptPool).where(BonusDeptPool.plan_id == plan.id)
    ).all()
    pool_dept = {p.id: p.dept_id for p in pools}
    dept_rows = db.scalars(
        select(Department).where(Department.tenant_id == principal.user.tenant_id)
    ).all()
    dept_name = {d.id: d.name for d in dept_rows}

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["方案名称", "工号", "姓名", "职级", "部门",
                     "目标奖金", "个人绩效系数", "组织系数", "在职月数",
                     "公式应发", "缩放比", "实发金额"])
    for i in items:
        emp = emp_meta.get(i.employee_id)
        writer.writerow([
            plan.plan_name, emp.employee_no if emp else "", emp.name if emp else "",
            emp.grade if emp else "",
            dept_name.get(pool_dept.get(i.dept_pool_id)) or "",
            f"{float(i.target_bonus):.2f}", f"{float(i.perf_coefficient):.2f}",
            f"{float(i.org_coefficient):.2f}",
            "" if i.service_months is None else i.service_months,
            f"{float(i.formula_amount):.2f}", f"{float(i.scale_ratio):.4f}",
            f"{float(i.final_amount):.2f}",
        ])
    # utf-8-sig 让 Excel 正确识别中文
    data = ("\ufeff" + buf.getvalue()).encode("utf-8")
    filename = f"payout-{plan.id}.csv"
    return StreamingResponse(
        io.BytesIO(data),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/comp/my-salary")
def my_salary(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """员工本人查看：现薪 + 各周期已批准奖金发放记录（周期/工具/等级/实发）。"""
    emp = db.scalar(
        select(Employee).where(
            Employee.tenant_id == user.tenant_id, Employee.user_id == user.id
        )
    )
    if emp is None:
        raise err(404, "no_employee", "未找到员工档案")
    # 已归档（已批准）奖金方案中本人的发放明细
    bonus_items = db.scalars(
        select(BonusPlanItem).join(
            BonusPlan, BonusPlanItem.plan_id == BonusPlan.id
        ).where(
            BonusPlanItem.employee_id == emp.id,
            BonusPlan.tenant_id == emp.tenant_id,
            BonusPlan.status == BonusPlanStatus.ARCHIVED.value,
            BonusPlanItem.excluded_reason.is_(None),
        )
    ).all()
    plan_ids = {i.plan_id for i in bonus_items}
    plans = db.scalars(
        select(BonusPlan).where(BonusPlan.id.in_(plan_ids))
    ).all() if plan_ids else []
    plan_map = {p.id: p for p in plans}
    perf_plan_ids = {p.perf_plan_id for p in plans}
    perf_plans = db.scalars(
        select(PerfPlan).where(PerfPlan.id.in_(perf_plan_ids))
    ).all() if perf_plan_ids else []
    perf_plan_map = {p.id: p for p in perf_plans}
    grades = db.scalars(
        select(PerfResult).where(
            PerfResult.plan_id.in_(perf_plan_ids),
            PerfResult.employee_id == emp.id,
        )
    ).all() if perf_plan_ids else []
    grade_map = {r.plan_id: r.grade for r in grades}

    rows = []
    for i in bonus_items:
        bp = plan_map.get(i.plan_id)
        pp = perf_plan_map.get(bp.perf_plan_id) if bp else None
        rows.append({
            "plan_id": str(i.plan_id),
            "plan_name": bp.plan_name if bp else "",
            "period": pp.period if pp else None,
            "tool_type": pp.tool_type if pp else None,
            "perf_grade": grade_map.get(bp.perf_plan_id) if bp else None,
            "final_amount": float(i.final_amount),
            "formula_amount": float(i.formula_amount),
            "target_bonus": float(i.target_bonus),
        })
    return {
        "base_salary": emp.base_salary,
        "name": emp.name,
        "employee_no": emp.employee_no,
        "grade": emp.grade,
        "approved_bonuses": rows,
    }
