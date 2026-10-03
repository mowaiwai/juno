import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.internal.router import router as internal_router
from app.api.v1.router import router as v1_router
from app.config import settings
from app.services.scheduler import run_daily_jobs_with_lock

logger = logging.getLogger("juno")

# 启动后首次执行延迟与执行间隔
_FIRST_RUN_DELAY = 30  # 秒，避开启动高峰
_RUN_INTERVAL = 24 * 60 * 60  # 秒


async def scheduler_loop() -> None:
    """每日定时任务循环：advisory lock 保证多实例只执行一份。"""
    await asyncio.sleep(_FIRST_RUN_DELAY)
    while True:
        try:
            result = await asyncio.to_thread(run_daily_jobs_with_lock)
            logger.info("每日任务执行完成：%s", result)
        except Exception:
            logger.exception("每日任务执行失败")
        await asyncio.sleep(_RUN_INTERVAL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    tasks: list[asyncio.Task] = []
    if settings.scheduler_enabled:
        tasks.append(asyncio.create_task(scheduler_loop()))
    yield
    for task in tasks:
        task.cancel()
    for task in tasks:
        with contextlib.suppress(asyncio.CancelledError):
            await task


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)

    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    if origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        # 统一错误体 {code, message}
        if isinstance(exc.detail, dict):
            return JSONResponse(status_code=exc.status_code, content=exc.detail)
        return JSONResponse(
            status_code=exc.status_code,
            content={"code": "error", "message": str(exc.detail)},
        )

    app.include_router(v1_router, prefix="/api/v1")
    app.include_router(internal_router, prefix="/api")
    return app


app = create_app()
