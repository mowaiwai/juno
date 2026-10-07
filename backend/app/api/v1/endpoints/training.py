"""人才发展模块端点：培训管理 / 经验萃取库 / 学习地图。"""
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import Principal, err, require_perm, require_perm_user
from app.database import get_db
from app.models.training import (
    KnowledgeItem,
    KnowledgeStatus,
    LearningPath,
    TrainingCourse,
    TrainingInstructor,
)
from app.models.user import User
from app.schemas.training import (
    CourseCreate,
    CourseOut,
    CourseUpdate,
    InstructorCreate,
    InstructorOut,
    InstructorUpdate,
    KnowledgeCreate,
    KnowledgeOut,
    KnowledgeUpdate,
    LearningPathCreate,
    LearningPathOut,
    LearningPathUpdate,
)
from app.services.audit import audit

router = APIRouter(prefix="/training", tags=["training"])

_manage = require_perm_user("training.manage")
# 查看：OTD / 教练（IDP 辅导）/ 差距分析均可
_view = require_perm("training.manage", "idp.coach", "gap.manage")


ONBOARDING_PATH = [
    {"stage": "第 1–7 天 · 入职引导", "items": ["企业文化与制度", "安全与保密", "导师配对"]},
    {"stage": "第 8–30 天 · 基础培训", "items": ["岗位基础课", "质量意识", "工具权限开通"]},
    {"stage": "第 31–90 天 · 带教实操", "items": ["跟岗任务", "首个独立任务", "30 天面谈"]},
    {"stage": "第 91–150 天 · 训练营", "items": ["序列训练营", "阶段考试", "90 天面谈"]},
    {"stage": "第 151–180 天 · 轮岗/定岗", "items": ["轮岗体验（可选）", "定岗评估", "转正答辩"]},
]


# ============================================================
# 课程
# ============================================================

@router.get("/courses", response_model=list[CourseOut])
def list_courses(
    type: str | None = Query(default=None),
    db: Session = Depends(get_db),
    principal: Principal = Depends(_view),
):
    q = select(TrainingCourse).where(TrainingCourse.tenant_id == principal.user.tenant_id)
    if type:
        q = q.where(TrainingCourse.type == type)
    rows = db.scalars(q.order_by(TrainingCourse.created_at.desc())).all()
    return [CourseOut.model_validate(r) for r in rows]


@router.post("/courses", response_model=CourseOut, status_code=201)
def create_course(
    body: CourseCreate,
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    course = TrainingCourse(tenant_id=user.tenant_id, created_by=user.id, **body.model_dump())
    db.add(course)
    db.commit()
    db.refresh(course)
    return CourseOut.model_validate(course)


def _get_owned_course(db: Session, course_id, tenant_id) -> TrainingCourse:
    row = db.scalar(
        select(TrainingCourse).where(
            TrainingCourse.id == course_id, TrainingCourse.tenant_id == tenant_id
        )
    )
    if row is None:
        raise err(404, "not_found", "课程不存在")
    return row


@router.put("/courses/{course_id}", response_model=CourseOut)
def update_course(
    course_id: uuid.UUID,
    body: CourseUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    course = _get_owned_course(db, course_id, user.tenant_id)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(course, key, value)
    db.commit()
    db.refresh(course)
    return CourseOut.model_validate(course)


@router.delete("/courses/{course_id}", status_code=204)
def delete_course(
    course_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    course = _get_owned_course(db, course_id, user.tenant_id)
    db.delete(course)
    db.commit()
    return None


# ============================================================
# 讲师
# ============================================================

@router.get("/instructors", response_model=list[InstructorOut])
def list_instructors(
    db: Session = Depends(get_db),
    principal: Principal = Depends(_view),
):
    rows = db.scalars(
        select(TrainingInstructor)
        .where(TrainingInstructor.tenant_id == principal.user.tenant_id)
        .order_by(TrainingInstructor.created_at)
    ).all()
    return [InstructorOut.model_validate(r) for r in rows]


@router.post("/instructors", response_model=InstructorOut, status_code=201)
def create_instructor(
    body: InstructorCreate,
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    inst = TrainingInstructor(tenant_id=user.tenant_id, **body.model_dump())
    db.add(inst)
    db.commit()
    db.refresh(inst)
    return InstructorOut.model_validate(inst)


def _get_owned_instructor(db: Session, inst_id, tenant_id) -> TrainingInstructor:
    row = db.scalar(
        select(TrainingInstructor).where(
            TrainingInstructor.id == inst_id, TrainingInstructor.tenant_id == tenant_id
        )
    )
    if row is None:
        raise err(404, "not_found", "讲师不存在")
    return row


@router.put("/instructors/{inst_id}", response_model=InstructorOut)
def update_instructor(
    inst_id: uuid.UUID,
    body: InstructorUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    inst = _get_owned_instructor(db, inst_id, user.tenant_id)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(inst, key, value)
    db.commit()
    db.refresh(inst)
    return InstructorOut.model_validate(inst)


@router.delete("/instructors/{inst_id}", status_code=204)
def delete_instructor(
    inst_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    inst = _get_owned_instructor(db, inst_id, user.tenant_id)
    db.delete(inst)
    db.commit()
    return None


@router.get("/onboarding")
def get_onboarding_path(_: Principal = Depends(_view)):
    """新员工 180 天融入路径（平台固定模板）。"""
    return ONBOARDING_PATH


# ============================================================
# 经验萃取库
# ============================================================

@router.get("/knowledge", response_model=list[KnowledgeOut])
def list_knowledge(
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    principal: Principal = Depends(_view),
):
    q = select(KnowledgeItem).where(KnowledgeItem.tenant_id == principal.user.tenant_id)
    if status:
        q = q.where(KnowledgeItem.status == status)
    rows = db.scalars(q.order_by(KnowledgeItem.created_at.desc())).all()
    return [KnowledgeOut.model_validate(r) for r in rows]


@router.post("/knowledge", response_model=KnowledgeOut, status_code=201)
def create_knowledge(
    body: KnowledgeCreate,
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    item = KnowledgeItem(tenant_id=user.tenant_id, created_by=user.id, **body.model_dump())
    db.add(item)
    audit(db, user.tenant_id, user.id, "knowledge_created", "knowledge_item", item.id)
    db.commit()
    db.refresh(item)
    return KnowledgeOut.model_validate(item)


def _get_owned_knowledge(db: Session, item_id, tenant_id) -> KnowledgeItem:
    row = db.scalar(
        select(KnowledgeItem).where(
            KnowledgeItem.id == item_id, KnowledgeItem.tenant_id == tenant_id
        )
    )
    if row is None:
        raise err(404, "not_found", "知识条目不存在")
    return row


@router.put("/knowledge/{item_id}", response_model=KnowledgeOut)
def update_knowledge(
    item_id: uuid.UUID,
    body: KnowledgeUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    item = _get_owned_knowledge(db, item_id, user.tenant_id)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return KnowledgeOut.model_validate(item)


@router.delete("/knowledge/{item_id}", status_code=204)
def delete_knowledge(
    item_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    item = _get_owned_knowledge(db, item_id, user.tenant_id)
    db.delete(item)
    db.commit()
    return None


@router.post("/knowledge/{item_id}/publish", response_model=KnowledgeOut)
def publish_knowledge(
    item_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    """发布知识条目（draft/extracting → published）。"""
    item = _get_owned_knowledge(db, item_id, user.tenant_id)
    before = {"status": item.status}
    item.status = KnowledgeStatus.PUBLISHED.value
    audit(db, user.tenant_id, user.id, "knowledge_published", "knowledge_item", item.id, before)
    db.commit()
    db.refresh(item)
    return KnowledgeOut.model_validate(item)


# ============================================================
# 学习地图
# ============================================================

@router.get("/learning-paths", response_model=list[LearningPathOut])
def list_learning_paths(
    position: str | None = Query(default=None),
    grade: str | None = Query(default=None),
    db: Session = Depends(get_db),
    principal: Principal = Depends(_view),
):
    q = select(LearningPath).where(LearningPath.tenant_id == principal.user.tenant_id)
    if position:
        q = q.where(LearningPath.position == position)
    if grade:
        q = q.where(LearningPath.grade == grade)
    rows = db.scalars(q.order_by(LearningPath.position, LearningPath.grade)).all()
    return [LearningPathOut.model_validate(r) for r in rows]


@router.post("/learning-paths", response_model=LearningPathOut, status_code=201)
def create_learning_path(
    body: LearningPathCreate,
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    lp = LearningPath(tenant_id=user.tenant_id, created_by=user.id, **body.model_dump())
    db.add(lp)
    db.commit()
    db.refresh(lp)
    return LearningPathOut.model_validate(lp)


def _get_owned_path(db: Session, path_id, tenant_id) -> LearningPath:
    row = db.scalar(
        select(LearningPath).where(
            LearningPath.id == path_id, LearningPath.tenant_id == tenant_id
        )
    )
    if row is None:
        raise err(404, "not_found", "学习地图条目不存在")
    return row


@router.put("/learning-paths/{path_id}", response_model=LearningPathOut)
def update_learning_path(
    path_id: uuid.UUID,
    body: LearningPathUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    lp = _get_owned_path(db, path_id, user.tenant_id)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(lp, key, value)
    db.commit()
    db.refresh(lp)
    return LearningPathOut.model_validate(lp)


@router.delete("/learning-paths/{path_id}", status_code=204)
def delete_learning_path(
    path_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(_manage),
):
    lp = _get_owned_path(db, path_id, user.tenant_id)
    db.delete(lp)
    db.commit()
    return None
