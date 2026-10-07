"""绩效管理标准库 API 测试：考核指标 CRUD + 等级定义 + 校准规则。"""
import uuid

from tests.conftest import auth_header, login


def test_standards_aggregated_view(client, db_session):
    hr = login(client, "hr@xingye.test")
    resp = client.get("/api/v1/perf/standards", headers=auth_header(hr))
    assert resp.status_code == 200
    data = resp.json()
    assert "indicators" in data
    assert "grades" in data
    assert "calibration_rules" in data
    grades = data["grades"]
    assert [g["grade"] for g in grades] == ["S", "A", "B", "C", "D"]
    s_grade = next(g for g in grades if g["grade"] == "S")
    assert s_grade["label"] == "卓越"
    assert s_grade["cutoff"] == 95
    assert s_grade["coefficient"] == 1.5
    assert data["calibration_rules"][0]["title"] == "建议分布"


def test_indicator_crud(client, db_session):
    hr = login(client, "hr@xingye.test")
    # 创建
    resp = client.post("/api/v1/perf/standards/indicators", json={
        "name": "营收达成率", "type": "kpi", "sequence_codes": ["SW", "SAL"],
        "weight_min": 40, "weight_max": 60, "data_source": "经营系统",
    }, headers=auth_header(hr))
    assert resp.status_code == 201
    ind = resp.json()
    assert ind["type"] == "kpi"
    assert ind["sequence_codes"] == ["SW", "SAL"]

    # 列表
    resp = client.get("/api/v1/perf/standards/indicators", headers=auth_header(hr))
    assert resp.status_code == 200
    assert len(resp.json()) >= 1

    # 按类型过滤
    resp = client.get("/api/v1/perf/standards/indicators?type=okr", headers=auth_header(hr))
    assert all(r["type"] == "okr" for r in resp.json())

    # 更新
    resp = client.put(f"/api/v1/perf/standards/indicators/{ind['id']}", json={
        "name": "营收 / 利润达成率", "weight_max": 65,
    }, headers=auth_header(hr))
    assert resp.status_code == 200
    assert resp.json()["name"] == "营收 / 利润达成率"
    assert resp.json()["weight_max"] == 65

    # 删除
    resp = client.delete(f"/api/v1/perf/standards/indicators/{ind['id']}", headers=auth_header(hr))
    assert resp.status_code == 204
    resp = client.get("/api/v1/perf/standards/indicators", headers=auth_header(hr))
    assert all(r["id"] != ind["id"] for r in resp.json())


def test_indicator_cross_tenant_404(client, db_session):
    hr = login(client, "hr@xingye.test")
    t2 = login(client, "hr@linyuan.test")
    ind = client.post("/api/v1/perf/standards/indicators", json={
        "name": "跨租户指标", "type": "value",
    }, headers=auth_header(t2)).json()
    resp = client.put(f"/api/v1/perf/standards/indicators/{ind['id']}", json={
        "name": "越权修改",
    }, headers=auth_header(hr))
    assert resp.status_code == 404
    resp = client.delete(f"/api/v1/perf/standards/indicators/{ind['id']}", headers=auth_header(hr))
    assert resp.status_code == 404


def test_indicator_invalid_type(client, db_session):
    hr = login(client, "hr@xingye.test")
    resp = client.post("/api/v1/perf/standards/indicators", json={
        "name": "非法类型", "type": "bogus",
    }, headers=auth_header(hr))
    assert resp.status_code == 422


def test_calibration_rules_update(client, db_session):
    hr = login(client, "hr@xingye.test")
    new_rules = [
        {"title": "自定义规则一", "desc": "这是租户自定义的校准规则。"},
        {"title": "自定义规则二", "desc": "另一条规则。"},
    ]
    resp = client.put("/api/v1/perf/standards/calibration-rules", json={"rules": new_rules}, headers=auth_header(hr))
    assert resp.status_code == 200
    assert [r["title"] for r in resp.json()] == ["自定义规则一", "自定义规则二"]
    # 聚合视图也应反映
    data = client.get("/api/v1/perf/standards", headers=auth_header(hr)).json()
    assert data["calibration_rules"][0]["title"] == "自定义规则一"


def test_calibration_rules_reset_to_default(client, db_session):
    hr = login(client, "hr@xingye.test")
    client.put("/api/v1/perf/standards/calibration-rules", json={"rules": []}, headers=auth_header(hr))
    resp = client.get("/api/v1/perf/standards/calibration-rules", headers=auth_header(hr))
    assert resp.status_code == 200
    assert resp.json()[0]["title"] == "建议分布"


def test_grade_constants_reflected_in_standards(client, db_session):
    """修改 SABC 常量后，standards 聚合的等级定义应同步。"""
    hr = login(client, "hr@xingye.test")
    client.put("/api/v1/perf/constants", json={"coefficients": {"S": 2.0}}, headers=auth_header(hr))
    data = client.get("/api/v1/perf/standards", headers=auth_header(hr)).json()
    s_grade = next(g for g in data["grades"] if g["grade"] == "S")
    assert s_grade["coefficient"] == 2.0
