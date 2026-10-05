"""一次性 PG 冒烟脚本：绩效内生（P1）关键路径走真实 PostgreSQL。

路径：建租户/部门/员工 → HR 建 KPI 方案 → 两段流转 → 录入 11 人结果
（S 越界）→ 无理由发布被拦 → 带理由发布 → 断言 perf_grade 回写 +
D 等自动建 PIP + 员工 /perf/me 可见。结束后自动清理全部写入数据。

用法（backend 目录，.env 指向本地 PG 容器 juno-pg-local）：
    $env:PYTHONPATH='.'
    python tests/perf_pg_smoke.py
"""

import uuid
from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.security import hash_password
from app.database import SessionLocal, get_db
from app.main import create_app
from app.models.employee import Employee
from app.models.org import Department
from app.models.perf import PerfPlan, PerfResult, Pip
from app.models.role_def import TenantRole
from app.models.user import Role, Tenant, User, custom_role_ref
from app.services.role_service import ensure_preset_all_hr, set_active_role

PASSWORD = "Passw0rd!"
PERIOD = "SMOKE-2026Q9"

session = SessionLocal()


def purge_tenant(s, ten_id) -> None:
    """按 FK 顺序删除租户下全部冒烟数据（每步 commit）。"""
    for row in s.scalars(select(Pip).where(Pip.tenant_id == ten_id)).all():
        s.delete(row)
    s.commit()
    result_ids = [
        r.id
        for r in s.scalars(
            select(PerfResult)
            .join(PerfPlan, PerfResult.plan_id == PerfPlan.id)
            .where(PerfPlan.tenant_id == ten_id)
        ).all()
    ]
    if result_ids:
        s.execute(PerfResult.__table__.delete().where(PerfResult.id.in_(result_ids)))
    s.commit()
    for p in s.scalars(
        select(PerfPlan).where(PerfPlan.tenant_id == ten_id)
    ).all():
        s.delete(p)
    s.commit()
    for emp in s.scalars(
        select(Employee).where(Employee.tenant_id == ten_id)
    ).all():
        s.delete(emp)
    s.commit()
    for u in s.scalars(select(User).where(User.tenant_id == ten_id)).all():
        s.delete(u)
    s.commit()
    for role in s.scalars(
        select(TenantRole).where(TenantRole.tenant_id == ten_id)
    ).all():
        s.delete(role)
    s.commit()
    d = s.get(Department, ("SMK1", ten_id))
    if d:
        s.delete(d)
    s.commit()


# 自愈：清理上次失败可能遗留的同名冒烟租户
for stale in session.scalars(
    select(Tenant).where(Tenant.name == "绩效冒烟租户")
).all():
    purge_tenant(session, stale.id)
    session.delete(stale)
    session.commit()

tenant = Tenant(name="绩效冒烟租户")
session.add(tenant)
session.flush()

preset = ensure_preset_all_hr(session, tenant.id)
all_hr_ref = custom_role_ref(preset.id)

hr_user = User(
    tenant_id=tenant.id,
    email="perf-smoke-hr@example.test",
    name="冒烟绩效HR",
    role=Role.EMPLOYEE,
    roles=[Role.EMPLOYEE.value, all_hr_ref],
    hashed_password=hash_password(PASSWORD),
)
session.add(hr_user)
session.flush()
set_active_role(session, tenant.id, hr_user.id, all_hr_ref)

dept = Department(
    id="SMK1", tenant_id=tenant.id, name="冒烟研发部", parent_id=None, type="tech"
)
session.add(dept)

# 11 人：1 S + 1 A + 8 B + 1 D（S 占比 9.1% 超 5% 上限，触发越界）
employees: list[Employee] = []
users: list[User] = []
for i in range(11):
    user = User(
        tenant_id=tenant.id,
        email=f"perf-smoke-emp{i}@example.test",
        name=f"冒烟员工{i:02d}",
        role=Role.EMPLOYEE,
        hashed_password=hash_password(PASSWORD),
    )
    session.add(user)
    session.flush()
    users.append(user)
    employees.append(
        Employee(
            tenant_id=tenant.id,
            user_id=user.id,
            employee_no=f"SMK{i:03d}",
            name=f"冒烟员工{i:02d}",
            dept_id="SMK1",
            position="工程师",
            family="tech",
            sequence="rd",
            grade="P5",
            grade_since=date(2025, 1, 1),
        )
    )
session.add_all(employees)
session.commit()

s_emp, a_emp, d_emp = employees[0], employees[1], employees[10]
b_emps = employees[2:10]

app = create_app()
app.dependency_overrides[get_db] = lambda: session
client = TestClient(app)

plan_id: uuid.UUID | None = None
try:
    # ---- 登录（综合 HR 预设含全部 perf 权限点，GLOBAL）----
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "perf-smoke-hr@example.test", "password": PASSWORD},
    )
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    # ---- 建 KPI 方案：11 人名册 ----
    created = client.post(
        "/api/v1/perf/plans",
        headers=headers,
        json={
            "period": PERIOD,
            "tool_type": "kpi",
            "dept_ids": ["SMK1"],
            "sequence_codes": [],
        },
    )
    assert created.status_code == 201, created.text
    plan = created.json()
    plan_id = uuid.UUID(plan["id"])
    assert plan["status"] == "draft"
    assert len(plan["roster_members"]) == 11, plan["roster_members"]

    # draft → evaluating → calibrating
    for to in ("evaluating", "calibrating"):
        r = client.post(
            f"/api/v1/perf/plans/{plan_id}/transition",
            headers=headers,
            json={"to": to},
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == to

    # ---- 录入结果 ----
    items = [
        {
            "employee_id": str(s_emp.id),
            "grade": "S",
            "score": 96,
            "evidence": ["牵头核心项目，全年目标超额 120% 达成"],
        },
        {
            "employee_id": str(a_emp.id),
            "grade": "A",
            "score": 91,
            "evidence": ["重点项目高质量交付"],
        },
        *[
            {"employee_id": str(e.id), "grade": "B", "score": 82, "evidence": []}
            for e in b_emps
        ],
        {"employee_id": str(d_emp.id), "grade": "D", "score": 55, "evidence": []},
    ]
    put = client.put(
        f"/api/v1/perf/plans/{plan_id}/results",
        headers=headers,
        json={"items": items},
    )
    assert put.status_code == 200, put.text
    assert len(put.json()) == 11

    # draft 导入门已过；这里确认导入不在非 draft 态可用（409）
    imp = client.post(
        f"/api/v1/perf/plans/{plan_id}/import",
        headers=headers,
        json={"items": [{"employee_no": "SMK000", "grade": "B"}]},
    )
    assert imp.status_code == 409 and imp.json()["code"] == "plan_not_draft", imp.text

    # ---- 分布：S 9.1% 超 5% 上限，且非小团队 ----
    dist = client.get(
        f"/api/v1/perf/plans/{plan_id}/distribution", headers=headers
    ).json()
    assert dist["roster_size"] == 11 and dist["graded_count"] == 11
    assert not dist["small_roster"]
    assert dist["counts"]["S"] == 1
    assert any(v["bucket"] == "S" for v in dist["violations"]), dist["violations"]

    # 无理由发布 → 422 distribution_override_required
    blocked = client.post(
        f"/api/v1/perf/plans/{plan_id}/publish",
        headers=headers,
        json={"override_reason": None},
    )
    assert blocked.status_code == 422, blocked.text
    assert blocked.json()["code"] == "distribution_override_required"

    # ---- 带理由发布 ----
    pub = client.post(
        f"/api/v1/perf/plans/{plan_id}/publish",
        headers=headers,
        json={"override_reason": "冒烟验证：核心项目骨干集中，S 越界已经校准会审议"},
    )
    assert pub.status_code == 200, pub.text
    assert pub.json()["status"] == "published"
    assert pub.json()["published_at"]

    session.expire_all()
    # ---- 回写 perf_grade（KPI 在回写工具集）----
    assert session.get(Employee, s_emp.id).perf_grade == "S"
    assert session.get(Employee, a_emp.id).perf_grade == "A"
    assert session.get(Employee, b_emps[0].id).perf_grade == "B"
    assert session.get(Employee, d_emp.id).perf_grade == "D"

    # ---- D 等自动、幂等建 PIP ----
    pips = session.scalars(
        select(Pip).where(
            Pip.tenant_id == tenant.id, Pip.employee_id == d_emp.id
        )
    ).all()
    assert len(pips) == 1 and pips[0].status == "active", pips
    d_result = session.scalars(
        select(PerfResult).where(PerfResult.employee_id == d_emp.id)
    ).one()
    assert pips[0].perf_result_id == d_result.id

    # 撤回后重新发布不重复建 PIP
    unp = client.post(
        f"/api/v1/perf/plans/{plan_id}/unpublish", headers=headers
    )
    assert unp.status_code == 200, unp.text
    repub = client.post(
        f"/api/v1/perf/plans/{plan_id}/publish",
        headers=headers,
        json={"override_reason": "冒烟验证：重新发布（幂等 PIP）"},
    )
    assert repub.status_code == 200, repub.text
    pips2 = session.scalars(
        select(Pip).where(Pip.employee_id == d_emp.id)
    ).all()
    assert len(pips2) == 1, "重复发布不应重复建 PIP"

    # ---- 员工本人 /perf/me 可见结果与 PIP ----
    emp_login = client.post(
        "/api/v1/auth/login",
        json={"email": "perf-smoke-emp10@example.test", "password": PASSWORD},
    )
    assert emp_login.status_code == 200, emp_login.text
    emp_headers = {"Authorization": f"Bearer {emp_login.json()['access_token']}"}
    me = client.get("/api/v1/perf/me", headers=emp_headers)
    assert me.status_code == 200, me.text
    body = me.json()
    assert len(body["results"]) == 1 and body["results"][0]["grade"] == "D"
    assert len(body["pips"]) == 1 and body["pips"][0]["status"] == "active"

    print(
        "PERF PG SMOKE OK: KPI 方案 → 越界拦截/理由发布 → perf_grade 回写 → "
        "D 自动 PIP（幂等）→ /perf/me verified on PostgreSQL"
    )
finally:
    # 清理（每类先 commit，避免 UOW 刷新顺序导致父子 FK 冲突）
    purge_tenant(session, tenant.id)
    session.delete(tenant)
    session.commit()
    session.close()
