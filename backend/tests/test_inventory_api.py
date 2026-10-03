"""C2 盘点批次与九宫格：端点与权限。"""

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


def _create_batch(client, token, name="2026 年度盘点", purpose="annual",
                  scope=None):
    body = {"name": name, "purpose": purpose}
    if scope is not None:
        body["scope_employee_ids"] = scope
    resp = client.post(
        "/api/v1/inventory-batches", headers=auth_header(token), json=body
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _start(client, token, batch_id):
    resp = client.post(
        f"/api/v1/inventory-batches/{batch_id}/start",
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_create_batch_forbidden_for_employee(client):
    token = login(client, "employee@xingye.test")
    resp = client.post(
        "/api/v1/inventory-batches",
        headers=auth_header(token),
        json={"name": "盘点", "purpose": "annual"},
    )
    assert resp.status_code == 403


def test_full_flow_api(client, db_session):
    hr = login(client, "hr@xingye.test")
    admin = login(client, "admin@xingye.test")

    batch = _create_batch(client, hr)
    data = _start(client, hr, batch["id"])
    assert data["status"] == "calibrating"

    results = client.get(
        f"/api/v1/inventory-batches/{batch['id']}/results",
        headers=auth_header(hr),
    ).json()
    assert len(results) == 8

    for r in results:
        resp = client.put(
            f"/api/v1/inventory-batches/{batch['id']}/results/{r['employee_id']}",
            headers=auth_header(hr),
            json={"potential": "mid", "note": "校准会评定"},
        )
        assert resp.status_code == 200, resp.text
        updated = resp.json()
        assert updated["located"] is True
        assert updated["grid_code"].startswith("9")

    submit = client.post(
        f"/api/v1/inventory-batches/{batch['id']}/submit-calibration",
        headers=auth_header(hr),
    )
    assert submit.status_code == 200
    assert submit.json()["status"] == "confirming"

    confirm = client.post(
        f"/api/v1/inventory-batches/{batch['id']}/confirm",
        headers=auth_header(admin),
    )
    assert confirm.status_code == 200, resp.text
    assert confirm.json()["status"] == "published"
    assert confirm.json()["published_at"] is not None


def test_confirm_forbidden_for_hr(client, db_session):
    hr = login(client, "hr@xingye.test")
    batch = _create_batch(client, hr)
    _start(client, hr, batch["id"])
    results = client.get(
        f"/api/v1/inventory-batches/{batch['id']}/results",
        headers=auth_header(hr),
    ).json()
    for r in results:
        client.put(
            f"/api/v1/inventory-batches/{batch['id']}/results/{r['employee_id']}",
            headers=auth_header(hr),
            json={"potential": "low", "note": "评定"},
        )
    client.post(
        f"/api/v1/inventory-batches/{batch['id']}/submit-calibration",
        headers=auth_header(hr),
    )
    # HR 无权确认
    resp = client.post(
        f"/api/v1/inventory-batches/{batch['id']}/confirm",
        headers=auth_header(hr),
    )
    assert resp.status_code == 403


def test_reject_flow_api(client):
    hr = login(client, "hr@xingye.test")
    admin = login(client, "admin@xingye.test")
    batch = _create_batch(client, hr)
    _start(client, hr, batch["id"])
    client.post(
        f"/api/v1/inventory-batches/{batch['id']}/submit-calibration",
        headers=auth_header(hr),
    )
    resp = client.post(
        f"/api/v1/inventory-batches/{batch['id']}/reject",
        headers=auth_header(admin),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "calibrating"


def test_invalid_transition_409(client):
    hr = login(client, "hr@xingye.test")
    batch = _create_batch(client, hr)
    # draft 直接提交校准 → 409
    resp = client.post(
        f"/api/v1/inventory-batches/{batch['id']}/submit-calibration",
        headers=auth_header(hr),
    )
    assert resp.status_code == 409
    assert resp.json()["code"] == "invalid_inventory_transition"


def test_grid_override_without_note_422(client, db_session):
    hr = login(client, "hr@xingye.test")
    batch = _create_batch(client, hr)
    _start(client, hr, batch["id"])
    emp_id = _emp_id(db_session, "employee@xingye.test")
    resp = client.put(
        f"/api/v1/inventory-batches/{batch['id']}/results/{emp_id}",
        headers=auth_header(hr),
        json={"potential": "high", "grid_code": "9A2"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "calibration_note_required"


def test_invalid_potential_422(client, db_session):
    hr = login(client, "hr@xingye.test")
    batch = _create_batch(client, hr)
    _start(client, hr, batch["id"])
    emp_id = _emp_id(db_session, "employee@xingye.test")
    resp = client.put(
        f"/api/v1/inventory-batches/{batch['id']}/results/{emp_id}",
        headers=auth_header(hr),
        json={"potential": "super_duper", "note": "非法"},
    )
    assert resp.status_code == 422


def test_list_and_detail(client):
    hr = login(client, "hr@xingye.test")
    batch = _create_batch(client, hr, name="盘点清单测试")

    listing = client.get(
        "/api/v1/inventory-batches", headers=auth_header(hr)
    )
    assert listing.status_code == 200
    assert any(b["id"] == batch["id"] for b in listing.json())

    detail = client.get(
        f"/api/v1/inventory-batches/{batch['id']}",
        headers=auth_header(hr),
    )
    assert detail.status_code == 200
    assert detail.json()["name"] == "盘点清单测试"


def test_manager_readonly_for_subordinates(client, db_session):
    hr = login(client, "hr@xingye.test")
    mgr = login(client, "manager@xingye.test")
    batch = _create_batch(client, hr, scope=[
        str(_emp_id(db_session, "employee@xingye.test")),
    ])
    _start(client, hr, batch["id"])

    # 经理可读汇报链范围内批次
    resp = client.get(
        f"/api/v1/inventory-batches/{batch['id']}",
        headers=auth_header(mgr),
    )
    assert resp.status_code == 200

    # 经理不能启动/校准
    blocked = client.post(
        f"/api/v1/inventory-batches/{batch['id']}/start",
        headers=auth_header(mgr),
    )
    assert blocked.status_code == 403


def test_cross_tenant_forbidden(client):
    hr = login(client, "hr@xingye.test")
    batch = _create_batch(client, hr)
    t2_hr = login(client, "hr@linyuan.test")
    resp = client.get(
        f"/api/v1/inventory-batches/{batch['id']}",
        headers=auth_header(t2_hr),
    )
    assert resp.status_code == 403


def test_distribution_endpoint(client, db_session):
    hr = login(client, "hr@xingye.test")
    batch = _create_batch(client, hr)
    _start(client, hr, batch["id"])

    results = client.get(
        f"/api/v1/inventory-batches/{batch['id']}/results",
        headers=auth_header(hr),
    ).json()
    for r in results[:3]:
        client.put(
            f"/api/v1/inventory-batches/{batch['id']}/results/{r['employee_id']}",
            headers=auth_header(hr),
            json={"potential": "high", "note": "评定"},
        )

    resp = client.get(
        f"/api/v1/inventory-batches/{batch['id']}/distribution",
        headers=auth_header(hr),
    )
    assert resp.status_code == 200, resp.text
    stats = resp.json()
    assert stats["total"] == 8
    assert stats["unlocated"] == 5
    assert sum(stats["grids"].values()) == 3
