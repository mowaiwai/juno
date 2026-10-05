"""Task 8：奖金方案端点与审批发放清单（AC-10）。"""
import uuid
from datetime import datetime

from sqlalchemy import select

from app.models.audit import AuditLog
from app.models.employee import Employee
from app.models.perf import (
    PerfPlan,
    PerfPlanStatus,
    PerfResult,
    PerfToolType,
)
from app.models.user import Tenant
from tests.conftest import auth_header, login


def _tenant_id(db_session, name="星野制造"):
    return db_session.scalar(select(Tenant.id).where(Tenant.name == name))


def _emp_by_no(db_session, tenant_id, no):
    return db_session.scalar(
        select(Employee).where(
            Employee.tenant_id == tenant_id, Employee.employee_no == no
        )
    )


def _published_plan(db_session, tenant_id, results):
    plan = PerfPlan(
        tenant_id=tenant_id, period="2026H1",
        tool_type=PerfToolType.KPI.value,
        status=PerfPlanStatus.PUBLISHED.value,
        published_at=datetime(2026, 7, 1),
        roster=[e.id for e, _ in results],
    )
    db_session.add(plan)
    db_session.flush()
    for emp, (grade, coef) in results:
        db_session.add(PerfResult(
            tenant_id=tenant_id, plan_id=plan.id, employee_id=emp.id,
            grade=grade, coefficient=coef, org_coefficient=1.0,
        ))
    db_session.flush()
    return plan


def test_bonus_plan_lifecycle(client, db_session):
    tid = _tenant_id(db_session)
    hr_token = login(client, "hr@xingye.test")
    exec_token = login(client, "admin@xingye.test")

    e1 = _emp_by_no(db_session, tid, "E10086")  # SW
    e1.base_salary = 10000
    db_session.flush()

    plan = _published_plan(db_session, tid, [(e1, ("S", 1.5))])

    # 创建奖金方案
    resp = client.post(
        "/api/v1/comp/bonus-plans",
        headers=auth_header(hr_token),
        json={"perf_plan_id": str(plan.id), "plan_name": "2026H1 奖金",
              "scope_depts": [], "proration_enabled": False},
    )
    assert resp.status_code == 200, resp.text
    bp_id = resp.json()["id"]

    # 测算
    resp = client.post(
        f"/api/v1/comp/bonus-plans/{bp_id}/calculate",
        headers=auth_header(hr_token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "calculated"

    # 查看明细
    resp = client.get(
        f"/api/v1/comp/bonus-plans/{bp_id}", headers=auth_header(hr_token)
    )
    body = resp.json()
    item = body["items"][0]
    # SW: 10000×3=30000 目标，系数 1.5，折算关 → 公式 45000
    assert item["target_bonus"] == 30000.0
    assert item["formula_amount"] == 45000.0
    assert item["excluded_reason"] is None
    # 初始缩放比 1.0
    assert item["scale_ratio"] == 1.0

    # 微调部门包：50000 / 45000
    dept_id = body["dept_pools"][0]["dept_id"]
    resp = client.patch(
        f"/api/v1/comp/bonus-plans/{bp_id}/dept-pools/{dept_id}",
        headers=auth_header(hr_token),
        json={"pool_amount": 50000, "adjust_reason": "部门包加码"},
    )
    assert resp.status_code == 200
    assert resp.json()["ratio"] == round(50000 / 45000, 4)

    # 提交审批
    resp = client.post(
        f"/api/v1/comp/bonus-plans/{bp_id}/submit", headers=auth_header(hr_token)
    )
    assert resp.json()["status"] == "approving"

    # 高管批准 → archived
    resp = client.post(
        f"/api/v1/comp/bonus-plans/{bp_id}/approve", headers=auth_header(exec_token)
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "archived"


def test_bonus_plan_reject(client, db_session):
    tid = _tenant_id(db_session)
    hr_token = login(client, "hr@xingye.test")
    exec_token = login(client, "admin@xingye.test")

    e1 = _emp_by_no(db_session, tid, "E10086")
    e1.base_salary = 10000
    db_session.flush()
    plan = _published_plan(db_session, tid, [(e1, ("A", 1.2))])

    resp = client.post(
        "/api/v1/comp/bonus-plans", headers=auth_header(hr_token),
        json={"perf_plan_id": str(plan.id), "plan_name": "test", "scope_depts": []},
    )
    bp_id = resp.json()["id"]
    client.post(f"/api/v1/comp/bonus-plans/{bp_id}/calculate", headers=auth_header(hr_token))
    client.post(f"/api/v1/comp/bonus-plans/{bp_id}/submit", headers=auth_header(hr_token))

    # 过短理由（<5 字）后端拒绝
    bad = client.post(
        f"/api/v1/comp/bonus-plans/{bp_id}/reject", headers=auth_header(exec_token),
        json={"reason": "驳回"},
    )
    assert bad.status_code == 422

    resp = client.post(
        f"/api/v1/comp/bonus-plans/{bp_id}/reject", headers=auth_header(exec_token),
        json={"reason": "包额过高，请压缩"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "draft"
    assert resp.json()["reject_reason"] == "包额过高，请压缩"


def test_non_exec_cannot_approve_bonus(client, db_session):
    tid = _tenant_id(db_session)
    hr_token = login(client, "hr@xingye.test")

    e1 = _emp_by_no(db_session, tid, "E10086")
    e1.base_salary = 10000
    db_session.flush()
    plan = _published_plan(db_session, tid, [(e1, ("A", 1.2))])

    resp = client.post(
        "/api/v1/comp/bonus-plans", headers=auth_header(hr_token),
        json={"perf_plan_id": str(plan.id), "plan_name": "test", "scope_depts": []},
    )
    bp_id = resp.json()["id"]
    client.post(f"/api/v1/comp/bonus-plans/{bp_id}/calculate", headers=auth_header(hr_token))
    client.post(f"/api/v1/comp/bonus-plans/{bp_id}/submit", headers=auth_header(hr_token))

    resp = client.post(
        f"/api/v1/comp/bonus-plans/{bp_id}/approve", headers=auth_header(hr_token)
    )
    assert resp.status_code == 403


# ---------- P0-2：奖金仅消费已发布 KPI/PBC ----------

def test_create_bonus_plan_rejects_unpublished_or_okr(client, db_session):
    tid = _tenant_id(db_session)
    hr_token = login(client, "hr@xingye.test")
    e1 = _emp_by_no(db_session, tid, "E10086")

    # 未发布的 KPI 方案 → 422
    draft_plan = PerfPlan(
        tenant_id=tid, period="2026Q3", tool_type=PerfToolType.KPI.value,
        status=PerfPlanStatus.DRAFT.value, roster=[e1.id],
    )
    db_session.add(draft_plan)
    db_session.flush()
    resp = client.post(
        "/api/v1/comp/bonus-plans", headers=auth_header(hr_token),
        json={"perf_plan_id": str(draft_plan.id), "plan_name": "t", "scope_depts": []},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "perf_plan_not_published"

    # 已发布 OKR 方案 → 422（OKR/360 不计发奖金）
    okr_plan = PerfPlan(
        tenant_id=tid, period="2026Q2", tool_type=PerfToolType.OKR.value,
        status=PerfPlanStatus.PUBLISHED.value,
        published_at=datetime(2026, 7, 1), roster=[e1.id],
    )
    db_session.add(okr_plan)
    db_session.flush()
    resp = client.post(
        "/api/v1/comp/bonus-plans", headers=auth_header(hr_token),
        json={"perf_plan_id": str(okr_plan.id), "plan_name": "t", "scope_depts": []},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "perf_plan_tool_unsupported"

    # 不存在的周期 → 404
    resp = client.post(
        "/api/v1/comp/bonus-plans", headers=auth_header(hr_token),
        json={"perf_plan_id": str(uuid.uuid4()), "plan_name": "t", "scope_depts": []},
    )
    assert resp.status_code == 404


# ---------- P1-1：奖金包总额预切 ----------

def test_bonus_pool_total_precuts_dept_pools(client, db_session):
    tid = _tenant_id(db_session)
    hr_token = login(client, "hr@xingye.test")
    e1 = _emp_by_no(db_session, tid, "E10086")
    e2 = _emp_by_no(db_session, tid, "E10091")
    e1.base_salary, e2.base_salary = 10000, 10000
    db_session.flush()
    plan = _published_plan(db_session, tid, [(e1, ("A", 1.2)), (e2, ("A", 1.2))])

    resp = client.post(
        "/api/v1/comp/bonus-plans", headers=auth_header(hr_token),
        json={"perf_plan_id": str(plan.id), "plan_name": "总包预切",
              "scope_depts": [], "proration_enabled": False,
              "bonus_pool_total": 30000},
    )
    assert resp.status_code == 200, resp.text
    bp_id = resp.json()["id"]

    resp = client.post(
        f"/api/v1/comp/bonus-plans/{bp_id}/calculate", headers=auth_header(hr_token)
    )
    assert resp.status_code == 200

    body = client.get(
        f"/api/v1/comp/bonus-plans/{bp_id}", headers=auth_header(hr_token)
    ).json()
    # 两人同部门同目标各 30000 → 部门总目标 60000，总包 30000 按占比预切
    assert len(body["dept_pools"]) == 1
    pool = body["dept_pools"][0]
    assert pool["target_sum"] == 60000
    assert pool["formula_sum"] == 72000
    assert pool["pool_amount"] == 30000
    # 缩放比一致且 <1（30000/72000）
    assert body["items"][0]["scale_ratio"] == body["items"][1]["scale_ratio"]
    assert body["items"][0]["scale_ratio"] < 1
    assert body["bonus_pool_total"] == 30000


def test_no_pool_total_means_one_to_one(client, db_session):
    tid = _tenant_id(db_session)
    hr_token = login(client, "hr@xingye.test")
    e1 = _emp_by_no(db_session, tid, "E10086")
    e1.base_salary = 10000
    db_session.flush()
    plan = _published_plan(db_session, tid, [(e1, ("A", 1.2))])

    resp = client.post(
        "/api/v1/comp/bonus-plans", headers=auth_header(hr_token),
        json={"perf_plan_id": str(plan.id), "plan_name": "不缩放",
              "scope_depts": [], "proration_enabled": False},
    )
    bp_id = resp.json()["id"]
    client.post(
        f"/api/v1/comp/bonus-plans/{bp_id}/calculate", headers=auth_header(hr_token)
    )
    body = client.get(
        f"/api/v1/comp/bonus-plans/{bp_id}", headers=auth_header(hr_token)
    ).json()
    pool = body["dept_pools"][0]
    assert pool["pool_amount"] == pool["formula_sum"] == 36000
    assert body["items"][0]["scale_ratio"] == 1.0
    assert body["items"][0]["final_amount"] == 36000


# ---------- P1-2：个人目标奖金覆盖 + 留痕 ----------

def test_tune_bonus_item_overrides_target_and_audits(client, db_session):
    tid = _tenant_id(db_session)
    hr_token = login(client, "hr@xingye.test")
    e1 = _emp_by_no(db_session, tid, "E10086")
    e1.base_salary = 10000
    db_session.flush()
    plan = _published_plan(db_session, tid, [(e1, ("S", 1.5))])
    resp = client.post(
        "/api/v1/comp/bonus-plans", headers=auth_header(hr_token),
        json={"perf_plan_id": str(plan.id), "plan_name": "个人覆盖",
              "scope_depts": [], "proration_enabled": False},
    )
    bp_id = resp.json()["id"]
    client.post(
        f"/api/v1/comp/bonus-plans/{bp_id}/calculate", headers=auth_header(hr_token)
    )

    # 目标 30000→40000，公式 45000→60000；部门包额 45000 不变 → 包内缩放 0.75
    resp = client.patch(
        f"/api/v1/comp/bonus-plans/{bp_id}/items/{e1.id}",
        headers=auth_header(hr_token),
        json={"target_bonus": 40000, "reason": "核心人才专项加码"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["target_bonus"] == 40000
    assert resp.json()["formula_amount"] == 60000

    body = client.get(
        f"/api/v1/comp/bonus-plans/{bp_id}", headers=auth_header(hr_token)
    ).json()
    item = body["items"][0]
    assert item["target_bonus"] == 40000
    assert item["formula_amount"] == 60000
    assert item["scale_ratio"] == 0.75
    assert item["final_amount"] == 45000
    assert body["dept_pools"][0]["target_sum"] == 40000
    assert body["dept_pools"][0]["formula_sum"] == 60000

    # 审计留痕（NFR-3）
    db_session.expire_all()
    rows = db_session.scalars(
        select(AuditLog).where(
            AuditLog.tenant_id == tid,
            AuditLog.action == "bonus_item_target_overridden",
        )
    ).all()
    assert len(rows) == 1
    assert rows[0].before["target_bonus"] == 30000
    assert rows[0].after["target_bonus"] == 40000
    assert rows[0].after["reason"] == "核心人才专项加码"

    # 非名册员工 → 404；金额非正 → 422
    resp = client.patch(
        f"/api/v1/comp/bonus-plans/{bp_id}/items/{uuid.uuid4()}",
        headers=auth_header(hr_token),
        json={"target_bonus": 1, "reason": "x"},
    )
    assert resp.status_code == 404
    resp = client.patch(
        f"/api/v1/comp/bonus-plans/{bp_id}/items/{e1.id}",
        headers=auth_header(hr_token),
        json={"target_bonus": 0, "reason": "x"},
    )
    assert resp.status_code == 422


def test_dept_pool_tune_requires_reason(client, db_session):
    tid = _tenant_id(db_session)
    hr_token = login(client, "hr@xingye.test")
    e1 = _emp_by_no(db_session, tid, "E10086")
    e1.base_salary = 10000
    db_session.flush()
    plan = _published_plan(db_session, tid, [(e1, ("A", 1.2))])
    bp_id = client.post(
        "/api/v1/comp/bonus-plans", headers=auth_header(hr_token),
        json={"perf_plan_id": str(plan.id), "plan_name": "理由必填", "scope_depts": []},
    ).json()["id"]
    client.post(
        f"/api/v1/comp/bonus-plans/{bp_id}/calculate", headers=auth_header(hr_token)
    )
    dept_id = client.get(
        f"/api/v1/comp/bonus-plans/{bp_id}", headers=auth_header(hr_token)
    ).json()["dept_pools"][0]["dept_id"]
    resp = client.patch(
        f"/api/v1/comp/bonus-plans/{bp_id}/dept-pools/{dept_id}",
        headers=auth_header(hr_token),
        json={"pool_amount": 50000, "adjust_reason": "   "},
    )
    assert resp.status_code == 422


# ---------- P1-4：发放清单 CSV 导出 ----------

def test_payout_export_csv_and_permissions(client, db_session):
    tid = _tenant_id(db_session)
    hr_token = login(client, "hr@xingye.test")
    emp_token = login(client, "employee@xingye.test")
    e1 = _emp_by_no(db_session, tid, "E10086")
    e1.base_salary = 10000
    db_session.flush()
    plan = _published_plan(db_session, tid, [(e1, ("S", 1.5))])
    bp_id = client.post(
        "/api/v1/comp/bonus-plans", headers=auth_header(hr_token),
        json={"perf_plan_id": str(plan.id), "plan_name": "2026H1 绩效奖金",
              "scope_depts": [], "proration_enabled": False},
    ).json()["id"]
    client.post(
        f"/api/v1/comp/bonus-plans/{bp_id}/calculate", headers=auth_header(hr_token)
    )

    # 未归档不可导出
    resp = client.get(
        f"/api/v1/comp/bonus-plans/{bp_id}/payout-export",
        headers=auth_header(hr_token),
    )
    assert resp.status_code == 409

    client.post(
        f"/api/v1/comp/bonus-plans/{bp_id}/submit", headers=auth_header(hr_token)
    )
    client.post(
        f"/api/v1/comp/bonus-plans/{bp_id}/approve",
        headers=auth_header(login(client, "admin@xingye.test")),
    )

    # 员工无导出权限
    resp = client.get(
        f"/api/v1/comp/bonus-plans/{bp_id}/payout-export",
        headers=auth_header(emp_token),
    )
    assert resp.status_code == 403

    # HR（bonus.manage）可导出
    resp = client.get(
        f"/api/v1/comp/bonus-plans/{bp_id}/payout-export",
        headers=auth_header(hr_token),
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    text = resp.content.decode("utf-8-sig")
    assert "2026H1 绩效奖金" in text
    assert "E10086" in text
    assert text.startswith("方案名称,工号,姓名")
