"""人才缺口预测：纯内核 + 配置读写 + 端点集成测试（spec structure-gap-forecast）。"""

import uuid
from datetime import datetime, timezone

import pytest
from pydantic import ValidationError
from sqlalchemy import select

from app.models.employee import Employee
from app.models.structure_gap import SequenceLevelHeadcount, StructureGapConfig
from app.models.succession import PoolLevel, PoolStatus, TalentPool
from app.models.user import Tenant
from app.schemas.structure_gap import GapConfigIn, HeadcountStandardsIn
from app.services.structure_gap import (
    DEFAULT_FACTORS,
    GapFactors,
    compute_gap_forecast,
    CellInput,
)
from app.services.structure_gap_data import (
    build_cell_inputs,
    build_grade_level_map,
    get_gap_config,
    replace_headcounts,
    upsert_gap_config,
)
from tests.conftest import auth_header, login


def _tenant(db_session, name="星野制造") -> Tenant:
    return db_session.scalar(select(Tenant).where(Tenant.name == name))


# ============================================================================
# AC-1 缺口公式与折算（纯内核）
# ============================================================================

def test_kernel_gap_formula_with_pool_discount():
    """spec AC-1：demand=10，在岗 6，梯队 L1×1/L2×2/L3×1，默认系数。"""
    cells = [CellInput(
        sequence="P", level_order=3, demand=10, active_count=6,
        pool_levels=("L1", "L2", "L2", "L3"),
    )]
    result = compute_gap_forecast(cells, DEFAULT_FACTORS)
    assert len(result.cells) == 1
    c = result.cells[0]
    assert c.supply_active == 6
    assert c.supply_pool == pytest.approx(2.2)  # 1.0 + 2×0.5 + 0.2
    assert c.supply_total == pytest.approx(8.2)
    assert c.gap == pytest.approx(1.8)
    assert c.severity == "shortage"
    assert result.total_demand == 10
    assert result.total_supply == pytest.approx(8.2)
    assert result.total_gap == pytest.approx(1.8)
    assert result.shortage_cells == 1
    assert result.surplus_cells == 0


def test_kernel_surplus_and_balanced():
    result = compute_gap_forecast(
        [
            CellInput(sequence="P", level_order=2, demand=2, active_count=5),
            CellInput(sequence="M", level_order=3, demand=3, active_count=3),
        ],
        DEFAULT_FACTORS,
    )
    by_key = {(c.sequence, c.level_order): c for c in result.cells}
    assert by_key[("P", 2)].severity == "surplus"
    assert by_key[("P", 2)].gap == pytest.approx(-3)
    assert by_key[("M", 3)].severity == "balanced"
    assert result.surplus_cells == 1
    assert result.shortage_cells == 0


# ============================================================================
# AC-2 空单元格裁剪
# ============================================================================

def test_kernel_empty_cells_pruned():
    result = compute_gap_forecast(
        [
            CellInput(sequence="P", level_order=1, demand=0, active_count=0),
            CellInput(sequence="P", level_order=2, demand=1, active_count=0),
        ],
        DEFAULT_FACTORS,
    )
    assert len(result.cells) == 1
    assert result.cells[0].level_order == 2


def test_kernel_unknown_pool_level_zero_factor():
    """非法 pool_level 按 0 折算，不抛异常。"""
    result = compute_gap_forecast(
        [CellInput(sequence="P", level_order=1, demand=1, active_count=0,
                   pool_levels=("LX",))],
        DEFAULT_FACTORS,
    )
    assert result.cells[0].supply_pool == 0.0


# ============================================================================
# AC-4 标准编制配置读写（服务层）
# ============================================================================

def test_headcounts_replace_semantics(db_session):
    t1 = _tenant(db_session)
    rows = [
        {"sequence": "SW", "level_order": 2, "headcount": 10},
        {"sequence": "SW", "level_order": 3, "headcount": 5},
        {"sequence": "MGT", "level_order": 4, "headcount": 2},
    ]
    replace_headcounts(db_session, t1.id, rows, updated_by=None)
    db_session.commit()
    stored = db_session.scalars(
        select(SequenceLevelHeadcount).where(
            SequenceLevelHeadcount.tenant_id == t1.id)
    ).all()
    assert len(stored) == 3

    # 整体替换：提交 2 行，库内仅剩 2 行
    replace_headcounts(db_session, t1.id, rows[:2], updated_by=None)
    db_session.commit()
    stored = db_session.scalars(
        select(SequenceLevelHeadcount).where(
            SequenceLevelHeadcount.tenant_id == t1.id)
    ).all()
    assert len(stored) == 2
    assert {(r.sequence, r.level_order) for r in stored} == {
        ("SW", 2), ("SW", 3)}

    # 清理，避免污染同会话其他测试
    replace_headcounts(db_session, t1.id, [], updated_by=None)
    db_session.commit()


def test_headcounts_schema_validation():
    HeadcountStandardsIn(rows=[
        {"sequence": "SW", "level_order": 2, "headcount": 5}])
    with pytest.raises(ValidationError):
        HeadcountStandardsIn(rows=[
            {"sequence": "SW", "level_order": 7, "headcount": 5}])
    with pytest.raises(ValidationError):
        HeadcountStandardsIn(rows=[
            {"sequence": "SW", "level_order": 2, "headcount": -1}])
    with pytest.raises(ValidationError):
        HeadcountStandardsIn(rows=[
            {"sequence": "", "level_order": 2, "headcount": 5}])
    with pytest.raises(ValidationError):
        HeadcountStandardsIn(rows=[
            {"sequence": "SW", "level_order": 2, "headcount": 5},
            {"sequence": "SW", "level_order": 2, "headcount": 3},
        ])


# ============================================================================
# AC-5 折算系数配置读写（服务层 + schema）
# ============================================================================

def test_gap_config_default_then_upsert(db_session):
    t1 = _tenant(db_session)
    factors, is_default = get_gap_config(db_session, t1.id)
    assert is_default is True
    assert (factors.l1, factors.l2, factors.l3) == (1.0, 0.5, 0.2)

    upsert_gap_config(
        db_session, t1.id,
        factor_l1=0.9, factor_l2=0.4, factor_l3=0.1, updated_by=None,
    )
    db_session.commit()
    factors, is_default = get_gap_config(db_session, t1.id)
    assert is_default is False
    assert (factors.l1, factors.l2, factors.l3) == (0.9, 0.4, 0.1)

    # 每租户仅一行
    rows = db_session.scalars(
        select(StructureGapConfig).where(
            StructureGapConfig.tenant_id == t1.id)
    ).all()
    assert len(rows) == 1

    # 清理：删除该行，恢复默认态
    db_session.delete(rows[0])
    db_session.commit()


def test_gap_config_schema_validation():
    GapConfigIn(factor_l1=1.0, factor_l2=0.5, factor_l3=0.2)
    with pytest.raises(ValidationError):  # f2 > f1
        GapConfigIn(factor_l1=0.4, factor_l2=0.6, factor_l3=0.2)
    with pytest.raises(ValidationError):  # 负数
        GapConfigIn(factor_l1=1.0, factor_l2=0.5, factor_l3=-0.1)
    with pytest.raises(ValidationError):  # > 1
        GapConfigIn(factor_l1=1.1, factor_l2=0.5, factor_l3=0.2)


def test_gap_config_tenant_isolation(db_session):
    t1 = _tenant(db_session, "星野制造")
    t2 = _tenant(db_session, "临渊科技")
    upsert_gap_config(
        db_session, t1.id,
        factor_l1=0.8, factor_l2=0.5, factor_l3=0.3, updated_by=None,
    )
    db_session.commit()
    _, t2_default = get_gap_config(db_session, t2.id)
    assert t2_default is True
    t1_factors, _ = get_gap_config(db_session, t1.id)
    assert t1_factors.l1 == 0.8

    row = db_session.scalar(
        select(StructureGapConfig).where(
            StructureGapConfig.tenant_id == t1.id))
    db_session.delete(row)
    db_session.commit()


# ============================================================================
# AC-3 梯队归属与状态过滤 + FR-3 未映射分组（数据装配层）
# ============================================================================

def _pool(tenant_id, employee_id, level, status=PoolStatus.ACTIVE):
    return TalentPool(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        employee_id=employee_id,
        pool_level=level,
        reason="测试",
        joined_by=uuid.uuid4(),
        joined_at=datetime.now(timezone.utc),
        status=status,
    )


def test_build_cell_inputs_pool_filters(db_session):
    t1 = _tenant(db_session)
    # 种子：t1_employee 许星遥 SW/P3（level 2）
    emp = db_session.scalar(
        select(Employee).where(Employee.employee_no == "E10086"))

    db_session.add_all([
        _pool(t1.id, emp.id, PoolLevel.L1, PoolStatus.ACTIVE),
        _pool(t1.id, emp.id, PoolLevel.L3, PoolStatus.ACTIVE),
        _pool(t1.id, emp.id, PoolLevel.L2, PoolStatus.GRADUATED),  # 不计
        _pool(t1.id, uuid.uuid4(), PoolLevel.L1),  # 非在职 employee_id：不计
    ])
    db_session.commit()

    cells, _ = build_cell_inputs(db_session, t1.id)
    cell = next(c for c in cells if c.sequence == "SW" and c.level_order == 2)
    assert sorted(cell.pool_levels) == ["L1", "L3"]

    # 清理
    db_session.query(TalentPool).filter(TalentPool.tenant_id == t1.id).delete()
    db_session.commit()


def test_build_grade_level_map_and_unmapped(db_session):
    t1 = _tenant(db_session)
    grade_level = build_grade_level_map(db_session, t1.id)
    # 平台默认映射：P3→2、M3→4
    assert grade_level.get("P3") == 2
    assert grade_level.get("M3") == 4

    # 造一名 grade 无法映射的在职员工
    weird_emp = Employee(
        id=uuid.uuid4(),
        tenant_id=t1.id,
        user_id=uuid.uuid4(),
        employee_no="E99999",
        name="测试未映射",
        dept_id="305",
        position="测试岗",
        family="P",
        sequence="SW",
        grade="X9",
        grade_since=datetime.now(timezone.utc).date(),
        is_active=True,
    )
    db_session.add(weird_emp)
    db_session.commit()

    cells, unmapped = build_cell_inputs(db_session, t1.id)
    assert unmapped["count"] >= 1
    assert "X9" in unmapped["grades"]
    # X9 不进任何 cell
    sw_l2 = next(
        (c for c in cells if c.sequence == "SW" and c.level_order == 2), None)
    assert sw_l2 is not None
    # 在职计数不含 X9（种子 SW/P3 有 2 人：E10086、E10093）
    assert sw_l2.active_count == 2

    db_session.delete(weird_emp)
    db_session.commit()


# ============================================================================
# AC-6 端点端到端
# ============================================================================

@pytest.fixture
def hr_headers(client):
    return auth_header(login(client, "hr@xingye.test"))


@pytest.fixture
def employee_headers(client):
    return auth_header(login(client, "employee@xingye.test"))


def test_gap_forecast_endpoint(db_session, client, hr_headers):
    t1 = _tenant(db_session)
    replace_headcounts(
        db_session, t1.id,
        [{"sequence": "SW", "level_order": 2, "headcount": 5}],
        updated_by=None,
    )
    db_session.commit()

    resp = client.get("/api/v1/structure/gap-forecast", headers=hr_headers)
    assert resp.status_code == 200
    body = resp.json()

    sw_l2 = next(
        c for c in body["cells"]
        if c["sequence"] == "SW" and c["level_order"] == 2)
    # 种子 SW/P3 在职 2 人（E10086、E10093），demand=5
    assert sw_l2["demand"] == 5
    assert sw_l2["supply_active"] == 2
    assert sw_l2["severity"] == "shortage"
    assert sw_l2["gap"] == pytest.approx(3.0)
    assert sw_l2["level_name"] == "经验层"

    assert body["config"]["is_default"] is True
    assert body["config"]["factor_l1"] == 1.0
    assert body["summary"]["total_demand"] >= 5
    assert body["summary"]["shortage_cells"] >= 1
    assert "count" in body["unmapped"] and "grades" in body["unmapped"]

    replace_headcounts(db_session, t1.id, [], updated_by=None)
    db_session.commit()


def test_gap_forecast_forbidden_for_employee(client, employee_headers):
    resp = client.get("/api/v1/structure/gap-forecast", headers=employee_headers)
    assert resp.status_code == 403


def test_headcount_endpoints_roundtrip(db_session, client, hr_headers,
                                       employee_headers):
    # 初始为空
    resp = client.get("/api/v1/structure/headcount-standards", headers=hr_headers)
    assert resp.status_code == 200
    initial = resp.json()

    payload = {"rows": [
        {"sequence": "SW", "level_order": 2, "headcount": 10},
        {"sequence": "SW", "level_order": 3, "headcount": 6},
    ]}
    resp = client.put(
        "/api/v1/structure/headcount-standards",
        headers=hr_headers, json=payload,
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 2

    # 整体替换为 1 行
    resp = client.put(
        "/api/v1/structure/headcount-standards",
        headers=hr_headers,
        json={"rows": [{"sequence": "SW", "level_order": 2, "headcount": 8}]},
    )
    assert resp.status_code == 200
    rows = resp.json()
    assert len(rows) == 1
    assert rows[0]["headcount"] == 8

    # 非法 422
    resp = client.put(
        "/api/v1/structure/headcount-standards",
        headers=hr_headers,
        json={"rows": [{"sequence": "SW", "level_order": 2, "headcount": -1}]},
    )
    assert resp.status_code == 422

    # 无权限 403
    resp = client.put(
        "/api/v1/structure/headcount-standards",
        headers=employee_headers, json=payload,
    )
    assert resp.status_code == 403

    # 还原
    client.put(
        "/api/v1/structure/headcount-standards",
        headers=hr_headers, json={"rows": initial},
    )


def test_gap_config_endpoints(db_session, client, hr_headers):
    resp = client.get("/api/v1/structure/gap-config", headers=hr_headers)
    assert resp.status_code == 200
    assert resp.json()["is_default"] is True

    resp = client.put(
        "/api/v1/structure/gap-config",
        headers=hr_headers,
        json={"factor_l1": 0.9, "factor_l2": 0.4, "factor_l3": 0.1},
    )
    assert resp.status_code == 200
    assert resp.json()["is_default"] is False

    # 单调性非法 422
    resp = client.put(
        "/api/v1/structure/gap-config",
        headers=hr_headers,
        json={"factor_l1": 0.4, "factor_l2": 0.6, "factor_l3": 0.1},
    )
    assert resp.status_code == 422

    # 还原为默认（删除租户行）
    t1 = _tenant(db_session)
    row = db_session.scalar(
        select(StructureGapConfig).where(
            StructureGapConfig.tenant_id == t1.id))
    db_session.delete(row)
    db_session.commit()


# ============================================================================
# AC-7 租户隔离
# ============================================================================

def test_forecast_tenant_isolation(db_session, client):
    t2 = _tenant(db_session, "临渊科技")
    replace_headcounts(
        db_session, t2.id,
        [{"sequence": "SAL", "level_order": 2, "headcount": 99}],
        updated_by=None,
    )
    db_session.commit()

    t1_headers = auth_header(login(client, "hr@xingye.test"))
    resp = client.get("/api/v1/structure/gap-forecast", headers=t1_headers)
    assert resp.status_code == 200
    # 租户 A 看不到租户 B 的 SAL 需求
    assert not any(
        c["sequence"] == "SAL" and c["demand"] == 99
        for c in resp.json()["cells"]
    )

    t2_headers = auth_header(login(client, "hr@linyuan.test"))
    resp = client.get("/api/v1/structure/gap-forecast", headers=t2_headers)
    sal = next(
        c for c in resp.json()["cells"]
        if c["sequence"] == "SAL" and c["level_order"] == 2)
    assert sal["demand"] == 99

    replace_headcounts(db_session, t2.id, [], updated_by=None)
    db_session.commit()
