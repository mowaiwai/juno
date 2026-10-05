"""人才画像端点（spec talent-matching §5.1）。"""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import (
    Principal,
    err,
    get_current_user,
    get_principal,
    require_perm_user,
)
from app.database import get_db
from app.framework_content import EDUCATION_OPTIONS
from app.models.employee import Employee
from app.models.profile import ProfileSnapshot
from app.models.user import User
from app.schemas.profile import (
    BasicIn,
    BasicOut,
    GenerateIn,
    ProfileOut,
    ProfileVersionItem,
)
from app.services.audit import audit_as
from app.services.profile import (
    can_view_profile,
    generate_all,
    generate_profile,
    get_version,
    latest_profile,
    profile_versions,
    update_basic,
)

router = APIRouter(tags=["profiles"])

# 画像生成：COE·组织与人才发展（profile.generate）
_generate = require_perm_user("profile.generate")
# 学历/证书等基本条件补录：employee.field.basic.edit
_basic_edit = require_perm_user("employee.field.basic.edit")


def _require_view(db: Session, principal: Principal, employee_id) -> None:
    if not can_view_profile(db, principal, employee_id):
        # 范围外员工统一 404 口径，不暴露存在性
        raise err(404, "employee_not_found", "员工不存在")


@router.post("/profiles/generate", status_code=201)
def generate_endpoint(
    body: GenerateIn,
    db: Session = Depends(get_db),
    user: User = Depends(_generate),
):
    if body.scope == "all":
        snapshots = generate_all(db, user.tenant_id, user)
        audit_as(
            db, user,
            "profile_generated", "profile", user.tenant_id,
            None,
            {"scope": "all",
             "employee_ids": [str(s.employee_id) for s in snapshots]},
        )
        db.commit()
        return [ProfileOut.model_validate(s) for s in snapshots]

    if body.employee_id is None:
        raise err(
            422, "invalid_request",
            "需提供 employee_id 或 scope=all",
        )
    snapshot = generate_profile(db, body.employee_id, actor=user)
    audit_as(
        db, user,
        "profile_generated", "profile", body.employee_id,
        None, {"version_seq": snapshot.version_seq},
    )
    db.commit()
    db.refresh(snapshot)
    return ProfileOut.model_validate(snapshot)


@router.post("/profiles/me/regenerate", response_model=ProfileOut,
             status_code=201)
def regenerate_me_endpoint(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    employee = db.query(Employee).filter(Employee.user_id == user.id).first()
    if employee is None:
        raise err(404, "employee_not_found", "当前账号无员工档案")
    snapshot = generate_profile(db, employee.id, actor=user)
    audit_as(
        db, user,
        "profile_generated", "profile", employee.id,
        None, {"version_seq": snapshot.version_seq, "self": True},
    )
    db.commit()
    db.refresh(snapshot)
    return snapshot


@router.get("/profiles/{employee_id}/latest", response_model=ProfileOut)
def latest_endpoint(
    employee_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    _require_view(db, principal, employee_id)
    snapshot = latest_profile(db, employee_id)
    if snapshot is None:
        raise err(404, "profile_not_found", "该员工暂无画像")
    return snapshot


@router.get("/profiles/{employee_id}/versions",
            response_model=list[ProfileVersionItem])
def versions_endpoint(
    employee_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    _require_view(db, principal, employee_id)
    return profile_versions(db, employee_id)


@router.get("/profiles/{employee_id}/versions/{version_seq}",
            response_model=ProfileOut)
def version_detail_endpoint(
    employee_id: uuid.UUID,
    version_seq: int,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    _require_view(db, principal, employee_id)
    snapshot = get_version(db, employee_id, version_seq)
    if snapshot is None:
        raise err(404, "profile_not_found", "该版本画像不存在")
    return snapshot


@router.put("/employees/{employee_id}/basic", response_model=BasicOut)
def update_basic_endpoint(
    employee_id: uuid.UUID,
    body: BasicIn,
    db: Session = Depends(get_db),
    user: User = Depends(_basic_edit),
):
    if body.education not in EDUCATION_OPTIONS or body.education == "不限":
        raise err(
            422, "invalid_education",
            f"学历取值不合法，可选：{[o for o in EDUCATION_OPTIONS if o != '不限']}",
        )
    employee = db.get(Employee, employee_id)
    if employee is None or employee.tenant_id != user.tenant_id:
        raise err(404, "employee_not_found", "员工不存在")

    update_basic(
        db, employee, user,
        education=body.education, certificates=body.certificates,
    )
    db.commit()
    return BasicOut(education=employee.education,
                    certificates=list(employee.certificates))
