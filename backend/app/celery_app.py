"""Celery application for heavy background jobs."""

from app.core.config import settings

try:
    from celery import Celery
except ImportError:  # pragma: no cover - keeps app imports safe if worker deps are absent.
    Celery = None  # type: ignore[assignment]


if Celery is not None:
    celery_app = Celery(
        "interconection",
        broker=settings.celery_broker_url,
        backend=settings.celery_result_backend,
    )
    celery_app.conf.update(
        accept_content=["json"],
        enable_utc=True,
        result_serializer="json",
        task_serializer="json",
        task_track_started=True,
        timezone="UTC",
        imports=("app.workers.bot_backtest_tasks",),
        task_routes={
            "bots.run_backtest": {"queue": "backtests"},
        },
    )
    celery_app.autodiscover_tasks(["app.workers"])
else:  # pragma: no cover
    celery_app = None
