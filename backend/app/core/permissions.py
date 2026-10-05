"""权限点目录与内置角色模板（ADR-0014）。

- PERMISSION_POINTS：平台代码发布的权限点目录，租户只能在目录内组合，不能自创。
- BUILTIN_TEMPLATES：内置角色（枚举）的默认权限点集合与数据范围类型，
  版本化随代码演进；租户不可改内置角色，只能克隆为自定义角色后编辑。
- 系统固定角色（EMPLOYEE/REVIEWER/LEAD_REVIEWER/COMMITTEE/EXECUTIVE/
  TENANT_ADMIN/PLATFORM_ADMIN）不开放克隆，其语义也在此声明。

新增功能时必须在此登记权限点，并把权限点补入相应内置模板；
自定义角色对新权限点一律默认拒绝。
"""

import enum


class ScopeType(str, enum.Enum):
    SELF = "self"
    SUBTREE = "subtree"
    ASSIGNED_DEPTS = "assigned_depts"
    GLOBAL = "global"


# 权限点分组 → 权限点（code, 中文说明）。顺序即配置 UI 的展示顺序。
PERMISSION_GROUPS: list[tuple[str, str, list[tuple[str, str]]]] = [
    (
        "组织与档案",
        "org_employee",
        [
            ("org.view", "组织架构查看"),
            ("org.dept.manage", "部门树维护"),
            ("employee.view", "员工名册查看"),
            ("employee.account.manage", "账号开通/停用/重置密码"),
            ("employee.field.org.edit", "档案组织字段编辑（部门/岗位/职级/序列）"),
            ("employee.field.basic.edit", "档案基本条件编辑（学历/证书）"),
            ("employee.field.perf.view", "绩效等级查看"),
            ("employee.field.perf.edit", "绩效结果录入"),
            ("employee.salary.view", "定薪数据查看"),
            ("employee.salary.edit", "定薪数据编辑"),
        ],
    ),
    (
        "标准与画像",
        "standard_profile",
        [
            ("standard.manage", "标准库/模板创建编辑"),
            ("standard.publish", "标准发布"),
            ("mapping.manage", "租户职级-层级映射维护"),
            ("comp.band.manage", "薪级带宽维护"),
            ("profile.view", "人才画像查看"),
            ("profile.generate", "画像生成"),
        ],
    ),
    (
        "盘点与继任",
        "inventory_succession",
        [
            ("inventory.manage", "盘点批次创建/配置/发布"),
            ("inventory.calibrate", "盘点评估与校准"),
            ("succession.manage", "核心岗位/继任/后备池管理"),
            ("succession.nominate", "继任提名"),
        ],
    ),
    (
        "绩效评价",
        "performance",
        [
            ("perf.plan.manage", "考核方案创建/校准/发布与结果导入"),
            ("perf.result.entry", "下属绩效初评与辅导记录写入"),
            ("perf.pip.manage", "PIP 创建与结论管理"),
        ],
    ),
    (
        "薪酬激励",
        "compensation",
        [
            ("comp.rule.manage", "调薪矩阵/固浮比/停涨分位配置"),
            ("bonus.manage", "绩效奖金方案测算/提交/发放清单"),
        ],
    ),
    (
        "发展与差距",
        "development",
        [
            ("idp.coach", "他人 IDP 辅导编辑"),
            ("gap.manage", "差距分析/组织诊断运行查看"),
            ("panel.manage", "认证小组模板/安排"),
        ],
    ),
    (
        "选聘与考试",
        "selection_exam",
        [
            ("recruit.manage", "招聘流程管理"),
            ("recruit.demand", "招聘需求提报"),
            ("exam.paper.manage", "题库/试卷管理（含 AI 组卷）"),
            ("exam.operate", "排考/通知/成绩运营"),
        ],
    ),
    (
        "洞察与审计",
        "insight_audit",
        [
            ("cockpit.ask", "Cockpit AI 问答"),
            ("audit.view", "审计日志查看"),
            ("audit.export", "数据导出"),
        ],
    ),
    (
        "系统",
        "system",
        [
            ("role.manage", "角色与权限配置"),
        ],
    ),
]

PERMISSION_POINTS: dict[str, str] = {
    code: label
    for _, _, points in PERMISSION_GROUPS
    for code, label in points
}

WILDCARD = "*"


class Template:
    """内置角色模板：默认数据范围 + 权限点集合。"""

    __slots__ = ("scope_type", "permissions", "cloneable", "display_name")

    def __init__(
        self,
        scope_type: ScopeType,
        permissions: frozenset[str],
        display_name: str,
        cloneable: bool = True,
    ):
        self.scope_type = scope_type
        self.permissions = permissions
        self.display_name = display_name
        self.cloneable = cloneable


# 模板缩写
_S = ScopeType

# 五 COE 共用：全租户名册（绩效等级对五个 COE 均可见）
_COE_ROSTER = frozenset(
    {"employee.view", "employee.field.perf.view", "audit.view"}
)

BUILTIN_TEMPLATES: dict[str, Template] = {
    # ---- 三支柱：COE 五板块（均全租户数据范围）----
    "hr_coe_cadre": Template(
        _S.GLOBAL,
        _COE_ROSTER
        | frozenset({
            "profile.view",
            "inventory.calibrate",   # 盘点监督/校准可见
            "succession.manage",     # 干部任免/后备/继任
            "idp.coach",
            "gap.manage",
            "cockpit.ask",
        }),
        "COE·干部管理",
    ),
    "hr_coe_perf": Template(
        _S.GLOBAL,
        _COE_ROSTER
        | frozenset({
            "employee.field.perf.edit",
            "perf.plan.manage",
            "perf.pip.manage",
            "profile.view",
            "inventory.calibrate",
            "idp.coach",
            "gap.manage",
            "cockpit.ask",
        }),
        "COE·绩效管理",
    ),
    "hr_coe_comp": Template(
        _S.GLOBAL,
        frozenset({
            "employee.view",
            "employee.salary.view",
            "employee.salary.edit",
            "comp.band.manage",
            "comp.rule.manage",
            "bonus.manage",
            "profile.view",
            "audit.view",
        }),
        "COE·薪酬激励",
    ),
    "hr_coe_recruit": Template(
        _S.GLOBAL,
        _COE_ROSTER
        | frozenset({
            "recruit.manage",
            "exam.operate",
        }),
        "COE·招聘运营",
    ),
    "hr_coe_otd": Template(
        _S.GLOBAL,
        _COE_ROSTER
        | frozenset({
            "org.view",
            "org.dept.manage",
            "employee.field.org.edit",
            "employee.field.basic.edit",
            "standard.manage",
            "standard.publish",
            "mapping.manage",
            "profile.view",
            "profile.generate",
            "inventory.manage",
            "inventory.calibrate",
            "idp.coach",
            "gap.manage",
            "exam.paper.manage",
            "exam.operate",
            "panel.manage",
            "cockpit.ask",
        }),
        "COE·组织与人才发展",
    ),
    # ---- 三支柱：HRBP / SSC ----
    "hrbp": Template(
        _S.ASSIGNED_DEPTS,
        frozenset({
            "employee.view",
            "employee.field.perf.view",
            "profile.view",
            "inventory.calibrate",
            "succession.nominate",
            "idp.coach",
            "gap.manage",
            "recruit.demand",
            "exam.operate",
            "cockpit.ask",
            "perf.result.entry",
        }),
        "HRBP（业务伙伴）",
    ),
    "ssc": Template(
        _S.GLOBAL,
        frozenset({
            "employee.view",            # 全租户只读名册（绩效/薪酬均掩码）
            "employee.account.manage",
            "audit.view",
            "audit.export",
        }),
        "SSC（共享服务）",
    ),
    # ---- 部门领导（可克隆；范围=部门子树∪汇报链）----
    "manager": Template(
        _S.SUBTREE,
        frozenset({
            "employee.view",
            "employee.field.perf.view",
            "profile.view",
            "inventory.calibrate",
            "succession.nominate",
            "idp.coach",
            "gap.manage",
            "recruit.demand",
            "perf.result.entry",
        }),
        "部门领导",
    ),
    # ---- 系统固定角色（不可克隆）----
    "employee": Template(
        _S.SELF,
        frozenset(),
        "员工",
        cloneable=False,
    ),
    "exec": Template(
        _S.GLOBAL,
        frozenset({
            "employee.view",
            "employee.field.perf.view",
            "profile.view",
            "inventory.calibrate",
            "cockpit.ask",
        }),
        "高管",
        cloneable=False,
    ),
    "committee": Template(
        _S.GLOBAL,
        frozenset({"profile.view", "panel.manage"}),
        "任职资格管理委员会",
        cloneable=False,
    ),
    "reviewer": Template(
        _S.SELF,
        frozenset({"profile.view"}),
        "认证评委",
        cloneable=False,
    ),
    "lead_reviewer": Template(
        _S.SELF,
        frozenset({"profile.view", "panel.manage"}),
        "认证评审组长",
        cloneable=False,
    ),
    "tenant_admin": Template(
        _S.GLOBAL,
        frozenset({WILDCARD}),
        "租户管理员",
        cloneable=False,
    ),
    "platform_admin": Template(
        _S.GLOBAL,
        frozenset({WILDCARD}),
        "平台管理员",
        cloneable=False,
    ),
}

# 可克隆为自定义角色的内置模板
CLONEABLE_BUILTIN = [
    "hr_coe_cadre",
    "hr_coe_perf",
    "hr_coe_comp",
    "hr_coe_recruit",
    "hr_coe_otd",
    "hrbp",
    "ssc",
    "manager",
]

# 综合 HR 预设：七模板权限点并集 + GLOBAL（小租户一人全包）
PRESET_ALL_HR_NAME = "综合 HR（一人全包）"
PRESET_ALL_HR_PERMS: frozenset[str] = frozenset(
    p
    for key in (
        "hr_coe_cadre", "hr_coe_perf", "hr_coe_comp", "hr_coe_recruit",
        "hr_coe_otd", "hrbp", "ssc",
    )
    for p in BUILTIN_TEMPLATES[key].permissions
)
