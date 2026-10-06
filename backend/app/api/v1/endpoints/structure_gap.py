"""人才缺口预测端点（spec structure-gap-forecast，模块五/十 P3）。

确定性减法：缺口 = 标准编制 −（在岗 + 梯队储备按梯队层级折算），
按「序列 × 层级」实时计算，不落快照。
权限点复用 gap.manage，与 match 端点同策略（不新增权限点）。
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import Principal, err, get_principal
from app.database import get_db
from app.schemas.structure_gap import (
    GapCellOut,
    GapConfigIn,
    GapConfigOut,
    GapForecastOut,
    GapSummaryOut,
    HeadcountRowOut,
    HeadcountStandardsIn,
    UnmappedOut,
)
from app.services.audit import audit_as
from app.services.structure_gap import DEFAULT_FACTORS, compute_gap_forecast
from app.services.structure_gap_data import (
    build_cell_inputs,
    get_gap_config,
    level_names,
    list_headcounts,
    replace_headcounts,
    upsert_gap_config,
)

router = APIRouter(tags=["structure"])


def _require_gap_manage(principal: Principal) -> None:
    if not principal.can("gap.manage"):
        raise err(403, "forbidden", "当前角色无权访问人才缺口预测")


def _config_out(factors, is_default: bool) -> GapConfigOut:
    return GapConfigOut(
        factor_l1=factors.l1,
        factor_l2=factors.l2,
        factor_l3=factors.l3,
        is_default=is_default,
    )


@router.get("/structure/gap-forecast", response_model=GapForecastOut)
def gap_forecast(
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    """序列 × 层级缺口矩阵实时计算（FR-1~4, FR-7）。"""
    _require_gap_manage(principal)
    tenant_id = principal.user.tenant_id
    factors, is_default = get_gap_config(db, tenant_id)
    cells, unmapped = build_cell_inputs(db, tenant_id)
    result = compute_gap_forecast(cells, factors)
    names = level_names(db)
    return GapForecastOut(
        cells=[
            GapCellOut(
                sequence=c.sequence,
                level_order=c.level_order,
                level_name=names.get(c.level_order),
                demand=c.demand,
                supply_active=c.supply_active,
                supply_pool=c.supply_pool,
                supply_total=c.supply_total,
                gap=c.gap,
                severity=c.severity,
            )
            for c in result.cells
        ],
        unmapped=UnmappedOut(count=unmapped["count"], grades=unmapped["grades"]),
        config=_config_out(factors, is_default),
        summary=GapSummaryOut(
            total_demand=result.total_demand,
            total_supply=result.total_supply,
            total_gap=result.total_gap,
            shortage_cells=result.shortage_cells,
            surplus_cells=result.surplus_cells,
        ),
    )


@router.get("/structure/headcount-standards", response_model=list[HeadcountRowOut])
def get_headcounts(
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    """读取本租户序列 × 层级标准编制全量行。"""
    _require_gap_manage(principal)
    rows = list_headcounts(db, principal.user.tenant_id)
    return [
        HeadcountRowOut(
            sequence=r.sequence, level_order=r.level_order, headcount=r.headcount
        )
        for r in rows
    ]


@router.put("/structure/headcount-standards", response_model=list[HeadcountRowOut])
def put_headcounts(
    body: HeadcountStandardsIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    """整体替换标准编制（提交集外的库内行删除），写审计 before/after 全量。"""
    _require_gap_manage(principal)
    user = principal.user
    before = [
        {"sequence": r.sequence, "level_order": r.level_order, "headcount": r.headcount}
        for r in list_headcounts(db, user.tenant_id)
    ]
    rows = replace_headcounts(
        db,
        user.tenant_id,
        [r.model_dump() for r in body.rows],
        updated_by=user.id,
    )
    after = [
        {"sequence": r.sequence, "level_order": r.level_order, "headcount": r.headcount}
        for r in rows
    ]
    audit_as(
        db, user,
        "structure_headcounts_updated", "sequence_level_headcounts", None,
        {"rows": before}, {"rows": after},
    )
    db.commit()
    return [
        HeadcountRowOut(
            sequence=r.sequence, level_order=r.level_order, headcount=r.headcount
        )
        for r in rows
    ]


@router.get("/structure/gap-config", response_model=GapConfigOut)
def get_config(
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    """读取折算系数；未配置返回平台默认（is_default=true）。"""
    _require_gap_manage(principal)
    factors, is_default = get_gap_config(db, principal.user.tenant_id)
    return _config_out(factors, is_default)


@router.put("/structure/gap-config", response_model=GapConfigOut)
def put_config(
    body: GapConfigIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    """整体更新折算系数，写审计（before 未配置时为平台默认快照）。"""
    _require_gap_manage(principal)
    user = principal.user
    before, before_default = get_gap_config(db, user.tenant_id)
    factors = upsert_gap_config(
        db,
        user.tenant_id,
        factor_l1=body.factor_l1,
        factor_l2=body.factor_l2,
        factor_l3=body.factor_l3,
        updated_by=user.id,
    )
    audit_as(
        db, user,
        "structure_gap_config_updated", "structure_gap_config", None,
        {
            "factor_l1": before.l1,
            "factor_l2": before.l2,
            "factor_l3": before.l3,
            "is_default": before_default,
        },
        {"factor_l1": factors.l1, "factor_l2": factors.l2, "factor_l3": factors.l3},
    )
    db.commit()
    return _config_out(factors, False)
