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
from app.models.compensation import TenantSalaryBand
from app.models.employee import Employee
from app.models.org import Department
from app.models.user import User
from app.services.audit import audit_as
from app.services.grade_catalog import CHANNELS, DEFAULT_BANDS
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
    customized: bool = False
    p25: float | None = None
    p50: float | None = None
    p75: float | None = None
    p90: float | None = None
    market_source_year: int | None = None


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


class SalaryBandIn(BaseModel):
    grade: str
    min_value: int
    max_value: int
    p25: float | None = None
    p50: float | None = None
    p75: float | None = None
    p90: float | None = None
    market_source_year: int | None = None


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
# 职级通道 + 薪级带宽（静态默认，租户可覆盖带宽）
# ---------------------------------------------------------------------------

def _tenant_bands(db: Session, tenant_id) -> dict[str, TenantSalaryBand]:
    return {
        b.grade: b
        for b in db.scalars(
            select(TenantSalaryBand).where(TenantSalaryBand.tenant_id == tenant_id)
        ).all()
    }


@router.get("/channels", response_model=list[ChannelFamilyOut])
def list_channels(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """职级通道配置；薪级带宽取租户覆盖，未覆盖回落平台默认。"""
    overrides = _tenant_bands(db, user.tenant_id)
    result = []
    for c in CHANNELS:
        grades = []
        for g in c["grades"]:
            band = overrides.get(g["grade"])
            grades.append(GradeBandOut(
                grade=g["grade"],
                title=g["title"],
                band_range=g["band_range"],
                salary_band=[band.min_value, band.max_value] if band else g["salary_band"],
                review_years=g.get("review_years"),
                promote_rule=g["promote_rule"],
                customized=band is not None,
                p25=band.p25 if band else None,
                p50=band.p50 if band else None,
                p75=band.p75 if band else None,
                p90=band.p90 if band else None,
                market_source_year=band.market_source_year if band else None,
            ))
        result.append(ChannelFamilyOut(
            family=c["family"],
            name=c["name"],
            desc=c["desc"],
            sequences=c["sequences"],
            grades=grades,
        ))
    return result


@router.put("/salary-bands", response_model=GradeBandOut)
def upsert_salary_band(
    body: SalaryBandIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_perm("comp.band.manage")),
):
    if body.grade not in DEFAULT_BANDS:
        raise err(404, "grade_not_found", "未知职级，带宽只能覆盖既有职级")
    if body.min_value >= body.max_value:
        raise err(422, "invalid_band", "带宽下限必须小于上限")
    row = db.scalar(
        select(TenantSalaryBand).where(
            TenantSalaryBand.tenant_id == principal.user.tenant_id,
            TenantSalaryBand.grade == body.grade,
        )
    )
    if row is None:
        row = TenantSalaryBand(
            tenant_id=principal.user.tenant_id,
            grade=body.grade,
            min_value=body.min_value,
            max_value=body.max_value,
            p25=body.p25, p50=body.p50, p75=body.p75, p90=body.p90,
            market_source_year=body.market_source_year,
            updated_by=principal.user.id,
        )
        db.add(row)
    else:
        row.min_value, row.max_value = body.min_value, body.max_value
        row.p25, row.p50, row.p75, row.p90 = body.p25, body.p50, body.p75, body.p90
        row.market_source_year = body.market_source_year
        row.updated_by = principal.user.id
    audit_as(db, principal.user, "salary_band_updated", "org", None,
             after={"grade": body.grade,
                    "band": [body.min_value, body.max_value]})
    db.commit()
    title = next(
        (g["title"] for c in CHANNELS for g in c["grades"] if g["grade"] == body.grade),
        body.grade,
    )
    band_range = next(
        (g["band_range"] for c in CHANNELS for g in c["grades"]
         if g["grade"] == body.grade),
        "",
    )
    promote_rule = next(
        (g["promote_rule"] for c in CHANNELS for g in c["grades"]
         if g["grade"] == body.grade),
        "",
    )
    review_years = next(
        (g.get("review_years") for c in CHANNELS for g in c["grades"]
         if g["grade"] == body.grade),
        None,
    )
    return GradeBandOut(
        grade=body.grade, title=title, band_range=band_range,
        salary_band=[body.min_value, body.max_value],
        review_years=review_years, promote_rule=promote_rule, customized=True,
        p25=body.p25, p50=body.p50, p75=body.p75, p90=body.p90,
        market_source_year=body.market_source_year,
    )


@router.get("/family-label")
def family_label(
    user: User = Depends(get_current_user),
):
    """职族标签映射。"""
    return FAMILY_LABEL
