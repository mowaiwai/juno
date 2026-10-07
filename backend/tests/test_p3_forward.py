"""P3 远期能力端点测试：岗位价值评估 / 激励记录 / 问卷 / 判断辅助 / 五体系全景。"""
from sqlalchemy import select

from app.models.employee import Employee

from tests.conftest import auth_header, login


def _hr(client):
    return login(client, "hr@xingye.test")


class TestJobEvaluation:
    def test_default_factors(self, client):
        r = client.get("/api/v1/p3/job-eval/default-factors")
        assert r.status_code == 200
        assert len(r.json()) == 5

    def test_create_and_list(self, client):
        tok = _hr(client)
        r = client.post(
            "/api/v1/p3/job-evals",
            headers=auth_header(tok),
            json={
                "position_name": "高级后端工程师",
                "dept_id": "300",
                "factor_scores": [
                    {"key": "knowledge", "score": 4, "weight": 0.25},
                    {"key": "responsibility", "score": 3, "weight": 0.25},
                    {"key": "complexity", "score": 4, "weight": 0.20},
                    {"key": "conditions", "score": 2, "weight": 0.10},
                    {"key": "impact", "score": 3, "weight": 0.20},
                ],
                "grade": "P3",
                "notes": "点因素法评估",
            },
        )
        assert r.status_code == 201, r.text
        data = r.json()
        assert data["position_name"] == "高级后端工程师"
        expected = 4 * 0.25 + 3 * 0.25 + 4 * 0.20 + 2 * 0.10 + 3 * 0.20
        assert abs(data["total_score"] - expected) < 0.01
        assert data["grade"] == "P3"

        r2 = client.get("/api/v1/p3/job-evals", headers=auth_header(tok))
        assert len(r2.json()) >= 1

    def test_update(self, client):
        tok = _hr(client)
        r = client.post(
            "/api/v1/p3/job-evals",
            headers=auth_header(tok),
            json={"position_name": "测试岗", "factor_scores": [{"key": "knowledge", "score": 3, "weight": 1.0}]},
        )
        eid = r.json()["id"]

        r2 = client.put(
            f"/api/v1/p3/job-evals/{eid}",
            headers=auth_header(tok),
            json={"grade": "P2", "factor_scores": [{"key": "knowledge", "score": 5, "weight": 1.0}]},
        )
        assert r2.status_code == 200
        assert r2.json()["grade"] == "P2"
        assert r2.json()["total_score"] == 5.0

    def test_delete(self, client):
        tok = _hr(client)
        r = client.post(
            "/api/v1/p3/job-evals",
            headers=auth_header(tok),
            json={"position_name": "待删", "factor_scores": [{"key": "knowledge", "score": 1, "weight": 1.0}]},
        )
        eid = r.json()["id"]
        r2 = client.delete(f"/api/v1/p3/job-evals/{eid}", headers=auth_header(tok))
        assert r2.status_code == 204

    def test_forbidden_for_employee(self, client):
        tok = login(client, "employee@xingye.test")
        r = client.get("/api/v1/p3/job-evals", headers=auth_header(tok))
        assert r.status_code == 403


class TestIncentive:
    def test_crud(self, client, db_session):
        tok = _hr(client)
        emp = db_session.scalar(select(Employee).limit(1))
        assert emp is not None

        r = client.post(
            "/api/v1/p3/incentives",
            headers=auth_header(tok),
            json={
                "employee_id": str(emp.id),
                "category": "benefit",
                "item_name": "住房补贴",
                "amount": 2000,
                "currency": "CNY",
            },
        )
        assert r.status_code == 201, r.text
        iid = r.json()["id"]

        r2 = client.get(f"/api/v1/p3/incentives?employee_id={emp.id}", headers=auth_header(tok))
        assert any(i["id"] == iid for i in r2.json())

        r3 = client.put(f"/api/v1/p3/incentives/{iid}", headers=auth_header(tok), json={"status": "expired"})
        assert r3.json()["status"] == "expired"

        r4 = client.delete(f"/api/v1/p3/incentives/{iid}", headers=auth_header(tok))
        assert r4.status_code == 204


class TestQuestionnaire:
    def test_generate_rule_based(self, client):
        tok = _hr(client)
        r = client.post(
            "/api/v1/p3/questionnaires/generate",
            headers=auth_header(tok),
            json={"title": "2026 年度盘点问卷", "q_type": "inventory", "focus": "领导力"},
        )
        assert r.status_code == 201, r.text
        data = r.json()
        assert data["q_type"] == "inventory"
        assert len(data["questions"]) >= 3
        assert data["source"] == "rule_based"

    def test_list(self, client):
        tok = _hr(client)
        r = client.get("/api/v1/p3/questionnaires", headers=auth_header(tok))
        assert r.status_code == 200


class TestPanorama:
    def test_summary(self, client):
        tok = _hr(client)
        r = client.get("/api/v1/p3/panorama/summary", headers=auth_header(tok))
        assert r.status_code == 200
        data = r.json()
        assert "systems" in data
        assert len(data["systems"]) == 5
        assert "total_employees" in data


class TestJudgment:
    def test_salary_eligibility_not_found(self, client):
        import uuid
        tok = _hr(client)
        r = client.get(
            f"/api/v1/p3/judge/salary-adjust-eligibility/{uuid.uuid4()}",
            headers=auth_header(tok),
        )
        assert r.status_code == 404

    def test_salary_eligibility_found(self, client, db_session):
        tok = _hr(client)
        emp = db_session.scalar(select(Employee).limit(1))
        r = client.get(
            f"/api/v1/p3/judge/salary-adjust-eligibility/{emp.id}",
            headers=auth_header(tok),
        )
        assert r.status_code == 200
        data = r.json()
        assert "eligible" in data
        assert "reasons" in data
