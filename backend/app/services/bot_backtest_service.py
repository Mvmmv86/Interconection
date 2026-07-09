"""Instance-scoped bot backtest runner.

This service is intentionally separate from the API request path. The API only
creates a run record and enqueues Celery; the worker executes this CPU/IO-heavy
simulation outside the FastAPI event loop.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
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
        coverage_quality = self._coverage_quality(candles, run.timeframe, run.period_start, run.period_end)
        data_warnings = self.engine._data_quality_warnings(data_quality) + coverage_quality["warnings"]
        data_quality = {
            **data_quality,
            **coverage_quality,
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
        max_drawdown_usd = Decimal("0")
        trade_count = 0
        trade_returns: list[Decimal] = []
        bars_in_market = 0
        best_trade_return: Decimal | None = None
        worst_trade_return: Decimal | None = None
        current_win_streak = 0
        current_loss_streak = 0
        max_win_streak = 0
        max_loss_streak = 0
        previous_equity: Decimal | None = None
        equity_returns: list[float] = []

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
            drawdown_usd = peak_equity - equity
            max_drawdown = max(max_drawdown, drawdown)
            max_drawdown_usd = max(max_drawdown_usd, drawdown_usd)
            if previous_equity is not None and previous_equity > 0:
                equity_returns.append(float((equity - previous_equity) / previous_equity))
            previous_equity = equity
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
                bars_held = max(1, index - entry_index)
                net_pnl, gross_pnl, fee_paid, slippage_paid, return_percent = self._close_trade(
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
                    bars_held=bars_held,
                    exit_evaluations=exit_evaluations,
                    fee_percent=fee_percent,
                    slippage_percent=slippage_percent,
                )
                bars_in_market += bars_held
                gross_proceeds = units * (price * (Decimal("1") - slippage_percent / Decimal("100")))
                cash += max(Decimal("0"), gross_proceeds - fee_paid)
                realized_net_pnl += net_pnl
                realized_gross_pnl += gross_pnl
                total_fees += fee_paid
                total_slippage += slippage_paid
                trade_returns.append(return_percent)
                best_trade_return = return_percent if best_trade_return is None else max(best_trade_return, return_percent)
                worst_trade_return = return_percent if worst_trade_return is None else min(worst_trade_return, return_percent)
                if net_pnl >= 0:
                    winning_trades += 1
                    gross_profit += net_pnl
                    current_win_streak += 1
                    current_loss_streak = 0
                    max_win_streak = max(max_win_streak, current_win_streak)
                else:
                    losing_trades += 1
                    gross_loss += net_pnl
                    current_loss_streak += 1
                    current_win_streak = 0
                    max_loss_streak = max(max_loss_streak, current_loss_streak)
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
            bars_held = max(1, len(candles) - 1 - entry_index)
            net_pnl, gross_pnl, fee_paid, slippage_paid, return_percent = self._close_trade(
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
                bars_held=bars_held,
                exit_evaluations=[],
                fee_percent=fee_percent,
                slippage_percent=slippage_percent,
            )
            bars_in_market += bars_held
            gross_proceeds = units * (last_price * (Decimal("1") - slippage_percent / Decimal("100")))
            cash += max(Decimal("0"), gross_proceeds - fee_paid)
            realized_net_pnl += net_pnl
            realized_gross_pnl += gross_pnl
            total_fees += fee_paid
            total_slippage += slippage_paid
            trade_returns.append(return_percent)
            best_trade_return = return_percent if best_trade_return is None else max(best_trade_return, return_percent)
            worst_trade_return = return_percent if worst_trade_return is None else min(worst_trade_return, return_percent)
            if net_pnl >= 0:
                winning_trades += 1
                gross_profit += net_pnl
                current_win_streak += 1
                current_loss_streak = 0
                max_win_streak = max(max_win_streak, current_win_streak)
            else:
                losing_trades += 1
                gross_loss += net_pnl
                current_loss_streak += 1
                current_win_streak = 0
                max_loss_streak = max(max_loss_streak, current_loss_streak)
            trade_count += 1

        ending_equity = cash
        roi_percent = (ending_equity - initial_capital) / initial_capital * Decimal("100") if initial_capital > 0 else Decimal("0")
        win_rate = Decimal(winning_trades) / Decimal(trade_count) * Decimal("100") if trade_count else Decimal("0")
        profit_factor = gross_profit / abs(gross_loss) if gross_loss < 0 else (gross_profit if gross_profit > 0 else Decimal("0"))
        avg_win = gross_profit / Decimal(winning_trades) if winning_trades else Decimal("0")
        avg_loss = gross_loss / Decimal(losing_trades) if losing_trades else Decimal("0")
        payoff_ratio = avg_win / abs(avg_loss) if avg_loss < 0 else (avg_win if avg_win > 0 else Decimal("0"))
        expectancy = realized_net_pnl / Decimal(trade_count) if trade_count else Decimal("0")
        expectancy_percent = sum(trade_returns, Decimal("0")) / Decimal(trade_count) if trade_count else Decimal("0")
        exposure_percent = Decimal(bars_in_market) / Decimal(max(1, len(candles))) * Decimal("100")
        avg_bars_held = Decimal(bars_in_market) / Decimal(trade_count) if trade_count else Decimal("0")
        buy_hold_roi = self._buy_hold_roi(candles)
        buy_hold_pnl = initial_capital * buy_hold_roi / Decimal("100")
        alpha_vs_buy_hold = roi_percent - buy_hold_roi
        annualization = self._annualization_metrics(
            equity_returns=equity_returns,
            timeframe=run.timeframe,
            initial_capital=initial_capital,
            ending_equity=ending_equity,
            max_drawdown=max_drawdown,
        )
        recovery_factor = realized_net_pnl / max_drawdown_usd if max_drawdown_usd > 0 else Decimal("0")
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
            "avg_win_usd": _json_number(avg_win),
            "avg_loss_usd": _json_number(avg_loss),
            "payoff_ratio": _json_number(payoff_ratio),
            "expectancy_usd": _json_number(expectancy),
            "expectancy_percent": _json_number(expectancy_percent),
            "exposure_percent": _json_number(exposure_percent),
            "avg_bars_held": _json_number(avg_bars_held),
            "best_trade_percent": _json_number(best_trade_return or Decimal("0")),
            "worst_trade_percent": _json_number(worst_trade_return or Decimal("0")),
            "max_consecutive_wins": max_win_streak,
            "max_consecutive_losses": max_loss_streak,
            "max_drawdown_usd": _json_number(max_drawdown_usd),
            "recovery_factor": _json_number(recovery_factor),
            "buy_hold_roi_percent": _json_number(buy_hold_roi),
            "buy_hold_pnl_usd": _json_number(buy_hold_pnl),
            "alpha_vs_buy_hold_percent": _json_number(alpha_vs_buy_hold),
            **annualization,
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
    ) -> tuple[Decimal, Decimal, Decimal, Decimal, Decimal]:
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
        return net_pnl, gross_pnl, exit_fee, exit_slippage, return_percent

    def _coverage_quality(
        self,
        candles: list,
        timeframe: str,
        period_start: datetime | None,
        period_end: datetime | None,
    ) -> dict:
        warnings: list[str] = []
        if period_start is None or period_end is None:
            return {
                "expected_rows": len(candles),
                "period_coverage_percent": 100,
                "first_candle_at": self._candle_open_time(candles[0]).isoformat() if candles and self._candle_open_time(candles[0]) else None,
                "last_candle_at": self._candle_open_time(candles[-1]).isoformat() if candles and self._candle_open_time(candles[-1]) else None,
                "warnings": warnings,
            }
        seconds = self._timeframe_seconds(timeframe)
        normalized_start = self._coerce_utc(period_start)
        normalized_end = self._coerce_utc(period_end)
        expected_rows = max(1, int((period_end - period_start).total_seconds() // seconds))
        first_at = self._candle_open_time(candles[0]) if candles else None
        last_at = self._candle_open_time(candles[-1]) if candles else None
        coverage_percent = Decimal(len(candles)) / Decimal(expected_rows) * Decimal("100") if expected_rows else Decimal("100")
        if first_at is not None and first_at > normalized_start + self._timeframe_tolerance(timeframe):
            warnings.append("requested_period_starts_before_available_history")
        if last_at is not None and last_at < normalized_end - self._timeframe_tolerance(timeframe):
            warnings.append("requested_period_ends_after_available_history")
        if coverage_percent < Decimal("90"):
            warnings.append("period_coverage_below_90_percent")
        return {
            "expected_rows": expected_rows,
            "period_coverage_percent": _json_number(min(coverage_percent, Decimal("100"))),
            "first_candle_at": first_at.isoformat() if first_at else None,
            "last_candle_at": last_at.isoformat() if last_at else None,
            "warnings": warnings,
        }

    def _candle_open_time(self, candle: object) -> datetime | None:
        value = getattr(candle, "open_time", None)
        if value is None and isinstance(candle, dict):
            value = candle.get("open_time") or candle.get("time")
        if isinstance(value, datetime):
            return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
        return None

    def _timeframe_tolerance(self, timeframe: str):
        return timedelta(seconds=self._timeframe_seconds(timeframe) * 2)

    def _coerce_utc(self, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    def _buy_hold_roi(self, candles: list) -> Decimal:
        if len(candles) < 2:
            return Decimal("0")
        first = Decimal(str(_candle_close_value(candles[0])))
        last = Decimal(str(_candle_close_value(candles[-1])))
        if first <= 0:
            return Decimal("0")
        return (last - first) / first * Decimal("100")

    def _annualization_metrics(
        self,
        *,
        equity_returns: list[float],
        timeframe: str,
        initial_capital: Decimal,
        ending_equity: Decimal,
        max_drawdown: Decimal,
    ) -> dict:
        periods_per_year = 365 * 24 * 3600 / self._timeframe_seconds(timeframe)
        mean_return = sum(equity_returns) / len(equity_returns) if equity_returns else 0.0
        volatility = self._stddev(equity_returns)
        downside = self._stddev([item for item in equity_returns if item < 0])
        sharpe = mean_return / volatility * math.sqrt(periods_per_year) if volatility > 0 else 0.0
        sortino = mean_return / downside * math.sqrt(periods_per_year) if downside > 0 else 0.0
        total_return = float(ending_equity / initial_capital) if initial_capital > 0 else 0.0
        annualized_return = 0.0
        if total_return > 0 and equity_returns:
            annualized_return = (total_return ** (periods_per_year / len(equity_returns)) - 1) * 100
        calmar = annualized_return / float(max_drawdown) if max_drawdown > 0 else 0.0
        return {
            "annualized_return_percent": self._finite_number(annualized_return),
            "annualized_volatility_percent": self._finite_number(volatility * math.sqrt(periods_per_year) * 100),
            "sharpe_ratio": self._finite_number(sharpe),
            "sortino_ratio": self._finite_number(sortino),
            "calmar_ratio": self._finite_number(calmar),
        }

    def _stddev(self, values: list[float]) -> float:
        clean_values = [item for item in values if math.isfinite(item)]
        if len(clean_values) < 2:
            return 0.0
        mean = sum(clean_values) / len(clean_values)
        variance = sum((item - mean) ** 2 for item in clean_values) / (len(clean_values) - 1)
        return math.sqrt(max(0.0, variance))

    def _finite_number(self, value: float) -> float:
        return value if math.isfinite(value) else 0.0

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
