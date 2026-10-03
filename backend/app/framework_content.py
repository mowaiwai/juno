"""层级框架平台内容资产 v1。

六层四要素、L1–L3 行为锚点、平台默认职级映射、基础条件模板与加分项目录。
默认映射是平台代码资产（非数据库表）：租户未覆盖时回落此表。
"""

# 学历下限枚举
EDUCATION_OPTIONS = ["不限", "大专", "本科", "硕士", "博士"]

LEVEL_CODES = [
    "basic",
    "experienced",
    "backbone",
    "elite",
    "business_unit",
    "group",
]

# 平台默认「职级代码 → 层级序」
DEFAULT_GRADE_LEVELS: dict[str, int] = {}
for _grade in ("P2", "T2"):
    DEFAULT_GRADE_LEVELS[_grade] = 1
for _grade in ("P3", "T3", "S3", "O3"):
    DEFAULT_GRADE_LEVELS[_grade] = 2
for _grade in ("P4", "T4", "M2"):
    DEFAULT_GRADE_LEVELS[_grade] = 3
DEFAULT_GRADE_LEVELS["M3"] = 4
DEFAULT_GRADE_LEVELS["M4"] = 5
DEFAULT_GRADE_LEVELS["M5"] = 6


FRAMEWORK_V1 = {
    "levels": [
        {
            "level_order": 1,
            "code": "basic",
            "name": "基础层",
            "role_definition": (
                "初阶工作者。对所从事专业知识有一定了解，能按已有规范、流程和"
                "操作规则处理专业工作，完成部分一般性专业工作"
            ),
            "performance_level": (
                "理解并执行基础工作任务，在指导下完成部分工作，配合团队完成任务，"
                "提供必要支持"
            ),
            "key_behaviors": ["参与", "支持", "配合", "记录"],
            "influence_scope": (
                "主要影响个人任务完成，对团队整体工作起基础性支撑作用"
            ),
            "target_anchor": "L1",
        },
        {
            "level_order": 2,
            "code": "experienced",
            "name": "经验层",
            "role_definition": (
                "能独立承担工作，熟练掌握本专业某一领域业务，了解相关业务知识，"
                "独立处理和解决日常性问题"
            ),
            "performance_level": (
                "独立执行工作任务，识别并解决常规问题，确保任务顺利推进；"
                "跟进进展、及时反馈"
            ),
            "key_behaviors": ["执行", "推进", "落实", "解决"],
            "influence_scope": (
                "影响个人与小团队工作效率，对部门日常工作有直接推动作用"
            ),
            "target_anchor": "L2",
        },
        {
            "level_order": 3,
            "code": "backbone",
            "name": "骨干层",
            "role_definition": (
                "业务骨干。精通本专业 1–2 个领域，熟悉相关领域知识；"
                "能制定本专业优化方案与制度标准；承担主要角色或牵头专业项目；"
                "指导低职级专员"
            ),
            "performance_level": (
                "主导部分重要工作，制定方案与计划，识别解决复杂问题；"
                "推动进展，统筹资源、协调成员完成任务"
            ),
            "key_behaviors": ["主导", "组织", "推动", "方案制定", "统筹规划"],
            "influence_scope": (
                "影响团队与整体工作效果，对部门业务发展和效率提升有重要影响"
            ),
            "target_anchor": "L3",
        },
        {
            "level_order": 4,
            "code": "elite",
            "name": "精英层",
            "role_definition": (
                "经营人员。能制定本专业领域整体解决方案，牵头公司重大项目，"
                "提供改善与发展建议"
            ),
            "performance_level": (
                "主导大部分工作，制定战略规划与创新方案；关注行业前沿、"
                "引入先进理念技术；建立长效机制，持续优化流程与管理体系"
            ),
            "key_behaviors": ["创新", "引领", "建立长效机制"],
            "influence_scope": (
                "影响部门整体战略发展，对业务发展与效率提升有重要影响"
            ),
            "target_anchor": "L3",
        },
        {
            "level_order": 5,
            "code": "business_unit",
            "name": "事业单位经营层",
            "role_definition": (
                "公司内专家。从业时间长，对市场实践与前沿理论有深入理解；"
                "为本专业发展提供前瞻性策略，为高管层提供前瞻建议"
            ),
            "performance_level": (
                "专业领域具权威性，提供专业指导；负责知识管理与传承，"
                "推动团队专业能力提升；参与战略规划，支持高层决策"
            ),
            "key_behaviors": ["指导", "传承", "赋能"],
            "influence_scope": (
                "影响团队整体专业能力与知识水平，对企业战略规划有重要影响"
            ),
            "target_anchor": "L3",
        },
        {
            "level_order": 6,
            "code": "group",
            "name": "集团经营层",
            "role_definition": "行业内专家，能对本专业整体发展趋势产生影响",
            "performance_level": (
                "行业内具广泛影响力，引领行业发展；代表企业参与行业标准制定与"
                "学术交流，提升行业地位；提供前瞻性战略建议"
            ),
            "key_behaviors": ["引领", "贡献", "代表"],
            "influence_scope": (
                "对行业发展有贡献，对企业行业地位与战略发展有重大贡献"
            ),
            "target_anchor": "L3",
        },
    ],
    "anchors": [
        {
            "code": "L1",
            "name": "参与执行",
            "description": (
                "在指导下理解并执行既定规范与流程；参与、支持、配合团队任务；"
                "如实记录过程与问题，及时反馈"
            ),
        },
        {
            "code": "L2",
            "name": "独立推进",
            "description": (
                "独立承担工作任务；熟练处理本领域常规问题，确保任务落实推进；"
                "识别异常并协调解决，对结果负责"
            ),
        },
        {
            "code": "L3",
            "name": "主导引领",
            "description": (
                "主导复杂任务与项目，制定方案、统筹资源、组织协调；"
                "推动流程优化与机制建立；解决跨领域复杂问题，指导他人，"
                "产出可复用的方法或标准"
            ),
        },
    ],
    # MVP：工龄/司龄 v1 不限；资质证书清单为空，学历下限为 v1 建议值
    "conditions": [
        {"level_order": 1, "education_min": "不限", "min_work_years": None,
         "min_company_years": None, "certificates": []},
        {"level_order": 2, "education_min": "大专", "min_work_years": None,
         "min_company_years": None, "certificates": []},
        {"level_order": 3, "education_min": "本科", "min_work_years": None,
         "min_company_years": None, "certificates": []},
        {"level_order": 4, "education_min": "本科", "min_work_years": None,
         "min_company_years": None, "certificates": []},
        {"level_order": 5, "education_min": "硕士", "min_work_years": None,
         "min_company_years": None, "certificates": []},
        {"level_order": 6, "education_min": "硕士", "min_work_years": None,
         "min_company_years": None, "certificates": []},
    ],
    "bonus_items": [
        {"code": "teaching_hours", "name": "授课培训时长",
         "measure_unit": "课时", "sort_order": 0},
        {"code": "knowledge_contribution", "name": "知识管理贡献",
         "measure_unit": "件数", "sort_order": 1},
        {"code": "content_development", "name": "经验萃取与课件开发",
         "measure_unit": "件数", "sort_order": 2},
        {"code": "mentoring", "name": "人才带教",
         "measure_unit": "人次", "sort_order": 3},
        {"code": "professional_output", "name": "专业成果（专利/论文等）",
         "measure_unit": "件数", "sort_order": 4},
    ],
}
