"""Celery tasks for bot backtests."""

from __future__ import annotations

import asyncio
from uuid import UUID

from app.celery_app import celery_app
from app.db.session import async_session_maker
from app.services.bot_backtest_service import BotBacktestService


if celery_app is not None:

    @celery_app.task(name="bots.run_backtest", bind=True)
    def run_bot_backtest_task(self, run_id: str) -> dict:
        """Run one queued heavy backtest outside the API event loop."""
        return asyncio.run(_run_bot_backtest(run_id))
else:

    class _MissingCeleryTask:
        def delay(self, *_args, **_kwargs):
            raise RuntimeError("Celery is not installed or configured")

    run_bot_backtest_task = _MissingCeleryTask()


async def _run_bot_backtest(run_id: str) -> dict:
    async with async_session_maker() as session:
        service = BotBacktestService(session)
        run = await service.run_backtest_run(UUID(str(run_id)))
        await session.commit()
        return {"run_id": str(run.id), "status": run.status.value}
