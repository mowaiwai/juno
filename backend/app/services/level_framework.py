"""层级框架领域服务：版本装配、种子、校验与发布。"""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import err
from app.framework_content import DEFAULT_GRADE_LEVELS, FRAMEWORK_V1
from app.models.employee import Employee
from app.models.level_framework import (
    BaseConditionTemplate,
    BehaviorAnchor,
    BonusItemCatalog,
    FrameworkStatus,
    LevelDefinition,
    LevelFrameworkVersion,
    TenantLevelMapping,
)
from app.schemas.level_framework import FrameworkDraftIn
from app.services.audit import audit


def _now() -> datetime:
    return datetime.now(timezone.utc)


def get_published(db: Session, version: int | None = None):
    """读已发布版本：默认最新；指定版本号时精确读。"""
    stmt = select(LevelFrameworkVersion).where(
        LevelFrameworkVersion.status == FrameworkStatus.PUBLISHED
    )
    if version is not None:
        return db.scalar(stmt.where(LevelFrameworkVersion.version == version))
    return db.scalar(stmt.order_by(LevelFrameworkVersion.version.desc()))


def get_draft(db: Session):
    return db.scalar(
        select(LevelFrameworkVersion)
        .where(LevelFrameworkVersion.status == FrameworkStatus.DRAFT)
        .order_by(LevelFrameworkVersion.version.desc())
    )


def build_version(content: dict, *, version: int, status: FrameworkStatus,
                  published_at: datetime | None = None) -> LevelFrameworkVersion:
    """由内容资产构造框架版本聚合（含全部子行）。"""
    fw = LevelFrameworkVersion(
        version=version, status=status, published_at=published_at
    )
    fw.levels = [LevelDefinition(**lv) for lv in content["levels"]]
    fw.anchors = [BehaviorAnchor(**a) for a in content["anchors"]]
    fw.conditions = [BaseConditionTemplate(**c) for c in content["conditions"]]
    fw.bonus_items = [BonusItemCatalog(**b) for b in content["bonus_items"]]
    return fw


def seed_v1_framework(db: Session) -> LevelFrameworkVersion | None:
    """幂等写入首个已发布框架 v1；已存在则不操作。"""
    existing = db.scalar(
        select(LevelFrameworkVersion).where(LevelFrameworkVersion.version == 1)
    )
    if existing is not None:
        return None
    fw = build_version(
        FRAMEWORK_V1,
        version=1,
        status=FrameworkStatus.PUBLISHED,
        published_at=_now(),
    )
    db.add(fw)
    db.flush()
    return fw


def tenant_overrides(
    db: Session, tenant_id, framework_id
) -> dict[str, int]:
    """租户在指定框架版本上的映射差异：grade → level_order。"""
    rows = db.scalars(
        select(TenantLevelMapping).where(
            TenantLevelMapping.tenant_id == tenant_id,
            TenantLevelMapping.framework_version_id == framework_id,
        )
    ).all()
    return {r.grade_code: r.level_order for r in rows}


def resolve_for_tenant(db: Session, tenant_id, grade: str):
    """职级解析：先租户覆盖，再平台默认；未映射返回 None。

    返回 (framework, level_definition, source)。
    """
    fw = get_published(db)
    if fw is None:
        return None
    overrides = tenant_overrides(db, tenant_id, fw.id)
    if grade in overrides:
        order, source = overrides[grade], "override"
    elif grade in DEFAULT_GRADE_LEVELS:
        order, source = DEFAULT_GRADE_LEVELS[grade], "default"
    else:
        return None

    level = next((lv for lv in fw.levels if lv.level_order == order), None)
    if level is None:
        return None
    return fw, level, source


# ---------------------------------------------------------------------------
# 租户映射
# ---------------------------------------------------------------------------

def natural_rank(grade: str) -> float:
    """职级在平台层级序上的自然高度（spec：P2<P3<P4… M2<M3<M4<M5）。

    默认表内职级取整数层序；表外职级按同族已知职级线性插值/外推。
    """
    if grade in DEFAULT_GRADE_LEVELS:
        return float(DEFAULT_GRADE_LEVELS[grade])

    letter, num = grade[0], int(grade[1:])
    known = sorted(
        (int(g[1:]), float(lv))
        for g, lv in DEFAULT_GRADE_LEVELS.items()
        if g[0] == letter
    )
    if not known:
        return ord(letter) + num / 10

    lower = [k for k in known if k[0] <= num]
    upper = [k for k in known if k[0] >= num]
    if lower and upper and lower[-1][0] != num:
        n0, v0 = lower[-1]
        n1, v1 = upper[0]
        return v0 + (v1 - v0) * (num - n0) / (n1 - n0)
    if lower:
        n0, v0 = lower[-1]
        n1, v1 = lower[-2] if len(lower) > 1 else (n0 - 1, v0 - 1)
        slope = (v0 - v1) / (n0 - n1)
        return v0 + slope * (num - n0)
    n0, v0 = upper[0]
    n1, v1 = upper[1] if len(upper) > 1 else (n0 + 1, v0 + 1)
    slope = (v1 - v0) / (n1 - n0)
    return v0 - slope * (n0 - num)


def required_grades(db: Session, tenant_id) -> set[str]:
    """覆盖范围：员工档案出现的职级 ∪ 平台默认表职级。"""
    emp_grades = db.scalars(
        select(Employee.grade)
        .where(Employee.tenant_id == tenant_id)
        .distinct()
    ).all()
    return set(DEFAULT_GRADE_LEVELS) | set(emp_grades)


def merged_mapping_view(db: Session, tenant_id):
    """合并视图：默认 + 覆盖（覆盖只认当前已发布版本上的差异行）。"""
    fw = get_published(db)
    if fw is None:
        raise err(404, "framework_not_published", "暂无已发布的层级框架")

    overrides = tenant_overrides(db, tenant_id, fw.id)
    grades = set(DEFAULT_GRADE_LEVELS) | set(overrides) | required_grades(
        db, tenant_id
    )
    level_names = {lv.level_order: lv.name for lv in fw.levels}

    items = []
    for g in grades:
        if g in overrides:
            order, source = overrides[g], "override"
        else:
            order, source = DEFAULT_GRADE_LEVELS[g], "default"
        items.append(
            {
                "grade_code": g,
                "level_order": order,
                "level_name": level_names[order],
                "source": source,
            }
        )
    items.sort(key=lambda x: (natural_rank(x["grade_code"]), x["grade_code"]))
    return fw, items


def apply_tenant_mapping(
    db: Session,
    tenant_id,
    actor,
    framework_version_id,
    items_in,
):
    """整表提交租户映射：版本/全覆盖/单调校验 → diff 落库 → 审计。"""
    fw = db.get(LevelFrameworkVersion, framework_version_id)
    if fw is None:
        raise err(
            404,
            "framework_version_not_found",
            "绑定的框架版本不存在",
        )
    if fw.status != FrameworkStatus.PUBLISHED:
        raise err(
            409,
            "framework_version_stale",
            "绑定的框架版本不是已发布版本",
        )
    current = get_published(db)
    if current is None or current.id != fw.id:
        raise err(
            409,
            "framework_version_stale",
            "框架已有更新版本，请基于最新版本重新配置",
        )

    if len({i.grade_code for i in items_in}) != len(items_in):
        raise err(422, "duplicate_grade_code", "提交列表中职级代码重复")

    submitted = {i.grade_code: i.level_order for i in items_in}
    bad = sorted(
        g for g, lv in submitted.items() if not 1 <= lv <= 6
    )
    if bad:
        raise err(
            422,
            "invalid_level_order",
            "层级序必须在 1–6 之间",
            details=bad,
        )

    missing = sorted(required_grades(db, tenant_id) - set(submitted))
    if missing:
        raise err(
            422,
            "mapping_incomplete",
            "本租户在用职级必须全部映射",
            details=missing,
        )

    # 严格单调：自然秩低的职级，映射层级不得高于秩更高的职级。
    # 同秩职级之间无约束；跨秩比较：前一秩组 max ≤ 当前秩组 min。
    grouped: dict[float, list[str]] = {}
    for g in submitted:
        grouped.setdefault(natural_rank(g), []).append(g)
    ranks = sorted(grouped)
    prev_max: int | None = None
    prev_rank: float | None = None
    prev_grade: str | None = None
    for rank in ranks:
        levels = [submitted[g] for g in grouped[rank]]
        group_min, group_max = min(levels), max(levels)
        if prev_max is not None and prev_max > group_min:
            raise err(
                422,
                "mapping_not_monotonic",
                "映射层级不得倒挂（高职级不能归入更低层级）",
                details={
                    "lower_rank": prev_rank,
                    "lower_grade": prev_grade,
                    "grade": next(
                        g for g in grouped[rank]
                        if submitted[g] == group_min
                    ),
                },
            )
        prev_max = group_max
        prev_rank = rank
        prev_grade = grouped[rank][0]

    old_rows = db.scalars(
        select(TenantLevelMapping).where(
            TenantLevelMapping.tenant_id == tenant_id,
            TenantLevelMapping.framework_version_id == fw.id,
        )
    ).all()
    before = {
        "items": [
            {"grade_code": r.grade_code, "level_order": r.level_order}
            for r in old_rows
        ]
    }
    for r in old_rows:
        db.delete(r)
    db.flush()

    after_rows = []
    for g, lv in submitted.items():
        if DEFAULT_GRADE_LEVELS.get(g) != lv:
            db.add(
                TenantLevelMapping(
                    tenant_id=tenant_id,
                    framework_version_id=fw.id,
                    grade_code=g,
                    level_order=lv,
                )
            )
            after_rows.append({"grade_code": g, "level_order": lv})

    actor_employee_id = db.scalar(
        select(Employee.id).where(Employee.user_id == actor.id)
    )
    audit(
        db,
        tenant_id,
        actor_employee_id,
        "tenant_level_mapping_update",
        "tenant_level_mapping",
        tenant_id,
        before,
        {"items": after_rows},
    )
    db.flush()


# ---------------------------------------------------------------------------
# 平台草稿管理
# ---------------------------------------------------------------------------

def create_draft(db: Session) -> LevelFrameworkVersion:
    """基于最新已发布版深拷贝创建草稿。"""
    if get_draft(db) is not None:
        raise err(409, "draft_exists", "当前已有草稿，请在其基础上继续编辑")
    source = get_published(db)
    if source is None:
        raise err(404, "framework_not_published", "暂无已发布框架可复制")

    draft = LevelFrameworkVersion(
        version=source.version + 1,
        status=FrameworkStatus.DRAFT,
    )
    db.add(draft)
    db.flush()

    for lv in source.levels:
        db.add(
            LevelDefinition(
                framework_version_id=draft.id,
                level_order=lv.level_order,
                code=lv.code,
                name=lv.name,
                role_definition=lv.role_definition,
                performance_level=lv.performance_level,
                key_behaviors=list(lv.key_behaviors),
                influence_scope=lv.influence_scope,
                target_anchor=lv.target_anchor,
            )
        )
    for a in source.anchors:
        db.add(
            BehaviorAnchor(
                framework_version_id=draft.id,
                code=a.code,
                name=a.name,
                description=a.description,
            )
        )
    for c in source.conditions:
        db.add(
            BaseConditionTemplate(
                framework_version_id=draft.id,
                level_order=c.level_order,
                education_min=c.education_min,
                min_work_years=c.min_work_years,
                min_company_years=c.min_company_years,
                certificates=list(c.certificates),
            )
        )
    for b in source.bonus_items:
        db.add(
            BonusItemCatalog(
                framework_version_id=draft.id,
                code=b.code,
                name=b.name,
                measure_unit=b.measure_unit,
                sort_order=b.sort_order,
            )
        )
    db.flush()
    return draft


def update_draft(db: Session, payload: FrameworkDraftIn):
    """整单替换草稿内容（六层定义/锚点/条件模板/加项目录）。"""
    draft = get_draft(db)
    if draft is None:
        raise err(404, "draft_not_found", "当前没有草稿")

    # 先删旧子行并 flush（避免唯一约束上 INSERT 与 DELETE 的排序冲突），
    # 再挂载新子行
    for collection in (
        draft.levels,
        draft.anchors,
        draft.conditions,
        draft.bonus_items,
    ):
        for child in list(collection):
            db.delete(child)
    db.flush()

    draft.levels = [LevelDefinition(**lv.model_dump()) for lv in payload.levels]
    draft.anchors = [BehaviorAnchor(**a.model_dump()) for a in payload.anchors]
    draft.conditions = [
        BaseConditionTemplate(**c.model_dump()) for c in payload.conditions
    ]
    draft.bonus_items = [
        BonusItemCatalog(**b.model_dump()) for b in payload.bonus_items
    ]
    db.flush()
    return draft


def validate_framework(fw: LevelFrameworkVersion) -> list[str]:
    """发布前校验：六层齐全 / 文案非空 / target_anchor 合法 / L1–L3 齐全。"""
    errors: list[str] = []

    orders = [lv.level_order for lv in fw.levels]
    if sorted(orders) != [1, 2, 3, 4, 5, 6]:
        errors.append("六层必须齐全且 level_order 为 1–6 且不重复")

    for lv in fw.levels:
        text_fields = {
            "code": lv.code,
            "name": lv.name,
            "role_definition": lv.role_definition,
            "performance_level": lv.performance_level,
            "influence_scope": lv.influence_scope,
        }
        for label, value in text_fields.items():
            if not value or not value.strip():
                errors.append(f"第 {lv.level_order} 层 {label} 不能为空")
        if lv.target_anchor not in ("L1", "L2", "L3"):
            errors.append(f"第 {lv.level_order} 层 target_anchor 非法")
        if not lv.key_behaviors or any(
            not str(w).strip() for w in lv.key_behaviors
        ):
            errors.append(f"第 {lv.level_order} 层关键行为词不能为空")

    anchor_codes = {a.code for a in fw.anchors}
    if anchor_codes != {"L1", "L2", "L3"}:
        errors.append("L1–L3 行为锚点必须齐全")
    for a in fw.anchors:
        if not a.name.strip() or not a.description.strip():
            errors.append(f"锚点 {a.code} 文案不能为空")

    condition_orders = {c.level_order for c in fw.conditions}
    if condition_orders != {1, 2, 3, 4, 5, 6}:
        errors.append("基础条件模板必须每层一条")

    return errors


def publish_draft(db: Session) -> LevelFrameworkVersion:
    """发布草稿：旧已发布版转归档，草稿转已发布。"""
    draft = get_draft(db)
    if draft is None:
        raise err(404, "draft_not_found", "当前没有草稿")

    errors = validate_framework(draft)
    if errors:
        raise err(
            422,
            "invalid_framework",
            "框架内容不满足发布条件",
            details=errors,
        )

    old = get_published(db)
    if old is not None:
        old.status = FrameworkStatus.ARCHIVED

    draft.status = FrameworkStatus.PUBLISHED
    draft.published_at = _now()
    db.flush()
    return draft
