from tests.conftest import auth_header, login


def test_employee_cannot_list_users(client):
    token = login(client, "employee@xingye.test")
    resp = client.get("/api/v1/users", headers=auth_header(token))
    assert resp.status_code == 403
    assert resp.json()["code"] == "forbidden"


def test_manager_cannot_list_users(client):
    token = login(client, "manager@xingye.test")
    resp = client.get("/api/v1/users", headers=auth_header(token))
    assert resp.status_code == 403


def test_hr_can_list_users(client):
    token = login(client, "hr@xingye.test")
    resp = client.get("/api/v1/users", headers=auth_header(token))
    assert resp.status_code == 200


def test_tenant_admin_can_list_users(client):
    token = login(client, "admin@xingye.test")
    resp = client.get("/api/v1/users", headers=auth_header(token))
    assert resp.status_code == 200
