"""人才发展模块 API 测试：培训管理 / 经验萃取库 / 学习地图。"""
from tests.conftest import auth_header, login


def test_course_crud(client, db_session):
    hr = login(client, "hr@xingye.test")
    # 创建
    resp = client.post("/api/v1/training/courses", json={
        "name": "P4 认证知识串讲", "type": "bootcamp", "category": "任职资格",
        "instructor_name": "江予安", "hours": 24, "enrolled": 18, "completion": 62,
        "status": "ongoing", "started_at": "2026-09-02",
    }, headers=auth_header(hr))
    assert resp.status_code == 201
    course = resp.json()
    assert course["type"] == "bootcamp"
    assert course["completion"] == 62

    # 列表 + 过滤
    resp = client.get("/api/v1/training/courses", headers=auth_header(hr))
    assert resp.status_code == 200
    assert len(resp.json()) >= 1
    resp = client.get("/api/v1/training/courses?type=bootcamp", headers=auth_header(hr))
    assert all(r["type"] == "bootcamp" for r in resp.json())

    # 更新
    resp = client.put(f"/api/v1/training/courses/{course['id']}", json={
        "completion": 80, "status": "completed",
    }, headers=auth_header(hr))
    assert resp.status_code == 200
    body = resp.json()
    assert body["completion"] == 80
    assert body["status"] == "completed"

    # 删除
    resp = client.delete(f"/api/v1/training/courses/{course['id']}", headers=auth_header(hr))
    assert resp.status_code == 204


def test_instructor_crud_and_onboarding(client, db_session):
    hr = login(client, "hr@xingye.test")
    resp = client.post("/api/v1/training/instructors", json={
        "name": "江予安", "field": "软件架构", "rating": 4.8, "internal": True,
    }, headers=auth_header(hr))
    assert resp.status_code == 201
    inst = resp.json()
    assert inst["rating"] == 4.8

    resp = client.get("/api/v1/training/instructors", headers=auth_header(hr))
    assert resp.status_code == 200
    assert len(resp.json()) >= 1

    resp = client.put(f"/api/v1/training/instructors/{inst['id']}", json={
        "field": "分布式系统",
    }, headers=auth_header(hr))
    assert resp.status_code == 200
    assert resp.json()["field"] == "分布式系统"

    # 新员工 180 天路径
    resp = client.get("/api/v1/training/onboarding", headers=auth_header(hr))
    assert resp.status_code == 200
    path = resp.json()
    assert len(path) == 5
    assert "入职引导" in path[0]["stage"]

    resp = client.delete(f"/api/v1/training/instructors/{inst['id']}", headers=auth_header(hr))
    assert resp.status_code == 204


def test_knowledge_crud_and_publish(client, db_session):
    hr = login(client, "hr@xingye.test")
    resp = client.post("/api/v1/training/knowledge", json={
        "title": "核心系统性能优化 8 步法", "category": "软件研发",
        "author": "江予安", "way": "interview", "status": "draft",
        "summary": "从基线压测到链路拆解的可复用流程。",
    }, headers=auth_header(hr))
    assert resp.status_code == 201
    item = resp.json()
    assert item["status"] == "draft"

    # 列表过滤
    resp = client.get("/api/v1/training/knowledge?status=draft", headers=auth_header(hr))
    assert all(r["status"] == "draft" for r in resp.json())

    # 发布
    resp = client.post(f"/api/v1/training/knowledge/{item['id']}/publish", headers=auth_header(hr))
    assert resp.status_code == 200
    assert resp.json()["status"] == "published"

    # 更新 + 删除
    resp = client.put(f"/api/v1/training/knowledge/{item['id']}", json={
        "summary": "更新后的摘要。",
    }, headers=auth_header(hr))
    assert resp.json()["summary"] == "更新后的摘要。"

    resp = client.delete(f"/api/v1/training/knowledge/{item['id']}", headers=auth_header(hr))
    assert resp.status_code == 204


def test_learning_path_crud_and_filter(client, db_session):
    hr = login(client, "hr@xingye.test")
    resp = client.post("/api/v1/training/learning-paths", json={
        "position": "软件研发工程师", "grade": "P4",
        "course_name": "分布式系统基础", "learn_type": 1, "mastery": 3,
        "exam_mode": "问答题", "duration": "24h",
    }, headers=auth_header(hr))
    assert resp.status_code == 201
    lp = resp.json()
    assert lp["learn_type"] == 1
    assert lp["mastery"] == 3

    # 列表 + 按岗位过滤
    resp = client.get("/api/v1/training/learning-paths", headers=auth_header(hr))
    assert len(resp.json()) >= 1
    resp = client.get("/api/v1/training/learning-paths?position=软件研发工程师", headers=auth_header(hr))
    assert all(r["position"] == "软件研发工程师" for r in resp.json())

    resp = client.put(f"/api/v1/training/learning-paths/{lp['id']}", json={
        "mastery": 4, "exam_mode": "答辩",
    }, headers=auth_header(hr))
    assert resp.json()["mastery"] == 4
    assert resp.json()["exam_mode"] == "答辩"

    resp = client.delete(f"/api/v1/training/learning-paths/{lp['id']}", headers=auth_header(hr))
    assert resp.status_code == 204


def test_cross_tenant_isolation(client, db_session):
    hr = login(client, "hr@xingye.test")
    t2 = login(client, "hr@linyuan.test")
    course = client.post("/api/v1/training/courses", json={
        "name": "林远内部课程", "type": "internal", "category": "新人融入",
        "instructor_name": "讲师A", "hours": 8,
    }, headers=auth_header(t2)).json()
    resp = client.put(f"/api/v1/training/courses/{course['id']}", json={
        "name": "越权修改",
    }, headers=auth_header(hr))
    assert resp.status_code == 404
    resp = client.delete(f"/api/v1/training/courses/{course['id']}", headers=auth_header(hr))
    assert resp.status_code == 404


def test_invalid_enum_rejected(client, db_session):
    hr = login(client, "hr@xingye.test")
    resp = client.post("/api/v1/training/courses", json={
        "name": "非法类型", "type": "bogus", "category": "x",
        "instructor_name": "x",
    }, headers=auth_header(hr))
    assert resp.status_code == 422
    resp = client.post("/api/v1/training/knowledge", json={
        "title": "非法方式", "category": "x", "author": "x", "way": "bogus",
    }, headers=auth_header(hr))
    assert resp.status_code == 422
    resp = client.post("/api/v1/training/learning-paths", json={
        "position": "x", "grade": "P1", "course_name": "x",
        "learn_type": 9, "mastery": 2, "exam_mode": "x",
    }, headers=auth_header(hr))
    assert resp.status_code == 422
