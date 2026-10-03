from tests.conftest import auth_header, login


def test_login_success_returns_token(client):
    token = login(client, "hr@xingye.test")
    assert isinstance(token, str) and token


def test_login_wrong_password(client):
    resp = client.post(
        "/api/v1/auth/login", json={"email": "hr@xingye.test", "password": "wrong-pass"}
    )
    assert resp.status_code == 401
    assert resp.json()["code"] == "invalid_credentials"


def test_login_unknown_email(client):
    resp = client.post(
        "/api/v1/auth/login", json={"email": "nobody@xingye.test", "password": "x"}
    )
    assert resp.status_code == 401
    assert resp.json()["code"] == "invalid_credentials"


def test_me_returns_current_user(client):
    token = login(client, "employee@xingye.test")
    resp = client.get("/api/v1/me", headers=auth_header(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == "employee@xingye.test"
    assert body["name"] == "许星遥"
    assert body["role"] == "employee"
    assert body["tenant_id"]


def test_me_requires_token(client):
    assert client.get("/api/v1/me").status_code == 401
