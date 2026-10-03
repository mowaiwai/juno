from tests.conftest import auth_header, login


def test_users_scoped_to_own_tenant(client):
    token = login(client, "hr@xingye.test")
    resp = client.get("/api/v1/users", headers=auth_header(token))
    assert resp.status_code == 200
    users = resp.json()
    emails = {u["email"] for u in users}
    assert "employee@xingye.test" in emails
    assert "hr@linyuan.test" not in emails
    assert "employee@linyuan.test" not in emails
    assert len({u["tenant_id"] for u in users}) == 1


def test_other_tenant_sees_disjoint_set(client):
    token = login(client, "hr@linyuan.test")
    resp = client.get("/api/v1/users", headers=auth_header(token))
    emails = {u["email"] for u in resp.json()}
    assert "employee@linyuan.test" in emails
    assert "employee@xingye.test" not in emails
