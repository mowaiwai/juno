"""C1 画像引擎：端点与数据范围授权。"""

from sqlalchemy import select

from app.models.audit import AuditLog
from app.models.employee import Employee
from app.models.user import User
from tests.conftest import auth_header, login


def _get_employee_id(db_session, email):
    return db_session.scalar(
        select(Employee.id)
        .where(
            Employee.user_id
            == select(User.id).where(User.email == email).scalar_subquery()
        )
    )


def test_generate_forbidden_for_employee(client):
    token = login(client, "employee@xingye.test")
    resp = client.post(
        "/api/v1/profiles/generate",
        headers=auth_header(token),
        json={"scope": "all"},
    )
    assert resp.status_code == 403


def test_generate_single_by_hr(client, db_session):
    token = login(client, "hr@xingye.test")
    emp_id = _get_employee_id(db_session, "employee@xingye.test")
    resp = client.post(
        "/api/v1/profiles/generate",
        headers=auth_header(token),
        json={"employee_id": str(emp_id)},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["version_seq"] == 1
    assert data["source"] == "manual"
    assert len(data["dimensions"]) == 7

    log = db_session.scalar(
        select(AuditLog).where(AuditLog.action == "profile_generated")
    )
    assert log is not None


def test_generate_all_by_hr(client, db_session):
    token = login(client, "hr@xingye.test")
    resp = client.post(
        "/api/v1/profiles/generate",
        headers=auth_header(token),
        json={"scope": "all"},
    )
    assert resp.status_code == 201, resp.text
    from app.models.user import Tenant
    t1_id = db_session.scalar(
        select(Tenant.id).where(Tenant.name == "星野制造")
    )
    active = db_session.scalars(
        select(Employee).where(Employee.tenant_id == t1_id)
    ).all()
    assert len(resp.json()) == len(active)


def test_me_regenerate(client):
    token = login(client, "employee@xingye.test")
    resp = client.post(
        "/api/v1/profiles/me/regenerate", headers=auth_header(token)
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["source"] == "manual"
    assert resp.json()["version_seq"] == 1


def test_latest_self_visible(client, db_session):
    token = login(client, "employee@xingye.test")
    emp_id = _get_employee_id(db_session, "employee@xingye.test")
    client.post(
        "/api/v1/profiles/generate",
        headers=auth_header(login(client, "hr@xingye.test")),
        json={"employee_id": str(emp_id)},
    )
    resp = client.get(
        f"/api/v1/profiles/{emp_id}/latest", headers=auth_header(token)
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["version_seq"] == 1


def test_latest_outside_scope_not_found(client, db_session):
    # 由 HR 先给 junior 生成画像
    hr = login(client, "hr@xingye.test")
    junior_id = _get_employee_id(db_session, "junior@xingye.test")
    client.post(
        "/api/v1/profiles/generate",
        headers=auth_header(hr),
        json={"employee_id": str(junior_id)},
    )

    # 平级员工不可见：数据范围外统一 404（ADR-0014 不泄露存在性）
    token = login(client, "employee@xingye.test")
    resp = client.get(
        f"/api/v1/profiles/{junior_id}/latest", headers=auth_header(token)
    )
    assert resp.status_code == 404


def test_latest_manager_sees_subordinate(client, db_session):
    mgr = login(client, "manager@xingye.test")
    emp_id = _get_employee_id(db_session, "employee@xingye.test")
    client.post(
        "/api/v1/profiles/generate",
        headers=auth_header(login(client, "hr@xingye.test")),
        json={"employee_id": str(emp_id)},
    )
    resp = client.get(
        f"/api/v1/profiles/{emp_id}/latest", headers=auth_header(mgr)
    )
    assert resp.status_code == 200


def test_cross_tenant_not_found(client, db_session):
    t2 = login(client, "employee@linyuan.test")
    t1_emp = _get_employee_id(db_session, "employee@xingye.test")
    resp = client.get(
        f"/api/v1/profiles/{t1_emp}/latest", headers=auth_header(t2)
    )
    # 跨租户统一 404 口径
    assert resp.status_code == 404


def test_latest_not_found(client, db_session):
    token = login(client, "employee@xingye.test")
    emp_id = _get_employee_id(db_session, "employee@xingye.test")
    resp = client.get(
        f"/api/v1/profiles/{emp_id}/latest", headers=auth_header(token)
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "profile_not_found"


def test_versions_list_and_detail(client, db_session):
    hr = login(client, "hr@xingye.test")
    emp_id = _get_employee_id(db_session, "employee@xingye.test")
    for _ in range(2):
        client.post(
            "/api/v1/profiles/generate",
            headers=auth_header(hr),
            json={"employee_id": str(emp_id)},
        )

    token = login(client, "employee@xingye.test")
    listing = client.get(
        f"/api/v1/profiles/{emp_id}/versions", headers=auth_header(token)
    )
    assert listing.status_code == 200
    assert [v["version_seq"] for v in listing.json()] == [1, 2]

    detail = client.get(
        f"/api/v1/profiles/{emp_id}/versions/1", headers=auth_header(token)
    )
    assert detail.status_code == 200
    assert detail.json()["version_seq"] == 1
    assert len(detail.json()["dimensions"]) == 7


def test_put_basic_by_hr(client, db_session):
    hr = login(client, "hr@xingye.test")
    emp_id = _get_employee_id(db_session, "employee@xingye.test")
    resp = client.put(
        f"/api/v1/employees/{emp_id}/basic",
        headers=auth_header(hr),
        json={"education": "本科", "certificates": ["PMP"]},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["education"] == "本科"
    assert resp.json()["certificates"] == ["PMP"]


def test_put_basic_forbidden_for_employee(client, db_session):
    token = login(client, "employee@xingye.test")
    emp_id = _get_employee_id(db_session, "employee@xingye.test")
    resp = client.put(
        f"/api/v1/employees/{emp_id}/basic",
        headers=auth_header(token),
        json={"education": "本科", "certificates": []},
    )
    assert resp.status_code == 403


def test_put_basic_invalid_education(client, db_session):
    hr = login(client, "hr@xingye.test")
    emp_id = _get_employee_id(db_session, "employee@xingye.test")
    resp = client.put(
        f"/api/v1/employees/{emp_id}/basic",
        headers=auth_header(hr),
        json={"education": "博士后流动站", "certificates": []},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "invalid_education"
