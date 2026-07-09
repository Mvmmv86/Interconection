"""Instance-scoped bot backtest runner.

This service is intentionally separate from the API request path. The API only
creates a run record and enqueues Celery; the worker executes this CPU/IO-heavy
simulation outside the FastAPI event loop.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.bot import (
    BotBacktestRun,
    BotBacktestStatus,
    BotBacktestTrade,
    BotInstance,
    BotStrategy,
)
from app.services.bot_engine_service import (
    BotEngineService,
    _candle_close_value,
    _candle_high_value,
    _candle_low_value,
    _candle_timestamp,
    _json_number,
)


class BotBacktestService:
    """Runs institutional backtests for activated customer bot instances."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.engine = BotEngineService(db)

    async def run_backtest_run(self, run_id: UUID) -> BotBacktestRun:
        """Execute one queued backtest run and persist metrics/trades."""
        result = await self.db.execute(
            select(BotBacktestRun)
            .options(
                selectinload(BotBacktestRun.instance).selectinload(BotInstance.template),
                selectinload(BotBacktestRun.instance).selectinload(BotInstance.exchange),
                selectinload(BotBacktestRun.strategy),
            )
            .where(BotBacktestRun.id == run_id)
            .with_for_update()
        )
        run = result.scalar_one_or_none()
        if run is None:
            raise ValueError(f"Backtest run not found: {run_id}")
        if run.status != BotBacktestStatus.RUNNING:
            return run

        run.started_at = run.started_at or datetime.now(timezone.utc)
        run.progress = 1
        await self.db.flush()

        try:
            await self._execute(run)
        except Exception as exc:
            run.status = BotBacktestStatus.FAILED
            run.error_message = str(exc)
            run.progress = 100
            run.finished_at = datetime.now(timezone.utc)
            run.diagnostics = {
                **(run.diagnostics or {}),
                "error_type": exc.__class__.__name__,
                "failed_at": run.finished_at.isoformat(),
            }
        return run

    async def _execute(self, run: BotBacktestRun) -> None:
        strategy = run.strategy
        instance = run.instance
        limit = self._candle_limit(run.timeframe, run.period_start, run.period_end, strategy)
        candles, candle_source = await self.engine._load_strategy_candles(
            strategy,
            instance=instance,
            symbol=run.symbol,
            timeframe=run.timeframe,
            limit=limit,
            period_start=run.period_start,
            period_end=run.period_end,
            ascending=True,
        )
        data_quality = self.engine._data_quality(candles)
        data_warnings = self.engine._data_quality_warnings(data_quality)
        data_quality = {
            **data_quality,
            "requested_limit": limit,
            "candle_source": candle_source,
            "warnings": data_warnings,
        }
        run.data_quality = data_quality
        if len(candles) < 2:
            run.status = BotBacktestStatus.FAILED
            run.error_message = "Not enough price history for backtest"
            run.result_summary = {"reason": "missing_price_history", "sample_count": len(candles)}
            run.progress = 100
            run.finished_at = datetime.now(timezone.utc)
            return

        frames, fallback_indicators = self.engine._indicator_frames(strategy, candles)
        if not frames:
            run.status = BotBacktestStatus.FAILED
            run.error_message = "Strategy has no configured indicators"
            run.result_summary = {"reason": "missing_indicators", "sample_count": len(candles)}
            run.progress = 100
            run.finished_at = datetime.now(timezone.utc)
            return

        await self.db.execute(delete(BotBacktestTrade).where(BotBacktestTrade.run_id == run.id))

        risk = self.engine._merged_risk_config(strategy, instance=instance, overrides=run.risk_snapshot or {})
        cost_snapshot = run.cost_snapshot or {}
        fee_percent = self._bounded_percent(risk.get("fee_percent", cost_snapshot.get("fee_percent", 0)), 10)
        slippage_percent = self._bounded_percent(risk.get("slippage_percent", cost_snapshot.get("slippage_percent", 0)), 20)
        stop_loss_percent = Decimal(str(risk.get("stop_loss_percent", 0) or 0))
        take_profit_percent = Decimal(str(risk.get("take_profit_percent", 0) or 0))
        trailing_stop_percent = Decimal(str(risk.get("trailing_stop_percent", 0) or 0))
        breakeven_activation_percent = Decimal(str(risk.get("breakeven_activation_percent", 0) or 0))
        stop_model = str(risk.get("stop_model") or "alpha_trend")

        cash = Decimal(str(run.initial_capital_usd))
        initial_capital = cash
        units = Decimal("0")
        entry_price = Decimal("0")
        entry_execution_price = Decimal("0")
        entry_time: datetime | None = None
        entry_index = 0
        entry_fee = Decimal("0")
        entry_slippage = Decimal("0")
        entry_reason = "rule_entry"
        highest_since_entry = Decimal("0")
        lowest_since_entry = Decimal("0")
        breakeven_armed = False
        trailing_armed = False
        equity_curve: list[dict] = []
        drawdown_curve: list[dict] = []
        realized_net_pnl = Decimal("0")
        realized_gross_pnl = Decimal("0")
        total_fees = Decimal("0")
        total_slippage = Decimal("0")
        gross_profit = Decimal("0")
        gross_loss = Decimal("0")
        winning_trades = 0
        losing_trades = 0
        peak_equity = cash
        max_drawdown = Decimal("0")
        trade_count = 0

        for index, candle in enumerate(candles):
            price = Decimal(str(_candle_close_value(candle)))
            if price <= 0:
                continue
            timestamp = _candle_timestamp(candle)
            high = Decimal(str(_candle_high_value(candle, price) or price))
            low = Decimal(str(_candle_low_value(candle, price) or price))
            if units > 0:
                highest_since_entry = max(highest_since_entry, high)
                lowest_since_entry = min(lowest_since_entry if lowest_since_entry > 0 else low, low)

            equity = cash + units * price
            peak_equity = max(peak_equity, equity)
            drawdown = (peak_equity - equity) / peak_equity * Decimal("100") if peak_equity > 0 else Decimal("0")
            max_drawdown = max(max_drawdown, drawdown)
            equity_curve.append({"time": timestamp.isoformat(), "equity": _json_number(equity)})
            drawdown_curve.append({"time": timestamp.isoformat(), "drawdown_percent": _json_number(drawdown)})

            exit_passed, exit_evaluations = self.engine._evaluate_rule_group(strategy.rule_config or {}, "exit", frames, index)
            entry_passed, entry_evaluations = self.engine._evaluate_rule_group(strategy.rule_config or {}, "entry", frames, index)
            exit_reason = "rule_exit"
            if units > 0 and entry_price > 0:
                gain_percent = (price - entry_price) / entry_price * Decimal("100")
                peak_gain_percent = (highest_since_entry - entry_price) / entry_price * Decimal("100")
                if breakeven_activation_percent > 0 and peak_gain_percent >= breakeven_activation_percent:
                    breakeven_armed = True
                if trailing_stop_percent > 0 and peak_gain_percent >= trailing_stop_percent:
                    trailing_armed = True
                drawdown_from_entry = (entry_price - price) / entry_price * Decimal("100")
                trailing_drawdown = (
                    (highest_since_entry - price) / highest_since_entry * Decimal("100")
                    if highest_since_entry > 0
                    else Decimal("0")
                )
                alpha_stop = self.engine._condition_value(frames, "bc_alpha_trend", "stop", index)
                if stop_loss_percent > 0 and drawdown_from_entry >= stop_loss_percent:
                    exit_passed = True
                    exit_reason = "stop_loss"
                elif stop_model == "alpha_trend" and alpha_stop is not None and alpha_stop > 0 and price <= Decimal(str(alpha_stop)):
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
                net_pnl, gross_pnl, fee_paid, slippage_paid = self._close_trade(
                    run=run,
                    timestamp=timestamp,
                    price=price,
                    units=units,
                    entry_time=entry_time or timestamp,
                    entry_price=entry_execution_price or entry_price,
                    entry_fee=entry_fee,
                    entry_slippage=entry_slippage,
                    lowest_since_entry=lowest_since_entry,
                    highest_since_entry=highest_since_entry,
                    entry_reason=entry_reason,
                    exit_reason=exit_reason,
                    bars_held=max(1, index - entry_index),
                    exit_evaluations=exit_evaluations,
                    fee_percent=fee_percent,
                    slippage_percent=slippage_percent,
                )
                gross_proceeds = units * (price * (Decimal("1") - slippage_percent / Decimal("100")))
                cash += max(Decimal("0"), gross_proceeds - fee_paid)
                realized_net_pnl += net_pnl
                realized_gross_pnl += gross_pnl
                total_fees += fee_paid
                total_slippage += slippage_paid
                if net_pnl >= 0:
                    winning_trades += 1
                    gross_profit += net_pnl
                else:
                    losing_trades += 1
                    gross_loss += net_pnl
                trade_count += 1
                units = Decimal("0")
                entry_price = Decimal("0")
                entry_execution_price = Decimal("0")
                entry_time = None
                entry_index = 0
                entry_fee = Decimal("0")
                entry_slippage = Decimal("0")
                highest_since_entry = Decimal("0")
                lowest_since_entry = Decimal("0")
                breakeven_armed = False
                trailing_armed = False
                continue

            current_position_value = units * price
            allow_averaging = str(risk.get("allow_averaging", "false")).lower() in {"1", "true", "yes", "on"}
            if entry_passed and cash > 0 and (units == 0 or allow_averaging):
                alpha_stop = self.engine._condition_value(frames, "bc_alpha_trend", "stop", index)
                sizing = self.engine._sizing_snapshot(
                    risk,
                    latest_price=price,
                    current_symbol_value=current_position_value,
                    sizing_capital=cash + current_position_value,
                    alpha_stop=alpha_stop,
                )
                spend = min(cash, sizing["notional_cap"])
                if spend <= 0:
                    continue
                execution_price = price * (Decimal("1") + slippage_percent / Decimal("100"))
                fee_paid = spend * fee_percent / Decimal("100")
                slippage_paid = spend * slippage_percent / Decimal("100")
                asset_spend = max(Decimal("0"), spend - fee_paid)
                bought_units = asset_spend / execution_price if execution_price > 0 else Decimal("0")
                if bought_units <= 0:
                    continue
                entry_price = (
                    (entry_price * units + execution_price * bought_units) / (units + bought_units)
                    if units > 0
                    else execution_price
                )
                entry_execution_price = entry_price
                units += bought_units
                cash -= spend
                entry_time = entry_time or timestamp
                entry_index = index if units == bought_units else entry_index
                entry_fee += fee_paid
                entry_slippage += slippage_paid
                total_fees += fee_paid
                total_slippage += slippage_paid
                entry_reason = "rule_entry"
                highest_since_entry = max(highest_since_entry, high)
                lowest_since_entry = low if lowest_since_entry <= 0 else min(lowest_since_entry, low)
                breakeven_armed = False
                trailing_armed = False
                run.diagnostics = {
                    **(run.diagnostics or {}),
                    "last_entry_conditions": entry_evaluations,
                    "last_sizing": {key: _json_number(value) if isinstance(value, Decimal) else value for key, value in sizing.items()},
                }

            if index % 250 == 0:
                run.progress = min(95, int(index / max(1, len(candles)) * 100))
                await self.db.flush()

        if units > 0:
            last_candle = candles[-1]
            last_price = Decimal(str(_candle_close_value(last_candle)))
            net_pnl, gross_pnl, fee_paid, slippage_paid = self._close_trade(
                run=run,
                timestamp=_candle_timestamp(last_candle),
                price=last_price,
                units=units,
                entry_time=entry_time or _candle_timestamp(last_candle),
                entry_price=entry_execution_price or entry_price,
                entry_fee=entry_fee,
                entry_slippage=entry_slippage,
                lowest_since_entry=lowest_since_entry,
                highest_since_entry=highest_since_entry,
                entry_reason=entry_reason,
                exit_reason="end_of_period",
                bars_held=max(1, len(candles) - 1 - entry_index),
                exit_evaluations=[],
                fee_percent=fee_percent,
                slippage_percent=slippage_percent,
            )
            gross_proceeds = units * (last_price * (Decimal("1") - slippage_percent / Decimal("100")))
            cash += max(Decimal("0"), gross_proceeds - fee_paid)
            realized_net_pnl += net_pnl
            realized_gross_pnl += gross_pnl
            total_fees += fee_paid
            total_slippage += slippage_paid
            if net_pnl >= 0:
                winning_trades += 1
                gross_profit += net_pnl
            else:
                losing_trades += 1
                gross_loss += net_pnl
            trade_count += 1

        ending_equity = cash
        roi_percent = (ending_equity - initial_capital) / initial_capital * Decimal("100") if initial_capital > 0 else Decimal("0")
        win_rate = Decimal(winning_trades) / Decimal(trade_count) * Decimal("100") if trade_count else Decimal("0")
        profit_factor = gross_profit / abs(gross_loss) if gross_loss < 0 else (gross_profit if gross_profit > 0 else Decimal("0"))
        metrics = {
            "initial_capital_usd": _json_number(initial_capital),
            "ending_equity_usd": _json_number(ending_equity),
            "net_pnl_usd": _json_number(realized_net_pnl),
            "gross_pnl_usd": _json_number(realized_gross_pnl),
            "roi_percent": _json_number(roi_percent),
            "max_drawdown_percent": _json_number(max_drawdown),
            "profit_factor": _json_number(profit_factor),
            "trade_count": trade_count,
            "winning_trades": winning_trades,
            "losing_trades": losing_trades,
            "win_rate_percent": _json_number(win_rate),
            "fees_paid_usd": _json_number(total_fees),
            "slippage_paid_usd": _json_number(total_slippage),
            "sample_count": len(candles),
        }
        run.status = BotBacktestStatus.SUCCEEDED
        run.progress = 100
        run.metrics = metrics
        run.result_summary = {
            **metrics,
            "symbol": run.symbol,
            "timeframe": run.timeframe,
            "period_start": run.period_start.isoformat(),
            "period_end": run.period_end.isoformat(),
            "candle_source": candle_source,
            "fallback_indicators": fallback_indicators,
            "engine_note": "Backtest uses the same rule evaluation and risk-distance sizing helper as paper decisions.",
        }
        stored_equity_curve = self._downsample_curve(equity_curve)
        stored_drawdown_curve = self._downsample_curve(drawdown_curve)
        run.equity_curve = stored_equity_curve
        run.drawdown_curve = stored_drawdown_curve
        run.diagnostics = {
            **(run.diagnostics or {}),
            "curve_points_full": len(equity_curve),
            "curve_points_stored": len(stored_equity_curve),
            "curve_downsample_max_points": 2000,
        }
        run.finished_at = datetime.now(timezone.utc)

    def _close_trade(
        self,
        *,
        run: BotBacktestRun,
        timestamp: datetime,
        price: Decimal,
        units: Decimal,
        entry_time: datetime,
        entry_price: Decimal,
        entry_fee: Decimal,
        entry_slippage: Decimal,
        lowest_since_entry: Decimal,
        highest_since_entry: Decimal,
        entry_reason: str,
        exit_reason: str,
        bars_held: int,
        exit_evaluations: list[dict],
        fee_percent: Decimal,
        slippage_percent: Decimal,
    ) -> tuple[Decimal, Decimal, Decimal, Decimal]:
        execution_price = price * (Decimal("1") - slippage_percent / Decimal("100"))
        gross_pnl = (execution_price - entry_price) * units
        gross_proceeds = units * execution_price
        exit_fee = gross_proceeds * fee_percent / Decimal("100")
        exit_slippage = gross_proceeds * slippage_percent / Decimal("100")
        net_pnl = gross_pnl - entry_fee - exit_fee
        return_percent = net_pnl / (entry_price * units) * Decimal("100") if entry_price > 0 and units > 0 else Decimal("0")
        mae_percent = (
            (lowest_since_entry - entry_price) / entry_price * Decimal("100")
            if lowest_since_entry > 0 and entry_price > 0
            else Decimal("0")
        )
        mfe_percent = (
            (highest_since_entry - entry_price) / entry_price * Decimal("100")
            if highest_since_entry > 0 and entry_price > 0
            else Decimal("0")
        )
        self.db.add(
            BotBacktestTrade(
                run_id=run.id,
                organization_id=run.organization_id,
                instance_id=run.instance_id,
                symbol=run.symbol,
                side="long",
                entry_time=entry_time,
                exit_time=timestamp,
                entry_price=entry_price,
                exit_price=execution_price,
                quantity=units,
                gross_pnl=gross_pnl,
                fee_paid=entry_fee + exit_fee,
                slippage_paid=entry_slippage + exit_slippage,
                net_pnl=net_pnl,
                return_percent=return_percent,
                mae_percent=mae_percent,
                mfe_percent=mfe_percent,
                entry_reason=entry_reason,
                exit_reason=exit_reason,
                bars_held=bars_held,
                raw_payload={"exit_conditions": exit_evaluations},
            )
        )
        return net_pnl, gross_pnl, exit_fee, exit_slippage

    def _bounded_percent(self, value: object, ceiling: int) -> Decimal:
        parsed = Decimal(str(value or 0))
        return max(Decimal("0"), min(parsed, Decimal(str(ceiling))))

    def _candle_limit(
        self,
        timeframe: str,
        period_start: datetime,
        period_end: datetime,
        strategy: BotStrategy,
    ) -> int:
        seconds = self._timeframe_seconds(timeframe)
        expected = int(max(1, (period_end - period_start).total_seconds() // seconds)) + 20
        warmup = self.engine._strategy_candle_limit(strategy)
        return min(max(expected, warmup, 500), 250000)

    def _timeframe_seconds(self, timeframe: str) -> int:
        normalized = str(timeframe or "1h").lower()
        if normalized.endswith("m"):
            return max(60, int(normalized[:-1] or "1") * 60)
        if normalized.endswith("h"):
            return max(3600, int(normalized[:-1] or "1") * 3600)
        if normalized.endswith("d"):
            return max(86400, int(normalized[:-1] or "1") * 86400)
        return 3600

    def _downsample_curve(self, points: list[dict], max_points: int = 2000) -> list[dict]:
        """Persist a render-safe curve while metrics use the full series."""
        if len(points) <= max_points:
            return points
        if max_points <= 2:
            return points[:max_points]
        step = (len(points) - 1) / (max_points - 1)
        sampled: list[dict] = []
        previous_index = -1
        for item_index in range(max_points):
            source_index = round(item_index * step)
            if source_index == previous_index:
                continue
            sampled.append(points[source_index])
            previous_index = source_index
        if sampled[-1] != points[-1]:
            sampled[-1] = points[-1]
        return sampled
