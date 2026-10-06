from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.core.security import hash_password
from app.database import SessionLocal, get_db
from app.main import create_app
from app.models.base import Base
from app.models.employee import Employee
# 层级框架为纯增量模块：显式导入确保测试库建表
from app.models.level_framework import (
    LevelFrameworkVersion,
    TenantLevelMapping,
)
from app.models.user import Role, Tenant, User
from app.models.profile import ProfileSnapshot
from app.models.inventory import InventoryBatch, InventoryResult
from app.models.succession import (
    CorePosition,
    SuccessionCandidate,
    TalentPool,
)
# 在线考试为新增模块：显式导入确保测试库建表
from app.models.exam import (
    ExamAttempt,
    ExamPaper,
    ExamQuestion,
)
# P1 绩效内生：显式导入确保测试库建表
from app.models.perf import (
    CoachingRecord,
    PerfPlan,
    PerfResult,
    Pip,
)
from app.models.compensation import (
    AdjustmentPlan,
    BonusDeptPool,
    BonusPlan,
    BonusPlanItem,
    SalaryAdjustmentHistory,
    TenantSalaryBand,
)
# 匹配度引擎：显式导入确保测试库建表
from app.models.match import MatchTenantConfig
from app.models.user import custom_role_ref
from app.services.level_framework import seed_v1_framework
from app.services.llm import set_client_provider
from app.services.email import set_sender_provider
from app.services.org_service import seed_departments
from app.services.role_service import (
    ensure_preset_all_hr,
    grant_role,
    set_active_role,
)

from tests.fake_llm import FakeLLMClient
from tests.fake_email import RecordingEmailSender

TEST_PASSWORD = "Passw0rd!"


@pytest.fixture(scope="session")
def db_session(tmp_path_factory):
    # 举证文件落到临时目录，不污染工作区
    settings.storage_dir = str(tmp_path_factory.mktemp("storage"))

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)

    # 后台 worker 通过 SessionLocal 开新会话；测试中重定向到同一 SQLite 引擎，
    # 使 FastAPI BackgroundTasks 能读到/写入测试库
    SessionLocal.configure(bind=engine)

    # 全套件 LLM 调用走假客户端，杜绝真实网络
    set_client_provider(lambda **kwargs: FakeLLMClient())
    # 邮件走记录 sender（不触网）；是否真正调用取决于租户是否配置 SMTP
    set_sender_provider(lambda **kwargs: RecordingEmailSender())

    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSession()

    t1 = Tenant(name="星野制造")
    t2 = Tenant(name="临渊科技")
    session.add_all([t1, t2])
    session.flush()

    # 部门主数据（数据范围 subtree/assigned_depts 依赖部门树）
    seed_departments(session, t1.id)
    seed_departments(session, t2.id)
    session.flush()

    def user(tenant, email, name, role):
        return User(
            tenant_id=tenant.id,
            email=email,
            name=name,
            role=role,
            roles=[role.value],
            hashed_password=hash_password(TEST_PASSWORD),
        )

    users = {
        # HR 账号先以 EMPLOYEE 建账，随后挂租户预设「综合 HR（一人全包）」
        # 自定义角色并设为激活角色（七模板权限并集 + global，等价旧 HR）
        "t1_hr": user(t1, "hr@xingye.test", "温晚晴", Role.EMPLOYEE),
        "t1_admin": user(t1, "admin@xingye.test", "岑风眠", Role.TENANT_ADMIN),
        "t1_manager": user(t1, "manager@xingye.test", "陆行舟", Role.MANAGER),
        "t1_employee": user(t1, "employee@xingye.test", "许星遥", Role.EMPLOYEE),
        "t1_junior": user(t1, "junior@xingye.test", "许清禾", Role.EMPLOYEE),
        "t1_lowperf": user(t1, "lowperf@xingye.test", "董斯年", Role.EMPLOYEE),
        "t1_lead": user(t1, "lead@xingye.test", "江予舟", Role.LEAD_REVIEWER),
        "t1_rev1": user(t1, "rev1@xingye.test", "苏望知", Role.REVIEWER),
        "t1_rev2": user(t1, "rev2@xingye.test", "顾言溪", Role.REVIEWER),
        "t2_hr": user(t2, "hr@linyuan.test", "纪南乔", Role.EMPLOYEE),
        "t2_employee": user(t2, "employee@linyuan.test", "路之遥", Role.EMPLOYEE),
        "t1_platform_admin": user(t1, "admin@platform.test", "平台管理员",
                                  Role.PLATFORM_ADMIN),
    }
    session.add_all(users.values())
    session.flush()

    for _tenant, _hr in ((t1, users["t1_hr"]), (t2, users["t2_hr"])):
        _preset = ensure_preset_all_hr(session, _tenant.id)
        _ref = custom_role_ref(_preset.id)
        grant_role(session, _tenant.id, _hr.id, _ref)
        set_active_role(session, _tenant.id, _hr.id, _ref)
    session.flush()

    def employee(
        u, no, dept, position, family, sequence, grade, grade_since, perf, manager=None
    ):
        return Employee(
            tenant_id=u.tenant_id,
            user_id=u.id,
            employee_no=no,
            name=u.name,
            dept_id=dept,
            position=position,
            family=family,
            sequence=sequence,
            grade=grade,
            grade_since=grade_since,
            perf_grade=perf,
            manager_id=manager.id if manager else None,
            is_active=True,
        )

    mgr = employee(
        users["t1_manager"],
        "E10020", "305", "软件研发经理", "M", "MGT", "M2",
        date(2017, 9, 1), "A",
    )
    session.add(mgr)
    session.flush()

    session.add_all(
        [
            employee(
                users["t1_hr"],
                "E10002", "201", "HRD", "M", "MGT", "M3",
                date(2015, 6, 1), "A",
            ),
            employee(
                users["t1_employee"],
                "E10086", "305", "软件工程师", "P", "SW", "P3",
                date(2022, 7, 1), "B", manager=mgr,
            ),
            employee(
                users["t1_junior"],
                "E10091", "305", "初级软件工程师", "P", "SW", "P2",
                date(2026, 6, 1), "B", manager=mgr,
            ),
            employee(
                users["t1_lowperf"],
                "E10093", "305", "软件工程师", "P", "SW", "P3",
                date(2020, 3, 1), "C", manager=mgr,
            ),
            employee(
                users["t2_hr"],
                "E20001", "201", "HRD", "M", "MGT", "M3",
                date(2020, 1, 1), "A",
            ),
            employee(
                users["t2_employee"],
                "E20011", "601", "大客户经理", "S", "SAL", "S3",
                date(2023, 8, 1), "B",
            ),
            employee(
                users["t1_lead"],
                "E10005", "202", "认证评审组长", "M", "MGT", "M2",
                date(2018, 4, 1), "A",
            ),
            employee(
                users["t1_rev1"],
                "E10081", "305", "高级软件工程师（评委）", "P", "SW", "P4",
                date(2019, 7, 1), "A",
            ),
            employee(
                users["t1_rev2"],
                "E10105", "306", "高级机械工程师（评委）", "P", "ENG", "P4",
                date(2018, 9, 1), "A",
            ),
        ]
    )
    session.commit()

    # 员工已建账：绑定种子部门领导（201→E10002、305→E10020）并自动授经理角
    seed_departments(session, t1.id)
    seed_departments(session, t2.id)
    session.commit()

    # 平台资产：首个已发布框架 v1（幂等）
    seed_v1_framework(session)
    session.commit()

    yield session
    session.close()


@pytest.fixture(scope="session")
def client(db_session):
    app = create_app()

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)


def login(client, email, password=TEST_PASSWORD):
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def restore_mutable_employee_state(db_session):
    """测试间隔离：员工的可变字段（职级/起算日/绩效等）可能被业务改写，

    如发布后 grade_since 重置为今天，会让后续场景的门槛校验失败。
    每个测试前快照、结束后还原，保证用例互不污染。
    """
    # 登录限流按测试重置，避免同一账号多次登录被 429
    from app.core.rate_limit import login_limiter

    login_limiter.reset()

    snapshot = [
        (
            e,
            (
                e.grade, e.grade_since, e.perf_grade, e.manager_id, e.is_active,
                e.education, list(e.certificates or []),
                e.basic_updated_by, e.basic_updated_at,
            ),
        )
        for e in db_session.scalars(select(Employee)).all()
    ]

    # 通知/审计在测试间清理（seed 不产生这些数据）
    from app.models.notification import Notification
    from app.models.audit import AuditLog

    # 申请单快照：测试会改写状态/提交时间（如催办场景改到 6 天前），
    # 新增单（及其关联）在结束时删除，避免跨测试污染扫描
    from sqlalchemy import delete as _delete

    from app.models.ai import AISuggestion, AIUsage
    from app.models.application import Application as _App
    from app.models.review import ReviewTask
    from app.models.standard_snapshot import StandardSnapshot

    initial_app_ids = {
        a.id for a in db_session.scalars(select(_App)).all()
    }
    app_snapshot = [
        (
            a,
            (
                a.status, a.submitted_at, a.manager_id,
                a.manager_deadline_at, a.manager_reviewed_at,
                a.decided_at, a.published_at,
                a.review_locked_by, a.review_locked_until,
            ),
        )
        for a in db_session.scalars(select(_App)).all()
    ]

    notif_before = {
        n.id for n in db_session.scalars(select(Notification)).all()
    }
    audit_before = {
        a.id for a in db_session.scalars(select(AuditLog)).all()
    }

    # 层级框架基线：v1 版本保留，草稿清理；租户映射差异行清理
    fw_snapshot = [
        (v, (v.status, v.published_at))
        for v in db_session.scalars(select(LevelFrameworkVersion)).all()
    ]
    mapping_before = {
        m.id for m in db_session.scalars(select(TenantLevelMapping)).all()
    }
    profile_before = {
        p.id for p in db_session.scalars(select(ProfileSnapshot)).all()
    }
    inventory_before = {
        b.id for b in db_session.scalars(select(InventoryBatch)).all()
    }
    positions_before = {
        p.id for p in db_session.scalars(select(CorePosition)).all()
    }

    yield
    for e, values in snapshot:
        (
            e.grade, e.grade_since, e.perf_grade, e.manager_id, e.is_active,
            e.education, e.certificates,
            e.basic_updated_by, e.basic_updated_at,
        ) = values

    # 新增申请单：无 relationship 的关联表先 bulk 删，
    # 其余（自评/举证/初审/终裁）由 ORM cascade 处理
    current_apps = db_session.scalars(select(_App)).all()
    new_apps = [a for a in current_apps if a.id not in initial_app_ids]
    unrelated = (ReviewTask, StandardSnapshot, AISuggestion, AIUsage)
    for a in new_apps:
        for model in unrelated:
            db_session.execute(
                _delete(model).where(model.application_id == a.id)
            )
        db_session.delete(a)
    db_session.flush()

    # 初始已存在申请单：还原全部字段
    for a, values in app_snapshot:
        if a.id in initial_app_ids:
            (
                a.status, a.submitted_at, a.manager_id,
                a.manager_deadline_at, a.manager_reviewed_at,
                a.decided_at, a.published_at,
                a.review_locked_by, a.review_locked_until,
            ) = values
    db_session.flush()

    # 删除测试期间新增的通知与审计
    for n in db_session.scalars(select(Notification)).all():
        if n.id not in notif_before:
            db_session.delete(n)
    for a in db_session.scalars(select(AuditLog)).all():
        if a.id not in audit_before:
            db_session.delete(a)

    # 层级框架：删除新增租户映射（引用保留版本），删除草稿/新版本（级联子行）
    for m in db_session.scalars(select(TenantLevelMapping)).all():
        if m.id not in mapping_before:
            db_session.delete(m)
    db_session.flush()

    # 画像：删除测试期间新增版本（级联维度子行）
    for p in db_session.scalars(select(ProfileSnapshot)).all():
        if p.id not in profile_before:
            db_session.delete(p)
    db_session.flush()

    # 盘点：新增批次无 ORM relationship，先删结果行再删批次
    new_batches = [
        b for b in db_session.scalars(select(InventoryBatch)).all()
        if b.id not in inventory_before
    ]
    if new_batches:
        db_session.query(InventoryResult).filter(
            InventoryResult.batch_id.in_([b.id for b in new_batches])
        ).delete(synchronize_session=False)
        for b in new_batches:
            db_session.delete(b)
    db_session.flush()

    # 核心岗位：新增岗位先删候选行再删岗位；梯队池全量清理（seed 不产生）
    new_positions = [
        p for p in db_session.scalars(select(CorePosition)).all()
        if p.id not in positions_before
    ]
    if new_positions:
        db_session.query(SuccessionCandidate).filter(
            SuccessionCandidate.core_position_id.in_(
                [p.id for p in new_positions]
            )
        ).delete(synchronize_session=False)
        for p in new_positions:
            db_session.delete(p)
    db_session.query(TalentPool).delete(synchronize_session=False)
    db_session.flush()
    keep_ids = {v.id for v, _ in fw_snapshot}
    for v in db_session.scalars(select(LevelFrameworkVersion)).all():
        if v.id not in keep_ids:
            db_session.delete(v)
    db_session.flush()
    # 基线版本还原状态（如发布导致旧版被归档）
    for v, values in fw_snapshot:
        v.status, v.published_at = values

    # 绩效内生：P1 新表为纯增量，测试期间新增行全量清理（顺序避外键）
    db_session.query(CoachingRecord).delete(synchronize_session=False)
    db_session.query(Pip).delete(synchronize_session=False)
    db_session.query(PerfResult).delete(synchronize_session=False)
    db_session.query(PerfPlan).delete(synchronize_session=False)
    # 薪酬激励：P2 新表全量清理（顺序避外键）
    db_session.query(SalaryAdjustmentHistory).delete(synchronize_session=False)
    db_session.query(BonusPlanItem).delete(synchronize_session=False)
    db_session.query(BonusDeptPool).delete(synchronize_session=False)
    db_session.query(BonusPlan).delete(synchronize_session=False)
    db_session.query(AdjustmentPlan).delete(synchronize_session=False)
    db_session.query(TenantSalaryBand).delete(synchronize_session=False)
    # 匹配度引擎：租户配置为纯增量表，测试期间新增行全量清理
    db_session.query(MatchTenantConfig).delete(synchronize_session=False)
    db_session.flush()

    db_session.commit()
