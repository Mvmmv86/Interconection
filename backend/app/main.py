"""FastAPI application entry point."""

import asyncio
from contextlib import asynccontextmanager, suppress
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import InterconectionException


async def _run_bot_scheduler_loop() -> None:
    """Run active paper bots periodically when enabled by environment."""
    from app.db.session import async_session_maker
    from app.services.bot_scheduler_service import BotSchedulerService

    interval = max(15, int(settings.bot_scheduler_interval_seconds or 60))
    while True:
        try:
            async with async_session_maker() as session:
                service = BotSchedulerService(session)
                await service.run_due_paper_cycles(
                    limit=settings.bot_scheduler_batch_limit,
                    candle_limit=settings.bot_scheduler_candle_limit,
                )
                await session.commit()
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            print(f"Bot scheduler cycle failed: {exc}")
        await asyncio.sleep(interval)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """Application lifespan handler."""
    # Startup
    print(f"Starting {settings.app_name} API...")
    bot_scheduler_task: asyncio.Task | None = None
    if settings.bot_scheduler_enabled:
        bot_scheduler_task = asyncio.create_task(_run_bot_scheduler_loop())
        print("Bot scheduler loop enabled")
    try:
        yield
    finally:
        if bot_scheduler_task is not None:
            bot_scheduler_task.cancel()
            with suppress(asyncio.CancelledError):
                await bot_scheduler_task
    # Shutdown
    print(f"Shutting down {settings.app_name} API...")


app = FastAPI(
    title=settings.app_name,
    description="Treasury Management Platform for Digital Assets",
    version="1.0.0",
    openapi_url=f"{settings.api_v1_prefix}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handlers
@app.exception_handler(InterconectionException)
async def interconection_exception_handler(
    request: Request,
    exc: InterconectionException,
) -> JSONResponse:
    """Handle custom application exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": exc.message,
            "details": exc.details,
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(
    request: Request,
    exc: HTTPException,
) -> JSONResponse:
    """Handle HTTP exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": exc.detail,
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    """Handle all unhandled exceptions with logging."""
    import traceback
    print(f"Unhandled exception: {exc}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "Internal Server Error",
            "error": str(exc),
        },
    )


# Include API router
app.include_router(api_router, prefix=settings.api_v1_prefix)


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "app": settings.app_name,
        "version": "1.0.0",
    }


# Database test endpoint
@app.get("/db-test")
async def db_test():
    """Test database connection."""
    from app.db.session import async_session_maker
    from sqlalchemy import text
    try:
        async with async_session_maker() as session:
            result = await session.execute(text("SELECT 1"))
            return {"status": "ok", "result": result.scalar()}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "error": str(e)}


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": f"Welcome to {settings.app_name} API",
        "docs": "/docs",
        "version": "1.0.0",
    }
