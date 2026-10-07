"""离职风险预警端点测试（显式信号规则 + 分档）。"""
from tests.conftest import auth_header, login


def _hr(client):
    return login(client, "hr@xingye.test")


class TestTurnoverConfig:
    def test_default_config(self, client):
        tok = _hr(client)
        r = client.get("/api/v1/p3/turnover/config", headers=auth_header(tok))
        assert r.status_code == 200
        data = r.json()
        assert data["is_default"] is True
        assert "low_perf" in data["weights"]
        assert data["thresholds"]["stale_raise_months"] == 18

    def test_update_config(self, client):
        tok = _hr(client)
        r = client.put(
            "/api/v1/p3/turnover/config",
            headers=auth_header(tok),
            json={"thresholds": {"stale_promotion_months": 0}},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["is_default"] is False
        # 合并而非覆盖：其他默认键保留
        assert data["thresholds"]["stale_promotion_months"] == 0
        assert "stale_raise_months" in data["thresholds"]

    def test_forbidden_for_employee(self, client):
        tok = login(client, "employee@xingye.test")
        r = client.get("/api/v1/p3/turnover/config", headers=auth_header(tok))
        assert r.status_code == 403


class TestTurnoverRisks:
    def test_report_structure(self, client):
        tok = _hr(client)
        r = client.get("/api/v1/p3/turnover/risks", headers=auth_header(tok))
        assert r.status_code == 200
        data = r.json()
        assert data["engine"] == "rule_based"
        assert "非概率预测" in data["disclaimer"]
        assert {"high", "medium", "low", "total_scanned"} <= set(data["summary"].keys())
        assert data["summary"]["total_scanned"] >= 1
        # 无概率字段，只有分档
        for item in data["items"]:
            assert item["bucket"] in ("low", "medium", "high")
            assert "probability" not in item

    def test_signals_fire_with_low_thresholds(self, client):
        tok = _hr(client)
        # 职级停留阈值归零：每个员工都应触发 stale_promotion
        client.put(
            "/api/v1/p3/turnover/config",
            headers=auth_header(tok),
            json={"thresholds": {"stale_promotion_months": 0}, "buckets": {"medium": 1, "high": 99}},
        )
        r = client.get("/api/v1/p3/turnover/risks", headers=auth_header(tok))
        items = r.json()["items"]
        assert items, "至少有在职员工"
        triggered = [
            it for it in items
            if any(s["key"] == "stale_promotion" for s in it["signals"])
        ]
        assert len(triggered) == len(items)
        # 阈值 1：命中 1 个信号即中风险
        assert all(it["bucket"] in ("medium", "high") for it in items)

    def test_bucket_filter(self, client):
        tok = _hr(client)
        r = client.get("/api/v1/p3/turnover/risks?bucket=high", headers=auth_header(tok))
        assert r.status_code == 200
        for it in r.json()["items"]:
            assert it["bucket"] == "high"

    def test_invalid_bucket_rejected(self, client):
        tok = _hr(client)
        r = client.get("/api/v1/p3/turnover/risks?bucket=urgent", headers=auth_header(tok))
        assert r.status_code == 422
