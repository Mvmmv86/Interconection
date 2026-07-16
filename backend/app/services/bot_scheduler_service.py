"""Safe paper-cycle scheduler for active bot instances."""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.bot import BotInstance, BotInstanceAssetStatus, BotInstanceMode, BotInstanceStatus, BotTemplate
from app.services.bot_engine_service import BotEngineService
from app.services.market_data_ingestion_service import (
    MarketDataIngestionService,
    resolve_strategy_market_type,
    resolve_strategy_symbols,
    resolve_strategy_timeframe,
)
from app.services.market_ranking_service import MarketRankingService

logger = logging.getLogger(__name__)


class BotSchedulerService:
    """Runs active paper bots once per closed candle without duplicate cycles."""

    SCHEDULER_LOCK_KEY = 86021401

    def __init__(self, db: AsyncSession):
        self.db = db

    async def _try_acquire_scheduler_lock(self) -> bool:
        """Avoid duplicate scheduler loops when the API runs multiple workers."""
        try:
            return bool(await self.db.scalar(text("SELECT pg_try_advisory_xact_lock(:key)"), {"key": self.SCHEDULER_LOCK_KEY}))
        except Exception as exc:
            await self.db.rollback()
            logger.warning("Bot scheduler advisory lock unavailable; continuing without global lock: %s", exc)
            return True

    async def _release_scheduler_lock(self) -> None:
        try:
            # The scheduler uses pg_try_advisory_xact_lock so the lock cannot
            # leak into an idle pooled connection. A final rollback is harmless
            # after per-cycle commits and releases the lock if no cycle committed.
            await self.db.rollback()
        except Exception as exc:
            await self.db.rollback()
            logger.warning("Bot scheduler advisory lock release failed: %s", exc)

    async def run_due_paper_cycles(
        self,
        *,
        organization_id: UUID | None = None,
        limit: int = 50,
        candle_limit: int = 300,
    ) -> dict:
        """Run active paper instances for the latest closed candle."""
        should_run = await self._try_acquire_scheduler_lock()
        if not should_run:
            return {
                "processed": 0,
                "cycle_attempt_count": 0,
                "run_count": 0,
                "skipped_count": 1,
                "error_count": 0,
                "runs": [],
                "skipped": [{"reason": "scheduler_already_running"}],
                "errors": [],
            }

        runs: list[dict] = []
        skipped: list[dict] = []
        errors: list[dict] = []
        attempted_cycles = 0
        instances: list[BotInstance] = []

        try:
            max_cycles = max(1, min(int(limit or 50), 500))
            query = (
                select(BotInstance)
                .options(
                    selectinload(BotInstance.strategy),
                    selectinload(BotInstance.template).selectinload(BotTemplate.parameters),
                    selectinload(BotInstance.client),
                    selectinload(BotInstance.exchange),
                    selectinload(BotInstance.assets),
                )
                .where(
                    BotInstance.mode == BotInstanceMode.PAPER,
                    BotInstance.live_enabled == False,
                    BotInstance.status == BotInstanceStatus.ACTIVE,
                    BotInstance.strategy_id.is_not(None),
                    BotInstance.exchange_id.is_not(None),
                )
                .order_by(BotInstance.last_run_at.asc().nullsfirst(), BotInstance.created_at.asc())
                .limit(max(1, min(max_cycles, 200)))
            )
            if organization_id is not None:
                query = query.where(BotInstance.organization_id == organization_id)

            result = await self.db.execute(query)
            instances = result.scalars().unique().all()
            ingestion = MarketDataIngestionService(self.db)
            ranking_service = MarketRankingService(self.db)
            engine = BotEngineService(self.db)

            for instance in instances:
                if attempted_cycles >= max_cycles:
                    break
                if instance.exchange is None or instance.strategy is None:
                    skipped.append({"instance_id": str(instance.id), "reason": "missing_exchange_or_strategy"})
                    continue
                fallback_symbols = resolve_strategy_symbols(instance.strategy, instance)
                symbols, basket_metadata = await ranking_service.resolve_instance_basket_symbols(
                    instance=instance,
                    fallback_symbols=fallback_symbols,
                    refresh_snapshot=True,
                )
                timeframe = resolve_strategy_timeframe(instance.strategy, instance)
                market_type = resolve_strategy_market_type(instance.strategy, instance)
                approved_symbols = [
                    asset.symbol
                    for asset in sorted(
                        instance.assets or [],
                        key=lambda asset: (
                            asset.origin_rank is None,
                            asset.origin_rank or 0,
                            asset.symbol,
                        ),
                    )
                    if asset.status == BotInstanceAssetStatus.APPROVED and asset.approved_for_live
                ]
                if not symbols and not approved_symbols:
                    skipped.append({
                        "instance_id": str(instance.id),
                        "reason": "missing_symbols",
                        "basket": basket_metadata,
                    })
                    continue
                if not approved_symbols:
                    skipped.append({
                        "instance_id": str(instance.id),
                        "reason": "missing_approved_assets",
                        "candidate_symbols": symbols,
                        "basket": basket_metadata,
                    })
                    continue
                basket_metadata = {
                    **dict(basket_metadata or {}),
                    "operational_source": "approved_assets",
                    "operational_symbols": approved_symbols,
                    "candidate_symbols": symbols,
                    "requires_operator_approval": True,
                }
                market_snapshot = await engine.build_market_snapshot(instance)
                market_snapshot["market_basket"] = basket_metadata
                market_snapshot["allowed_symbols"] = approved_symbols
                for symbol in approved_symbols:
                    if attempted_cycles >= max_cycles:
                        break
                    attempted_cycles += 1
                    try:
                        await ingestion.sync_exchange_candles(
                            exchange_id=instance.exchange_id,
                            organization_id=instance.organization_id,
                            symbols=[symbol],
                            timeframes=[timeframe],
                            limit=candle_limit,
                            market_type=market_type,
                        )
                        latest = await ingestion.latest_closed_candle(
                            exchange=instance.exchange.exchange,
                            symbol=symbol,
                            timeframe=timeframe,
                            market_type=market_type,
                        )
                        if latest is None:
                            skipped.append({"instance_id": str(instance.id), "symbol": symbol, "reason": "no_closed_candle"})
                            await self.db.commit()
                            continue
                        await self.db.commit()
                        cycle_key = (
                            f"paper:{instance.id}:{latest.exchange}:{latest.symbol}:"
                            f"{latest.market_type}:{latest.timeframe}:{latest.close_time.isoformat()}"
                        )
                        run = await engine.run_paper_cycle(
                            instance_id=instance.id,
                            organization_id=instance.organization_id,
                            user_id=instance.created_by_user_id,
                            cycle_key=cycle_key,
                            symbol=latest.symbol,
                            timeframe=latest.timeframe,
                            triggered_by="scheduler",
                            market_snapshot=market_snapshot,
                        )
                        risk_blocks = list((run.risk_snapshot or {}).get("blocks") or [])
                        runs.append(
                            {
                                "instance_id": str(instance.id),
                                "run_id": str(run.id),
                                "cycle_key": run.cycle_key,
                                "symbol": latest.symbol,
                                "timeframe": latest.timeframe,
                                "risk_blocks": risk_blocks,
                            }
                        )
                        if "daily_signal_limit" in risk_blocks:
                            skipped.append(
                                {
                                    "instance_id": str(instance.id),
                                    "symbol": latest.symbol,
                                    "reason": "daily_signal_limit",
                                }
                            )
                        await self.db.commit()
                    except Exception as exc:
                        await self.db.rollback()
                        await self.db.execute(
                            update(BotInstance)
                            .where(BotInstance.id == instance.id)
                            .values(last_error=str(exc)[:1000])
                        )
                        await self.db.commit()
                        errors.append({"instance_id": str(instance.id), "symbol": symbol, "error": str(exc)})
        finally:
            await self._release_scheduler_lock()

        return {
            "processed": len(instances),
            "cycle_attempt_count": attempted_cycles,
            "run_count": len(runs),
            "skipped_count": len(skipped),
            "error_count": len(errors),
            "runs": runs,
            "skipped": skipped,
            "errors": errors,
        }
