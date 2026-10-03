"""层级框架 L1：数据模型与 v1 平台种子。"""

import pytest
from sqlalchemy import func, select

from app.framework_content import (
    DEFAULT_GRADE_LEVELS,
    FRAMEWORK_V1,
)
from app.models.level_framework import (
    BaseConditionTemplate,
    BehaviorAnchor,
    BonusItemCatalog,
    FrameworkStatus,
    LevelDefinition,
    LevelFrameworkVersion,
)
from app.services.level_framework import seed_v1_framework


def _latest_published(db) -> LevelFrameworkVersion:
    row = db.scalar(
        select(LevelFrameworkVersion)
        .where(LevelFrameworkVersion.status == FrameworkStatus.PUBLISHED)
        .order_by(LevelFrameworkVersion.version.desc())
    )
    assert row is not None
    return row


def test_seed_creates_v1_published(db_session):
    seed_v1_framework(db_session)
    v = _latest_published(db_session)
    assert v.version == 1
    assert v.status == FrameworkStatus.PUBLISHED
    assert v.published_at is not None


def test_seed_six_levels_match_spec(db_session):
    seed_v1_framework(db_session)
    v = _latest_published(db_session)
    levels = db_session.scalars(
        select(LevelDefinition)
        .where(LevelDefinition.framework_version_id == v.id)
        .order_by(LevelDefinition.level_order)
    ).all()

    assert [lv.level_order for lv in levels] == [1, 2, 3, 4, 5, 6]
    assert [lv.code for lv in levels] == [x["code"] for x in FRAMEWORK_V1["levels"]]
    assert [lv.name for lv in levels] == [x["name"] for x in FRAMEWORK_V1["levels"]]

    # 抽验 spec 第 2 节正式文案
    assert levels[0].role_definition.startswith("初阶工作者")
    assert levels[2].role_definition.startswith("业务骨干")
    assert levels[3].key_behaviors == ["创新", "引领", "建立长效机制"]
    assert levels[5].influence_scope.startswith("对行业发展有贡献")
    assert levels[0].target_anchor == "L1"
    assert levels[1].target_anchor == "L2"
    assert levels[2].target_anchor == "L3"
    assert levels[5].target_anchor == "L3"


def test_seed_anchors_l1_l3(db_session):
    seed_v1_framework(db_session)
    v = _latest_published(db_session)
    anchors = db_session.scalars(
        select(BehaviorAnchor)
        .where(BehaviorAnchor.framework_version_id == v.id)
        .order_by(BehaviorAnchor.code)
    ).all()

    assert [(a.code, a.name) for a in anchors] == [
        ("L1", "参与执行"),
        ("L2", "独立推进"),
        ("L3", "主导引领"),
    ]
    assert "在指导下理解并执行既定规范与流程" in anchors[0].description
    assert "独立承担工作任务" in anchors[1].description
    assert "产出可复用的方法或标准" in anchors[2].description


def test_seed_condition_templates(db_session):
    seed_v1_framework(db_session)
    v = _latest_published(db_session)
    rows = db_session.scalars(
        select(BaseConditionTemplate)
        .where(BaseConditionTemplate.framework_version_id == v.id)
        .order_by(BaseConditionTemplate.level_order)
    ).all()

    assert len(rows) == 6
    expected = FRAMEWORK_V1["conditions"]
    for row, exp in zip(rows, expected):
        assert row.level_order == exp["level_order"]
        assert row.education_min == exp["education_min"]
        assert row.min_work_years == exp["min_work_years"]
        assert row.min_company_years == exp["min_company_years"]
        assert row.certificates == exp["certificates"]


def test_seed_bonus_catalog(db_session):
    seed_v1_framework(db_session)
    v = _latest_published(db_session)
    rows = db_session.scalars(
        select(BonusItemCatalog)
        .where(BonusItemCatalog.framework_version_id == v.id)
        .order_by(BonusItemCatalog.sort_order)
    ).all()

    assert len(rows) == len(FRAMEWORK_V1["bonus_items"])
    for row, exp in zip(rows, FRAMEWORK_V1["bonus_items"]):
        assert row.code == exp["code"]
        assert row.name == exp["name"]
        assert row.measure_unit == exp["measure_unit"]


def test_default_grade_mapping_table(db_session):
    assert DEFAULT_GRADE_LEVELS["P2"] == 1
    assert DEFAULT_GRADE_LEVELS["T2"] == 1
    assert DEFAULT_GRADE_LEVELS["P3"] == 3 - 1
    assert DEFAULT_GRADE_LEVELS["S3"] == 2
    assert DEFAULT_GRADE_LEVELS["O3"] == 2
    assert DEFAULT_GRADE_LEVELS["P4"] == 3
    assert DEFAULT_GRADE_LEVELS["T4"] == 3
    assert DEFAULT_GRADE_LEVELS["M2"] == 3
    assert DEFAULT_GRADE_LEVELS["M3"] == 4
    assert DEFAULT_GRADE_LEVELS["M4"] == 5
    assert DEFAULT_GRADE_LEVELS["M5"] == 6
    assert "P5" not in DEFAULT_GRADE_LEVELS


def test_seed_idempotent(db_session):
    seed_v1_framework(db_session)
    seed_v1_framework(db_session)

    assert db_session.scalar(
        select(func.count()).select_from(LevelFrameworkVersion)
    ) == 1
    v = _latest_published(db_session)
    assert db_session.scalar(
        select(func.count())
        .select_from(LevelDefinition)
        .where(LevelDefinition.framework_version_id == v.id)
    ) == 6
