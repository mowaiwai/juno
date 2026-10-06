from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db

from app.api.v1.endpoints import (
    ai,
    applications,
    audit_logs,
    auth,
    cockpit,
    comp,
    core_positions,
    employees,
    exam,
    finalize,
    gaps,
    idp,
    inventory_batches,
    level_framework,
    manager,
    match,
    me,
    notifications,
    org,
    org_diagnosis,
    panel_templates,
    perf,
    perf_dev,
    perf_plans,
    perf_publish,
    perf_results,
    profiles,
    recruit,
    review,
    roles,
    standard_sets,
    structure_gap,
    tenant_level_mapping,
    users,
)

router = APIRouter()


@router.get("/health")
def health(db: Session = Depends(get_db)):
    """存活+就绪探针：数据库不可达时返回 503，供负载均衡/编排探活。"""
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        return JSONResponse(
            status_code=503,
            content={"status": "degraded", "service": "juno", "database": "unavailable"},
        )
    return {"status": "ok", "service": "juno", "database": "ok"}


router.include_router(auth.router)
router.include_router(me.router)
router.include_router(users.router)
router.include_router(roles.router)
router.include_router(employees.router)
router.include_router(standard_sets.router)
router.include_router(level_framework.router)
router.include_router(tenant_level_mapping.router)
router.include_router(applications.router)
router.include_router(manager.router)
router.include_router(panel_templates.router)
router.include_router(profiles.router)
router.include_router(inventory_batches.router)
router.include_router(core_positions.router)
router.include_router(cockpit.router)
router.include_router(exam.router)
router.include_router(review.router)
router.include_router(ai.router)
router.include_router(finalize.router)
router.include_router(notifications.router)
router.include_router(audit_logs.router)
router.include_router(idp.router)
router.include_router(recruit.router)
router.include_router(gaps.router)
router.include_router(match.router)
router.include_router(org_diagnosis.router)
router.include_router(structure_gap.router)
router.include_router(org.router)
router.include_router(comp.router)
router.include_router(perf.router)
router.include_router(perf_plans.router)
router.include_router(perf_results.router)
router.include_router(perf_publish.router)
router.include_router(perf_dev.router)
