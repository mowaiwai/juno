"""招聘主流程端点测试：创建需求/投递候选人/阶段流转/入职/漏斗。"""

import uuid

import pytest

from app.models.employee import Employee
from app.models.recruit import Candidate
from app.models.user import User
from tests.conftest import auth_header, login


def _create_req(client, token, **kw):
    payload = {
        "position": "后端工程师",
        "dept_id": "305",
        "grade": "P4",
        "headcount": 2,
        "owner": "温晚晴",
        "priority": "high",
    }
    payload.update(kw)
    return client.post(
        "/api/v1/requisitions", json=payload, headers=auth_header(token)
    )


def _create_cand(client, token, req_id, **kw):
    payload = {
        "req_id": str(req_id),
        "name": "沈知夏",
        "source": "内推",
        "years": 3,
        "last_title": "高级工程师",
        "expected_salary": 25000,
        "tags": ["Python", "分布式"],
    }
    payload.update(kw)
    return client.post(
        "/api/v1/candidates", json=payload, headers=auth_header(token)
    )


@pytest.fixture
def hr_token(client):
    return login(client, "hr@xingye.test")


@pytest.fixture
def emp_token(client):
    return login(client, "employee@xingye.test")


@pytest.fixture
def t2_hr_token(client):
    return login(client, "hr@linyuan.test")


# --- 创建需求 ---------------------------------------------------------------

def test_create_requisition_ok(client, hr_token):
    resp = _create_req(client, hr_token)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["position"] == "后端工程师"
    assert data["dept_id"] == "305"
    assert data["headcount"] == 2
    assert data["priority"] == "high"
    assert data["funnel"] == [0, 0, 0, 0, 0]


def test_create_requisition_dept_not_found(client, hr_token):
    resp = _create_req(client, hr_token, dept_id="999")
    assert resp.status_code == 404


def test_create_requisition_forbidden_for_employee(client, emp_token):
    resp = _create_req(client, emp_token)
    assert resp.status_code == 403


# --- 投递候选人 -------------------------------------------------------------

def test_create_candidate_ok(client, hr_token):
    req_id = _create_req(client, hr_token).json()["id"]
    resp = _create_cand(client, hr_token, req_id)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["name"] == "沈知夏"
    assert data["stage"] == "screen"
    assert data["match_score"] == 0
    assert data["tags"] == ["Python", "分布式"]


def test_create_candidate_req_cross_tenant(client, hr_token, t2_hr_token):
    # tenant2 HR 创建需求，tenant1 HR 投递 → 404
    req_id = _create_req(client, t2_hr_token, dept_id="201").json()["id"]
    resp = _create_cand(client, hr_token, req_id)
    assert resp.status_code == 404


# --- 阶段流转 ---------------------------------------------------------------

def test_stage_transition_pipeline(client, hr_token):
    req_id = _create_req(client, hr_token).json()["id"]
    cand_id = _create_cand(client, hr_token, req_id).json()["id"]
    for stage in ["first", "final", "offer"]:
        resp = client.put(
            f"/api/v1/candidates/{cand_id}/stage",
            json={"stage": stage},
            headers=auth_header(hr_token),
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["stage"] == stage


def test_stage_reject(client, hr_token):
    req_id = _create_req(client, hr_token).json()["id"]
    cand_id = _create_cand(client, hr_token, req_id, name="淘汰候选人").json()["id"]
    resp = client.put(
        f"/api/v1/candidates/{cand_id}/stage",
        json={"stage": "rejected"},
        headers=auth_header(hr_token),
    )
    assert resp.status_code == 200
    assert resp.json()["stage"] == "rejected"


def test_stage_cannot_back_to_screen(client, hr_token):
    req_id = _create_req(client, hr_token).json()["id"]
    cand_id = _create_cand(client, hr_token, req_id).json()["id"]
    resp = client.put(
        f"/api/v1/candidates/{cand_id}/stage",
        json={"stage": "screen"},
        headers=auth_header(hr_token),
    )
    assert resp.status_code == 422


def test_stage_cross_tenant_404(client, hr_token, t2_hr_token):
    req_id = _create_req(client, t2_hr_token, dept_id="201").json()["id"]
    cand_id = _create_cand(client, t2_hr_token, req_id).json()["id"]
    resp = client.put(
        f"/api/v1/candidates/{cand_id}/stage",
        json={"stage": "first"},
        headers=auth_header(hr_token),
    )
    assert resp.status_code == 404


# --- 入职 -------------------------------------------------------------------

def test_onboard_creates_user_and_employee(client, hr_token, db_session):
    req_id = _create_req(client, hr_token).json()["id"]
    cand_id = _create_cand(client, hr_token, req_id).json()["id"]
    resp = client.post(
        f"/api/v1/candidates/{cand_id}/onboard",
        headers=auth_header(hr_token),
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["candidate_id"] == cand_id
    assert data["employee_no"].startswith("E")
    assert data["user_id"]

    # 校验 User + Employee 已创建
    emp = db_session.get(Employee, uuid.UUID(data["employee_id"]))
    assert emp is not None
    assert emp.name == "沈知夏"
    assert emp.dept_id == "305"
    assert emp.position == "后端工程师"
    assert emp.grade == "P4"
    user = db_session.get(User, uuid.UUID(data["user_id"]))
    assert user is not None
    assert user.email.endswith("@juno.new")
    assert user.role.value == "employee"

    # 候选人 stage 已变更
    cand = db_session.get(Candidate, uuid.UUID(cand_id))
    assert cand.stage.value == "onboard"


def test_onboard_duplicate_409(client, hr_token):
    req_id = _create_req(client, hr_token).json()["id"]
    cand_id = _create_cand(client, hr_token, req_id).json()["id"]
    client.post(f"/api/v1/candidates/{cand_id}/onboard", headers=auth_header(hr_token))
    resp = client.post(
        f"/api/v1/candidates/{cand_id}/onboard", headers=auth_header(hr_token)
    )
    assert resp.status_code == 409


def test_onboard_cross_tenant_404(client, hr_token, t2_hr_token):
    req_id = _create_req(client, t2_hr_token, dept_id="201").json()["id"]
    cand_id = _create_cand(client, t2_hr_token, req_id).json()["id"]
    resp = client.post(
        f"/api/v1/candidates/{cand_id}/onboard", headers=auth_header(hr_token)
    )
    assert resp.status_code == 404


# --- 漏斗实时计算 -----------------------------------------------------------

def test_funnel_realtime(client, hr_token):
    req_id = _create_req(client, hr_token).json()["id"]
    # 三个候选人：screen / first / offer
    _create_cand(client, hr_token, req_id, name="漏斗A")
    c2 = _create_cand(client, hr_token, req_id, name="漏斗B").json()["id"]
    c3 = _create_cand(client, hr_token, req_id, name="漏斗C").json()["id"]
    client.put(f"/api/v1/candidates/{c2}/stage", json={"stage": "first"},
               headers=auth_header(hr_token))
    client.put(f"/api/v1/candidates/{c3}/stage", json={"stage": "offer"},
               headers=auth_header(hr_token))

    resp = client.get("/api/v1/requisitions", headers=auth_header(hr_token))
    assert resp.status_code == 200
    req = next(r for r in resp.json() if r["id"] == req_id)
    # [screen, first, final, offer, onboard]
    assert req["funnel"] == [1, 1, 0, 1, 0]
