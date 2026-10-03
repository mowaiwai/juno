import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.core.deps import err, get_current_user, require_roles
from app.database import get_db
from app.models.application import (
    Application,
    ApplicationStatus,
    Evidence,
    ManagerReview,
    SelfAssessment,
    SelfLevel,
)
from app.models.employee import Employee
from app.models.standard import StandardSet, StandardStatus
from app.models.standard_snapshot import StandardSnapshot
from app.models.review import ReviewTask
from app.models.tenant_config import DEFAULT_TENANT_CONFIG, TenantConfig
from app.models.user import Role, User
from app.schemas.application import (
    ApplicationCreate,
    ApplicationDetailOut,
    ApplicationListItem,
    EvidenceOut,
    ManagerReviewOut,
    SelfAssessmentOut,
    SelfAssessmentUpdate,
    StandardItemBrief,
)
from app.services.audit import application_status_audit, audit
from app.services.notification import application_submitted

router = APIRouter(tags=["applications"])

_PERF_RANK = {"S": 4, "A": 3, "B": 2, "C": 1}
_MIME_EXT = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "application/pdf": "pdf",
}


def _tenant_config(db: Session, tenant_id) -> dict:
    row = db.get(TenantConfig, tenant_id)
    config = dict(DEFAULT_TENANT_CONFIG)
    if row and row.values:
        config.update(row.values)
    return config


def _current_employee(db: Session, user: User) -> Employee | None:
    return db.scalar(select(Employee).where(Employee.user_id == user.id))


def _check_eligibility(employee: Employee, config: dict) -> list[dict]:
    """硬门槛校验，返回未达标原因列表（空=通过）。"""
    reasons = []
    min_years = int(config["min_years_in_grade"])
    years = (date.today() - employee.grade_since).days / 365.25
    if years < min_years:
        reasons.append(
            {
                "rule": "min_years_in_grade",
                "required": min_years,
                "actual": round(years, 2),
            }
        )
    required_perf = str(config["min_perf_grade"])
    if _PERF_RANK.get(employee.perf_grade, 0) < _PERF_RANK[required_perf]:
        reasons.append(
            {
                "rule": "min_perf_grade",
                "required": required_perf,
                "actual": employee.perf_grade,
            }
        )
    return reasons


def _get_application(db: Session, application_id, tenant_id) -> Application:
    row = db.scalar(
        select(Application)
        .where(
            Application.id == application_id,
            Application.tenant_id == tenant_id,
        )
        .options(
            selectinload(Application.self_assessments),
            selectinload(Application.evidences),
            selectinload(Application.manager_review),
            selectinload(Application.decision),
        )
    )
    if row is None:
        raise err(404, "not_found", "申请单不存在")
    return row


def _standard_set_for(db: Session, tenant_id, sequence, grade) -> StandardSet:
    return db.scalar(
        select(StandardSet)
        .where(
            StandardSet.tenant_id == tenant_id,
            StandardSet.sequence == sequence,
            StandardSet.target_grade == grade,
            StandardSet.status == StandardStatus.PUBLISHED,
        )
        .options(selectinload(StandardSet.items))
    )


def _detail_out(application: Application, standard_set: StandardSet) -> ApplicationDetailOut:
    return ApplicationDetailOut(
        id=application.id,
        tenant_id=application.tenant_id,
        employee_id=application.employee_id,
        target_sequence=application.target_sequence,
        target_grade=application.target_grade,
        standard_set_id=application.standard_set_id,
        status=application.status.value,
        previous_application_id=application.previous_application_id,
        submitted_at=application.submitted_at,
        standard_items=[
            StandardItemBrief(
                code=i.code,
                name=i.name,
                description=i.description,
                requirement=i.requirement,
                weight=float(i.weight),
                sort_order=i.sort_order,
            )
            for i in standard_set.items
        ],
        self_assessments=[
            SelfAssessmentOut(
                standard_item_code=a.standard_item_code,
                self_level=a.self_level.value,
                self_comment=a.self_comment,
            )
            for a in application.self_assessments
        ],
        evidences=[
            EvidenceOut(
                id=e.id,
                standard_item_code=e.standard_item_code,
                file_name=e.file_name,
                mime_type=e.mime_type,
                size_bytes=e.size_bytes,
            )
            for e in application.evidences
        ],
        manager_review=(
            ManagerReviewOut(
                decision=application.manager_review.decision,
                reject_category=application.manager_review.reject_category,
                comment=application.manager_review.comment,
            )
            if application.manager_review
            else None
        ),
        final_decision=(
            application.decision.decision if application.decision else None
        ),
    )


def _require_owner_employee(
    db: Session, user: User, application: Application
) -> Employee:
    employee = _current_employee(db, user)
    if employee is None or employee.id != application.employee_id:
        # 非本人：统一 404，避免存在性泄露
        raise err(404, "not_found", "申请单不存在")
    return employee


# ---- 创建草稿 ----

@router.post(
    "/applications",
    response_model=ApplicationDetailOut,
    status_code=201,
)
def create_application(
    body: ApplicationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.EMPLOYEE)),
):
    employee = _current_employee(db, user)
    if employee is None:
        raise err(422, "no_employee_profile", "当前账号缺少员工档案")

    config = _tenant_config(db, user.tenant_id)
    reasons = _check_eligibility(employee, config)
    if reasons:
        raise err(422, "eligibility_failed", "不满足认证申请门槛", details=reasons)

    standard_set = _standard_set_for(
        db, user.tenant_id, body.target_sequence, body.target_grade
    )
    if standard_set is None:
        raise err(
            422,
            "standard_not_published",
            "该序列与职级尚无已发布的认证标准",
        )

    application = Application(
        tenant_id=user.tenant_id,
        employee_id=employee.id,
        target_sequence=body.target_sequence,
        target_grade=body.target_grade,
        standard_set_id=standard_set.id,
        status=ApplicationStatus.DRAFT,
    )
    db.add(application)
    db.commit()
    db.refresh(application)
    return _detail_out(application, standard_set)


# ---- 我的申请 / 详情 ----

@router.get("/applications/mine", response_model=list[ApplicationListItem])
def list_mine(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    employee = _current_employee(db, user)
    if employee is None:
        return []
    rows = db.scalars(
        select(Application)
        .where(Application.employee_id == employee.id)
        .order_by(Application.created_at.desc())
    ).all()
    return [
        ApplicationListItem(
            id=a.id,
            target_sequence=a.target_sequence,
            target_grade=a.target_grade,
            status=a.status.value,
            submitted_at=a.submitted_at,
            decided_at=a.decided_at,
            published_at=a.published_at,
        )
        for a in rows
    ]


@router.get("/applications/{application_id}", response_model=ApplicationDetailOut)
def get_application(
    application_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    application = _get_application(db, application_id, user.tenant_id)
    standard_set = db.scalar(
        select(StandardSet)
        .where(StandardSet.id == application.standard_set_id)
        .options(selectinload(StandardSet.items))
    )

    # 可见范围：本人、该单初审经理、被派单的评审成员、HR
    employee = _current_employee(db, user)
    is_owner = employee is not None and employee.id == application.employee_id
    is_manager = (
        employee is not None and employee.id == application.manager_id
    )
    is_panel_member = employee is not None and bool(
        db.scalar(
            select(ReviewTask.id).where(
                ReviewTask.application_id == application.id,
                ReviewTask.assignee_id == employee.id,
            )
        )
    )
    if not any([is_owner, is_manager, is_panel_member]) and not user.has_any(Role.HR):
        raise err(404, "not_found", "申请单不存在")
    return _detail_out(application, standard_set)


# ---- 履职表自评 ----

@router.put(
    "/applications/{application_id}/self-assessment",
    response_model=ApplicationDetailOut,
)
def update_self_assessment(
    application_id: uuid.UUID,
    body: SelfAssessmentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    application = _get_application(db, application_id, user.tenant_id)
    _require_owner_employee(db, user, application)
    if application.status != ApplicationStatus.DRAFT:
        raise err(409, "not_draft", "仅草稿状态可编辑履职表")

    standard_set = db.scalar(
        select(StandardSet)
        .where(StandardSet.id == application.standard_set_id)
        .options(selectinload(StandardSet.items))
    )
    valid_codes = {i.code for i in standard_set.items}
    incoming = {i.standard_item_code for i in body.items}
    if not incoming <= valid_codes:
        raise err(
            422,
            "unknown_standard_item",
            "自评包含不属于该标准集的标准项",
            details=sorted(incoming - valid_codes),
        )

    existing = {
        a.standard_item_code: a for a in application.self_assessments
    }
    for item in body.items:
        if item.standard_item_code in existing:
            row = existing[item.standard_item_code]
            row.self_level = SelfLevel(item.self_level)
            row.self_comment = item.self_comment
        else:
            db.add(
                SelfAssessment(
                    application_id=application.id,
                    standard_item_code=item.standard_item_code,
                    self_level=SelfLevel(item.self_level),
                    self_comment=item.self_comment,
                )
            )
    db.commit()
    db.refresh(application)
    return _detail_out(application, standard_set)


# ---- 举证 ----

@router.post(
    "/applications/{application_id}/evidences",
    response_model=EvidenceOut,
    status_code=201,
)
async def upload_evidence(
    application_id: uuid.UUID,
    standard_item_code: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    application = _get_application(db, application_id, user.tenant_id)
    _require_owner_employee(db, user, application)
    if application.status != ApplicationStatus.DRAFT:
        raise err(409, "not_draft", "仅草稿状态可上传举证材料")

    standard_set = db.scalar(
        select(StandardSet)
        .where(StandardSet.id == application.standard_set_id)
        .options(selectinload(StandardSet.items))
    )
    if standard_item_code not in {i.code for i in standard_set.items}:
        raise err(422, "unknown_standard_item", "举证挂接的标准项不存在")

    if file.content_type not in _MIME_EXT:
        raise err(
            422,
            "invalid_file_type",
            "仅支持 JPG、PNG 图片与 PDF 文件",
        )

    content = await file.read()
    if len(content) > settings.evidence_max_size:
        raise err(
            422,
            "file_too_large",
            f"单文件不得超过 {settings.evidence_max_size // (1024 * 1024)}MB",
        )

    count = sum(
        1 for e in application.evidences if e.standard_item_code == standard_item_code
    )
    if count >= settings.evidence_max_per_item:
        raise err(
            422,
            "evidence_limit_exceeded",
            f"单个标准项最多上传 {settings.evidence_max_per_item} 个附件",
        )

    ext = _MIME_EXT[file.content_type]
    file_id = uuid.uuid4()
    relative_path = (
        Path("evidences")
        / str(user.tenant_id)
        / str(application.id)
        / f"{file_id}.{ext}"
    )
    absolute = Path(settings.storage_dir) / relative_path
    absolute.parent.mkdir(parents=True, exist_ok=True)
    absolute.write_bytes(content)

    evidence = Evidence(
        id=file_id,
        application_id=application.id,
        standard_item_code=standard_item_code,
        file_name=file.filename or f"file.{ext}",
        mime_type=file.content_type,
        size_bytes=len(content),
        storage_path=str(relative_path),
        uploaded_by=user.id,
    )
    db.add(evidence)
    db.flush()

    audit(
        db, user.tenant_id, application.employee_id,
        "evidence.upload", "application", application.id,
        None, {"evidence_id": str(evidence.id),
               "file_name": evidence.file_name,
               "standard_item_code": standard_item_code},
    )
    db.commit()
    return EvidenceOut(
        id=evidence.id,
        standard_item_code=evidence.standard_item_code,
        file_name=evidence.file_name,
        mime_type=evidence.mime_type,
        size_bytes=evidence.size_bytes,
    )


@router.delete("/evidences/{evidence_id}", status_code=204)
def delete_evidence(
    evidence_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    evidence = db.scalar(
        select(Evidence)
        .join(Application, Application.id == Evidence.application_id)
        .where(Evidence.id == evidence_id, Application.tenant_id == user.tenant_id)
    )
    if evidence is None:
        raise err(404, "not_found", "举证材料不存在")

    application = db.get(Application, evidence.application_id)
    _require_owner_employee(db, user, application)
    if application.status != ApplicationStatus.DRAFT:
        raise err(409, "not_draft", "仅草稿状态可删除举证材料")

    # 先删文件（缺失也不阻塞）
    absolute = Path(settings.storage_dir) / evidence.storage_path
    absolute.unlink(missing_ok=True)

    db.delete(evidence)
    db.commit()


# ---- 提交 ----

@router.post("/applications/{application_id}/submit", response_model=ApplicationListItem)
def submit_application(
    application_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    application = _get_application(db, application_id, user.tenant_id)
    _require_owner_employee(db, user, application)
    if application.status != ApplicationStatus.DRAFT:
        raise err(409, "not_draft", "仅草稿状态可提交")

    standard_set = db.scalar(
        select(StandardSet)
        .where(StandardSet.id == application.standard_set_id)
        .options(selectinload(StandardSet.items))
    )
    if standard_set.status != StandardStatus.PUBLISHED:
        raise err(
            409,
            "standard_superseded",
            "标准集已有新版本，请基于最新标准重新发起申请",
        )

    assessed = {a.standard_item_code for a in application.self_assessments}
    required = {i.code for i in standard_set.items}
    if not required <= assessed:
        raise err(
            422,
            "assessment_incomplete",
            "尚有标准项未完成自评",
            details=sorted(required - assessed),
        )

    # 30 天窗口内同目标职级提交次数限制（自己是 draft 无 submitted_at，自然不计）
    config = _tenant_config(db, user.tenant_id)
    window_days = int(config["resubmit_window_days"])
    max_count = int(config["resubmit_max_count"])
    window_start = datetime.now(timezone.utc) - timedelta(days=window_days)
    recent_count = db.scalar(
        select(func.count(Application.id)).where(
            Application.tenant_id == user.tenant_id,
            Application.employee_id == application.employee_id,
            Application.target_grade == application.target_grade,
            Application.submitted_at.is_not(None),
            Application.submitted_at >= window_start,
        )
    )
    if recent_count >= max_count:
        raise err(
            422,
            "resubmit_limit_exceeded",
            f"{window_days} 天内对同一目标职级最多提交 {max_count} 次",
        )

    # 整版标准快照
    payload = {
        "set": {
            "id": str(standard_set.id),
            "sequence": standard_set.sequence,
            "target_grade": standard_set.target_grade,
            "version": standard_set.version,
            "status": standard_set.status.value,
        },
        "items": [
            {
                "code": i.code,
                "name": i.name,
                "description": i.description,
                "requirement": i.requirement,
                "weight": float(i.weight),
                "sort_order": i.sort_order,
            }
            for i in standard_set.items
        ],
    }
    db.add(
        StandardSnapshot(
            application_id=application.id,
            standard_set_id=standard_set.id,
            payload=payload,
        )
    )

    employee = db.get(Employee, application.employee_id)
    now = datetime.now(timezone.utc)
    application.status = ApplicationStatus.SUBMITTED
    application.submitted_at = now
    application.manager_id = employee.manager_id
    application.submit_count = recent_count + 1
    deadline_days = int(config["manager_review_deadline_days"])
    application.manager_deadline_at = now + timedelta(days=deadline_days)
    db.flush()

    # 通知直属经理有新申请；审计提交动作
    application_submitted(db, application)
    application_status_audit(
        db, application, application.employee_id,
        "application.submit", "draft", "submitted",
    )
    db.commit()

    return ApplicationListItem(
        id=application.id,
        target_sequence=application.target_sequence,
        target_grade=application.target_grade,
        status=application.status.value,
        submitted_at=application.submitted_at,
    )


# ---- 撤回 ----

@router.post("/applications/{application_id}/withdraw", response_model=ApplicationListItem)
def withdraw_application(
    application_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    application = _get_application(db, application_id, user.tenant_id)
    _require_owner_employee(db, user, application)
    if application.status != ApplicationStatus.SUBMITTED:
        raise err(409, "not_submitted", "仅已提交、初审开始前可撤回")

    application.status = ApplicationStatus.DRAFT
    # 清空提交痕迹：撤回单不计入 30 天提交窗口，重新提交时重算经理与截止
    application.submitted_at = None
    application.manager_id = None
    application.manager_deadline_at = None
    db.flush()

    application_status_audit(
        db, application, application.employee_id,
        "application.withdraw", "submitted", "draft",
    )
    db.commit()
    return ApplicationListItem(
        id=application.id,
        target_sequence=application.target_sequence,
        target_grade=application.target_grade,
        status=application.status.value,
        submitted_at=application.submitted_at,
    )


# ---- 驳回后重新提交 ----

@router.post(
    "/applications/{application_id}/resubmit",
    response_model=ApplicationDetailOut,
    status_code=201,
)
def resubmit_application(
    application_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    application = _get_application(db, application_id, user.tenant_id)
    _require_owner_employee(db, user, application)
    if application.status != ApplicationStatus.REJECTED:
        raise err(409, "not_rejected", "仅已驳回的申请可重新提交")

    # 新单关联当前最新发布版；标准已下架则要求重新发起
    latest_set = _standard_set_for(
        db, user.tenant_id, application.target_sequence, application.target_grade
    )
    if latest_set is None:
        raise err(
            422,
            "standard_not_published",
            "该序列与职级当前无可用标准，请改投其他认证",
        )
    valid_codes = {i.code for i in latest_set.items}

    new_application = Application(
        tenant_id=user.tenant_id,
        employee_id=application.employee_id,
        target_sequence=application.target_sequence,
        target_grade=application.target_grade,
        standard_set_id=latest_set.id,
        status=ApplicationStatus.DRAFT,
        previous_application_id=application.id,
    )
    db.add(new_application)
    db.flush()

    # 复制自评：仅新标准中仍存在的标准项
    for old_assessment in application.self_assessments:
        if old_assessment.standard_item_code not in valid_codes:
            continue
        db.add(
            SelfAssessment(
                application_id=new_application.id,
                standard_item_code=old_assessment.standard_item_code,
                self_level=old_assessment.self_level,
                self_comment=old_assessment.self_comment,
            )
        )

    # 复制举证：物理文件复制到新单目录，DB 记录独立（新单删附件不影响归档原单）
    for old_evidence in application.evidences:
        if old_evidence.standard_item_code not in valid_codes:
            continue
        source = Path(settings.storage_dir) / old_evidence.storage_path
        new_file_id = uuid.uuid4()
        ext = source.suffix.lstrip(".")
        relative = (
            Path("evidences")
            / str(user.tenant_id)
            / str(new_application.id)
            / f"{new_file_id}.{ext}"
        )
        target = Path(settings.storage_dir) / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        if source.exists():
            target.write_bytes(source.read_bytes())
        db.add(
            Evidence(
                id=new_file_id,
                application_id=new_application.id,
                standard_item_code=old_evidence.standard_item_code,
                file_name=old_evidence.file_name,
                mime_type=old_evidence.mime_type,
                size_bytes=old_evidence.size_bytes,
                storage_path=str(relative),
                uploaded_by=user.id,
            )
        )

    db.commit()
    loaded = _get_application(db, new_application.id, user.tenant_id)
    return _detail_out(loaded, latest_set)
