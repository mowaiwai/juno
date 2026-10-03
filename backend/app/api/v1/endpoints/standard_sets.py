from datetime import datetime, timezone
from decimal import Decimal
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.deps import err, get_current_user, require_roles
from app.database import get_db
from app.models.standard import StandardItem, StandardSet, StandardStatus
from app.models.user import Role, User
from app.schemas.standard import (
    StandardSetCreate,
    StandardSetOut,
    StandardSetUpdate,
)

router = APIRouter(prefix="/standard-sets", tags=["standard-sets"])

# 仅 HR 可管理标准集
_hr = require_roles(Role.HR)


def _get_owned_set(db: Session, set_id, tenant_id) -> StandardSet:
    """按租户取标准集，跨租户/不存在一律 404。"""
    row = db.scalar(
        select(StandardSet)
        .where(StandardSet.id == set_id, StandardSet.tenant_id == tenant_id)
        .options(selectinload(StandardSet.items))
    )
    if row is None:
        raise err(404, "not_found", "标准集不存在")
    return row


def _next_version(db: Session, tenant_id, sequence, grade) -> int:
    current = db.scalar(
        select(func.max(StandardSet.version)).where(
            StandardSet.tenant_id == tenant_id,
            StandardSet.sequence == sequence,
            StandardSet.target_grade == grade,
        )
    )
    return (current or 0) + 1


@router.post("", response_model=StandardSetOut, status_code=201)
def create_set(
    body: StandardSetCreate,
    db: Session = Depends(get_db),
    user: User = Depends(_hr),
):
    # 同键已有草稿 → 拒绝（一次只允许编辑一个草稿）
    existing_draft = db.scalar(
        select(StandardSet.id).where(
            StandardSet.tenant_id == user.tenant_id,
            StandardSet.sequence == body.sequence,
            StandardSet.target_grade == body.target_grade,
            StandardSet.status == StandardStatus.DRAFT,
        )
    )
    if existing_draft:
        raise err(409, "draft_exists", "该序列与职级已存在草稿，请先发布或修改原草稿")

    standard_set = StandardSet(
        tenant_id=user.tenant_id,
        sequence=body.sequence,
        target_grade=body.target_grade,
        version=_next_version(db, user.tenant_id, body.sequence, body.target_grade),
        items=[
            StandardItem(
                code=i.code,
                name=i.name,
                description=i.description,
                requirement=i.requirement,
                weight=i.weight,
                sort_order=i.sort_order,
            )
            for i in body.items
        ],
    )
    db.add(standard_set)
    db.commit()
    db.refresh(standard_set)
    return _get_owned_set(db, standard_set.id, user.tenant_id)


@router.get("", response_model=list[StandardSetOut])
def list_sets(
    sequence: str | None = None,
    target_grade: str | None = None,
    status: StandardStatus | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # 租户内全角色可读；草稿仅 HR 可见
    stmt = (
        select(StandardSet)
        .where(StandardSet.tenant_id == user.tenant_id)
        .options(selectinload(StandardSet.items))
        .order_by(StandardSet.sequence, StandardSet.target_grade, StandardSet.version)
    )
    if sequence:
        stmt = stmt.where(StandardSet.sequence == sequence)
    if target_grade:
        stmt = stmt.where(StandardSet.target_grade == target_grade)
    if status:
        stmt = stmt.where(StandardSet.status == status)
    if not user.has_any(Role.HR):
        stmt = stmt.where(StandardSet.status != StandardStatus.DRAFT)
    return db.scalars(stmt).unique().all()


@router.get("/{set_id}", response_model=StandardSetOut)
def get_set(
    set_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    row = _get_owned_set(db, set_id, user.tenant_id)
    # 草稿仅 HR 可见，其他角色一律 404（不暴露草稿存在性）
    if row.status == StandardStatus.DRAFT and not user.has_any(Role.HR):
        raise err(404, "not_found", "标准集不存在")
    return row


@router.put("/{set_id}", response_model=StandardSetOut)
def update_set(
    set_id: uuid.UUID,
    body: StandardSetUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(_hr),
):
    standard_set = _get_owned_set(db, set_id, user.tenant_id)
    if standard_set.status != StandardStatus.DRAFT:
        raise err(409, "already_published", "已发布或已归档的标准集不可修改")

    # 整单替换标准项
    standard_set.items = [
        StandardItem(
            code=i.code,
            name=i.name,
            description=i.description,
            requirement=i.requirement,
            weight=i.weight,
            sort_order=i.sort_order,
        )
        for i in body.items
    ]
    standard_set.sequence = body.sequence
    standard_set.target_grade = body.target_grade
    db.commit()
    return _get_owned_set(db, set_id, user.tenant_id)


@router.post("/{set_id}/publish", response_model=StandardSetOut)
def publish_set(
    set_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(_hr),
):
    standard_set = _get_owned_set(db, set_id, user.tenant_id)
    if standard_set.status != StandardStatus.DRAFT:
        raise err(409, "already_published", "该标准集已发布或归档")

    # 权重合计必须等于 100（Decimal 精确比较）
    total = sum((Decimal(str(i.weight)) for i in standard_set.items), Decimal("0"))
    if total != Decimal("100"):
        raise err(422, "invalid_weights", f"标准项权重合计必须为 100，当前为 {total}")

    # 同键旧发布版 → archived（至多一条）
    old_published = db.scalars(
        select(StandardSet).where(
            StandardSet.tenant_id == user.tenant_id,
            StandardSet.sequence == standard_set.sequence,
            StandardSet.target_grade == standard_set.target_grade,
            StandardSet.status == StandardStatus.PUBLISHED,
        )
    ).all()
    for old in old_published:
        old.status = StandardStatus.ARCHIVED

    standard_set.status = StandardStatus.PUBLISHED
    standard_set.published_at = datetime.now(timezone.utc)
    db.commit()
    return _get_owned_set(db, set_id, user.tenant_id)
