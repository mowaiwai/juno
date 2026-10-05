"""层级框架端点：框架读取（L2）+ 平台草稿管理（L4）。"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import (
    err,
    get_current_user,
    require_active_roles_user,
)
from app.database import get_db
from app.models.user import Role, User
from app.schemas.level_framework import (
    FrameworkDraftIn,
    FrameworkOut,
    ResolveOut,
)
from app.services.level_framework import (
    create_draft,
    get_draft,
    get_published,
    publish_draft,
    resolve_for_tenant,
    update_draft,
)

router = APIRouter(prefix="/level-framework", tags=["level-framework"])

_admin = require_active_roles_user(Role.PLATFORM_ADMIN)


@router.get("/latest", response_model=FrameworkOut)
def latest_framework(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fw = get_published(db)
    if fw is None:
        raise err(404, "framework_not_published", "暂无已发布的层级框架")
    return fw


@router.get("/resolve", response_model=ResolveOut)
def resolve_grade(
    grade: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = resolve_for_tenant(db, user.tenant_id, grade)
    if result is None:
        raise err(
            404,
            "grade_not_mapped",
            f"职级 {grade} 未映射到任何层级，请联系 HR 配置",
        )
    fw, level, source = result
    return ResolveOut(
        grade=grade,
        source=source,
        required_anchor=level.target_anchor,
        level=level,
        framework_version_id=fw.id,
    )


# ---------------------------------------------------------------------------
# 平台草稿管理（PLATFORM_ADMIN）
# ---------------------------------------------------------------------------

@router.post("/drafts", response_model=FrameworkOut, status_code=201)
def create_draft_endpoint(
    db: Session = Depends(get_db),
    user: User = Depends(_admin),
):
    draft = create_draft(db)
    db.commit()
    db.refresh(draft)
    return draft


@router.get("/drafts/current", response_model=FrameworkOut)
def read_draft_endpoint(
    db: Session = Depends(get_db),
    user: User = Depends(_admin),
):
    draft = get_draft(db)
    if draft is None:
        raise err(404, "draft_not_found", "当前没有草稿")
    return draft


@router.put("/drafts/current", response_model=FrameworkOut)
def update_draft_endpoint(
    body: FrameworkDraftIn,
    db: Session = Depends(get_db),
    user: User = Depends(_admin),
):
    draft = update_draft(db, body)
    db.commit()
    db.refresh(draft)
    return draft


@router.post("/drafts/current/publish", response_model=FrameworkOut)
def publish_draft_endpoint(
    db: Session = Depends(get_db),
    user: User = Depends(_admin),
):
    draft = publish_draft(db)
    db.commit()
    db.refresh(draft)
    return draft
