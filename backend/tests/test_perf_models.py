"""Task 2：绩效四表模型在 SQLite（测试建表）下的 CRUD 与约束。"""
import uuid
from datetime import date

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select

from app.models.employee import Employee
from app.models.perf import (
    CoachingRecord,
    PerfPlan,
    PerfPlanStatus,
    PerfResult,
    PerfToolType,
    Pip,
    PipStatus,
)
from app.models.user import Tenant


def _tenant_and_employee(db_session, tenant_name="星野制造", no="E10086"):
    tenant_id = db_session.scalar(
        select(Tenant.id).where(Tenant.name == tenant_name)
    )
    emp = db_session.scalar(
        select(Employee).where(
            Employee.tenant_id == tenant_id, Employee.employee_no == no
        )
    )
    return tenant_id, emp


def test_perf_plan_crud_with_roster_guids(db_session):
    tenant_id, emp = _tenant_and_employee(db_session)
    plan = PerfPlan(
        tenant_id=tenant_id,
        period="2026H1",
        tool_type=PerfToolType.KPI.value,
        status=PerfPlanStatus.DRAFT.value,
        roster=[emp.id],
    )
    db_session.add(plan)
    db_session.commit()

    fetched = db_session.get(PerfPlan, plan.id)
    assert fetched.period == "2026H1"
    assert fetched.roster == [emp.id]  # GUIDList 字符串↔UUID 往返
    assert fetched.published_at is None
    assert fetched.distribution_override_reason is None
    assert fetched.created_at is not None and fetched.updated_at is not None


def test_perf_result_full_row_and_unique_constraint(db_session):
    tenant_id, emp = _tenant_and_employee(db_session)
    plan = PerfPlan(
        tenant_id=tenant_id,
        period="2026H1",
        tool_type=PerfToolType.PBC.value,
        roster=[emp.id],
    )
    db_session.add(plan)
    db_session.flush()

    result = PerfResult(
        tenant_id=tenant_id,
        plan_id=plan.id,
        employee_id=emp.id,
        grade="C",
        score=72.0,
        coefficient=0.9,
        org_coefficient=1.0,
        evidence=["半年项目按时交付"],
    )
    db_session.add(result)
    db_session.commit()
    assert result.org_coefficient == 1.0

    dup = PerfResult(
        tenant_id=tenant_id,
        plan_id=plan.id,
        employee_id=emp.id,
        grade="B",
        coefficient=1.0,
    )
    db_session.add(dup)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_pip_and_coaching_crud(db_session):
    tenant_id, emp = _tenant_and_employee(db_session)
    pip = Pip(
        tenant_id=tenant_id,
        employee_id=emp.id,
        period="2026H1",
        goals=["提升代码评审通过率"],
        deadline=date(2026, 9, 30),
        status=PipStatus.ACTIVE.value,
        linked_adjust_id=None,
    )
    db_session.add(pip)
    coaching = CoachingRecord(
        tenant_id=tenant_id,
        employee_id=emp.id,
        content="周度面谈：明确两项改进动作",
        happened_at=date(2026, 7, 1),
        created_by=uuid.uuid4(),
    )
    db_session.add(coaching)
    db_session.commit()

    fetched_pip = db_session.get(Pip, pip.id)
    assert fetched_pip.status == "active"
    assert fetched_pip.linked_adjust_id is None
    rows = db_session.scalars(
        select(CoachingRecord).where(CoachingRecord.employee_id == emp.id)
    ).all()
    assert len(rows) == 1
    assert rows[0].happened_at == date(2026, 7, 1)
