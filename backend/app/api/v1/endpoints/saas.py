"""SaaS 运营模块端点：套餐/账单/AI 用量/模板市场/配置中心。"""
import calendar
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import err, require_perm_user
from app.database import get_db
from app.models.ai import AIUsage
from app.models.saas import (
    BillingBill,
    BillingPlan,
    BillStatus,
    PlatformMonthlyMetric,
    SaasConfigItem,
    TenantTemplate,
    TemplatePack,
)
from app.models.tenant_config import TenantConfig
from app.models.user import Tenant, TenantStatus, User
from app.schemas.saas import (
    AiQuotaOut,
    AiTrendPoint,
    AiUsageOut,
    BillCreate,
    BillOut,
    BillUpdate,
    ConfigItemOut,
    ConfigItemUpdate,
    MrrTrendPoint,
    PlanOut,
    PlatformDashboard,
    TenantOut,
    TenantUpdate,
    TemplatePackOut,
)
from app.services.audit import audit

router = APIRouter(prefix="/saas", tags=["saas"])
platform_router = APIRouter(prefix="/platform", tags=["platform"])
_manage = require_perm_user("saas.manage")
_platform = require_perm_user("platform.manage")

DEFAULT_AI_QUOTA = {"monthly_token_quota": 50_000_000, "over_strategy": "熔断或降级为规则引擎兜底"}


class QuotaUpdate(BaseModel):
    monthly_token_quota: int | None = None
    over_strategy: str | None = None


# ============================================================
# 套餐（平台目录）
# ============================================================

@router.get("/plans", response_model=list[PlanOut])
def list_plans(
    db: Session = Depends(get_db),
    _: User = Depends(_manage),
):
    rows = db.scalars(select(BillingPlan).order_by(BillingPlan.sort_order)).all()
    return [PlanOut.model_validate(r) for r in rows]


# ============================================================
# 账单
# ============================================================

@router.get("/bills", response_model=list[BillOut])
def list_bills(
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    rows = db.scalars(
        select(BillingBill)
        .where(BillingBill.tenant_id == user.tenant_id)
        .order_by(BillingBill.period.desc())
    ).all()
    return [BillOut.model_validate(r) for r in rows]


@router.post("/bills", response_model=BillOut, status_code=201)
def create_bill(
    body: BillCreate,
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    bill = BillingBill(tenant_id=user.tenant_id, **body.model_dump())
    db.add(bill)
    audit(db, user.tenant_id, user.id, "bill_created", "billing_bill", bill.id)
    db.commit()
    db.refresh(bill)
    return BillOut.model_validate(bill)


def _get_owned_bill(db: Session, bill_id, tenant_id) -> BillingBill:
    row = db.scalar(
        select(BillingBill).where(BillingBill.id == bill_id, BillingBill.tenant_id == tenant_id)
    )
    if row is None:
        raise err(404, "not_found", "账单不存在")
    return row


@router.put("/bills/{bill_id}", response_model=BillOut)
def update_bill(
    bill_id: uuid.UUID,
    body: BillUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    bill = _get_owned_bill(db, bill_id, user.tenant_id)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(bill, key, value)
    db.commit()
    db.refresh(bill)
    return BillOut.model_validate(bill)


@router.post("/bills/{bill_id}/pay", response_model=BillOut)
def pay_bill(
    bill_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    bill = _get_owned_bill(db, bill_id, user.tenant_id)
    before = {"status": bill.status}
    bill.status = BillStatus.PAID.value
    audit(db, user.tenant_id, user.id, "bill_paid", "billing_bill", bill.id, before)
    db.commit()
    db.refresh(bill)
    return BillOut.model_validate(bill)


# ============================================================
# AI 用量
# ============================================================

def _resolve_ai_quota(db: Session, tenant_id: uuid.UUID) -> dict:
    row = db.get(TenantConfig, tenant_id)
    values = row.values if row else {}
    q = values.get("ai_quota") or {}
    return {**DEFAULT_AI_QUOTA, **q}


def _compute_quota(db: Session, tenant_id: uuid.UUID) -> AiQuotaOut:
    quota = _resolve_ai_quota(db, tenant_id)
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    used_tokens, calls, cost = db.execute(
        select(
            func.coalesce(func.sum(AIUsage.total_tokens), 0),
            func.count(AIUsage.id),
            func.coalesce(func.sum(AIUsage.cost), 0.0),
        ).where(AIUsage.tenant_id == tenant_id, AIUsage.created_at >= month_start)
    ).one()
    quota_val = quota["monthly_token_quota"]
    pct = int((used_tokens / quota_val) * 100) if quota_val else 0
    return AiQuotaOut(
        monthly_token_quota=quota_val,
        month_used_tokens=int(used_tokens),
        month_calls=int(calls),
        month_cost=round(float(cost), 2),
        over_strategy=quota["over_strategy"],
        usage_pct=min(pct, 100),
    )


@router.get("/ai/usage", response_model=list[AiUsageOut])
def list_ai_usage(
    scene: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    q = select(AIUsage).where(AIUsage.tenant_id == user.tenant_id)
    if scene:
        q = q.where(AIUsage.feature == scene)
    rows = db.scalars(q.order_by(AIUsage.created_at.desc()).limit(limit)).all()
    return [
        AiUsageOut(
            id=r.id,
            created_at=r.created_at,
            scene=r.feature,
            model=r.model,
            input_tokens=r.prompt_tokens,
            output_tokens=r.completion_tokens,
            cost=r.cost,
            operator=r.operator,
        )
        for r in rows
    ]


@router.get("/ai/quota", response_model=AiQuotaOut)
def get_ai_quota(
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    return _compute_quota(db, user.tenant_id)


@router.put("/ai/quota", response_model=AiQuotaOut)
def update_ai_quota(
    body: QuotaUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    row = db.get(TenantConfig, user.tenant_id)
    if row is None:
        row = TenantConfig(tenant_id=user.tenant_id, values={})
        db.add(row)
    values = dict(row.values or {})
    q = dict(values.get("ai_quota") or DEFAULT_AI_QUOTA)
    for key, value in body.model_dump(exclude_unset=True).items():
        q[key] = value
    values["ai_quota"] = q
    row.values = values
    audit(db, user.tenant_id, user.id, "ai_quota_updated", "tenant_config", user.tenant_id)
    db.commit()
    return _compute_quota(db, user.tenant_id)


@router.get("/ai/trend", response_model=list[AiTrendPoint])
def get_ai_trend(
    months: int = Query(default=6, ge=1, le=12),
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    tenant_id = user.tenant_id
    now = datetime.now(timezone.utc)
    points: list[AiTrendPoint] = []
    for i in range(months - 1, -1, -1):
        m_year = now.year
        m_month = now.month - i
        while m_month <= 0:
            m_month += 12
            m_year -= 1
        start = datetime(m_year, m_month, 1, tzinfo=timezone.utc)
        last_day = calendar.monthrange(m_year, m_month)[1]
        end = datetime(m_year, m_month, last_day, 23, 59, 59, tzinfo=timezone.utc)
        tokens, cost = db.execute(
            select(
                func.coalesce(func.sum(AIUsage.total_tokens), 0),
                func.coalesce(func.sum(AIUsage.cost), 0.0),
            ).where(
                AIUsage.tenant_id == tenant_id,
                AIUsage.created_at >= start,
                AIUsage.created_at <= end,
            )
        ).one()
        points.append(AiTrendPoint(
            month=f"{m_month} 月",
            tokens=round(int(tokens) / 1_000_000, 1),
            cost=round(float(cost), 1),
        ))
    return points


# ============================================================
# 模板市场
# ============================================================

def _installed_map(db: Session, tenant_id: uuid.UUID) -> dict:
    return {
        tt.pack_id: tt.active
        for tt in db.scalars(
            select(TenantTemplate).where(TenantTemplate.tenant_id == tenant_id)
        ).all()
    }


@router.get("/templates", response_model=list[TemplatePackOut])
def list_templates(
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    packs = db.scalars(select(TemplatePack).order_by(TemplatePack.installs.desc())).all()
    installed = _installed_map(db, user.tenant_id)
    return [
        TemplatePackOut(
            id=p.id, name=p.name, industry=p.industry, version=p.version,
            standards_count=p.standards_count, rating=p.rating, installs=p.installs,
            status=p.status, desc=p.desc,
            installed=p.id in installed, active=installed.get(p.id, False),
        )
        for p in packs
    ]


@router.post("/templates/{pack_id}/install", response_model=TemplatePackOut, status_code=201)
def install_template(
    pack_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    pack = db.get(TemplatePack, pack_id)
    if pack is None:
        raise err(404, "not_found", "模板不存在")
    existing = db.scalar(
        select(TenantTemplate).where(
            TenantTemplate.tenant_id == user.tenant_id,
            TenantTemplate.pack_id == pack_id,
        )
    )
    if existing:
        existing.active = True
    else:
        db.add(TenantTemplate(tenant_id=user.tenant_id, pack_id=pack_id, active=True))
        pack.installs = (pack.installs or 0) + 1
    audit(db, user.tenant_id, user.id, "template_installed", "template_pack", pack_id)
    db.commit()
    db.refresh(pack)
    installed = _installed_map(db, user.tenant_id)
    return TemplatePackOut(
        id=pack.id, name=pack.name, industry=pack.industry, version=pack.version,
        standards_count=pack.standards_count, rating=pack.rating, installs=pack.installs,
        status=pack.status, desc=pack.desc,
        installed=pack.id in installed, active=installed.get(pack.id, False),
    )


@router.delete("/templates/{pack_id}/install", status_code=204)
def uninstall_template(
    pack_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    tt = db.scalar(
        select(TenantTemplate).where(
            TenantTemplate.tenant_id == user.tenant_id,
            TenantTemplate.pack_id == pack_id,
        )
    )
    if tt:
        db.delete(tt)
        pack = db.get(TemplatePack, pack_id)
        if pack and pack.installs:
            pack.installs -= 1
        audit(db, user.tenant_id, user.id, "template_uninstalled", "template_pack", pack_id)
        db.commit()
    return None


# ============================================================
# 配置中心
# ============================================================

@router.get("/config", response_model=list[ConfigItemOut])
def list_config(
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    rows = db.scalars(
        select(SaasConfigItem)
        .where(SaasConfigItem.tenant_id == user.tenant_id)
        .order_by(SaasConfigItem.created_at)
    ).all()
    return [
        ConfigItemOut(
            id=r.id, group=r.group, template_value=r.template_value,
            override_value=r.override_value, note=r.note, status=r.status,
            customized=bool(r.override_value and r.override_value != r.template_value),
            updated_at=r.updated_at,
        )
        for r in rows
    ]


def _get_owned_config(db: Session, item_id, tenant_id) -> SaasConfigItem:
    row = db.scalar(
        select(SaasConfigItem).where(
            SaasConfigItem.id == item_id, SaasConfigItem.tenant_id == tenant_id
        )
    )
    if row is None:
        raise err(404, "not_found", "配置项不存在")
    return row


@router.put("/config/{item_id}", response_model=ConfigItemOut)
def update_config(
    item_id: uuid.UUID,
    body: ConfigItemUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    item = _get_owned_config(db, item_id, user.tenant_id)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    audit(db, user.tenant_id, user.id, "config_updated", "saas_config_item", item.id)
    db.commit()
    db.refresh(item)
    return ConfigItemOut(
        id=item.id, group=item.group, template_value=item.template_value,
        override_value=item.override_value, note=item.note, status=item.status,
        customized=bool(item.override_value and item.override_value != item.template_value),
        updated_at=item.updated_at,
    )


# ============================================================
# 平台运营（platform_admin）
# ============================================================

@platform_router.get("/tenants", response_model=list[TenantOut])
def list_platform_tenants(
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(_platform),
):
    q = select(Tenant)
    if status:
        q = q.where(Tenant.status == status)
    rows = db.scalars(q.order_by(Tenant.joined_at.desc())).all()
    return [TenantOut.model_validate(r) for r in rows]


@platform_router.put("/tenants/{tenant_id}", response_model=TenantOut)
def update_platform_tenant(
    tenant_id: uuid.UUID,
    body: TenantUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(_platform),
):
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise err(404, "not_found", "租户不存在")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(tenant, key, value)
    audit(db, user.tenant_id, user.id, "tenant_updated", "tenant", tenant_id)
    db.commit()
    db.refresh(tenant)
    return TenantOut.model_validate(tenant)


@platform_router.post("/tenants/{tenant_id}/suspend", response_model=TenantOut)
def suspend_tenant(
    tenant_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(_platform),
):
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise err(404, "not_found", "租户不存在")
    before = {"status": tenant.status}
    tenant.status = TenantStatus.SUSPENDED.value
    audit(db, user.tenant_id, user.id, "tenant_suspended", "tenant", tenant_id, before)
    db.commit()
    db.refresh(tenant)
    return TenantOut.model_validate(tenant)


@platform_router.post("/tenants/{tenant_id}/restore", response_model=TenantOut)
def restore_tenant(
    tenant_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(_platform),
):
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise err(404, "not_found", "租户不存在")
    before = {"status": tenant.status}
    tenant.status = TenantStatus.ACTIVE.value
    audit(db, user.tenant_id, user.id, "tenant_restored", "tenant", tenant_id, before)
    db.commit()
    db.refresh(tenant)
    return TenantOut.model_validate(tenant)


@platform_router.get("/dashboard", response_model=PlatformDashboard)
def platform_dashboard(
    db: Session = Depends(get_db),
    _: User = Depends(_platform),
):
    tenants = db.scalars(select(Tenant)).all()
    total = len(tenants)
    active = [t for t in tenants if t.status == TenantStatus.ACTIVE.value]
    trial = [t for t in tenants if t.status == TenantStatus.TRIAL.value]
    suspended = [t for t in tenants if t.status == TenantStatus.SUSPENDED.value]

    mrr = sum(t.mrr for t in tenants)
    paid_seats = sum(t.seats for t in active)

    # 行业 / 套餐分布
    industry_dist: dict[str, int] = {}
    plan_dist: dict[str, int] = {}
    for t in tenants:
        industry_dist[t.industry or "未分类"] = industry_dist.get(t.industry or "未分类", 0) + 1
        plan_dist[t.plan_name or "未开通"] = plan_dist.get(t.plan_name or "未开通", 0) + 1

    # 健康度最低的租户
    risky = sorted(tenants, key=lambda t: t.health)[:4]

    # 月度趋势
    metrics = db.scalars(
        select(PlatformMonthlyMetric).order_by(PlatformMonthlyMetric.month)
    ).all()
    mrr_trend = [
        MrrTrendPoint(month=m.month, mrr=m.mrr, new_tenants=m.new_tenants)
        for m in metrics[-6:]
    ]

    # 本月新增（从月度指标取最新月）
    latest = metrics[-1] if metrics else None
    new_this_month = latest.new_tenants if latest else 0

    # 试用转化率（近似：付费 / (付费 + 试用)）
    denom = len(active) + len(trial)
    conversion = round(len(active) * 100 / denom) if denom else 0

    return PlatformDashboard(
        total_tenants=total,
        paying_tenants=len(active),
        trial_tenants=len(trial),
        suspended=len(suspended),
        mrr=mrr,
        paid_seats=paid_seats,
        new_tenants_this_month=new_this_month,
        trial_conversion=conversion,
        mrr_trend=mrr_trend,
        industry_dist=[{"name": k, "value": v} for k, v in industry_dist.items()],
        plan_dist=[{"name": k, "value": v} for k, v in plan_dist.items()],
        risky_tenants=[TenantOut.model_validate(t) for t in risky],
    )
