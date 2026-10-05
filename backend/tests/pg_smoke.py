"""一次性 PG 冒烟脚本：用真实 PostgreSQL 走通登录/RBAC/租户隔离关键路径。

用法（backend 目录，.env 指向本地 PG）：
    python tests/pg_smoke.py
结束后自动清理写入的数据。
"""

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.security import hash_password
from app.database import SessionLocal, get_db
from app.main import create_app
from app.models.role_def import TenantRole
from app.models.user import Role, Tenant, User, custom_role_ref
from app.services.role_service import (
    ensure_preset_all_hr,
    set_active_role,
)

PASSWORD = "Passw0rd!"

session = SessionLocal()

tenant = Tenant(name="冒烟租户")
session.add(tenant)
session.flush()

preset = ensure_preset_all_hr(session, tenant.id)
all_hr_ref = custom_role_ref(preset.id)

hr = User(
    tenant_id=tenant.id,
    email="smoke-hr@example.test",
    name="冒烟HR",
    role=Role.EMPLOYEE,
    roles=[Role.EMPLOYEE.value, all_hr_ref],
    hashed_password=hash_password(PASSWORD),
)
employee = User(
    tenant_id=tenant.id,
    email="smoke-emp@example.test",
    name="冒烟员工",
    role=Role.EMPLOYEE,
    hashed_password=hash_password(PASSWORD),
)
session.add_all([hr, employee])
session.flush()
set_active_role(session, tenant.id, hr.id, all_hr_ref)
session.commit()

app = create_app()
app.dependency_overrides[get_db] = lambda: session
client = TestClient(app)

try:
    # 登录
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "smoke-hr@example.test", "password": PASSWORD},
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # /me 走 PG
    me = client.get("/api/v1/me", headers=headers)
    assert (
        me.status_code == 200
        and me.json()["active_role_ref"] == all_hr_ref
    ), me.text

    # RBAC：HR 可见用户列表
    users_resp = client.get("/api/v1/users", headers=headers)
    assert users_resp.status_code == 200, users_resp.text
    assert len(users_resp.json()) == 2

    # 员工无用户管理权限
    emp_login = client.post(
        "/api/v1/auth/login",
        json={"email": "smoke-emp@example.test", "password": PASSWORD},
    )
    emp_headers = {"Authorization": f"Bearer {emp_login.json()['access_token']}"}
    assert client.get("/api/v1/users", headers=emp_headers).status_code == 403

    # 错误密码
    bad = client.post(
        "/api/v1/auth/login",
        json={"email": "smoke-hr@example.test", "password": "wrong"},
    )
    assert bad.status_code == 401 and bad.json()["code"] == "invalid_credentials"

    print("PG SMOKE OK: login + /me + RBAC + tenant scope verified on PostgreSQL")
finally:
    # 清理
    for u in session.scalars(
        select(User).where(User.tenant_id == tenant.id)
    ).all():
        session.delete(u)
    session.commit()
    for role in session.scalars(
        select(TenantRole).where(TenantRole.tenant_id == tenant.id)
    ).all():
        session.delete(role)
    session.commit()
    session.delete(tenant)
    session.commit()
    session.close()
