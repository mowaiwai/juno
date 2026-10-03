"""组织基础数据端点：部门、岗位编制、职级通道、族标签。

部门与岗位编制为静态主数据（MVP 不建主数据表，dept_id 沿用字符串）。
在编人数（onDuty）与部门负责人从 Employee 表实时聚合。
职级通道为制度级静态配置。
"""

import uuid
from collections import Counter

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.employee import Employee
from app.models.user import User

router = APIRouter(prefix="/org", tags=["org"])

# ---------------------------------------------------------------------------
# 静态主数据
# ---------------------------------------------------------------------------

DEPARTMENTS = [
    {"id": "100", "parent_id": "0", "name": "星野制造", "type": "biz", "manager_no": None},
    {"id": "200", "parent_id": "100", "name": "职能中心", "type": "func", "manager_no": None},
    {"id": "201", "parent_id": "200", "name": "人力资源部", "type": "func", "manager_no": "E10002"},
    {"id": "202", "parent_id": "200", "name": "财务部", "type": "func", "manager_no": None},
    {"id": "203", "parent_id": "200", "name": "综合管理部", "type": "func", "manager_no": None},
    {"id": "300", "parent_id": "100", "name": "研发中心", "type": "tech", "manager_no": None},
    {"id": "305", "parent_id": "300", "name": "软件研发部", "type": "tech", "manager_no": "E10020"},
    {"id": "306", "parent_id": "300", "name": "机械设计部", "type": "tech", "manager_no": None},
    {"id": "307", "parent_id": "300", "name": "工艺工程部", "type": "tech", "manager_no": None},
    {"id": "400", "parent_id": "100", "name": "制造中心", "type": "biz", "manager_no": None},
    {"id": "401", "parent_id": "400", "name": "机加车间", "type": "biz", "manager_no": None},
    {"id": "402", "parent_id": "400", "name": "装配车间", "type": "biz", "manager_no": None},
    {"id": "403", "parent_id": "400", "name": "质量部", "type": "tech", "manager_no": None},
    {"id": "500", "parent_id": "100", "name": "供应链中心", "type": "func", "manager_no": None},
    {"id": "501", "parent_id": "500", "name": "采购部", "type": "func", "manager_no": None},
    {"id": "502", "parent_id": "500", "name": "仓储物流部", "type": "func", "manager_no": None},
    {"id": "600", "parent_id": "100", "name": "营销中心", "type": "biz", "manager_no": None},
    {"id": "601", "parent_id": "600", "name": "销售部", "type": "biz", "manager_no": None},
    {"id": "602", "parent_id": "600", "name": "市场部", "type": "biz", "manager_no": None},
]

POSITIONS = [
    {"id": "p001", "name": "首席执行官", "dept_id": "100", "family": "M", "sequence": "MGT", "grade": "M5", "is_core": True, "headcount": 1},
    {"id": "p002", "name": "研发总监", "dept_id": "300", "family": "M", "sequence": "MGT", "grade": "M4", "is_core": True, "headcount": 1},
    {"id": "p003", "name": "软件研发经理", "dept_id": "305", "family": "M", "sequence": "MGT", "grade": "M2", "is_core": True, "headcount": 1},
    {"id": "p004", "name": "高级软件工程师", "dept_id": "305", "family": "P", "sequence": "SW", "grade": "P4", "is_core": True, "headcount": 4},
    {"id": "p005", "name": "软件工程师", "dept_id": "305", "family": "P", "sequence": "SW", "grade": "P3", "is_core": False, "headcount": 9},
    {"id": "p006", "name": "初级软件工程师", "dept_id": "305", "family": "P", "sequence": "SW", "grade": "P2", "is_core": False, "headcount": 6},
    {"id": "p007", "name": "机械设计经理", "dept_id": "306", "family": "M", "sequence": "MGT", "grade": "M2", "is_core": True, "headcount": 1},
    {"id": "p008", "name": "高级机械工程师", "dept_id": "306", "family": "P", "sequence": "ENG", "grade": "P4", "is_core": True, "headcount": 3},
    {"id": "p009", "name": "机械工程师", "dept_id": "306", "family": "P", "sequence": "ENG", "grade": "P3", "is_core": False, "headcount": 7},
    {"id": "p010", "name": "工艺工程师", "dept_id": "307", "family": "T", "sequence": "OP", "grade": "T3", "is_core": False, "headcount": 5},
    {"id": "p011", "name": "高级工艺工程师", "dept_id": "307", "family": "T", "sequence": "OP", "grade": "T4", "is_core": True, "headcount": 2},
    {"id": "p012", "name": "制造总监", "dept_id": "400", "family": "M", "sequence": "MGT", "grade": "M4", "is_core": True, "headcount": 1},
    {"id": "p013", "name": "车间主任", "dept_id": "401", "family": "M", "sequence": "MGT", "grade": "M2", "is_core": True, "headcount": 1},
    {"id": "p014", "name": "质量工程师", "dept_id": "403", "family": "T", "sequence": "OP", "grade": "T3", "is_core": False, "headcount": 4},
    {"id": "p015", "name": "供应链总监", "dept_id": "500", "family": "M", "sequence": "MGT", "grade": "M3", "is_core": True, "headcount": 1},
    {"id": "p016", "name": "采购主管", "dept_id": "501", "family": "O", "sequence": "PUR", "grade": "O3", "is_core": False, "headcount": 2},
    {"id": "p017", "name": "营销总监", "dept_id": "600", "family": "M", "sequence": "MGT", "grade": "M3", "is_core": True, "headcount": 1},
    {"id": "p018", "name": "大客户经理", "dept_id": "601", "family": "S", "sequence": "SAL", "grade": "S3", "is_core": True, "headcount": 5},
    {"id": "p019", "name": "HRD", "dept_id": "201", "family": "M", "sequence": "MGT", "grade": "M3", "is_core": True, "headcount": 1},
    {"id": "p020", "name": "HRBP", "dept_id": "201", "family": "O", "sequence": "HR", "grade": "O3", "is_core": False, "headcount": 3},
    {"id": "p021", "name": "IT 运维专员", "dept_id": "203", "family": "O", "sequence": "OPS", "grade": "O3", "is_core": False, "headcount": 2},
    {"id": "p022", "name": "数控技师", "dept_id": "401", "family": "T", "sequence": "OP", "grade": "T3", "is_core": False, "headcount": 12},
    {"id": "p023", "name": "高级数控技师", "dept_id": "401", "family": "T", "sequence": "OP", "grade": "T4", "is_core": True, "headcount": 5},
    {"id": "p024", "name": "装配技师", "dept_id": "402", "family": "T", "sequence": "OP", "grade": "T2", "is_core": False, "headcount": 18},
]

FAMILY_LABEL = {
    "P": "专业族",
    "T": "技术操作族",
    "M": "管理族",
    "O": "职能族",
    "S": "销售族",
}

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


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class DepartmentOut(BaseModel):
    id: str
    parent_id: str
    name: str
    type: str
    manager_id: uuid.UUID | None = None
    manager_name: str | None = None


class GradeBandOut(BaseModel):
    grade: str
    title: str
    band_range: str
    salary_band: list[int]
    review_years: int | None = None
    promote_rule: str


class ChannelFamilyOut(BaseModel):
    family: str
    name: str
    desc: str
    sequences: list[str]
    grades: list[GradeBandOut]


class PositionOut(BaseModel):
    id: str
    name: str
    dept_id: str
    family: str
    sequence: str
    grade: str
    is_core: bool
    headcount: int
    on_duty: int


# ---------------------------------------------------------------------------
# 端点
# ---------------------------------------------------------------------------

@router.get("/departments", response_model=list[DepartmentOut])
def list_departments(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """部门列表（含负责人）。manager 从 Employee 表按 employee_no 查。"""
    manager_nos = {d["manager_no"] for d in DEPARTMENTS if d["manager_no"]}
    mgr_map: dict[str, Employee] = {}
    if manager_nos:
        rows = db.scalars(
            select(Employee).where(
                Employee.tenant_id == user.tenant_id,
                Employee.employee_no.in_(manager_nos),
            )
        ).all()
        mgr_map = {r.employee_no: r for r in rows}

    result = []
    for d in DEPARTMENTS:
        mgr = mgr_map.get(d["manager_no"]) if d["manager_no"] else None
        result.append(DepartmentOut(
            id=d["id"],
            parent_id=d["parent_id"],
            name=d["name"],
            type=d["type"],
            manager_id=mgr.id if mgr else None,
            manager_name=mgr.name if mgr else None,
        ))
    return result


@router.get("/positions", response_model=list[PositionOut])
def list_positions(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """岗位编制列表。onDuty 从 Employee 表按 dept_id + position 聚合。"""
    rows = db.scalars(
        select(Employee).where(
            Employee.tenant_id == user.tenant_id,
            Employee.is_active.is_(True),
        )
    ).all()
    counter: Counter[tuple[str, str]] = Counter()
    for e in rows:
        counter[(e.dept_id, e.position)] += 1

    result = []
    for p in POSITIONS:
        result.append(PositionOut(
            id=p["id"],
            name=p["name"],
            dept_id=p["dept_id"],
            family=p["family"],
            sequence=p["sequence"],
            grade=p["grade"],
            is_core=p["is_core"],
            headcount=p["headcount"],
            on_duty=counter.get((p["dept_id"], p["name"]), 0),
        ))
    return result


@router.get("/channels", response_model=list[ChannelFamilyOut])
def list_channels(
    user: User = Depends(get_current_user),
):
    """职级通道配置（制度级静态数据）。"""
    return [
        ChannelFamilyOut(
            family=c["family"],
            name=c["name"],
            desc=c["desc"],
            sequences=c["sequences"],
            grades=[
                GradeBandOut(
                    grade=g["grade"],
                    title=g["title"],
                    band_range=g["band_range"],
                    salary_band=g["salary_band"],
                    review_years=g.get("review_years"),
                    promote_rule=g["promote_rule"],
                )
                for g in c["grades"]
            ],
        )
        for c in CHANNELS
    ]


@router.get("/family-label")
def family_label(
    user: User = Depends(get_current_user),
):
    """职族标签映射。"""
    return FAMILY_LABEL
