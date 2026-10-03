"""AI 生成后台 worker：独立会话执行，供 FastAPI BackgroundTasks 调度。"""
import uuid

from app.database import SessionLocal
from app.services.ai import generate_for_application


def run_ai_generation(application_id: uuid.UUID) -> None:
    db = SessionLocal()
    try:
        generate_for_application(db, application_id)
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()
