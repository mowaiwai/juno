"""虚拟第一租户种子数据。

在 backend 目录执行（.env 指向本地 PostgreSQL）：
    python seed_data.py
幂等：若租户「星野制造」已存在则跳过；加 --reset 先删除该租户全部数据再重建。

账号（密码统一 Juno12345）：
    hr@juno.test        综合 HR（一人全包，租户预设自定义角色）
    admin@juno.test     租户管理员
    exec@juno.test      高管
    manager@juno.test   部门经理（陆行舟）
    lead@juno.test      评审组长
    rev1@juno.test      评委
    rev2@juno.test      评委
    employee@juno.test  员工（许星遥，P3，可申 P4）
    junior@juno.test    新人（P2）
    lowperf@juno.test   绩效 C（不可申请）
"""

import sys
from datetime import date, datetime, timezone

from sqlalchemy import delete, select

from app.core.security import hash_password
from app.database import SessionLocal
from app.models.application import (
    Application, Decision, Evidence, ManagerReview, SelfAssessment,
)
from app.models.ai import AISuggestion, AIUsage
from app.models.audit import AuditLog
from app.models.employee import Employee
from app.models.gap import Gap, GapAction, GapDimension, GapSeverity
from app.models.idp import IDP
from app.models.inventory import InventoryBatch, InventoryResult
from app.models.org_diagnosis import LiquidProject, LiquidProjectStatus
from app.models.recruit import (
    Candidate,
    CandStage,
    InterviewQuestion,
    InterviewRecord,
    QuestionSource,
    QuestionStatus,
    Requisition,
)
from app.models.notification import Notification
from app.models.profile import ProfileDimension, ProfileSnapshot
from app.models.review import ReviewPanelTemplate, ReviewTask
from app.models.standard import StandardSet, StandardStatus, StandardItem
from app.models.standard_snapshot import StandardSnapshot
from app.models.succession import CorePosition, SuccessionCandidate, TalentPool
from app.models.tenant_config import TenantConfig
from app.models.compensation import TenantSalaryBand
from app.models.org import Department
from app.models.role_def import RoleScope, TenantRole
from app.models.user import Role, Tenant, User, custom_role_ref
from app.services.level_framework import seed_v1_framework
from app.services.org_service import seed_departments
from app.services.role_service import ensure_preset_all_hr

TENANT_NAME = "星野制造"
PASSWORD = "Juno12345"


def create_published_set(session, tenant_id, sequence, grade, items, now):
    standard_set = StandardSet(
        tenant_id=tenant_id,
        sequence=sequence,
        target_grade=grade,
        version=1,
        status=StandardStatus.PUBLISHED,
        published_at=now,
    )
    session.add(standard_set)
    session.flush()
    for i, (code, name, description, requirement, weight) in enumerate(items):
        session.add(
            StandardItem(
                standard_set_id=standard_set.id,
                code=code,
                name=name,
                description=description,
                requirement=requirement,
                weight=weight,
                sort_order=i,
            )
        )


def seed(session) -> None:
    # 平台全局资产：首个已发布层级框架（幂等），与租户数据独立
    if seed_v1_framework(session) is not None:
        session.commit()
        print("平台资产：层级框架 v1 已发布")

    existing = session.scalar(select(Tenant).where(Tenant.name == TENANT_NAME))
    if existing:
        if "--reset" not in sys.argv:
            print(f"租户 {TENANT_NAME} 已存在，跳过（--reset 可重建）")
            return
        reset_tenant(session, existing)
        tenant = existing
    else:
        tenant = Tenant(name=TENANT_NAME)
        session.add(tenant)
        session.flush()

    now = datetime.now(timezone.utc)

    # 部门树扶正（员工建账前先有部门主数据；领导在员工创建后绑定）
    seed_departments(session, tenant.id)
    session.flush()

    # 综合 HR 预设自定义角色（七模板权限并集 + global）
    preset_all_hr = ensure_preset_all_hr(session, tenant.id)
    all_hr_ref = custom_role_ref(preset_all_hr.id)

    def make_user(email: str, name: str, role: Role,
                  extra_roles: list[Role] | None = None,
                  role_refs: list[str] | None = None,
                  active_role_ref: str | None = None) -> User:
        if role_refs is None:
            role_refs = [role.value] + [r.value for r in (extra_roles or [])]
        u = User(
            tenant_id=tenant.id,
            email=email,
            name=name,
            role=role,
            roles=role_refs,
            active_role_ref=active_role_ref,
            hashed_password=hash_password(PASSWORD),
        )
        session.add(u)
        return u

    hr_user = make_user(
        "hr@juno.test", "温晚晴", Role.EMPLOYEE,
        role_refs=[Role.EMPLOYEE.value, all_hr_ref],
        active_role_ref=all_hr_ref,
    )
    make_user("admin@juno.test", "岑风眠", Role.TENANT_ADMIN)
    exec_user = make_user("exec@juno.test", "谢临渊", Role.EXECUTIVE)
    # 陆行舟：经理 + 评委，演示多角色视角切换
    mgr_user = make_user("manager@juno.test", "陆行舟", Role.MANAGER,
                         extra_roles=[Role.REVIEWER])
    lead_user = make_user("lead@juno.test", "江予舟", Role.LEAD_REVIEWER)
    rev1_user = make_user("rev1@juno.test", "苏望知", Role.REVIEWER)
    rev2_user = make_user("rev2@juno.test", "顾言溪", Role.REVIEWER)
    emp_user = make_user("employee@juno.test", "许星遥", Role.EMPLOYEE)
    junior_user = make_user("junior@juno.test", "许清禾", Role.EMPLOYEE)
    lowperf_user = make_user("lowperf@juno.test", "董斯年", Role.EMPLOYEE)
    session.flush()

    def make_employee(u: User, no: str, dept: str, position: str, family: str,
                      sequence: str, grade: str, grade_since: date, perf: str,
                      manager: Employee | None = None) -> Employee:
        e = Employee(
            tenant_id=tenant.id,
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
        session.add(e)
        return e

    mgr_emp = make_employee(
        mgr_user, "E10020", "305", "软件研发经理", "M", "MGT", "M2",
        date(2017, 9, 1), "A",
    )
    session.flush()

    lead_emp = make_employee(
        lead_user, "E10005", "202", "认证评审组长", "M", "MGT", "M2",
        date(2018, 4, 1), "A",
    )
    rev1_emp = make_employee(
        rev1_user, "E10081", "305", "高级软件工程师（评委）", "P", "SW", "P4",
        date(2019, 7, 1), "A", manager=mgr_emp,
    )
    rev2_emp = make_employee(
        rev2_user, "E10082", "306", "高级机械工程师（评委）", "P", "ENG", "P4",
        date(2018, 9, 1), "A",
    )
    make_employee(
        hr_user, "E10002", "201", "HRD", "M", "MGT", "M3",
        date(2015, 6, 1), "A",
    )
    make_employee(
        exec_user, "E10001", "101", "总经理", "M", "MGT", "M4",
        date(2012, 3, 1), "A",
    )
    emp_emp = make_employee(
        emp_user, "E10086", "305", "软件工程师", "P", "SW", "P3",
        date(2022, 7, 1), "B", manager=mgr_emp,
    )
    make_employee(
        junior_user, "E10091", "305", "初级软件工程师", "P", "SW", "P2",
        date(2026, 6, 1), "B", manager=mgr_emp,
    )
    make_employee(
        lowperf_user, "E10093", "305", "软件工程师", "P", "SW", "P3",
        date(2020, 3, 1), "C", manager=mgr_emp,
    )
    session.flush()
    # 员工已建账：绑定种子部门领导（E10002→201、E10020→305）并自动授经理角
    seed_departments(session, tenant.id)
    session.flush()
    lowperf_emp = session.scalar(
        select(Employee).where(Employee.user_id == lowperf_user.id)
    )

    # 已发布标准集：SW/P4（5 项权重合计 100）
    p4_items = [
        ("SW-P4-01", "系统设计", "能独立完成中等规模系统的方案设计",
         "输出设计文档并通过评审，覆盖关键非功能需求", "25.00"),
        ("SW-P4-02", "复杂问题解决", "定位并解决跨模块复杂技术问题",
         "近一年主导解决至少 2 个复杂故障/难题，有复盘记录", "25.00"),
        ("SW-P4-03", "项目主导", "主导项目交付，统筹计划与风险",
         "牵头至少 1 个项目按目标交付", "20.00"),
        ("SW-P4-04", "规范与标准建设", "沉淀可复用的方法、规范或工具",
         "产出并落地至少 1 项团队规范/工具", "15.00"),
        ("SW-P4-05", "指导他人", "指导低职级工程师",
         "有明确带教对象且被带教者能力可见提升", "15.00"),
    ]
    create_published_set(session, tenant.id, "SW", "P4", p4_items, now)

    # SW/P3 标准集（4 项，合计 100）
    p3_items = [
        ("SW-P3-01", "独立开发", "独立完成模块级开发任务",
         "按规范独立交付模块，质量达标", "30.00"),
        ("SW-P3-02", "问题处理", "独立排查常规问题",
         "及时定位并解决日常技术问题", "30.00"),
        ("SW-P3-03", "任务推进", "跟进任务进展并反馈",
         "任务按计划推进，风险及时暴露", "20.00"),
        ("SW-P3-04", "协作与记录", "配合团队协作，做好过程记录",
         "文档记录完整，跨角色协作顺畅", "20.00"),
    ]
    create_published_set(session, tenant.id, "SW", "P3", p3_items, now)
    session.flush()

    # SW 序列评审小组模板
    session.add(
        ReviewPanelTemplate(
            tenant_id=tenant.id,
            sequence="SW",
            lead_reviewer_id=lead_emp.id,
            reviewer_ids=[rev1_emp.id, rev2_emp.id],
            is_active=True,
        )
    )

    # IDP 种子数据
    session.add(IDP(
        tenant_id=tenant.id,
        employee_id=emp_emp.id,
        period="2026 Q3",
        period_type=1,
        status="confirmed",
        goals=[
            {"ability": "分布式系统", "target": "掌握分布式基础，P3→P4 知识达标"},
            {"ability": "系统思维", "target": "能独立完成模块级架构设计"},
        ],
        key_behaviors=[
            {"behavior": "完成《分布式系统基础》课程", "plan": "8 月学完 12 学时课程", "status": "done"},
            {"behavior": "主导 1 次模块设计评审", "plan": "9 月承担登录模块重构设计", "status": "doing"},
            {"behavior": "通过 P3 知识考试", "plan": "10 月参加补考", "status": "todo"},
        ],
        created_by=hr_user.id,
    ))
    session.add(IDP(
        tenant_id=tenant.id,
        employee_id=mgr_emp.id,
        period="2026 H2",
        period_type=2,
        status="confirmed",
        goals=[
            {"ability": "团队管理", "target": "提升团队交付效能，降低延期率"},
        ],
        key_behaviors=[
            {"behavior": "建立周度站会与风险同步机制", "plan": "7 月起执行", "status": "done"},
            {"behavior": "完成 2 名下属 IDP 复盘", "plan": "12 月前", "status": "doing"},
        ],
        created_by=hr_user.id,
    ))

    # ============ 招聘面试种子数据 ============
    # 在招需求
    reqs_data = [
        ("高级软件工程师", "305", "P4", 2, [46, 18, 7, 3, 1], "陆行舟", "high", "2026-08-20"),
        ("机械工程师", "306", "P3", 3, [38, 15, 8, 4, 2], "谢星野", "high", "2026-08-25"),
        ("大客户经理", "600", "S3", 1, [29, 10, 4, 2, 0], "江望舒", "mid", "2026-09-01"),
        ("质量工程师", "400", "T3", 1, [24, 9, 3, 1, 1], "冯柚", "mid", "2026-09-05"),
    ]
    req_map = {}
    for pos, dept, grade, hc, funnel, owner, prio, opened in reqs_data:
        r = Requisition(
            tenant_id=tenant.id,
            position=pos, dept_id=dept, grade=grade,
            headcount=hc, funnel=funnel, owner=owner,
            priority=prio, opened_at=opened,
        )
        session.add(r)
        session.flush()
        req_map[pos] = r

    # 候选人
    cand_data = [
        ("傅星言", "高级软件工程师", "offer", "BOSS 直聘", 88, 7, "高级后端工程师", 38000, 4.5, ["分布式", "带过小团队"], "2026-08-28"),
        ("祁让", "高级软件工程师", "final", "内推", 79, 6, "软件工程师", 35000, 4, ["Java 扎实"], "2026-09-02"),
        ("季临渊", "高级软件工程师", "first", "猎头", 72, 5, "全栈工程师", 32000, None, ["前后端通"], "2026-09-10"),
        ("邱野", "高级软件工程师", "screen", "BOSS 直聘", 64, 4, "后端工程师", 28000, None, ["简历待筛"], "2026-09-18"),
        ("苏星河", "机械工程师", "onboard", "校招", 82, 0, "机械工程硕士", 22000, 4.2, ["仿真竞赛", "校招优秀"], "2026-08-30"),
        ("魏知许", "机械工程师", "final", "内推", 85, 5, "机械设计工程师", 27000, 4.3, ["结构件经验"], "2026-09-05"),
        ("阮清时", "机械工程师", "first", "智联", 68, 3, "机械工程师", 22000, None, ["基础一般"], "2026-09-12"),
        ("任栩", "大客户经理", "final", "猎头", 86, 8, "行业销售经理", 38000, 4.4, ["客户资源", "大客户打法"], "2026-09-06"),
        ("唐棠", "大客户经理", "first", "BOSS 直聘", 70, 5, "客户经理", 30000, None, ["冲劲足"], "2026-09-14"),
        ("尹朝", "质量工程师", "offer", "内推", 90, 6, "质量工程师", 24000, 4.6, ["六西格玛黑带", "体系审核"], "2026-09-08"),
        ("龚一", "高级软件工程师", "rejected", "智联", 55, 4, "初级工程师", 26000, 2.5, ["深度不足"], "2026-09-01"),
    ]
    stage_map = {"screen": CandStage.SCREEN, "first": CandStage.FIRST, "final": CandStage.FINAL,
                 "offer": CandStage.OFFER, "onboard": CandStage.ONBOARD, "rejected": CandStage.REJECTED}
    for name, pos, stage, src, score, years, title, sal, rating, tags, applied in cand_data:
        session.add(Candidate(
            tenant_id=tenant.id,
            req_id=req_map[pos].id,
            name=name, stage=stage_map[stage], source=src,
            match_score=score, years=years, last_title=title,
            expected_salary=sal, rating=rating, tags=tags, applied_at=applied,
        ))

    # 面试题库
    q_data = [
        (1, "高级软件工程师", "P4", "请讲一次你独立完成模块详细设计的经历：设计中最难的取舍是什么？评审收到了哪些意见？", "取舍有依据、评审意见被采纳、无重大返工", "standard", "approved"),
        (1, "高级软件工程师", "P4", "讲一个你定位并修复的最复杂线上缺陷：排查路径、根因和后续预防动作？", "SLA 内闭环、有根因分析、预防机制落地", "standard", "approved"),
        (2, "高级软件工程师", "P4", "CAP 理论在你们系统里是怎么落地的？举一个为可用性牺牲一致性的真实决策。", "概念准确、决策与业务约束挂钩", "ai", "pending_review"),
        (2, "机械工程师", "P3", "公差累积在你最近的设计里怎么控制？仿真和实测偏差多少，如何收敛？", "公差链方法清晰、有实测数据", "ai", "approved"),
        (3, "高级软件工程师", "P4", "跨团队推进一个有分歧的方案时，你怎么让信息同步、承诺兑现？", "协同推进 2 级关键行为：信息同步及时、承诺可兑现", "standard", "approved"),
        (3, "大客户经理", "S3", "客户提出超出合同的要求且态度强硬，你最近一次是怎么处理的？", "客户导向 2 级：澄清需求背后的真实问题，而非简单让步", "ai", "pending_review"),
        (4, "高级软件工程师", "P4", "最近 6–12 个月你优化了哪个点？产出什么效果，用数据说明。", "追问话术：优化点具体、效果可量化、个人贡献边界清楚", "manual", "approved"),
        (4, "大客户经理", "S3", "讲一个你签下的最难的单子：周期、关键转折和你个人起到的作用？", "业绩真实可核、打法可复用", "standard", "approved"),
        (1, "质量工程师", "T3", "体系审核中发现过的最严重不符合项是什么？纠正措施怎么验证有效性？", "措施闭环、有验证记录", "ai", "rejected"),
    ]
    src_map = {"manual": QuestionSource.MANUAL, "standard": QuestionSource.STANDARD, "ai": QuestionSource.AI}
    status_map = {"approved": QuestionStatus.APPROVED, "pending_review": QuestionStatus.PENDING_REVIEW, "rejected": QuestionStatus.REJECTED}
    for dim, pos, grade, question, answer, src, status in q_data:
        session.add(InterviewQuestion(
            tenant_id=tenant.id,
            dimension=dim, position=pos, grade=grade,
            question=question, answer_point=answer,
            source=src_map[src], status=status_map[status],
            created_by=hr_user.id,
        ))

    # 租户配置行（默认值）
    if not session.get(TenantConfig, tenant.id):
        session.add(TenantConfig(tenant_id=tenant.id, values={}))

    # ============ 差距分析种子数据 ============
    # 直接插入代表性差距记录（POST /gaps/analyze 会覆盖）
    gap_data = [
        # 许星遥（P3, perf B）：履职+知识短板
        (emp_emp.id, "duty", "职责履行维度得分低于阈值", "≥ 75 分", "62 分", "MID", "process_supervision", 2),
        (emp_emp.id, "knowledge", "知识技能存在短板", "≥ 70 分", "58 分", "HIGH", "learn_knowledge", 3),
        # 董斯年（P3, perf C）：业绩+能力差距
        (lowperf_emp.id, "perf", "绩效等级低于 B 级", "≥ B 级 (80 分)", "C 级 (70 分)", "MID", "perf_improvement", 1),
        (lowperf_emp.id, "ability", "能力素质维度得分低于阈值", "≥ 72 分", "60 分", "HIGH", "behavior_improve", 3),
    ]
    for emp_id, dim, detail, standard, current, sev, action, prio in gap_data:
        session.add(Gap(
            tenant_id=tenant.id,
            employee_id=emp_id,
            dimension=GapDimension(dim),
            detail=detail, standard=standard, current=current,
            severity=GapSeverity(sev), action=GapAction(action),
            priority=prio, batch_id=None,
        ))

    # ============ 液态组队项目种子数据 ============
    projects = [
        ("数字化转型专项（MES 二期）", "研发", [
            {"ability": "能力素质", "level": 80},
            {"ability": "知识技能", "level": 75},
            {"ability": "职责履行", "level": 60},
        ], "2026-12-31", "forming"),
        ("海外建厂筹备组", "制造", [
            {"ability": "能力素质", "level": 80},
            {"ability": "职责履行", "level": 75},
        ], "2027-03-31", "forming"),
    ]
    for name, dept_name, needs, deadline, status in projects:
        session.add(LiquidProject(
            tenant_id=tenant.id,
            name=name, dept_name=dept_name,
            needs=needs, deadline=deadline,
            status=LiquidProjectStatus(status),
        ))

    session.commit()
    print(f"种子完成：{TENANT_NAME}，9 个账号，SW/P3+P4 标准集，SW 评审模板")


def reset_tenant(session, tenant: Tenant) -> None:
    """删除租户全部业务数据，保留租户行。"""
    emp_rows = session.scalars(
        select(Employee).where(Employee.tenant_id == tenant.id)
    ).all()
    emp_ids = [e.id for e in emp_rows]

    app_rows = session.scalars(
        select(Application).where(Application.tenant_id == tenant.id)
    ).all()
    app_ids = [a.id for a in app_rows]

    if app_ids:
        session.execute(
            delete(ReviewTask).where(ReviewTask.application_id.in_(app_ids))
        )
    if emp_ids:
        session.execute(
            delete(Notification).where(Notification.recipient_id.in_(emp_ids))
        )
    session.execute(
        delete(AuditLog).where(AuditLog.tenant_id == tenant.id)
    )
    session.execute(
        delete(ReviewPanelTemplate).where(
            ReviewPanelTemplate.tenant_id == tenant.id
        )
    )
    session.execute(
        delete(StandardItem).where(
            StandardItem.standard_set_id.in_(
                select(StandardSet.id).where(StandardSet.tenant_id == tenant.id)
            )
        )
    )
    session.execute(delete(IDP).where(IDP.tenant_id == tenant.id))
    # 差距分析 + 组织诊断模块 FK 清理
    session.execute(delete(Gap).where(Gap.tenant_id == tenant.id))
    session.execute(delete(LiquidProject).where(LiquidProject.tenant_id == tenant.id))
    # 招聘面试模块 FK 清理
    session.execute(delete(InterviewRecord).where(InterviewRecord.tenant_id == tenant.id))
    session.execute(delete(InterviewQuestion).where(InterviewQuestion.tenant_id == tenant.id))
    session.execute(delete(Candidate).where(Candidate.tenant_id == tenant.id))
    session.execute(delete(Requisition).where(Requisition.tenant_id == tenant.id))
    app_ids = select(Application.id).where(Application.tenant_id == tenant.id)
    for model in (AISuggestion, Decision, Evidence, ManagerReview, SelfAssessment, StandardSnapshot):
        session.execute(delete(model).where(model.application_id.in_(app_ids)))
    session.execute(delete(AIUsage).where(AIUsage.tenant_id == tenant.id))
    session.execute(delete(Application).where(Application.tenant_id == tenant.id))
    session.execute(
        delete(StandardSet).where(StandardSet.tenant_id == tenant.id)
    )
    # 删除引用 employees 的表
    snap_ids = select(ProfileSnapshot.id).where(ProfileSnapshot.tenant_id == tenant.id)
    session.execute(delete(ProfileDimension).where(ProfileDimension.profile_snapshot_id.in_(snap_ids)))
    session.execute(delete(ProfileSnapshot).where(ProfileSnapshot.tenant_id == tenant.id))
    session.execute(delete(InventoryResult).where(InventoryResult.employee_id.in_(emp_ids)))
    session.execute(delete(InventoryBatch).where(InventoryBatch.tenant_id == tenant.id))
    if emp_ids:
        session.execute(delete(SuccessionCandidate).where(SuccessionCandidate.employee_id.in_(emp_ids)))
    session.execute(delete(TalentPool).where(TalentPool.tenant_id == tenant.id))
    session.execute(delete(CorePosition).where(CorePosition.tenant_id == tenant.id))
    session.execute(
        delete(Employee).where(Employee.tenant_id == tenant.id)
    )
    # RBAC 三支柱新表：部门（员工删除后再删，解开 dept/leader 环依赖）、
    # 角色范围、租户自定义角色、薪级带宽
    session.execute(
        delete(Department).where(Department.tenant_id == tenant.id)
    )
    session.execute(
        delete(RoleScope).where(RoleScope.tenant_id == tenant.id)
    )
    session.execute(
        delete(TenantRole).where(TenantRole.tenant_id == tenant.id)
    )
    session.execute(
        delete(TenantSalaryBand).where(TenantSalaryBand.tenant_id == tenant.id)
    )
    session.execute(delete(TenantConfig).where(TenantConfig.tenant_id == tenant.id))
    session.execute(delete(User).where(User.tenant_id == tenant.id))
    session.flush()


if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()
