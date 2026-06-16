"""Paper bot engine and strategy backtest helpers."""

from __future__ import annotations

from datetime import datetime, time, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.bot import (
    BotBacktest,
    BotBacktestStatus,
    BotInstance,
    BotInstanceMode,
    BotInstanceStatus,
    BotRun,
    BotRunStatus,
    BotSignal,
    BotSignalAction,
    BotSignalStatus,
    BotStrategy,
    BotTemplate,
    BotTemplateType,
)
from app.models.position import Position, SourceType
from app.models.price_history import PriceHistory


def _json_number(value: object) -> float:
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _enum_value(value: object) -> str:
    return value.value if hasattr(value, "value") else str(value)


class BotEngineService:
    """Runs paper-only bot evaluations and historical backtests.

    The service intentionally does not place live exchange orders. The live
    path is guarded until a dedicated executor + reconciliation layer exists.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def run_paper_cycle(
        self,
        *,
        instance_id: UUID,
        organization_id: UUID,
        user_id: UUID,
        cycle_key: str | None = None,
    ) -> BotRun:
        """Run one idempotent paper evaluation for a bot instance."""
        now = datetime.now(timezone.utc)
        resolved_cycle_key = cycle_key or f"paper:{instance_id}:{now.strftime('%Y%m%d%H%M')}"

        # Fast path for already-completed cycles. A second check is done after
        # locking the instance so concurrent requests return the same run
        # instead of racing into the unique constraint.
        existing = await self.db.scalar(
            select(BotRun)
            .options(selectinload(BotRun.signals))
            .where(BotRun.instance_id == instance_id, BotRun.cycle_key == resolved_cycle_key)
        )
        if existing is not None:
            return existing

        result = await self.db.execute(
            select(BotInstance)
            .options(
                selectinload(BotInstance.template).selectinload(BotTemplate.parameters),
                selectinload(BotInstance.strategy),
                selectinload(BotInstance.client),
                selectinload(BotInstance.exchange),
            )
            .where(
                BotInstance.id == instance_id,
                BotInstance.organization_id == organization_id,
            )
            .with_for_update()
        )
        instance = result.scalar_one_or_none()
        if instance is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot instance not found")
        if instance.mode == BotInstanceMode.LIVE or instance.live_enabled:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Live execution is disabled until executor and reconciliation are enabled",
            )
        if instance.status not in {BotInstanceStatus.CONFIGURED, BotInstanceStatus.ACTIVE}:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Bot instance is {instance.status.value} and cannot run",
            )

        existing_after_lock = await self.db.scalar(
            select(BotRun)
            .options(selectinload(BotRun.signals))
            .where(BotRun.instance_id == instance_id, BotRun.cycle_key == resolved_cycle_key)
        )
        if existing_after_lock is not None:
            return existing_after_lock

        market_snapshot = await self._build_market_snapshot(instance)
        decision, risk_snapshot = await self._decide(instance, market_snapshot)

        run = BotRun(
            id=uuid4(),
            instance_id=instance.id,
            organization_id=instance.organization_id,
            client_id=instance.client_id,
            exchange_id=instance.exchange_id,
            strategy_id=instance.strategy_id,
            mode=instance.mode,
            status=BotRunStatus.SUCCEEDED,
            cycle_key=resolved_cycle_key,
            input_snapshot=market_snapshot,
            decision_snapshot=decision,
            risk_snapshot=risk_snapshot,
            started_at=now,
            completed_at=datetime.now(timezone.utc),
        )
        signal = BotSignal(
            id=uuid4(),
            instance_id=instance.id,
            run_id=run.id,
            organization_id=instance.organization_id,
            client_id=instance.client_id,
            exchange_id=instance.exchange_id,
            strategy_id=instance.strategy_id,
            action=BotSignalAction(decision["action"]),
            status=BotSignalStatus.GENERATED,
            symbol=decision.get("symbol"),
            confidence=decision.get("confidence"),
            price_usd=decision.get("price_usd"),
            quantity=decision.get("quantity"),
            notional_usd=decision.get("notional_usd"),
            reason=decision.get("reason"),
            input_snapshot=market_snapshot,
            risk_snapshot=risk_snapshot,
            generated_at=run.completed_at or now,
        )
        instance.status = BotInstanceStatus.ACTIVE
        instance.last_run_at = run.completed_at
        instance.last_heartbeat_at = run.completed_at
        instance.last_error = None
        self.db.add(run)
        self.db.add(signal)
        await self.db.flush()
        return run

    async def _build_market_snapshot(self, instance: BotInstance) -> dict:
        query = (
            select(Position)
            .options(selectinload(Position.asset))
            .where(
                Position.organization_id == instance.organization_id,
                Position.client_id == instance.client_id,
            )
            .order_by(Position.current_value_usd.desc())
        )
        if instance.exchange_id is not None:
            query = query.where(
                Position.source_type == SourceType.EXCHANGE,
                Position.source_id == instance.exchange_id,
            )
        result = await self.db.execute(query.limit(250))
        positions = result.scalars().all()
        items = []
        total_value = Decimal("0")
        for position in positions:
            symbol = position.asset.symbol if position.asset else None
            value = position.current_value_usd or Decimal("0")
            total_value += value
            items.append(
                {
                    "symbol": symbol,
                    "position_type": _enum_value(position.position_type),
                    "source_type": _enum_value(position.source_type),
                    "quantity": _json_number(position.quantity),
                    "current_price": _json_number(position.current_price),
                    "current_value_usd": _json_number(value),
                    "unrealized_pnl": _json_number(position.unrealized_pnl),
                    "unrealized_pnl_percent": _json_number(position.unrealized_pnl_percent),
                }
            )
        return {
            "client_id": str(instance.client_id),
            "exchange_id": str(instance.exchange_id) if instance.exchange_id else None,
            "position_count": len(items),
            "total_value_usd": _json_number(total_value),
            "positions": items,
            "captured_at": datetime.now(timezone.utc).isoformat(),
        }

    async def _decide(self, instance: BotInstance, market_snapshot: dict) -> tuple[dict, dict]:
        template_type = instance.template.type if instance.template else BotTemplateType.CUSTOM
        strategy_type = instance.strategy.type if instance.strategy else template_type
        risk_config = {
            **(instance.strategy.risk_defaults if instance.strategy else {}),
            **(instance.template.default_parameters if instance.template else {}),
            **(instance.risk_config or {}),
        }
        supported_assets = [item.upper() for item in ((instance.template.supported_assets if instance.template else []) or [])]
        allowed_symbols = [item.upper() for item in risk_config.get("allowed_symbols", [])]
        positions = market_snapshot.get("positions", [])
        top_position = positions[0] if positions else None
        total_value = Decimal(str(market_snapshot.get("total_value_usd") or 0))
        max_order_usd = Decimal(str(risk_config.get("max_order_usd", 100)))
        max_position_usd = Decimal(str(risk_config.get("max_position_usd", 1000)))
        max_daily_signals = int(risk_config.get("max_daily_signals", 20) or 0)
        today_start = datetime.combine(datetime.now(timezone.utc).date(), time.min, tzinfo=timezone.utc)
        signal_count_today = int(
            await self.db.scalar(
                select(func.count(BotSignal.id)).where(
                    BotSignal.instance_id == instance.id,
                    BotSignal.generated_at >= today_start,
                    BotSignal.action != BotSignalAction.HOLD,
                )
            )
            or 0
        )

        symbol = (
            supported_assets[0]
            if supported_assets
            else (str(top_position.get("symbol")).upper() if top_position and top_position.get("symbol") else None)
        )
        action = BotSignalAction.HOLD
        reason = "No actionable condition"
        confidence = Decimal("0.20")
        price = Decimal(str(top_position.get("current_price") or 0)) if top_position else Decimal("0")
        notional = Decimal("0")

        if strategy_type == BotTemplateType.DCA and symbol:
            action = BotSignalAction.BUY
            notional = max_order_usd
            confidence = Decimal("0.62")
            reason = "DCA paper cycle proposes a capped buy signal"
        elif strategy_type == BotTemplateType.REBALANCE and top_position and total_value > 0:
            allocation = Decimal(str(top_position.get("current_value_usd") or 0)) / total_value * Decimal("100")
            threshold = Decimal(str(risk_config.get("target_max_allocation_percent", 50)))
            if allocation > threshold:
                action = BotSignalAction.SELL
                symbol = str(top_position.get("symbol")).upper()
                price = Decimal(str(top_position.get("current_price") or 0))
                notional = min(max_order_usd, Decimal(str(top_position.get("current_value_usd") or 0)) * Decimal("0.10"))
                confidence = Decimal("0.70")
                reason = f"Top allocation {allocation:.2f}% is above target {threshold:.2f}%"
            else:
                reason = "Portfolio is inside rebalance bands"
        elif strategy_type == BotTemplateType.GRID:
            reason = "Grid strategy waiting for configured price bands"
        elif not positions and symbol:
            action = BotSignalAction.BUY
            notional = max_order_usd
            confidence = Decimal("0.45")
            reason = "No current position detected; paper entry signal generated"

        risk_blocks = []
        if allowed_symbols and symbol and symbol not in allowed_symbols:
            risk_blocks.append("symbol_not_allowed")
        if max_daily_signals > 0 and signal_count_today >= max_daily_signals:
            risk_blocks.append("daily_signal_limit")
        if action == BotSignalAction.BUY and max_position_usd > 0:
            current_symbol_value = sum(
                Decimal(str(item.get("current_value_usd") or 0))
                for item in positions
                if symbol and str(item.get("symbol") or "").upper() == symbol
            )
            if current_symbol_value + notional > max_position_usd:
                risk_blocks.append("max_position_usd")
        if max_order_usd <= 0 and action in {BotSignalAction.BUY, BotSignalAction.SELL}:
            risk_blocks.append("max_order_usd_disabled")

        if risk_blocks:
            action = BotSignalAction.HOLD
            reason = f"Risk guard blocked signal: {', '.join(risk_blocks)}"
            notional = Decimal("0")
            confidence = Decimal("0.10")

        quantity = Decimal("0")
        if price > 0 and notional > 0:
            quantity = notional / price

        risk_snapshot = {
            "max_order_usd": _json_number(max_order_usd),
            "max_position_usd": _json_number(max_position_usd),
            "max_daily_signals": max_daily_signals,
            "signals_today": signal_count_today,
            "allowed_symbols": allowed_symbols,
            "blocks": risk_blocks,
            "live_guard": "disabled",
        }
        decision = {
            "action": action.value,
            "symbol": symbol,
            "confidence": _json_number(confidence),
            "price_usd": _json_number(price),
            "quantity": _json_number(quantity),
            "notional_usd": _json_number(notional),
            "reason": reason,
        }
        return decision, risk_snapshot

    def _resolve_backtest_windows(self, strategy: BotStrategy) -> tuple[int, int]:
        indicator_config = strategy.indicator_config or {}
        short_window = int(indicator_config.get("short_window", 5) or 5)
        long_window = int(indicator_config.get("long_window", 20) or 20)
        indicators = indicator_config.get("indicators")
        if isinstance(indicators, list):
            lengths = []
            for indicator in indicators:
                if not isinstance(indicator, dict):
                    continue
                parameters = indicator.get("parameters")
                if not isinstance(parameters, dict):
                    continue
                length = parameters.get("length") or parameters.get("fast_length") or parameters.get("short_length")
                try:
                    parsed = int(length)
                except (TypeError, ValueError):
                    continue
                if parsed > 0:
                    lengths.append(parsed)
            if lengths:
                short_window = min(lengths)
                long_window = max(lengths)
                if short_window == long_window:
                    long_window = max(short_window + 1, 20)
        return short_window, long_window

    async def run_backtest(
        self,
        *,
        strategy: BotStrategy,
        name: str,
        symbol: str,
        timeframe: str,
        initial_capital_usd: Decimal,
        user_id: UUID | None,
        period_start: datetime | None = None,
        period_end: datetime | None = None,
    ) -> BotBacktest:
        """Run a simple historical paper backtest against stored price history.

        Bot Operations v1 intentionally uses one transparent baseline strategy:
        short/long moving-average crossover driven by ``indicator_config``.
        ``rule_config`` is stored for future strategy-specific engines, but is
        not dispatched yet.

        ``PriceHistory`` currently has no timeframe column, so ``timeframe`` is
        persisted with the backtest request and metrics but cannot filter the
        candle query in this version.
        """
        now = datetime.now(timezone.utc)
        backtest = BotBacktest(
            id=uuid4(),
            strategy_id=strategy.id,
            name=name,
            symbol=symbol.upper(),
            timeframe=timeframe,
            status=BotBacktestStatus.RUNNING,
            period_start=period_start,
            period_end=period_end,
            initial_capital_usd=initial_capital_usd,
            result_summary={},
            metrics={},
            logs=[],
            created_by_user_id=user_id,
            started_at=now,
        )
        self.db.add(backtest)
        await self.db.flush()

        query = select(PriceHistory).where(func.upper(PriceHistory.symbol) == symbol.upper())
        if period_start is not None:
            query = query.where(PriceHistory.timestamp >= period_start)
        if period_end is not None:
            query = query.where(PriceHistory.timestamp <= period_end)
        result = await self.db.execute(query.order_by(PriceHistory.timestamp.asc()).limit(2000))
        candles = result.scalars().all()
        if len(candles) < 2:
            backtest.status = BotBacktestStatus.FAILED
            backtest.error = "Not enough price history for backtest"
            backtest.completed_at = datetime.now(timezone.utc)
            return backtest

        cash = Decimal(str(initial_capital_usd))
        units = Decimal("0")
        peak_equity = cash
        max_drawdown = Decimal("0")
        logs = []
        short_window, long_window = self._resolve_backtest_windows(strategy)
        prices: list[Decimal] = []

        for candle in candles:
            price = candle.price_usd
            prices.append(price)
            if len(prices) < min(short_window, long_window):
                continue
            short_ma = sum(prices[-short_window:]) / Decimal(str(min(short_window, len(prices))))
            long_ma = sum(prices[-long_window:]) / Decimal(str(min(long_window, len(prices))))
            action = "hold"
            if short_ma > long_ma and cash > 0:
                spend = cash * Decimal("0.05")
                units += spend / price
                cash -= spend
                action = "buy"
            elif short_ma < long_ma and units > 0:
                sell_units = units * Decimal("0.05")
                cash += sell_units * price
                units -= sell_units
                action = "sell"
            equity = cash + units * price
            peak_equity = max(peak_equity, equity)
            if peak_equity > 0:
                drawdown = (peak_equity - equity) / peak_equity * Decimal("100")
                max_drawdown = max(max_drawdown, drawdown)
            if action != "hold":
                logs.append(
                    {
                        "timestamp": candle.timestamp.isoformat(),
                        "action": action,
                        "price": _json_number(price),
                        "equity": _json_number(equity),
                    }
                )

        final_price = candles[-1].price_usd
        final_equity = cash + units * final_price
        total_return = (
            (final_equity - Decimal(str(initial_capital_usd))) / Decimal(str(initial_capital_usd)) * Decimal("100")
        )
        backtest.status = BotBacktestStatus.SUCCEEDED
        backtest.result_summary = {
            "initial_capital_usd": _json_number(initial_capital_usd),
            "final_equity_usd": _json_number(final_equity),
            "total_return_percent": _json_number(total_return),
            "trade_count": len(logs),
            "engine_note": "v1 placeholder: ran moving-average crossover with windows extracted from selected indicators. Strategy-specific logic ships in the next phase.",
            "short_window": short_window,
            "long_window": long_window,
        }
        backtest.metrics = {
            "max_drawdown_percent": _json_number(max_drawdown),
            "final_cash_usd": _json_number(cash),
            "final_units": _json_number(units),
            "sample_count": len(candles),
            "short_window": short_window,
            "long_window": long_window,
            "requested_timeframe": timeframe,
            "timeframe_filter_applied": False,
        }
        backtest.logs = logs[-250:]
        backtest.completed_at = datetime.now(timezone.utc)
        return backtest
