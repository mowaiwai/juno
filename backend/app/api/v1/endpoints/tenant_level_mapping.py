"""租户职级映射端点：合并视图 + 整表提交（HR / 租户管理员）。"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.database import get_db
from app.models.user import Role, User
from app.schemas.level_framework import (
    TenantMappingIn,
    TenantMappingOut,
)
from app.services.level_framework import (
    apply_tenant_mapping,
    merged_mapping_view,
)

router = APIRouter(tags=["tenant-level-mapping"])

_mapping_roles = require_roles(Role.HR, Role.TENANT_ADMIN)


def _view(db: Session, user: User) -> TenantMappingOut:
    fw, items = merged_mapping_view(db, user.tenant_id)
    return TenantMappingOut(
        framework_version_id=fw.id,
        framework_version=fw.version,
        items=items,
    )


@router.get("/tenant-level-mapping", response_model=TenantMappingOut)
def read_mapping(
    db: Session = Depends(get_db),
    user: User = Depends(_mapping_roles),
):
    return _view(db, user)


@router.put("/tenant-level-mapping", response_model=TenantMappingOut)
def update_mapping(
    body: TenantMappingIn,
    db: Session = Depends(get_db),
    user: User = Depends(_mapping_roles),
):
    apply_tenant_mapping(
        db,
        user.tenant_id,
        user,
        body.framework_version_id,
        body.items,
    )
    db.commit()

    db.expire_all()
    return _view(db, user)
