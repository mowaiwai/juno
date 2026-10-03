"""C3 核心岗位/继任/梯队：端点与权限。"""

from sqlalchemy import select

from app.models.employee import Employee
from app.models.user import User
from tests.conftest import auth_header, login


def _emp_id(db, email):
    return db.scalar(
        select(Employee.id).where(
            Employee.user_id
            == select(User.id).where(User.email == email).scalar_subquery()
        )
    )


def _create_position(client, token, **overrides):
    body = {
        "name": "软件研发经理",
        "dept_id": "305",
        "grade": "M2",
        "sequence": "MGT",
        "headcount": 1,
    }
    body.update(overrides)
    resp = client.post(
        "/api/v1/core-positions", headers=auth_header(token), json=body
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_position_write_forbidden_for_employee(client):
    token = login(client, "employee@xingye.test")
    resp = client.post(
        "/api/v1/core-positions",
        headers=auth_header(token),
        json={"name": "岗位", "grade": "M2", "sequence": "MGT",
              "headcount": 1},
    )
    assert resp.status_code == 403


def test_position_crud_api(client, db_session):
    hr = login(client, "hr@xingye.test")
    mgr_id = _emp_id(db_session, "manager@xingye.test")
    position = _create_position(
        client, hr, incumbent_employee_id=str(mgr_id)
    )
    assert position["risk"] == "HIGH"  # 无候选
    assert position["incumbent_employee_id"] == str(mgr_id)

    listing = client.get("/api/v1/core-positions", headers=auth_header(hr))
    assert listing.status_code == 200
    assert len(listing.json()) == 1

    updated = client.put(
        f"/api/v1/core-positions/{position['id']}",
        headers=auth_header(hr),
        json={"headcount": 2},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["headcount"] == 2

    deleted = client.delete(
        f"/api/v1/core-positions/{position['id']}", headers=auth_header(hr)
    )
    assert deleted.status_code == 204


def test_position_list_readable_by_manager(client):
    hr = login(client, "hr@xingye.test")
    _create_position(client, hr)
    mgr = login(client, "manager@xingye.test")
    resp = client.get("/api/v1/core-positions", headers=auth_header(mgr))
    assert resp.status_code == 200

    # 经理不能改
    blocked = client.put(
        f"/api/v1/core-positions/{resp.json()[0]['id']}",
        headers=auth_header(mgr),
        json={"headcount": 3},
    )
    assert blocked.status_code == 403


def test_cross_tenant_forbidden(client, db_session):
    hr = login(client, "hr@xingye.test")
    position = _create_position(client, hr)
    t2 = login(client, "hr@linyuan.test")
    resp = client.get(
        f"/api/v1/core-positions/{position['id']}",
        headers=auth_header(t2),
    )
    assert resp.status_code == 403


def test_auto_screen_api(client, db_session):
    hr = login(client, "hr@xingye.test")
    rev1 = str(_emp_id(db_session, "rev1@xingye.test"))
    position = _create_position(
        client, hr, name="高级软件工程师", grade="P4",
        sequence="SW", incumbent_employee_id=rev1,
    )
    resp = client.post(
        f"/api/v1/core-positions/{position['id']}/auto-screen",
        headers=auth_header(hr),
    )
    assert resp.status_code == 200, resp.text
    view = resp.json()
    assert view["candidate_count"] == 2
    assert view["risk"] == "LOW"
    assert view["coverage"] == 100

    candidates = client.get(
        f"/api/v1/core-positions/{position['id']}/candidates",
        headers=auth_header(hr),
    ).json()
    assert {c["employee_id"] for c in candidates} == {
        str(_emp_id(db_session, "employee@xingye.test")),
        str(_emp_id(db_session, "junior@xingye.test")),
    }


def test_nominate_and_remove_api(client, db_session):
    hr = login(client, "hr@xingye.test")
    position = _create_position(client, hr)
    emp = str(_emp_id(db_session, "employee@xingye.test"))

    add = client.post(
        f"/api/v1/core-positions/{position['id']}/candidates",
        headers=auth_header(hr),
        json={"employee_id": emp},
    )
    assert add.status_code == 201, add.text

    # 重复提名 → 409
    dup = client.post(
        f"/api/v1/core-positions/{position['id']}/candidates",
        headers=auth_header(hr),
        json={"employee_id": emp},
    )
    assert dup.status_code == 409
    assert dup.json()["code"] == "candidate_exists"

    removed = client.request(
        "DELETE",
        f"/api/v1/core-positions/{position['id']}/candidates",
        headers=auth_header(hr),
        json={"employee_id": emp},
    )
    assert removed.status_code == 204


def test_willingness_api(client, db_session):
    hr = login(client, "hr@xingye.test")
    position = _create_position(client, hr)
    emp_id = str(_emp_id(db_session, "employee@xingye.test"))
    client.post(
        f"/api/v1/core-positions/{position['id']}/candidates",
        headers=auth_header(hr),
        json={"employee_id": emp_id},
    )
    resp = client.put(
        f"/api/v1/core-positions/{position['id']}/candidates/{emp_id}/willingness",
        headers=auth_header(hr),
        json={"willingness": "willing"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["willingness"] == "willing"


def test_willingness_invalid_422(client, db_session):
    hr = login(client, "hr@xingye.test")
    position = _create_position(client, hr)
    emp_id = str(_emp_id(db_session, "employee@xingye.test"))
    client.post(
        f"/api/v1/core-positions/{position['id']}/candidates",
        headers=auth_header(hr),
        json={"employee_id": emp_id},
    )
    resp = client.put(
        f"/api/v1/core-positions/{position['id']}/candidates/{emp_id}/willingness",
        headers=auth_header(hr),
        json={"willingness": "maybe"},
    )
    assert resp.status_code == 422


def test_position_not_found(client):
    hr = login(client, "hr@xingye.test")
    resp = client.get(
        "/api/v1/core-positions/00000000-0000-0000-0000-000000000000",
        headers=auth_header(hr),
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "core_position_not_found"


def test_talent_pool_api(client, db_session):
    hr = login(client, "hr@xingye.test")
    emp_id = str(_emp_id(db_session, "employee@xingye.test"))

    join = client.post(
        "/api/v1/talent-pools",
        headers=auth_header(hr),
        json={"employee_id": emp_id, "pool_level": "L1",
              "reason": "核心继任"},
    )
    assert join.status_code == 201, join.text
    member = join.json()
    assert member["pool_level"] == "L1"

    listing = client.get("/api/v1/talent-pools", headers=auth_header(hr))
    assert len(listing.json()) == 1

    updated = client.put(
        f"/api/v1/talent-pools/{member['id']}",
        headers=auth_header(hr),
        json={"pool_level": "L2"},
    )
    assert updated.status_code == 200
    assert updated.json()["pool_level"] == "L2"


def test_talent_pool_forbidden_for_employee(client):
    token = login(client, "employee@xingye.test")
    resp = client.get("/api/v1/talent-pools", headers=auth_header(token))
    assert resp.status_code == 403
