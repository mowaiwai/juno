"""平台默认职族/职级目录与带宽（端点与测算服务共享，避免分层倒置）。"""
from __future__ import annotations

CHANNELS = [
    {
        "family": "P",
        "name": "专业族",
        "desc": "深耕专业能力，走「资深专家」路线，与管理者同酬同级",
        "sequences": ["SW 软件研发", "ENG 机械工程"],
        "grades": [
            {"grade": "P1", "title": "见习生", "band_range": "薪级 3-4", "salary_band": [4000, 6000], "promote_rule": "试用期转正评估通过"},
            {"grade": "P2", "title": "初级", "band_range": "薪级 5-7", "salary_band": [8000, 14000], "promote_rule": "通过本序列 P2 标准认证"},
            {"grade": "P3", "title": "中级 / 骨干", "band_range": "薪级 8-11", "salary_band": [16000, 28000], "promote_rule": "通过 P3 标准认证；近一年绩效 B 以上"},
            {"grade": "P4", "title": "高级", "band_range": "薪级 12-15", "salary_band": [30000, 45000], "review_years": 3, "promote_rule": "通过 P4 标准认证 + 答辩；近两年绩效 A 以上 1 次"},
            {"grade": "P5", "title": "资深专家", "band_range": "薪级 16-18", "salary_band": [45000, 65000], "review_years": 3, "promote_rule": "P5 标准认证 + 委员会终审；有跨团队技术影响力"},
            {"grade": "P6", "title": "首席", "band_range": "薪级 19-21", "salary_band": [65000, 90000], "promote_rule": "首席答辩：公司级技术贡献 + 管委会任命"},
        ],
    },
    {
        "family": "T",
        "name": "技术操作族",
        "desc": "工艺、产线与设备的技术技能路线，突出「技师」价值",
        "sequences": ["OP 工艺操作"],
        "grades": [
            {"grade": "T1", "title": "普工", "band_range": "薪级 3-4", "salary_band": [4000, 6000], "promote_rule": "入职培训考核通过"},
            {"grade": "T2", "title": "技工", "band_range": "薪级 5-7", "salary_band": [8000, 14000], "promote_rule": "技能鉴定初级 + 师带徒出师"},
            {"grade": "T3", "title": "技师", "band_range": "薪级 8-11", "salary_band": [15000, 24000], "promote_rule": "通过 OP-T3 标准认证（实操 + 问答）"},
            {"grade": "T4", "title": "高级技师", "band_range": "薪级 12-15", "salary_band": [26000, 38000], "promote_rule": "T4 认证 + 解决重大工艺问题案例 1 项"},
            {"grade": "T5", "title": "首席技师", "band_range": "薪级 16-18", "salary_band": [40000, 55000], "promote_rule": "首席技师评聘：公司级技术攻关成果"},
        ],
    },
    {
        "family": "M",
        "name": "管理族",
        "desc": "通过团队拿结果，管理职级与专业职级一一对应同酬",
        "sequences": ["MGT 综合管理"],
        "grades": [
            {"grade": "M1", "title": "储备主管", "band_range": "薪级 6-8", "salary_band": [12000, 18000], "promote_rule": "后备干部池结业 + 部门任命"},
            {"grade": "M2", "title": "经理", "band_range": "薪级 12-15", "salary_band": [30000, 58000], "promote_rule": "M2 任职资格认证（管理行为举证）"},
            {"grade": "M3", "title": "总监", "band_range": "薪级 16-18", "salary_band": [50000, 80000], "promote_rule": "M3 认证 + 组织建设成果评审"},
            {"grade": "M4", "title": "中心负责人", "band_range": "薪级 19-21", "salary_band": [70000, 100000], "promote_rule": "管委会评审任命"},
            {"grade": "M5", "title": "高管", "band_range": "薪级 22-24", "salary_band": [110000, 140000], "promote_rule": "董事会任命"},
        ],
    },
    {
        "family": "O",
        "name": "职能族",
        "desc": "人力、财务、采购、IT 等职能支持路线",
        "sequences": ["HR 人力资源", "PUR 采购", "OPS 运维"],
        "grades": [
            {"grade": "O1", "title": "专员（初）", "band_range": "薪级 3-4", "salary_band": [4000, 6000], "promote_rule": "转正评估通过"},
            {"grade": "O2", "title": "专员", "band_range": "薪级 5-7", "salary_band": [8000, 14000], "promote_rule": "通过本序列 O2 标准认证"},
            {"grade": "O3", "title": "主管", "band_range": "薪级 8-11", "salary_band": [15000, 26000], "promote_rule": "O3 认证 + 独立负责一个职能模块"},
            {"grade": "O4", "title": "高级经理", "band_range": "薪级 12-15", "salary_band": [28000, 40000], "promote_rule": "O4 认证 + 跨部门项目主导经历"},
        ],
    },
    {
        "family": "S",
        "name": "销售族",
        "desc": "大客户与渠道销售路线，提成与职级带宽并行",
        "sequences": ["SAL 销售"],
        "grades": [
            {"grade": "S1", "title": "销售代表", "band_range": "薪级 4-5", "salary_band": [5000, 8000], "promote_rule": "首单成交 + 销售基础认证"},
            {"grade": "S2", "title": "高级代表", "band_range": "薪级 6-8", "salary_band": [10000, 18000], "promote_rule": "连续两季达成率 ≥ 100%"},
            {"grade": "S3", "title": "大客户经理", "band_range": "薪级 9-13", "salary_band": [20000, 45000], "promote_rule": "S3 认证 + 标杆客户案例答辩"},
            {"grade": "S4", "title": "销售总监", "band_range": "薪级 14-17", "salary_band": [45000, 70000], "promote_rule": "区域业绩 + 团队管理评审"},
        ],
    },
]

DEFAULT_BANDS: dict[str, list[int]] = {
    g["grade"]: g["salary_band"]
    for c in CHANNELS
    for g in c["grades"]
}
