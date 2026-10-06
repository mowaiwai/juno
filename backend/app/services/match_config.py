"""租户匹配配置读取/写入（DB 薄层；算分仍在 services.match 纯内核）。"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.match import MatchTenantConfig
from app.services.match import DEFAULT_CONFIG, MatchConfigData


def get_match_config(db: Session, tenant_id: uuid.UUID) -> MatchConfigData:
    """取租户生效配置；无记录返回平台默认（is_default=True）。"""
    row = db.scalar(
        select(MatchTenantConfig).where(
            MatchTenantConfig.tenant_id == tenant_id
        )
    )
    if row is None:
        return DEFAULT_CONFIG
    return MatchConfigData(
        weights=dict(row.weights),
        required=dict(row.required),
        good=row.good_threshold,
        warn=row.warn_threshold,
        is_default=False,
    )


def upsert_match_config(
    db: Session,
    tenant_id: uuid.UUID,
    *,
    weights: dict,
    required: dict,
    good: int,
    warn: int,
    updated_by: uuid.UUID | None,
) -> MatchConfigData:
    """整体替换租户配置（每租户至多一行）。调用方负责校验与 commit。"""
    row = db.scalar(
        select(MatchTenantConfig).where(
            MatchTenantConfig.tenant_id == tenant_id
        )
    )
    if row is None:
        row = MatchTenantConfig(tenant_id=tenant_id)
        db.add(row)
    row.weights = dict(weights)
    row.required = dict(required)
    row.good_threshold = good
    row.warn_threshold = warn
    row.updated_by = updated_by
    db.flush()
    return MatchConfigData(
        weights=dict(row.weights),
        required=dict(row.required),
        good=row.good_threshold,
        warn=row.warn_threshold,
        is_default=False,
    )
