"""组织基础数据端点：部门主数据、岗位编制、职级通道、族标签、薪级带宽。

部门树为真实主数据（departments 表，ADR-0014），OTD 维护、领导变更自动授角；
岗位编制仍为静态主数据，在编人数从 Employee 表实时聚合；
职级通道为制度级静态配置，薪级带宽支持租户覆盖（薪酬激励角色维护）。
"""

import uuid
from collections import Counter

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import Principal, err, get_current_user, require_perm
from app.database import get_db
from app.models.employee import Employee
from app.models.org import Department
from app.models.user import User
from app.services.audit import audit_as
from app.services.org_service import set_department_leader

router = APIRouter(prefix="/org", tags=["org"])

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

# ---------------------------------------------------------------------------
# 职级通道（制度级静态主数据）
# ---------------------------------------------------------------------------

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

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class DepartmentOut(BaseModel):
    id: str
    parent_id: str | None
    name: str
    type: str
    leader_id: uuid.UUID | None = None
    leader_name: str | None = None


class DepartmentIn(BaseModel):
    id: str
    name: str
    parent_id: str | None = None
    type: str = "func"
    leader_id: uuid.UUID | None = None


class DepartmentUpdate(BaseModel):
    name: str | None = None
    parent_id: str | None = None
    type: str | None = None
    leader_id: uuid.UUID | None = None


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
# 部门
# ---------------------------------------------------------------------------

@router.get("/departments", response_model=list[DepartmentOut])
def list_departments(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """部门树（含负责人），全员可查。"""
    rows = db.scalars(
        select(Department)
        .where(Department.tenant_id == user.tenant_id)
        .order_by(Department.id)
    ).all()
    leader_ids = {d.leader_employee_id for d in rows if d.leader_employee_id}
    mgr_map: dict[uuid.UUID, Employee] = {}
    if leader_ids:
        mgr_map = {
            e.id: e
            for e in db.scalars(
                select(Employee).where(Employee.id.in_(leader_ids))
            ).all()
        }
    return [
        DepartmentOut(
            id=d.id,
            parent_id=d.parent_id,
            name=d.name,
            type=d.type,
            leader_id=d.leader_employee_id,
            leader_name=(mgr_map[d.leader_employee_id].name
                         if d.leader_employee_id in mgr_map else None),
        )
        for d in rows
    ]


@router.post("/departments", response_model=DepartmentOut, status_code=201)
def create_department(
    body: DepartmentIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_perm("org.dept.manage")),
):
    exists = db.scalar(
        select(Department.id).where(
            Department.tenant_id == principal.user.tenant_id,
            Department.id == body.id,
        )
    )
    if exists is not None:
        raise err(409, "dept_exists", "部门编码已存在")
    dept = Department(
        id=body.id,
        tenant_id=principal.user.tenant_id,
        name=body.name,
        parent_id=body.parent_id,
        type=body.type,
    )
    db.add(dept)
    db.flush()
    if body.leader_id:
        try:
            set_department_leader(
                db, principal.user.tenant_id, body.id, body.leader_id
            )
        except ValueError as exc:
            raise err(404, str(exc), "负责人不存在")
    audit_as(db, principal.user, "department_created", "org", None,
             after={"id": body.id, "name": body.name})
    db.commit()
    return _dept_out(db, dept)


@router.put("/departments/{dept_id}", response_model=DepartmentOut)
def update_department(
    dept_id: str,
    body: DepartmentUpdate,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_perm("org.dept.manage")),
):
    dept = db.scalar(
        select(Department).where(
            Department.tenant_id == principal.user.tenant_id,
            Department.id == dept_id,
        )
    )
    if dept is None:
        raise err(404, "dept_not_found", "部门不存在")
    if body.name is not None:
        dept.name = body.name
    if body.type is not None:
        dept.type = body.type
    if body.parent_id is not None and body.parent_id != dept.parent_id:
        if body.parent_id == dept_id:
            raise err(422, "invalid_parent", "上级部门不能是自身")
        dept.parent_id = body.parent_id
    if "leader_id" in body.model_fields_set:
        try:
            set_department_leader(
                db, principal.user.tenant_id, dept_id, body.leader_id
            )
        except ValueError as exc:
            raise err(404, str(exc), "负责人不存在")
    audit_as(db, principal.user, "department_updated", "org", None,
             after={"id": dept_id})
    db.commit()
    return _dept_out(db, dept)


def _dept_out(db: Session, dept: Department) -> DepartmentOut:
    leader = db.get(Employee, dept.leader_employee_id) if dept.leader_employee_id else None
    return DepartmentOut(
        id=dept.id,
        parent_id=dept.parent_id,
        name=dept.name,
        type=dept.type,
        leader_id=dept.leader_employee_id,
        leader_name=leader.name if leader else None,
    )


# ---------------------------------------------------------------------------
# 岗位编制（静态）
# ---------------------------------------------------------------------------

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

    return [
        PositionOut(
            id=p["id"],
            name=p["name"],
            dept_id=p["dept_id"],
            family=p["family"],
            sequence=p["sequence"],
            grade=p["grade"],
            is_core=p["is_core"],
            headcount=p["headcount"],
            on_duty=counter.get((p["dept_id"], p["name"]), 0),
        )
        for p in POSITIONS
    ]


# ---------------------------------------------------------------------------
# 职级通道（制度级静态数据）
# ---------------------------------------------------------------------------

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
