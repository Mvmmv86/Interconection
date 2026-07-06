"""Paper bot engine and strategy backtest helpers."""

from __future__ import annotations

import math
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
from app.models.market_candle import MarketCandle
from app.models.position import Position, SourceType
from app.models.price_history import PriceHistory
from app.services.market_data_ingestion_service import (
    normalize_exchange_key,
    normalize_market_type,
    normalize_strategy_symbol,
    resolve_strategy_market_type,
    resolve_strategy_symbols,
    resolve_strategy_timeframe,
)


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


def _safe_float(value: object, default: float = 0.0) -> float:
    if value is None:
        return default
    if isinstance(value, Decimal):
        return float(value)
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    return parsed if math.isfinite(parsed) else default


def _safe_int(value: object, default: int = 1) -> int:
    try:
        parsed = int(float(str(value)))
    except (TypeError, ValueError):
        return default
    return max(1, parsed)


def _candle_close_value(candle: object) -> object:
    return getattr(candle, "close", getattr(candle, "price_usd", 0))


def _candle_high_value(candle: object, fallback: object) -> object:
    return getattr(candle, "high", getattr(candle, "high_24h", fallback))


def _candle_low_value(candle: object, fallback: object) -> object:
    return getattr(candle, "low", getattr(candle, "low_24h", fallback))


def _candle_volume_value(candle: object) -> object:
    return getattr(candle, "volume", getattr(candle, "volume_24h", 0))


def _candle_timestamp(candle: object) -> datetime:
    return getattr(candle, "close_time", getattr(candle, "timestamp"))


def _empty_series(length: int) -> list[float | None]:
    return [None for _ in range(length)]


def _rolling_sma(values: list[float], length: int) -> list[float | None]:
    output = _empty_series(len(values))
    if length <= 0:
        return output
    rolling = 0.0
    for index, value in enumerate(values):
        rolling += value
        if index >= length:
            rolling -= values[index - length]
        if index >= length - 1:
            output[index] = rolling / length
    return output


def _rolling_sma_nullable(values: list[float | None], length: int) -> list[float | None]:
    output = _empty_series(len(values))
    for index in range(len(values)):
        if index < length - 1:
            continue
        window = values[index - length + 1 : index + 1]
        if any(value is None for value in window):
            continue
        output[index] = sum(float(value) for value in window) / length
    return output


def _rolling_max(values: list[float], length: int) -> list[float | None]:
    output = _empty_series(len(values))
    for index in range(len(values)):
        if index >= length - 1:
            output[index] = max(values[index - length + 1 : index + 1])
    return output


def _rolling_min(values: list[float], length: int) -> list[float | None]:
    output = _empty_series(len(values))
    for index in range(len(values)):
        if index >= length - 1:
            output[index] = min(values[index - length + 1 : index + 1])
    return output


def _rolling_stddev(values: list[float], length: int) -> list[float | None]:
    output = _empty_series(len(values))
    for index in range(len(values)):
        if index < length - 1:
            continue
        window = values[index - length + 1 : index + 1]
        mean = sum(window) / length
        variance = sum((item - mean) ** 2 for item in window) / length
        output[index] = math.sqrt(variance)
    return output


def _ema(values: list[float], length: int) -> list[float | None]:
    output = _empty_series(len(values))
    if not values or length <= 0:
        return output
    multiplier = 2 / (length + 1)
    current: float | None = None
    for index, value in enumerate(values):
        if index < length - 1:
            continue
        if current is None:
            current = sum(values[index - length + 1 : index + 1]) / length
        else:
            current = (value - current) * multiplier + current
        output[index] = current
    return output


def _ema_nullable(values: list[float | None], length: int) -> list[float | None]:
    output = _empty_series(len(values))
    multiplier = 2 / (length + 1)
    current: float | None = None
    buffer: list[float] = []
    for index, value in enumerate(values):
        if value is None:
            continue
        buffer.append(value)
        if len(buffer) < length:
            continue
        if current is None:
            current = sum(buffer[-length:]) / length
        else:
            current = (value - current) * multiplier + current
        output[index] = current
    return output


def _rma_nullable(values: list[float | None], length: int) -> list[float | None]:
    output = _empty_series(len(values))
    current: float | None = None
    buffer: list[float] = []
    for index, value in enumerate(values):
        if value is None:
            continue
        buffer.append(value)
        if len(buffer) < length:
            continue
        if current is None:
            current = sum(buffer[-length:]) / length
        else:
            current = (current * (length - 1) + value) / length
        output[index] = current
    return output


def _rma(values: list[float], length: int) -> list[float | None]:
    output = _empty_series(len(values))
    current: float | None = None
    for index, value in enumerate(values):
        if index < length - 1:
            continue
        if current is None:
            current = sum(values[index - length + 1 : index + 1]) / length
        else:
            current = (current * (length - 1) + value) / length
        output[index] = current
    return output


def _wma_nullable(values: list[float | None], length: int) -> list[float | None]:
    output = _empty_series(len(values))
    denominator = length * (length + 1) / 2
    for index in range(len(values)):
        if index < length - 1:
            continue
        window = values[index - length + 1 : index + 1]
        if any(value is None for value in window):
            continue
        output[index] = sum(float(value) * weight for weight, value in enumerate(window, start=1)) / denominator
    return output


def _wma(values: list[float], length: int) -> list[float | None]:
    output = _empty_series(len(values))
    denominator = length * (length + 1) / 2
    for index in range(len(values)):
        if index < length - 1:
            continue
        window = values[index - length + 1 : index + 1]
        output[index] = sum(value * weight for weight, value in enumerate(window, start=1)) / denominator
    return output


def _series_at(series: list[float | None], index: int) -> float | None:
    if index < 0 or index >= len(series):
        return None
    return series[index]


def _coalesce_series(primary: list[float | None], fallback: list[float]) -> list[float]:
    return [fallback[index] if value is None else value for index, value in enumerate(primary)]


class BotEngineService:
    """Runs paper-only bot evaluations and historical backtests.

    The service intentionally does not place live exchange orders. The live
    path is guarded until a dedicated executor + reconciliation layer exists.
    """

    IMPLEMENTED_INDICATORS = frozenset(
        {
            "sma",
            "ema",
            "wma",
            "rma",
            "dema",
            "tema",
            "hma",
            "kama",
            "alma",
            "vwma",
            "roc",
            "momentum",
            "standard_deviation",
            "bollinger_bands",
            "rsi",
            "stoch_rsi",
            "macd",
            "ultimate_oscillator",
            "awesome_oscillator",
            "atr",
            "adx",
            "dmi",
            "supertrend",
            "parabolic_sar",
            "ichimoku",
            "aroon",
            "donchian_channel",
            "keltner_channel",
            "historical_volatility",
            "stochastic",
            "williams_r",
            "cci",
            "volume_sma",
            "obv",
            "vwap",
            "mfi",
            "bc_alpha_trend",
            "accumulation_distribution",
            "chaikin_money_flow",
        }
    )

    def __init__(self, db: AsyncSession):
        self.db = db

    async def run_paper_cycle(
        self,
        *,
        instance_id: UUID,
        organization_id: UUID,
        user_id: UUID | None,
        cycle_key: str | None = None,
        symbol: str | None = None,
        timeframe: str | None = None,
        triggered_by: str = "manual",
        market_snapshot: dict | None = None,
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

        market_snapshot = dict(market_snapshot) if market_snapshot is not None else await self._build_market_snapshot(instance)
        if symbol:
            market_snapshot["requested_symbol"] = normalize_strategy_symbol(symbol)
        if timeframe:
            market_snapshot["requested_timeframe"] = str(timeframe)
        market_snapshot["triggered_by"] = triggered_by
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

    async def build_market_snapshot(self, instance: BotInstance) -> dict:
        """Build the portfolio snapshot used by one bot instance evaluation."""
        return await self._build_market_snapshot(instance)

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

    def _strategy_rule_version(self, strategy: BotStrategy | None) -> int:
        if strategy is None:
            return 1
        rule_config = strategy.rule_config or {}
        embedded_version = _safe_int(rule_config.get("version"), 1) if isinstance(rule_config, dict) else 1
        return max(int(strategy.version or 1), embedded_version)

    async def _decide(self, instance: BotInstance, market_snapshot: dict) -> tuple[dict, dict]:
        strategy = instance.strategy
        if strategy is not None and self._strategy_rule_version(strategy) >= 2:
            return await self._decide_v2(instance, strategy, market_snapshot)
        return await self._decide_v1_legacy(instance, market_snapshot)

    def _allowed_symbols_for_decision(
        self,
        strategy: BotStrategy | None,
        instance: BotInstance,
        market_snapshot: dict,
    ) -> list[str]:
        """Prefer the scheduler/request basket over static strategy catalogs."""
        injected_symbols = market_snapshot.get("allowed_symbols")
        if isinstance(injected_symbols, list):
            normalized = []
            seen = set()
            for raw_symbol in injected_symbols:
                symbol = normalize_strategy_symbol(str(raw_symbol or ""))
                if not symbol or symbol in seen:
                    continue
                seen.add(symbol)
                normalized.append(symbol)
            if normalized:
                return normalized
        return resolve_strategy_symbols(strategy, instance)

    async def _decide_v1_legacy(self, instance: BotInstance, market_snapshot: dict) -> tuple[dict, dict]:
        template_type = instance.template.type if instance.template else BotTemplateType.CUSTOM
        strategy_type = instance.strategy.type if instance.strategy else template_type
        risk_config = {
            **(instance.strategy.risk_defaults if instance.strategy else {}),
            **(instance.template.default_parameters if instance.template else {}),
            **(instance.risk_config or {}),
        }
        supported_assets = self._allowed_symbols_for_decision(instance.strategy, instance, market_snapshot)
        allowed_symbols = supported_assets
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

        requested_symbol = market_snapshot.get("requested_symbol")
        symbol = (
            normalize_strategy_symbol(str(requested_symbol))
            if requested_symbol
            else (
                supported_assets[0]
                if supported_assets
                else (normalize_strategy_symbol(str(top_position.get("symbol"))) if top_position and top_position.get("symbol") else None)
            )
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
                symbol = normalize_strategy_symbol(str(top_position.get("symbol")))
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
                if symbol and normalize_strategy_symbol(str(item.get("symbol") or "")) == symbol
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

    async def _decide_v2(
        self,
        instance: BotInstance,
        strategy: BotStrategy,
        market_snapshot: dict,
    ) -> tuple[dict, dict]:
        risk_config = {
            **(strategy.risk_defaults or {}),
            **(instance.template.default_parameters if instance.template else {}),
            **(instance.risk_config or {}),
        }
        allowed_symbols = self._allowed_symbols_for_decision(strategy, instance, market_snapshot)
        positions = market_snapshot.get("positions", [])
        top_position = positions[0] if positions else None
        requested_symbol = market_snapshot.get("requested_symbol")
        symbol = (
            normalize_strategy_symbol(str(requested_symbol))
            if requested_symbol
            else allowed_symbols[0]
            if allowed_symbols
            else (normalize_strategy_symbol(str(top_position.get("symbol"))) if top_position and top_position.get("symbol") else None)
        )
        if not symbol:
            return (
                {
                    "action": BotSignalAction.HOLD.value,
                    "symbol": None,
                    "confidence": 0.1,
                    "price_usd": 0,
                    "quantity": 0,
                    "notional_usd": 0,
                    "reason": "Strategy v2 has no resolvable symbol",
                },
                {"rule_version": self._strategy_rule_version(strategy), "blocks": ["missing_symbol"], "live_guard": "disabled"},
            )

        timeframe = str(market_snapshot.get("requested_timeframe") or self._strategy_timeframe(strategy, instance))
        candles, candle_source = await self._load_strategy_candles(
            strategy,
            instance=instance,
            symbol=symbol,
            timeframe=timeframe,
            limit=self._strategy_candle_limit(strategy),
            ascending=False,
        )
        data_quality = self._data_quality(candles)
        data_warnings = self._data_quality_warnings(data_quality)
        if len(candles) < 2:
            return (
                {
                    "action": BotSignalAction.HOLD.value,
                    "symbol": symbol,
                    "confidence": 0.1,
                    "price_usd": 0,
                    "quantity": 0,
                    "notional_usd": 0,
                    "reason": "Not enough price history for strategy v2 decision",
                },
                {
                    "rule_version": self._strategy_rule_version(strategy),
                    "blocks": ["missing_price_history"],
                    "data_quality": data_quality,
                    "data_warnings": data_warnings,
                    "live_guard": "disabled",
                },
            )

        frames, fallback_indicators = self._indicator_frames(strategy, candles)
        latest_index = len(candles) - 1
        entry_passed, entry_evaluations = self._evaluate_rule_group(strategy.rule_config or {}, "entry", frames, latest_index)
        exit_passed, exit_evaluations = self._evaluate_rule_group(strategy.rule_config or {}, "exit", frames, latest_index)
        latest_price = Decimal(str(_candle_close_value(candles[-1])))
        max_order_usd = Decimal(str(risk_config.get("max_order_usd", 100) or 100))
        max_position_usd = Decimal(str(risk_config.get("max_position_usd", 1000) or 1000))
        risk_per_trade_percent = Decimal(str(risk_config.get("risk_per_trade_percent", 0) or 0))
        max_exposure_per_trade_percent = Decimal(str(risk_config.get("max_exposure_per_trade_percent", 0) or 0))
        allow_averaging = str(risk_config.get("allow_averaging", "false")).lower() in {"1", "true", "yes", "on"}
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
        current_symbol_value = sum(
            Decimal(str(item.get("current_value_usd") or 0))
            for item in positions
            if normalize_strategy_symbol(str(item.get("symbol") or "")) == symbol
        )
        alpha_stop = self._condition_value(frames, "bc_alpha_trend", "stop", latest_index)
        stop_price = Decimal(str(alpha_stop)) if alpha_stop is not None and alpha_stop > 0 else Decimal("0")
        stop_distance_percent = (
            abs(latest_price - stop_price) / latest_price * Decimal("100")
            if latest_price > 0 and stop_price > 0
            else Decimal("0")
        )
        portfolio_capital = Decimal(str(market_snapshot.get("total_value_usd") or 0))
        sizing_capital = portfolio_capital
        sizing_capital_source = "portfolio_snapshot"
        if sizing_capital <= 0:
            sizing_capital = max_position_usd if max_position_usd > 0 else max_order_usd
            sizing_capital_source = "risk_limit_fallback"
        risk_amount = sizing_capital * risk_per_trade_percent / Decimal("100") if risk_per_trade_percent > 0 else Decimal("0")
        risk_sized_notional = (
            risk_amount / (stop_distance_percent / Decimal("100"))
            if risk_amount > 0 and stop_distance_percent > 0
            else max_order_usd
        )
        exposure_cap = (
            sizing_capital * max_exposure_per_trade_percent / Decimal("100")
            if max_exposure_per_trade_percent > 0 and sizing_capital > 0
            else max_order_usd
        )
        action = BotSignalAction.HOLD
        reason = "Strategy v2 conditions did not pass"
        confidence = Decimal("0.25")
        notional = Decimal("0")
        stop_model = str(risk_config.get("stop_model") or "alpha_trend")
        stop_exit = (
            stop_model == "alpha_trend"
            and current_symbol_value > 0
            and stop_price > 0
            and latest_price <= stop_price
        )
        if stop_exit:
            action = BotSignalAction.SELL
            notional = min(current_symbol_value, max_order_usd if max_order_usd > 0 else current_symbol_value)
            confidence = Decimal("0.82")
            reason = "AlphaTrend stop invalidated the open paper position"
        elif exit_passed and current_symbol_value > 0:
            action = BotSignalAction.SELL
            notional = min(current_symbol_value, max_order_usd if max_order_usd > 0 else current_symbol_value)
            confidence = Decimal("0.78")
            reason = "Strategy v2 exit conditions passed"
        elif entry_passed and (current_symbol_value <= 0 or allow_averaging):
            action = BotSignalAction.BUY
            available_capacity = max(Decimal("0"), max_position_usd - current_symbol_value) if max_position_usd > 0 else max_order_usd
            notional = min(max_order_usd, risk_sized_notional, exposure_cap, available_capacity)
            confidence = Decimal("0.74")
            reason = "Strategy v2 entry conditions passed"
        elif entry_passed:
            reason = "Strategy v2 entry passed but averaging is disabled for an open position"

        risk_blocks = []
        if allowed_symbols and symbol not in allowed_symbols:
            risk_blocks.append("symbol_not_allowed")
        if max_daily_signals > 0 and signal_count_today >= max_daily_signals:
            risk_blocks.append("daily_signal_limit")
        if action == BotSignalAction.BUY and max_position_usd > 0 and current_symbol_value + notional > max_position_usd:
            risk_blocks.append("max_position_usd")
        if max_order_usd <= 0 and action in {BotSignalAction.BUY, BotSignalAction.SELL}:
            risk_blocks.append("max_order_usd_disabled")
        if risk_blocks:
            action = BotSignalAction.HOLD
            reason = f"Risk guard blocked strategy v2 signal: {', '.join(risk_blocks)}"
            notional = Decimal("0")
            confidence = Decimal("0.10")

        quantity = notional / latest_price if latest_price > 0 and notional > 0 else Decimal("0")
        risk_snapshot = {
            "rule_version": self._strategy_rule_version(strategy),
            "max_order_usd": _json_number(max_order_usd),
            "max_position_usd": _json_number(max_position_usd),
            "max_daily_signals": max_daily_signals,
            "signals_today": signal_count_today,
            "allowed_symbols": allowed_symbols,
            "allow_averaging": allow_averaging,
            "timeframe": timeframe,
            "candle_source": candle_source,
            "stop_model": stop_model,
            "alpha_trend_stop": _json_number(stop_price),
            "stop_distance_percent": _json_number(stop_distance_percent),
            "risk_per_trade_percent": _json_number(risk_per_trade_percent),
            "sizing_capital_usd": _json_number(sizing_capital),
            "sizing_capital_source": sizing_capital_source,
            "risk_amount_usd": _json_number(risk_amount),
            "sizing_model": "risk_distance" if risk_amount > 0 and stop_distance_percent > 0 else "max_order_fallback",
            "entry_passed": entry_passed,
            "exit_passed": exit_passed,
            "stop_exit": stop_exit,
            "entry_conditions": entry_evaluations,
            "exit_conditions": exit_evaluations,
            "fallback_indicators": fallback_indicators,
            "data_quality": data_quality,
            "data_warnings": data_warnings,
            "blocks": risk_blocks,
            "live_guard": "disabled",
        }
        decision = {
            "action": action.value,
            "symbol": symbol,
            "confidence": _json_number(confidence),
            "price_usd": _json_number(latest_price),
            "quantity": _json_number(quantity),
            "notional_usd": _json_number(notional),
            "reason": reason,
        }
        return decision, risk_snapshot

    def _source_values(self, candles: list[MarketCandle | PriceHistory], source: object = "close") -> list[float]:
        source_key = str(source or "close").lower()
        close = [_safe_float(_candle_close_value(candle)) for candle in candles]
        high = [_safe_float(_candle_high_value(candle, close[index]), close[index]) for index, candle in enumerate(candles)]
        low = [_safe_float(_candle_low_value(candle, close[index]), close[index]) for index, candle in enumerate(candles)]
        volume = [_safe_float(_candle_volume_value(candle)) for candle in candles]
        if source_key == "high":
            return high
        if source_key == "low":
            return low
        if source_key == "volume":
            return volume
        if source_key == "hl2":
            return [(high[index] + low[index]) / 2 for index in range(len(candles))]
        if source_key == "hlc3":
            return [(high[index] + low[index] + close[index]) / 3 for index in range(len(candles))]
        if source_key == "ohlc4":
            return [(high[index] + low[index] + close[index] + close[index]) / 4 for index in range(len(candles))]
        return close

    def _true_range(self, candles: list[PriceHistory]) -> list[float]:
        close = self._source_values(candles, "close")
        high = self._source_values(candles, "high")
        low = self._source_values(candles, "low")
        output: list[float] = []
        for index in range(len(candles)):
            previous_close = close[index - 1] if index > 0 else close[index]
            output.append(max(high[index] - low[index], abs(high[index] - previous_close), abs(low[index] - previous_close)))
        return output

    def _calculate_indicator(
        self,
        key: str,
        parameters: dict,
        candles: list[PriceHistory],
    ) -> dict[str, list[float | None]]:
        close = self._source_values(candles, "close")
        high = self._source_values(candles, "high")
        low = self._source_values(candles, "low")
        volume = self._source_values(candles, "volume")
        source = self._source_values(candles, parameters.get("source", "close"))
        length = _safe_int(parameters.get("length"), 20)
        key = key.lower()

        if key == "bc_alpha_trend":
            atr_length = _safe_int(parameters.get("atr_length"), 14)
            flow_length = _safe_int(parameters.get("flow_length"), 14)
            trend_offset = _safe_int(parameters.get("trend_offset"), 2)
            atr_multiplier = _safe_float(parameters.get("atr_multiplier"), 1.0)
            flow_threshold = _safe_float(parameters.get("flow_threshold"), 50.0)
            flow_source = str(parameters.get("flow_source") or "auto").lower()

            atr = _rma(self._true_range(candles), atr_length)
            rsi = self._calculate_indicator("rsi", {"length": flow_length, "source": "close"}, candles)["value"]
            volume_coverage = sum(1 for value in volume if value > 0) / len(volume) if volume else 0.0
            use_mfi = flow_source in {"auto", "mfi"} and volume_coverage >= 0.5
            if flow_source == "rsi" or not use_mfi:
                flow = rsi
            else:
                flow = self._calculate_indicator("mfi", {"length": flow_length}, candles)["value"]

            alpha_line = _empty_series(len(source))
            trend = _empty_series(len(source))
            signal = _empty_series(len(source))
            long_signal = _empty_series(len(source))
            short_signal = _empty_series(len(source))
            stop = _empty_series(len(source))

            for index in range(len(source)):
                signal[index] = 0.0
                long_signal[index] = 0.0
                short_signal[index] = 0.0
                if atr[index] is None or flow[index] is None:
                    continue

                up_support = low[index] - atr_multiplier * float(atr[index])
                down_resistance = high[index] + atr_multiplier * float(atr[index])
                previous_alpha = alpha_line[index - 1] if index > 0 else None

                if float(flow[index]) >= flow_threshold:
                    alpha_line[index] = max(up_support, float(previous_alpha)) if previous_alpha is not None else up_support
                else:
                    alpha_line[index] = min(down_resistance, float(previous_alpha)) if previous_alpha is not None else down_resistance

                reference = alpha_line[index - trend_offset] if index >= trend_offset else None
                previous_trend = trend[index - 1] if index > 0 and trend[index - 1] is not None else None
                if reference is None:
                    trend[index] = previous_trend if previous_trend is not None else 0.0
                elif alpha_line[index] > reference:
                    trend[index] = 1.0
                elif alpha_line[index] < reference:
                    trend[index] = -1.0
                else:
                    trend[index] = previous_trend if previous_trend is not None else 0.0

                if previous_trend is not None and previous_trend != 0.0 and trend[index] > 0 and previous_trend <= 0:
                    signal[index] = 1.0
                    long_signal[index] = 1.0
                elif previous_trend is not None and previous_trend != 0.0 and trend[index] < 0 and previous_trend >= 0:
                    signal[index] = -1.0
                    short_signal[index] = 1.0
                stop[index] = alpha_line[index]

            return {
                "value": alpha_line,
                "trend": trend,
                "signal": signal,
                "long_signal": long_signal,
                "short_signal": short_signal,
                "stop": stop,
                "atr": atr,
                "flow": flow,
            }
        if key == "sma":
            return {"value": _rolling_sma(source, length)}
        if key == "ema":
            return {"value": _ema(source, length)}
        if key == "wma":
            return {"value": _wma(source, length)}
        if key == "rma":
            return {"value": _rma(source, length)}
        if key == "dema":
            first = _ema(source, length)
            second = _ema(_coalesce_series(first, source), length)
            return {"value": [(2 * first[index] - second[index]) if first[index] is not None and second[index] is not None else None for index in range(len(source))]}
        if key == "tema":
            first = _ema(source, length)
            first_values = _coalesce_series(first, source)
            second = _ema(first_values, length)
            third = _ema(_coalesce_series(second, first_values), length)
            return {
                "value": [
                    (3 * first[index] - 3 * second[index] + third[index])
                    if first[index] is not None and second[index] is not None and third[index] is not None
                    else None
                    for index in range(len(source))
                ]
            }
        if key == "hma":
            half_length = max(1, length // 2)
            sqrt_length = max(1, int(math.sqrt(length)))
            half_wma = _wma(source, half_length)
            full_wma = _wma(source, length)
            raw = [
                (2 * half_wma[index] - full_wma[index])
                if half_wma[index] is not None and full_wma[index] is not None
                else None
                for index in range(len(source))
            ]
            return {"value": _wma_nullable(raw, sqrt_length)}
        if key == "kama":
            fast_length = _safe_int(parameters.get("fast_length"), 2)
            slow_length = _safe_int(parameters.get("slow_length"), 30)
            fast_sc = 2 / (fast_length + 1)
            slow_sc = 2 / (slow_length + 1)
            output = _empty_series(len(source))
            current: float | None = None
            for index in range(len(source)):
                if index < length:
                    continue
                direction = abs(source[index] - source[index - length])
                volatility = sum(abs(source[item] - source[item - 1]) for item in range(index - length + 1, index + 1))
                efficiency_ratio = direction / volatility if volatility else 0.0
                smoothing_constant = (efficiency_ratio * (fast_sc - slow_sc) + slow_sc) ** 2
                if current is None:
                    current = source[index]
                else:
                    current = current + smoothing_constant * (source[index] - current)
                output[index] = current
            return {"value": output}
        if key == "alma":
            offset = _safe_float(parameters.get("offset"), 0.85)
            sigma = max(_safe_float(parameters.get("sigma"), 6.0), 0.0001)
            m = offset * (length - 1)
            s = length / sigma
            weights = [math.exp(-((item - m) ** 2) / (2 * s * s)) for item in range(length)]
            denominator = sum(weights)
            output = _empty_series(len(source))
            for index in range(len(source)):
                if index < length - 1:
                    continue
                window = source[index - length + 1 : index + 1]
                output[index] = sum(window[item] * weights[item] for item in range(length)) / denominator
            return {"value": output}
        if key == "vwma":
            output = _empty_series(len(source))
            for index in range(len(source)):
                if index < length - 1:
                    continue
                price_volume = sum(source[item] * volume[item] for item in range(index - length + 1, index + 1))
                volume_sum = sum(volume[index - length + 1 : index + 1])
                output[index] = price_volume / volume_sum if volume_sum > 0 else None
            return {"value": output}
        if key == "roc":
            output = _empty_series(len(source))
            for index in range(length, len(source)):
                previous = source[index - length]
                output[index] = ((source[index] - previous) / previous * 100) if previous else None
            return {"value": output}
        if key == "momentum":
            output = _empty_series(len(source))
            for index in range(length, len(source)):
                output[index] = source[index] - source[index - length]
            return {"value": output}
        if key == "standard_deviation":
            return {"value": _rolling_stddev(source, length)}
        if key == "historical_volatility":
            annualization = _safe_float(parameters.get("annualization"), 365.0)
            returns = _empty_series(len(source))
            for index in range(1, len(source)):
                if source[index - 1] > 0 and source[index] > 0:
                    returns[index] = math.log(source[index] / source[index - 1])
            output = _empty_series(len(source))
            for index in range(len(source)):
                if index < length:
                    continue
                window = returns[index - length + 1 : index + 1]
                if any(value is None for value in window):
                    continue
                mean = sum(float(value) for value in window) / length
                variance = sum((float(value) - mean) ** 2 for value in window) / (length - 1) if length > 1 else 0.0
                output[index] = math.sqrt(variance) * math.sqrt(annualization) * 100
            return {"value": output}
        if key == "bollinger_bands":
            basis = _rolling_sma(source, length)
            deviation = _rolling_stddev(source, length)
            multiplier = _safe_float(parameters.get("stddev"), 2.0)
            upper = _empty_series(len(source))
            lower = _empty_series(len(source))
            bandwidth = _empty_series(len(source))
            for index in range(len(source)):
                if basis[index] is None or deviation[index] is None:
                    continue
                upper[index] = basis[index] + deviation[index] * multiplier
                lower[index] = basis[index] - deviation[index] * multiplier
                bandwidth[index] = ((upper[index] - lower[index]) / basis[index] * 100) if basis[index] else None
            return {"upper": upper, "basis": basis, "lower": lower, "bandwidth": bandwidth}
        if key == "rsi":
            gains = [0.0]
            losses = [0.0]
            for index in range(1, len(source)):
                change = source[index] - source[index - 1]
                gains.append(max(change, 0.0))
                losses.append(abs(min(change, 0.0)))
            avg_gain = _rma(gains, length)
            avg_loss = _rma(losses, length)
            output = _empty_series(len(source))
            for index in range(len(source)):
                if avg_gain[index] is None or avg_loss[index] is None:
                    continue
                if avg_loss[index] == 0:
                    output[index] = 100.0
                else:
                    relative_strength = avg_gain[index] / avg_loss[index]
                    output[index] = 100 - (100 / (1 + relative_strength))
            return {"value": output}
        if key == "stoch_rsi":
            rsi_length = _safe_int(parameters.get("rsi_length"), 14)
            stoch_length = _safe_int(parameters.get("stoch_length"), 14)
            k_length = _safe_int(parameters.get("k_length"), 3)
            d_length = _safe_int(parameters.get("d_length"), 3)
            rsi = self._calculate_indicator("rsi", {"length": rsi_length, "source": parameters.get("source", "close")}, candles)["value"]
            raw_k = _empty_series(len(source))
            for index in range(len(source)):
                if index < stoch_length - 1:
                    continue
                window = rsi[index - stoch_length + 1 : index + 1]
                if any(value is None for value in window):
                    continue
                highest = max(float(value) for value in window)
                lowest = min(float(value) for value in window)
                raw_k[index] = ((float(rsi[index]) - lowest) / (highest - lowest) * 100) if highest != lowest and rsi[index] is not None else 0.0
            k = _rolling_sma_nullable(raw_k, k_length)
            d = _rolling_sma_nullable(k, d_length)
            return {"k": k, "d": d}
        if key == "macd":
            fast = _safe_int(parameters.get("fast_length"), 12)
            slow = _safe_int(parameters.get("slow_length"), 26)
            signal_length = _safe_int(parameters.get("signal_length"), 9)
            fast_ema = _ema(source, fast)
            slow_ema = _ema(source, slow)
            macd = [
                fast_ema[index] - slow_ema[index]
                if fast_ema[index] is not None and slow_ema[index] is not None
                else None
                for index in range(len(source))
            ]
            signal = _ema_nullable(macd, signal_length)
            histogram = [
                macd[index] - signal[index]
                if macd[index] is not None and signal[index] is not None
                else None
                for index in range(len(source))
            ]
            return {"macd": macd, "signal": signal, "histogram": histogram}
        if key == "ultimate_oscillator":
            short_length = _safe_int(parameters.get("short_length"), 7)
            mid_length = _safe_int(parameters.get("mid_length"), 14)
            long_length = _safe_int(parameters.get("long_length"), 28)
            buying_pressure = [0.0]
            true_range = [0.0]
            for index in range(1, len(source)):
                previous_close = close[index - 1]
                buying_pressure.append(close[index] - min(low[index], previous_close))
                true_range.append(max(high[index], previous_close) - min(low[index], previous_close))
            output = _empty_series(len(source))
            for index in range(len(source)):
                if index < long_length:
                    continue
                averages = []
                for window in (short_length, mid_length, long_length):
                    bp_sum = sum(buying_pressure[index - window + 1 : index + 1])
                    tr_sum = sum(true_range[index - window + 1 : index + 1])
                    averages.append(bp_sum / tr_sum if tr_sum else 0.0)
                output[index] = 100 * ((4 * averages[0]) + (2 * averages[1]) + averages[2]) / 7
            return {"value": output}
        if key == "awesome_oscillator":
            fast = _safe_int(parameters.get("fast_length"), 5)
            slow = _safe_int(parameters.get("slow_length"), 34)
            median_price = [(high[index] + low[index]) / 2 for index in range(len(source))]
            fast_sma = _rolling_sma(median_price, fast)
            slow_sma = _rolling_sma(median_price, slow)
            return {
                "value": [
                    fast_sma[index] - slow_sma[index]
                    if fast_sma[index] is not None and slow_sma[index] is not None
                    else None
                    for index in range(len(source))
                ]
            }
        if key == "atr":
            return {"value": _rma(self._true_range(candles), length)}
        if key in {"adx", "dmi"}:
            smoothing = _safe_int(parameters.get("smoothing"), length)
            true_range = self._true_range(candles)
            plus_dm = [0.0]
            minus_dm = [0.0]
            for index in range(1, len(source)):
                up_move = high[index] - high[index - 1]
                down_move = low[index - 1] - low[index]
                plus_dm.append(up_move if up_move > down_move and up_move > 0 else 0.0)
                minus_dm.append(down_move if down_move > up_move and down_move > 0 else 0.0)
            smoothed_tr = _rma(true_range, length)
            smoothed_plus = _rma(plus_dm, length)
            smoothed_minus = _rma(minus_dm, length)
            plus_di = _empty_series(len(source))
            minus_di = _empty_series(len(source))
            dx = _empty_series(len(source))
            for index in range(len(source)):
                if smoothed_tr[index] is None or smoothed_tr[index] == 0:
                    continue
                plus_di[index] = 100 * (smoothed_plus[index] or 0) / smoothed_tr[index]
                minus_di[index] = 100 * (smoothed_minus[index] or 0) / smoothed_tr[index]
                denominator = (plus_di[index] or 0) + (minus_di[index] or 0)
                dx[index] = 100 * abs((plus_di[index] or 0) - (minus_di[index] or 0)) / denominator if denominator else 0.0
            adx = _rma_nullable(dx, smoothing)
            if key == "adx":
                return {"adx": adx}
            return {"plus_di": plus_di, "minus_di": minus_di, "adx": adx}
        if key == "supertrend":
            atr_length = _safe_int(parameters.get("atr_length"), 10)
            factor = _safe_float(parameters.get("factor"), 3.0)
            atr = _rma(self._true_range(candles), atr_length)
            value = _empty_series(len(source))
            direction = _empty_series(len(source))
            final_upper = _empty_series(len(source))
            final_lower = _empty_series(len(source))
            for index in range(len(source)):
                if atr[index] is None:
                    continue
                hl2 = (high[index] + low[index]) / 2
                basic_upper = hl2 + factor * atr[index]
                basic_lower = hl2 - factor * atr[index]
                if index == 0 or final_upper[index - 1] is None or final_lower[index - 1] is None:
                    final_upper[index] = basic_upper
                    final_lower[index] = basic_lower
                    direction[index] = 1.0
                    value[index] = final_lower[index]
                    continue
                previous_upper = final_upper[index - 1] or basic_upper
                previous_lower = final_lower[index - 1] or basic_lower
                final_upper[index] = basic_upper if basic_upper < previous_upper or close[index - 1] > previous_upper else previous_upper
                final_lower[index] = basic_lower if basic_lower > previous_lower or close[index - 1] < previous_lower else previous_lower
                previous_direction = direction[index - 1] if direction[index - 1] is not None else 1.0
                if previous_direction < 0 and close[index] > (final_upper[index] or basic_upper):
                    direction[index] = 1.0
                elif previous_direction > 0 and close[index] < (final_lower[index] or basic_lower):
                    direction[index] = -1.0
                else:
                    direction[index] = previous_direction
                value[index] = final_lower[index] if direction[index] > 0 else final_upper[index]
            return {"value": value, "direction": direction}
        if key == "parabolic_sar":
            start = _safe_float(parameters.get("start"), 0.02)
            increment = _safe_float(parameters.get("increment"), 0.02)
            maximum = _safe_float(parameters.get("maximum"), 0.2)
            value = _empty_series(len(source))
            direction = _empty_series(len(source))
            if len(source) < 2:
                return {"value": value, "direction": direction}
            is_long = close[1] >= close[0]
            sar = low[0] if is_long else high[0]
            extreme_point = high[1] if is_long else low[1]
            acceleration = start
            for index in range(1, len(source)):
                sar = sar + acceleration * (extreme_point - sar)
                if is_long:
                    sar = min(sar, low[index - 1], low[index - 2] if index > 1 else low[index - 1])
                    if low[index] < sar:
                        is_long = False
                        sar = extreme_point
                        extreme_point = low[index]
                        acceleration = start
                    else:
                        if high[index] > extreme_point:
                            extreme_point = high[index]
                            acceleration = min(acceleration + increment, maximum)
                else:
                    sar = max(sar, high[index - 1], high[index - 2] if index > 1 else high[index - 1])
                    if high[index] > sar:
                        is_long = True
                        sar = extreme_point
                        extreme_point = high[index]
                        acceleration = start
                    else:
                        if low[index] < extreme_point:
                            extreme_point = low[index]
                            acceleration = min(acceleration + increment, maximum)
                value[index] = sar
                direction[index] = 1.0 if is_long else -1.0
            return {"value": value, "direction": direction}
        if key == "ichimoku":
            conversion_length = _safe_int(parameters.get("conversion_length"), 9)
            base_length = _safe_int(parameters.get("base_length"), 26)
            span_b_length = _safe_int(parameters.get("span_b_length"), 52)
            conversion_high = _rolling_max(high, conversion_length)
            conversion_low = _rolling_min(low, conversion_length)
            base_high = _rolling_max(high, base_length)
            base_low = _rolling_min(low, base_length)
            span_b_high = _rolling_max(high, span_b_length)
            span_b_low = _rolling_min(low, span_b_length)
            conversion = [
                (conversion_high[index] + conversion_low[index]) / 2
                if conversion_high[index] is not None and conversion_low[index] is not None
                else None
                for index in range(len(source))
            ]
            base = [
                (base_high[index] + base_low[index]) / 2
                if base_high[index] is not None and base_low[index] is not None
                else None
                for index in range(len(source))
            ]
            span_a = [
                (conversion[index] + base[index]) / 2
                if conversion[index] is not None and base[index] is not None
                else None
                for index in range(len(source))
            ]
            span_b = [
                (span_b_high[index] + span_b_low[index]) / 2
                if span_b_high[index] is not None and span_b_low[index] is not None
                else None
                for index in range(len(source))
            ]
            return {"conversion": conversion, "base": base, "span_a": span_a, "span_b": span_b}
        if key == "aroon":
            up = _empty_series(len(source))
            down = _empty_series(len(source))
            oscillator = _empty_series(len(source))
            for index in range(len(source)):
                if index < length - 1:
                    continue
                high_window = high[index - length + 1 : index + 1]
                low_window = low[index - length + 1 : index + 1]
                periods_since_high = length - 1 - max(range(length), key=lambda item: high_window[item])
                periods_since_low = length - 1 - min(range(length), key=lambda item: low_window[item])
                up[index] = 100 * (length - periods_since_high) / length
                down[index] = 100 * (length - periods_since_low) / length
                oscillator[index] = up[index] - down[index]
            return {"up": up, "down": down, "oscillator": oscillator}
        if key == "donchian_channel":
            upper = _rolling_max(high, length)
            lower = _rolling_min(low, length)
            basis = [
                (upper[index] + lower[index]) / 2 if upper[index] is not None and lower[index] is not None else None
                for index in range(len(source))
            ]
            return {"upper": upper, "basis": basis, "lower": lower}
        if key == "keltner_channel":
            atr_length = _safe_int(parameters.get("atr_length"), 10)
            multiplier = _safe_float(parameters.get("multiplier"), 2.0)
            basis = _ema(source, length)
            atr = _rma(self._true_range(candles), atr_length)
            upper = [
                basis[index] + atr[index] * multiplier if basis[index] is not None and atr[index] is not None else None
                for index in range(len(source))
            ]
            lower = [
                basis[index] - atr[index] * multiplier if basis[index] is not None and atr[index] is not None else None
                for index in range(len(source))
            ]
            return {"upper": upper, "basis": basis, "lower": lower}
        if key == "stochastic":
            k_length = _safe_int(parameters.get("k_length"), 14)
            smooth = _safe_int(parameters.get("smooth"), 3)
            d_length = _safe_int(parameters.get("d_length"), 3)
            raw_k = _empty_series(len(source))
            for index in range(len(source)):
                if index < k_length - 1:
                    continue
                highest = max(high[index - k_length + 1 : index + 1])
                lowest = min(low[index - k_length + 1 : index + 1])
                raw_k[index] = ((close[index] - lowest) / (highest - lowest) * 100) if highest != lowest else 0.0
            k = _rolling_sma(_coalesce_series(raw_k, [0.0 for _ in source]), smooth)
            d = _rolling_sma(_coalesce_series(k, [0.0 for _ in source]), d_length)
            return {"k": k, "d": d}
        if key == "williams_r":
            output = _empty_series(len(source))
            for index in range(len(source)):
                if index < length - 1:
                    continue
                highest = max(high[index - length + 1 : index + 1])
                lowest = min(low[index - length + 1 : index + 1])
                output[index] = ((highest - close[index]) / (highest - lowest) * -100) if highest != lowest else 0.0
            return {"value": output}
        if key == "cci":
            typical = [(high[index] + low[index] + close[index]) / 3 for index in range(len(source))]
            basis = _rolling_sma(typical, length)
            output = _empty_series(len(source))
            for index in range(len(source)):
                if index < length - 1 or basis[index] is None:
                    continue
                window = typical[index - length + 1 : index + 1]
                mean_deviation = sum(abs(value - basis[index]) for value in window) / length
                output[index] = (typical[index] - basis[index]) / (0.015 * mean_deviation) if mean_deviation else 0.0
            return {"value": output}
        if key == "volume_sma":
            return {"value": _rolling_sma(volume, length)}
        if key == "obv":
            output = _empty_series(len(source))
            current = 0.0
            for index in range(len(source)):
                if index == 0:
                    output[index] = current
                    continue
                if close[index] > close[index - 1]:
                    current += volume[index]
                elif close[index] < close[index - 1]:
                    current -= volume[index]
                output[index] = current
            return {"value": output}
        if key == "vwap":
            output = _empty_series(len(source))
            price_volume = 0.0
            volume_sum = 0.0
            typical = [(high[index] + low[index] + close[index]) / 3 for index in range(len(source))]
            for index in range(len(source)):
                price_volume += typical[index] * volume[index]
                volume_sum += volume[index]
                output[index] = price_volume / volume_sum if volume_sum else typical[index]
            return {"value": output}
        if key == "mfi":
            typical = [(high[index] + low[index] + close[index]) / 3 for index in range(len(source))]
            positive = [0.0]
            negative = [0.0]
            for index in range(1, len(source)):
                flow = typical[index] * volume[index]
                if typical[index] > typical[index - 1]:
                    positive.append(flow)
                    negative.append(0.0)
                else:
                    positive.append(0.0)
                    negative.append(flow)
            positive_sum = _rolling_sma(positive, length)
            negative_sum = _rolling_sma(negative, length)
            output = _empty_series(len(source))
            for index in range(len(source)):
                if positive_sum[index] is None or negative_sum[index] is None:
                    continue
                if negative_sum[index] == 0:
                    output[index] = 100.0
                else:
                    money_ratio = positive_sum[index] / negative_sum[index]
                    output[index] = 100 - (100 / (1 + money_ratio))
            return {"value": output}
        if key == "accumulation_distribution":
            output = _empty_series(len(source))
            current = 0.0
            for index in range(len(source)):
                price_range = high[index] - low[index]
                money_flow_multiplier = ((close[index] - low[index]) - (high[index] - close[index])) / price_range if price_range else 0.0
                current += money_flow_multiplier * volume[index]
                output[index] = current
            return {"value": output}
        if key == "chaikin_money_flow":
            money_flow_volume = []
            for index in range(len(source)):
                price_range = high[index] - low[index]
                money_flow_multiplier = ((close[index] - low[index]) - (high[index] - close[index])) / price_range if price_range else 0.0
                money_flow_volume.append(money_flow_multiplier * volume[index])
            output = _empty_series(len(source))
            for index in range(len(source)):
                if index < length - 1:
                    continue
                volume_sum = sum(volume[index - length + 1 : index + 1])
                output[index] = sum(money_flow_volume[index - length + 1 : index + 1]) / volume_sum if volume_sum else 0.0
            return {"value": output}

        # Fallback keeps the engine safe for newly seeded indicators while making
        # unsupported handlers explicit in the backtest logs/summary.
        return {"value": source}

    def _indicator_frames(self, strategy: BotStrategy, candles: list[PriceHistory]) -> tuple[dict[str, dict[str, list[float | None]]], list[str]]:
        frames: dict[str, dict[str, list[float | None]]] = {}
        unsupported: list[str] = []
        indicators = (strategy.indicator_config or {}).get("indicators")
        if not isinstance(indicators, list):
            return frames, unsupported
        for indicator in indicators:
            if not isinstance(indicator, dict):
                continue
            key = str(indicator.get("key") or "").lower()
            if not key:
                continue
            parameters = indicator.get("parameters") if isinstance(indicator.get("parameters"), dict) else {}
            frames[key] = self._calculate_indicator(key, parameters, candles)
            if key not in self.IMPLEMENTED_INDICATORS:
                unsupported.append(key)
        return frames, sorted(set(unsupported))

    def _strategy_candle_limit(self, strategy: BotStrategy) -> int:
        """Pick enough candles for indicator warm-up without unbounded reads."""
        max_length = 500
        indicators = (strategy.indicator_config or {}).get("indicators")
        if isinstance(indicators, list):
            for indicator in indicators:
                if not isinstance(indicator, dict):
                    continue
                parameters = indicator.get("parameters")
                if not isinstance(parameters, dict):
                    continue
                for key, value in parameters.items():
                    if "length" not in str(key):
                        continue
                    max_length = max(max_length, _safe_int(value, 1) * 4)
        return min(max_length, 5000)

    def _strategy_timeframe(self, strategy: BotStrategy, instance: BotInstance | None = None) -> str:
        return resolve_strategy_timeframe(strategy, instance)

    async def _load_strategy_candles(
        self,
        strategy: BotStrategy,
        *,
        instance: BotInstance | None = None,
        symbol: str,
        timeframe: str,
        limit: int,
        period_start: datetime | None = None,
        period_end: datetime | None = None,
        ascending: bool = True,
    ) -> tuple[list[MarketCandle | PriceHistory], str]:
        normalized_symbol = normalize_strategy_symbol(symbol)
        market_config = strategy.market_config or {}
        market_type = normalize_market_type(resolve_strategy_market_type(strategy, instance))
        supported_exchanges = market_config.get("supported_exchanges")
        default_supported_exchange = supported_exchanges[0] if isinstance(supported_exchanges, list) and supported_exchanges else None
        instance_exchange = getattr(getattr(instance, "exchange", None), "exchange", None)
        if instance is not None:
            configured_exchange = instance_exchange
        else:
            configured_exchange = (
                market_config.get("exchange")
                or market_config.get("default_exchange")
                or default_supported_exchange
            )
        query = select(MarketCandle).where(
            MarketCandle.symbol == normalized_symbol,
            MarketCandle.market_type == market_type,
            MarketCandle.timeframe == timeframe,
            MarketCandle.is_closed == True,
        )
        if configured_exchange:
            query = query.where(MarketCandle.exchange == normalize_exchange_key(str(configured_exchange)))
        if period_start is not None:
            query = query.where(MarketCandle.close_time >= period_start)
        if period_end is not None:
            query = query.where(MarketCandle.close_time <= period_end)
        order_column = MarketCandle.close_time.asc() if ascending else MarketCandle.close_time.desc()
        result = await self.db.execute(query.order_by(order_column).limit(limit))
        market_candles = result.scalars().all()
        if market_candles:
            return list(market_candles if ascending else reversed(market_candles)), "market_candles"

        legacy_symbol = normalized_symbol.removesuffix("USDT").removesuffix("USDC").removesuffix("USD")
        legacy_query = select(PriceHistory).where(func.upper(PriceHistory.symbol).in_([normalized_symbol, legacy_symbol]))
        if period_start is not None:
            legacy_query = legacy_query.where(PriceHistory.timestamp >= period_start)
        if period_end is not None:
            legacy_query = legacy_query.where(PriceHistory.timestamp <= period_end)
        legacy_order = PriceHistory.timestamp.asc() if ascending else PriceHistory.timestamp.desc()
        legacy_result = await self.db.execute(legacy_query.order_by(legacy_order).limit(limit))
        legacy_candles = legacy_result.scalars().all()
        return list(legacy_candles if ascending else reversed(legacy_candles)), "price_history_legacy"

    def _data_quality(self, candles: list[MarketCandle | PriceHistory]) -> dict:
        total = len(candles)
        if total == 0:
            return {
                "rows_total": 0,
                "high_coverage": 0.0,
                "low_coverage": 0.0,
                "volume_coverage": 0.0,
                "ohlcv_source": "unknown",
            }
        is_market_candle = isinstance(candles[0], MarketCandle)
        return {
            "rows_total": total,
            "high_coverage": sum(1 for candle in candles if _candle_high_value(candle, None) is not None) / total,
            "low_coverage": sum(1 for candle in candles if _candle_low_value(candle, None) is not None) / total,
            "volume_coverage": sum(1 for candle in candles if _candle_volume_value(candle) is not None) / total,
            "ohlcv_source": "market_candles" if is_market_candle else "price_history_legacy",
        }

    def _data_quality_warnings(self, data_quality: dict) -> list[str]:
        warnings: list[str] = []
        high_coverage = _safe_float(data_quality.get("high_coverage"), 0.0)
        low_coverage = _safe_float(data_quality.get("low_coverage"), 0.0)
        volume_coverage = _safe_float(data_quality.get("volume_coverage"), 0.0)
        if data_quality.get("ohlcv_source") == "price_history_legacy":
            warnings.append("Using legacy PriceHistory ticker snapshots; BC AlphaTrend backtests are not statistically valid until market_candles are ingested")
        if high_coverage < 0.5 or low_coverage < 0.5:
            warnings.append("High/low coverage below 50%; range-based indicators are degraded until OHLCV candles are available")
        if volume_coverage < 0.5:
            warnings.append("Volume coverage below 50%; volume-based indicators are degraded until OHLCV candles are available")
        return warnings

    def _condition_value(
        self,
        frames: dict[str, dict[str, list[float | None]]],
        indicator_key: object,
        output_key: object,
        index: int,
    ) -> float | None:
        indicator_outputs = frames.get(str(indicator_key or "").lower())
        if not indicator_outputs:
            return None
        output = indicator_outputs.get(str(output_key or "value"))
        if output is None and "value" in indicator_outputs:
            output = indicator_outputs["value"]
        return _series_at(output, index) if output is not None else None

    def _compare_condition(
        self,
        condition: dict,
        frames: dict[str, dict[str, list[float | None]]],
        index: int,
    ) -> bool:
        left = self._condition_value(frames, condition.get("indicator"), condition.get("output", "value"), index)
        if left is None:
            return False
        right_type = str(condition.get("right_type") or "value")
        operator = str(condition.get("operator") or "greater_than")
        if right_type == "indicator":
            compare_to = condition.get("compare_to") if isinstance(condition.get("compare_to"), dict) else {}
            right = self._condition_value(frames, compare_to.get("indicator"), compare_to.get("output", "value"), index)
            previous_left = self._condition_value(frames, condition.get("indicator"), condition.get("output", "value"), index - 1)
            previous_right = self._condition_value(frames, compare_to.get("indicator"), compare_to.get("output", "value"), index - 1)
        else:
            right = _safe_float(condition.get("value"), 0.0)
            previous_left = self._condition_value(frames, condition.get("indicator"), condition.get("output", "value"), index - 1)
            previous_right = right
        if right is None:
            return False
        if operator == "greater_than":
            return left > right
        if operator == "less_than":
            return left < right
        if operator == "greater_or_equal":
            return left >= right
        if operator == "less_or_equal":
            return left <= right
        if operator == "crosses_above":
            return previous_left is not None and previous_right is not None and previous_left <= previous_right and left > right
        if operator == "crosses_below":
            return previous_left is not None and previous_right is not None and previous_left >= previous_right and left < right
        if operator == "between":
            upper = _safe_float(condition.get("value_max"), right)
            low_bound, high_bound = sorted([right, upper])
            return low_bound <= left <= high_bound
        return False

    def _evaluate_rule_group(
        self,
        rule_config: dict,
        side: str,
        frames: dict[str, dict[str, list[float | None]]],
        index: int,
    ) -> tuple[bool, list[dict]]:
        group = rule_config.get(side) if isinstance(rule_config.get(side), dict) else {}
        conditions = group.get("conditions") if isinstance(group.get("conditions"), list) else []
        if not conditions:
            return False, []
        evaluations = [
            {
                "indicator": condition.get("indicator"),
                "output": condition.get("output", "value"),
                "operator": condition.get("operator"),
                "passed": self._compare_condition(condition, frames, index),
            }
            for condition in conditions
            if isinstance(condition, dict)
        ]
        logic = str(group.get("logic") or rule_config.get("logic") or "AND").upper()
        passed = any(item["passed"] for item in evaluations) if logic == "OR" else all(item["passed"] for item in evaluations)
        return passed, evaluations

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
        risk_overrides: dict | None = None,
    ) -> BotBacktest:
        """Run a historical paper backtest using configured indicators/rules.

        The engine is deterministic and intentionally paper-only. It evaluates
        selected indicators once, then applies entry/exit rule groups candle by
        candle. ``PriceHistory`` has no native timeframe column yet, so the
        requested timeframe is persisted but cannot filter the query in this
        version.
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

        candles, candle_source = await self._load_strategy_candles(
            strategy,
            symbol=symbol,
            timeframe=timeframe,
            limit=2000,
            period_start=period_start,
            period_end=period_end,
            ascending=True,
        )
        if len(candles) < 2:
            backtest.status = BotBacktestStatus.FAILED
            backtest.error = "Not enough price history for backtest"
            backtest.completed_at = datetime.now(timezone.utc)
            return backtest

        data_quality = self._data_quality(candles)
        data_warnings = self._data_quality_warnings(data_quality)
        rule_config = strategy.rule_config or {}
        frames, fallback_indicators = self._indicator_frames(strategy, candles)
        if not frames:
            backtest.status = BotBacktestStatus.FAILED
            backtest.error = "Strategy has no configured indicators"
            backtest.completed_at = datetime.now(timezone.utc)
            return backtest

        cash = Decimal(str(initial_capital_usd))
        units = Decimal("0")
        entry_price = Decimal("0")
        highest_since_entry = Decimal("0")
        max_gain_since_entry = Decimal("0")
        breakeven_armed = False
        trailing_armed = False
        realized_pnl = Decimal("0")
        peak_equity = cash
        max_drawdown = Decimal("0")
        winning_trades = 0
        losing_trades = 0
        entry_count = 0
        exit_count = 0
        logs: list[dict] = []
        risk = {
            **(strategy.risk_defaults or {}),
            **(risk_overrides or {}),
        }
        max_order_usd = Decimal(str(risk.get("max_order_usd", 100) or 100))
        max_position_usd = Decimal(str(risk.get("max_position_usd", 1000) or 1000))
        stop_loss_percent = Decimal(str(risk.get("stop_loss_percent", 0) or 0))
        take_profit_percent = Decimal(str(risk.get("take_profit_percent", 0) or 0))
        trailing_stop_percent = Decimal(str(risk.get("trailing_stop_percent", 0) or 0))
        breakeven_activation_percent = Decimal(str(risk.get("breakeven_activation_percent", 0) or 0))
        fee_percent = Decimal(str(risk.get("fee_percent", 0) or 0))
        slippage_percent = Decimal(str(risk.get("slippage_percent", 0) or 0))
        fee_percent = max(Decimal("0"), min(fee_percent, Decimal("10")))
        slippage_percent = max(Decimal("0"), min(slippage_percent, Decimal("20")))
        stop_model = str(risk.get("stop_model") or "alpha_trend")
        allow_averaging = str(risk.get("allow_averaging", "false")).lower() in {"1", "true", "yes", "on"}

        for index, candle in enumerate(candles):
            price = Decimal(str(_candle_close_value(candle)))
            if price <= 0:
                continue
            if units > 0:
                highest_since_entry = max(highest_since_entry, price)
            equity = cash + units * price
            peak_equity = max(peak_equity, equity)
            if peak_equity > 0:
                drawdown = (peak_equity - equity) / peak_equity * Decimal("100")
                max_drawdown = max(max_drawdown, drawdown)

            exit_passed, exit_evaluations = self._evaluate_rule_group(rule_config, "exit", frames, index)
            entry_passed, entry_evaluations = self._evaluate_rule_group(rule_config, "entry", frames, index)
            exit_reason = "rule_exit"
            if units > 0 and entry_price > 0:
                gain_percent = (price - entry_price) / entry_price * Decimal("100")
                peak_gain_percent = (highest_since_entry - entry_price) / entry_price * Decimal("100")
                max_gain_since_entry = max(max_gain_since_entry, peak_gain_percent)
                if breakeven_activation_percent > 0 and max_gain_since_entry >= breakeven_activation_percent:
                    breakeven_armed = True
                if trailing_stop_percent > 0 and peak_gain_percent >= trailing_stop_percent:
                    trailing_armed = True
                drawdown_from_entry = (entry_price - price) / entry_price * Decimal("100")
                trailing_drawdown = (
                    (highest_since_entry - price) / highest_since_entry * Decimal("100")
                    if highest_since_entry > 0
                    else Decimal("0")
                )
                if stop_loss_percent > 0 and drawdown_from_entry >= stop_loss_percent:
                    exit_passed = True
                    exit_reason = "stop_loss"
                elif stop_model == "alpha_trend":
                    alpha_stop = self._condition_value(frames, "bc_alpha_trend", "stop", index)
                    if alpha_stop is not None and alpha_stop > 0 and price <= Decimal(str(alpha_stop)):
                        exit_passed = True
                        exit_reason = "alpha_trend_stop"
                elif take_profit_percent > 0 and gain_percent >= take_profit_percent:
                    exit_passed = True
                    exit_reason = "take_profit"
                elif trailing_armed and trailing_drawdown >= trailing_stop_percent:
                    exit_passed = True
                    exit_reason = "trailing_stop"
                elif breakeven_armed and price <= entry_price:
                    exit_passed = True
                    exit_reason = "breakeven_guard"

            if units > 0 and exit_passed:
                execution_price = price * (Decimal("1") - slippage_percent / Decimal("100"))
                gross_proceeds = units * execution_price
                fee_usd = gross_proceeds * fee_percent / Decimal("100")
                proceeds = max(Decimal("0"), gross_proceeds - fee_usd)
                trade_pnl = proceeds - units * entry_price
                realized_pnl += trade_pnl
                cash += proceeds
                units = Decimal("0")
                exit_count += 1
                if trade_pnl >= 0:
                    winning_trades += 1
                else:
                    losing_trades += 1
                equity = cash
                logs.append(
                    {
                        "timestamp": _candle_timestamp(candle).isoformat(),
                        "action": "sell",
                        "reason": exit_reason,
                        "price": _json_number(price),
                        "execution_price": _json_number(execution_price),
                        "fee_usd": _json_number(fee_usd),
                        "equity": _json_number(equity),
                        "pnl_usd": _json_number(trade_pnl),
                        "conditions": exit_evaluations,
                    }
                )
                entry_price = Decimal("0")
                highest_since_entry = Decimal("0")
                max_gain_since_entry = Decimal("0")
                breakeven_armed = False
                trailing_armed = False
                continue

            position_value = units * price
            if entry_passed and cash > 0 and position_value < max_position_usd and (units == 0 or allow_averaging):
                available_capacity = max(Decimal("0"), max_position_usd - position_value)
                spend = min(cash, max_order_usd, available_capacity)
                if spend > 0:
                    execution_price = price * (Decimal("1") + slippage_percent / Decimal("100"))
                    fee_usd = spend * fee_percent / Decimal("100")
                    asset_spend = max(Decimal("0"), spend - fee_usd)
                    bought_units = asset_spend / execution_price if execution_price > 0 else Decimal("0")
                    if bought_units <= 0:
                        continue
                    weighted_cost = (entry_price * units + spend) / (units + bought_units) if units > 0 else spend / bought_units
                    units += bought_units
                    cash -= spend
                    entry_price = weighted_cost
                    highest_since_entry = max(highest_since_entry, price)
                    max_gain_since_entry = Decimal("0")
                    breakeven_armed = False
                    trailing_armed = False
                    entry_count += 1
                    equity = cash + units * price
                    logs.append(
                        {
                            "timestamp": _candle_timestamp(candle).isoformat(),
                            "action": "buy",
                            "reason": "rule_entry",
                            "price": _json_number(price),
                            "execution_price": _json_number(execution_price),
                            "notional_usd": _json_number(spend),
                            "fee_usd": _json_number(fee_usd),
                            "equity": _json_number(equity),
                            "conditions": entry_evaluations,
                        }
                    )

        final_price = Decimal(str(_candle_close_value(candles[-1])))
        final_equity = cash + units * final_price
        total_return = (
            (final_equity - Decimal(str(initial_capital_usd))) / Decimal(str(initial_capital_usd)) * Decimal("100")
        )
        total_closed_trades = winning_trades + losing_trades
        win_rate = Decimal(str(winning_trades)) / Decimal(str(total_closed_trades)) * Decimal("100") if total_closed_trades else Decimal("0")
        backtest.status = BotBacktestStatus.SUCCEEDED
        backtest.result_summary = {
            "initial_capital_usd": _json_number(initial_capital_usd),
            "final_equity_usd": _json_number(final_equity),
            "total_return_percent": _json_number(total_return),
            "trade_count": entry_count + exit_count,
            "logged_event_count": min(len(logs), 250),
            "entry_count": entry_count,
            "exit_count": exit_count,
            "win_rate_percent": _json_number(win_rate),
            "realized_pnl_usd": _json_number(realized_pnl),
            "risk_config_applied": {
                "max_order_usd": _json_number(max_order_usd),
                "max_position_usd": _json_number(max_position_usd),
                "stop_loss_percent": _json_number(stop_loss_percent),
                "take_profit_percent": _json_number(take_profit_percent),
                "trailing_stop_percent": _json_number(trailing_stop_percent),
                "breakeven_activation_percent": _json_number(breakeven_activation_percent),
                "fee_percent": _json_number(fee_percent),
                "slippage_percent": _json_number(slippage_percent),
                "stop_model": stop_model,
                "allow_averaging": allow_averaging,
            },
            "engine_note": "strategy_rules_v2: evaluated selected indicators and entry/exit rule groups with dedicated handlers for the seeded indicator catalog.",
            "fallback_indicators": fallback_indicators,
            "data_quality": data_quality,
            "data_warnings": data_warnings,
            "candle_source": candle_source,
        }
        backtest.metrics = {
            "max_drawdown_percent": _json_number(max_drawdown),
            "final_cash_usd": _json_number(cash),
            "final_units": _json_number(units),
            "sample_count": len(candles),
            "indicator_count": len(frames),
            "allow_averaging": allow_averaging,
            "entry_rule_logic": (rule_config.get("entry") or {}).get("logic", rule_config.get("logic", "AND")) if isinstance(rule_config.get("entry"), dict) else rule_config.get("logic", "AND"),
            "exit_rule_logic": (rule_config.get("exit") or {}).get("logic", rule_config.get("logic", "AND")) if isinstance(rule_config.get("exit"), dict) else rule_config.get("logic", "AND"),
            "requested_timeframe": timeframe,
            "timeframe_filter_applied": candle_source == "market_candles",
            "data_quality": data_quality,
        }
        # Keep the full trade counters in result_summary while capping stored
        # event logs to avoid unbounded JSONB growth on long simulations.
        backtest.logs = logs[-250:]
        backtest.completed_at = datetime.now(timezone.utc)
        return backtest
