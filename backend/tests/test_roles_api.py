"""角色与权限管理端点测试（ADR-0014）。

覆盖：目录可见性、自定义角色 CRUD、授/收角色、激活角色（含
X-Active-Role 请求头的服务端强制）、ASSIGNED_DEPTS 数据范围、
最后管理员防呆。
"""

import pytest
from sqlalchemy import select

from app.models.role_def import RoleScope, TenantRole
from app.models.user import User
from tests.conftest import auth_header, login

BASE = "/api/v1"


@pytest.fixture
def admin_headers(client):
    return auth_header(login(client, "admin@xingye.test"))


@pytest.fixture(autouse=True)
def restore_rbac_state(db_session):
    """还原用户角色引用/激活角色，清理测试新增的自定义角色与部门授权。"""
    users = db_session.scalars(select(User)).all()
    snapshot = [
        (u, list(u.roles or []), u.active_role_ref, u.role) for u in users
    ]
    role_ids = {r.id for r in db_session.scalars(select(TenantRole)).all()}
    scope_ids = {s.id for s in db_session.scalars(select(RoleScope)).all()}
    yield
    for s in db_session.scalars(select(RoleScope)).all():
        if s.id not in scope_ids:
            db_session.delete(s)
    db_session.flush()
    for r in db_session.scalars(select(TenantRole)).all():
        if r.id not in role_ids:
            db_session.delete(r)
    for u, roles, active, primary in snapshot:
        u.roles = roles
        u.active_role_ref = active
        u.role = primary
    db_session.commit()


def _user_id(client, headers, email: str) -> str:
    rows = client.get(f"{BASE}/users", headers=headers).json()
    return next(u["id"] for u in rows if u["email"] == email)


def _create_role(client, headers, name, permissions, scope_type="global"):
    resp = client.post(
        f"{BASE}/roles/custom",
        headers=headers,
        json={
            "name": name,
            "scope_type": scope_type,
            "permissions": permissions,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---------------------------------------------------------------------------

def test_catalog_only_for_role_managers(client, admin_headers):
    resp = client.get(f"{BASE}/roles/catalog", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "groups" in body and "builtin_roles" in body
    refs = {r["ref"] for r in body["builtin_roles"]}
    assert {"hr_coe_cadre", "hr_coe_perf", "hrbp", "ssc"} <= refs

    emp = auth_header(login(client, "employee@xingye.test"))
    assert client.get(f"{BASE}/roles/catalog", headers=emp).status_code == 403


def test_custom_role_crud(client, admin_headers):
    created = _create_role(
        client, admin_headers, "临时盘点员", ["employee.view", "inventory.calibrate"]
    )
    role_id = created["id"]

    # 非法权限点 → 422
    bad = client.post(
        f"{BASE}/roles/custom",
        headers=admin_headers,
        json={"name": "x", "scope_type": "global", "permissions": ["not.a.perm"]},
    )
    assert bad.status_code == 422

    # 改名与权限
    upd = client.put(
        f"{BASE}/roles/custom/{role_id}",
        headers=admin_headers,
        json={"name": "盘点员 v2", "scope_type": "global",
              "permissions": ["employee.view"]},
    )
    assert upd.status_code == 200 and upd.json()["name"] == "盘点员 v2"
    assert upd.json()["permissions"] == ["employee.view"]

    assert client.delete(
        f"{BASE}/roles/custom/{role_id}", headers=admin_headers
    ).status_code == 204
    assert client.delete(
        f"{BASE}/roles/custom/{role_id}", headers=admin_headers
    ).status_code == 404


def test_clone_builtin_role(client, admin_headers):
    resp = client.post(
        f"{BASE}/roles/clone",
        headers=admin_headers,
        json={"builtin_key": "hrbp", "name": "制造线 HRBP"},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["cloned_from"] == "hrbp"
    assert body["scope_type"] == "assigned_depts"

    # 固定角色不可克隆
    bad = client.post(
        f"{BASE}/roles/clone",
        headers=admin_headers,
        json={"builtin_key": "tenant_admin", "name": "x"},
    )
    assert bad.status_code == 422


def test_grant_active_role_and_header_enforcement(client, admin_headers):
    """授角 + 激活后权限生效；X-Active-Role 头可切换且服务端强制。"""
    role = _create_role(client, admin_headers, "临时名册员", ["employee.view"])
    junior_id = _user_id(client, admin_headers, "junior@xingye.test")
    ref = f"custom:{role['id']}"

    # 默认 employee：无 employee.view
    junior = auth_header(login(client, "junior@xingye.test"))
    assert client.get(f"{BASE}/employees", headers=junior).status_code == 403

    # 授角
    granted = client.post(
        f"{BASE}/roles/users/{junior_id}/grants",
        headers=admin_headers,
        json={"ref": ref},
    )
    assert granted.status_code == 201 and ref in granted.json()["role_refs"]

    # 授予不存在的引用 → 422
    bad_grant = client.post(
        f"{BASE}/roles/users/{junior_id}/grants",
        headers=admin_headers,
        json={"ref": "custom:00000000-0000-0000-0000-000000000000"},
    )
    assert bad_grant.status_code == 422

    # 设为激活角色
    activated = client.put(
        f"{BASE}/roles/users/{junior_id}/active-role",
        headers=admin_headers,
        json={"ref": ref},
    )
    assert activated.status_code == 200
    assert activated.json()["active_role_ref"] == ref

    # 默认激活已是自定义角色
    junior = auth_header(login(client, "junior@xingye.test"))
    assert client.get(f"{BASE}/employees", headers=junior).status_code == 200

    # 请求头切回 employee → 立即失权（不做角色并集）
    as_employee = {**junior, "X-Active-Role": "employee"}
    assert client.get(f"{BASE}/employees", headers=as_employee).status_code == 403

    # 请求头切到自定义角色 → 有权
    as_custom = {**junior, "X-Active-Role": ref}
    assert client.get(f"{BASE}/employees", headers=as_custom).status_code == 200

    # 不属于本人的激活角色 → 403
    forged = {**junior, "X-Active-Role": "hr_coe_cadre"}
    assert client.get(f"{BASE}/employees", headers=forged).status_code == 403

    # 收角色后 403
    revoked = client.delete(
        f"{BASE}/roles/users/{junior_id}/grants/{ref}", headers=admin_headers
    )
    assert revoked.status_code == 204
    # 摘除后默认回落主角色 employee
    junior_after = auth_header(login(client, "junior@xingye.test"))
    assert client.get(f"{BASE}/employees", headers=junior_after).status_code == 403


def test_assigned_depts_scope_filters_employees(client, admin_headers):
    """ASSIGNED_DEPTS：只可见授权部门（含子树）内的员工。"""
    role = _create_role(
        client, admin_headers, "软件部 HRBP",
        ["employee.view"], scope_type="assigned_depts",
    )
    junior_id = _user_id(client, admin_headers, "junior@xingye.test")
    ref = f"custom:{role['id']}"
    client.post(
        f"{BASE}/roles/users/{junior_id}/grants",
        headers=admin_headers, json={"ref": ref},
    )
    client.put(
        f"{BASE}/roles/users/{junior_id}/active-role",
        headers=admin_headers, json={"ref": ref},
    )
    # 仅授权 305（软件研发部），不含子树参数（默认含子树）
    scopes = client.put(
        f"{BASE}/roles/users/{junior_id}/scopes",
        headers=admin_headers,
        json={"role_ref": ref, "depts": [{"dept_id": "305"}]},
    )
    assert scopes.status_code == 200, scopes.text
    assert scopes.json() == [
        {"role_ref": ref, "dept_id": "305", "include_subtree": True}
    ]

    junior = auth_header(login(client, "junior@xingye.test"))
    resp = client.get(f"{BASE}/employees", headers=junior)
    assert resp.status_code == 200, resp.text
    depts = {e["dept_id"] for e in resp.json()}
    # 本人始终可见；其余仅 305 子树
    assert depts <= {"305"}

    # 未授角先配范围 → 422
    emp_id = _user_id(client, admin_headers, "employee@xingye.test")
    bad = client.put(
        f"{BASE}/roles/users/{emp_id}/scopes",
        headers=admin_headers,
        json={"role_ref": ref, "depts": [{"dept_id": "305"}]},
    )
    assert bad.status_code == 422


def test_last_tenant_admin_protected(client, admin_headers):
    # t1 有两个通配管理员（租户管理员 + 平台管理员）：先撤平台管理员仍剩一人
    platform_id = _user_id(client, admin_headers, "admin@platform.test")
    first = client.delete(
        f"{BASE}/roles/users/{platform_id}/grants/platform_admin",
        headers=admin_headers,
    )
    assert first.status_code == 204

    # 再撤自己（最后一个租户管理员）→ 触发防呆 422
    admin_id = _user_id(client, admin_headers, "admin@xingye.test")
    second = client.delete(
        f"{BASE}/roles/users/{admin_id}/grants/tenant_admin",
        headers=admin_headers,
    )
    assert second.status_code == 422
    assert second.json()["code"] == "last_admin_protected"


def test_grants_listing(client, admin_headers):
    junior_id = _user_id(client, admin_headers, "junior@xingye.test")
    resp = client.get(
        f"{BASE}/roles/users/{junior_id}/grants", headers=admin_headers
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["role_refs"] == ["employee"]

    # 跨租户用户 → 404
    other_resp = client.get(
        f"{BASE}/roles/users/00000000-0000-0000-0000-000000000000/grants",
        headers=admin_headers,
    )
    assert other_resp.status_code == 404
