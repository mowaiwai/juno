"""组织诊断端点测试（含模块十 P3：决策大屏）。"""

from tests.conftest import auth_header, login


def test_executive_dashboard_403_for_employee(client):
    token = login(client, "employee@xingye.test")
    resp = client.get("/api/v1/org/executive-dashboard",
                        headers=auth_header(token))
    assert resp.status_code == 403


def test_executive_dashboard_ok_for_exec(client):
    token = login(client, "admin@xingye.test")  # TENANT_ADMIN 有 gap.manage
    resp = client.get("/api/v1/org/executive-dashboard",
                        headers=auth_header(token))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "year" in body
    assert "strategy" in body
    assert "org" in body
    assert "talent" in body
    assert "gap_heatmap" in body
    assert "gap_summary" in body
    assert "pipeline_health" in body
    assert "actions" in body
    assert isinstance(body["actions"], list)
    # gap_summary 至少有些字段
    summary = body["gap_summary"]
    assert "total_demand" in summary
    assert "shortage_cells" in summary
