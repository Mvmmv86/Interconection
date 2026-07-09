"""Celery workers module."""

from app.workers.bot_backtest_tasks import run_bot_backtest_task

__all__ = ["run_bot_backtest_task"]
