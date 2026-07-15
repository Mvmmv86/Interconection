"""Instance-scoped bot backtest runner.

This service is intentionally separate from the API request path. The API only
creates a run record and enqueues Celery; the worker executes this CPU/IO-heavy
simulation outside the FastAPI event loop.
"""

from __future__ import annotations

import math
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import delete, select, update
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import set_committed_value

from app.db.session import async_session_maker
from app.models.bot import (
    BotBacktestRun,
    BotBacktestStatus,
    BotBacktestTrade,
    BotInstance,
    BotStrategy,
)
from app.models.market_candle import MarketCandle
from app.services.bot_engine_service import (
    BotEngineService,
    _candle_close_value,
    _candle_high_value,
    _candle_low_value,
    _candle_timestamp,
    _candle_volume_value,
    _json_number,
)
from app.services.market_data_ingestion_service import (
    MarketDataIngestionService,
    normalize_exchange_key,
    normalize_market_type,
    normalize_strategy_symbol,
)

logger = logging.getLogger(__name__)


class BotBacktestService:
    """Runs institutional backtests for activated customer bot instances."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.engine = BotEngineService(db)

    async def run_backtest_run(self, run_id: UUID) -> BotBacktestRun:
        """Execute one queued backtest run and persist metrics/trades."""
        claim_id = str(uuid4())
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
        diagnostics = dict(run.diagnostics or {})
        existing_claim = diagnostics.get("worker_claim_id")
        existing_claimed_at = self._parse_datetime(diagnostics.get("worker_claimed_at"))
        claim_is_stale = existing_claimed_at is None or (
            existing_claimed_at < datetime.now(timezone.utc) - timedelta(hours=2)
        )
        if existing_claim and not claim_is_stale:
            diagnostics["duplicate_worker_skipped_at"] = datetime.now(timezone.utc).isoformat()
            run.diagnostics = diagnostics
            await self.db.commit()
            return run

        run.started_at = run.started_at or datetime.now(timezone.utc)
        run.progress = 1
        run.diagnostics = {
            **diagnostics,
            "stage": "claimed",
            "stage_label": "Backtest worker claimed run",
            "worker_claim_id": claim_id,
            "worker_claimed_at": datetime.now(timezone.utc).isoformat(),
        }
        await self.db.commit()

        try:
            await self._execute(run, claim_id=claim_id)
        except Exception as exc:
            run.status = BotBacktestStatus.FAILED
            run.error_message = str(exc)
            run.progress = 100
            run.finished_at = datetime.now(timezone.utc)
            run.diagnostics = {
                **(run.diagnostics or {}),
                "error_type": exc.__class__.__name__,
                "failed_at": run.finished_at.isoformat(),
                "stage": "failed",
                "stage_label": "Backtest failed",
            }
            await self.db.commit()
        return run

    async def _execute(self, run: BotBacktestRun, *, claim_id: str) -> None:
        strategy = run.strategy
        instance = run.instance
        limit = self._candle_limit(run.timeframe, run.period_start, run.period_end, strategy)
        await self._save_progress(
            run,
            claim_id=claim_id,
            progress=5,
            stage="preparing_candles",
            stage_label="Preparing exchange candles on demand",
        )
        preload_snapshot = await self._preload_exchange_candles(run, limit=limit)
        await self._save_progress(
            run,
            claim_id=claim_id,
            progress=15,
            stage="loading_candles",
            stage_label="Loading normalized candles",
        )
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
        available_history = await self._available_history(run)
        data_warnings = self.engine._data_quality_warnings(data_quality) + coverage_quality["warnings"]
        data_quality = {
            **data_quality,
            **coverage_quality,
            "stage": "loaded_candles",
            "preload": preload_snapshot,
            "available_history": available_history,
            "requested_limit": limit,
            "candle_source": candle_source,
            "warnings": data_warnings,
        }
        run.data_quality = data_quality
        if len(candles) < 2:
            run.status = BotBacktestStatus.FAILED
            run.error_message = self._insufficient_history_message(
                run=run,
                available_history=available_history,
                sample_count=len(candles),
            )
            run.result_summary = {
                "reason": "missing_price_history",
                "sample_count": len(candles),
                "available_history": available_history,
                "requested_period_start": run.period_start.isoformat(),
                "requested_period_end": run.period_end.isoformat(),
            }
            run.progress = 100
            run.finished_at = datetime.now(timezone.utc)
            run.diagnostics = {
                **(run.diagnostics or {}),
                "stage": "failed",
                "stage_label": "Backtest failed: insufficient history",
            }
            await self.db.commit()
            return

        frames, fallback_indicators = self.engine._indicator_frames(strategy, candles)
        if not frames:
            run.status = BotBacktestStatus.FAILED
            run.error_message = "Strategy has no configured indicators"
            run.result_summary = {"reason": "missing_indicators", "sample_count": len(candles)}
            run.progress = 100
            run.finished_at = datetime.now(timezone.utc)
            run.diagnostics = {
                **(run.diagnostics or {}),
                "stage": "failed",
                "stage_label": "Backtest failed: missing indicators",
            }
            await self.db.commit()
            return

        await self.db.execute(delete(BotBacktestTrade).where(BotBacktestTrade.run_id == run.id))
        await self._save_progress(
            run,
            claim_id=claim_id,
            progress=20,
            stage="simulating",
            stage_label="Running strategy simulation",
        )

        risk = self.engine._merged_risk_config(strategy, instance=instance, overrides=run.risk_snapshot or {})
        cost_snapshot = run.cost_snapshot or {}
        fee_percent = self._bounded_percent(risk.get("fee_percent", cost_snapshot.get("fee_percent", 0)), 10)
        slippage_percent = self._bounded_percent(risk.get("slippage_percent", cost_snapshot.get("slippage_percent", 0)), 20)
        stop_loss_percent = Decimal(str(risk.get("stop_loss_percent", 0) or 0))
        take_profit_percent = Decimal(str(risk.get("take_profit_percent", 0) or 0))
        breakeven_activation_percent = Decimal(str(risk.get("breakeven_activation_percent", 0) or 0))

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
        entry_conditions_snapshot: list[dict] = []
        entry_indicator_snapshot: dict = {}
        entry_candle_snapshot: dict = {}
        entry_stop_snapshot: dict = {}
        entry_sizing_snapshot: dict = {}
        highest_since_entry = Decimal("0")
        lowest_since_entry = Decimal("0")
        breakeven_armed = False
        trailing_armed = False
        active_stop_price = Decimal("0")
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
        active_equity_returns: list[float] = []

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
                bar_return = float((equity - previous_equity) / previous_equity)
                equity_returns.append(bar_return)
                if units > 0:
                    active_equity_returns.append(bar_return)
            previous_equity = equity
            equity_curve.append({"time": timestamp.isoformat(), "equity": _json_number(equity)})
            drawdown_curve.append({"time": timestamp.isoformat(), "drawdown_percent": _json_number(drawdown)})

            exit_passed, exit_evaluations = self.engine._evaluate_rule_group(strategy.rule_config or {}, "exit", frames, index)
            entry_passed, entry_evaluations = self.engine._evaluate_rule_group(strategy.rule_config or {}, "entry", frames, index)
            exit_reason = "rule_exit"
            exit_trigger_price = price
            exit_levels: dict = {}
            exit_stop_snapshot: dict = {}
            if units > 0 and entry_price > 0:
                gain_percent = (price - entry_price) / entry_price * Decimal("100")
                peak_gain_percent = (highest_since_entry - entry_price) / entry_price * Decimal("100")
                if breakeven_activation_percent > 0 and peak_gain_percent >= breakeven_activation_percent:
                    breakeven_armed = True
                drawdown_from_entry = (entry_price - low) / entry_price * Decimal("100")
                stop_snapshot = self.engine._risk_stop_snapshot(
                    risk_config=risk,
                    frames=frames,
                    candles=candles,
                    index=index,
                    price=price,
                    latest_high=high,
                    entry_price=entry_price,
                    highest_since_entry=highest_since_entry,
                    previous_active_stop=active_stop_price,
                )
                exit_stop_snapshot = self._json_safe(stop_snapshot)
                active_stop_price = stop_snapshot["active_stop_price"]
                trailing_armed = bool(stop_snapshot["trailing_armed"])
                stop_loss_price = entry_price * (Decimal("1") - stop_loss_percent / Decimal("100"))
                take_profit_price = entry_price * (Decimal("1") + take_profit_percent / Decimal("100"))
                exit_levels = self._json_safe(
                    {
                        "latest_close": price,
                        "latest_high": high,
                        "latest_low": low,
                        "gain_percent_close": gain_percent,
                        "drawdown_from_entry_percent": drawdown_from_entry,
                        "peak_gain_percent": peak_gain_percent,
                        "active_stop_price": active_stop_price,
                        "stop_loss_price": stop_loss_price if stop_loss_percent > 0 else None,
                        "take_profit_price": take_profit_price if take_profit_percent > 0 else None,
                        "breakeven_price": entry_price if breakeven_armed else None,
                        "breakeven_armed": breakeven_armed,
                        "trailing_armed": trailing_armed,
                    }
                )
                if stop_loss_percent > 0 and low <= stop_loss_price:
                    exit_passed = True
                    exit_reason = "stop_loss"
                    exit_trigger_price = stop_loss_price
                elif active_stop_price > 0 and low <= active_stop_price:
                    exit_passed = True
                    exit_trigger_price = active_stop_price
                    if stop_snapshot["stop_source"] == "trailing_stop":
                        exit_reason = "trailing_stop"
                    elif stop_snapshot["stop_model"] == "atr":
                        exit_reason = "atr_stop"
                    else:
                        exit_reason = "alpha_trend_stop"
                elif take_profit_percent > 0 and high >= take_profit_price:
                    exit_passed = True
                    exit_reason = "take_profit"
                    exit_trigger_price = take_profit_price
                elif breakeven_armed and low <= entry_price:
                    exit_passed = True
                    exit_reason = "breakeven_guard"
                    exit_trigger_price = entry_price

            if units > 0 and exit_passed:
                bars_held = max(1, index - entry_index)
                net_pnl, gross_pnl, fee_paid, slippage_paid, return_percent = self._close_trade(
                    run=run,
                    timestamp=timestamp,
                    price=exit_trigger_price,
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
                    entry_conditions=entry_conditions_snapshot,
                    entry_indicators=entry_indicator_snapshot,
                    entry_candle=entry_candle_snapshot,
                    entry_stop=entry_stop_snapshot,
                    entry_sizing=entry_sizing_snapshot,
                    exit_evaluations=exit_evaluations,
                    exit_indicators=self._indicator_snapshot(frames, index, exit_evaluations),
                    exit_candle=self._candle_snapshot(candle, index),
                    exit_stop=exit_stop_snapshot,
                    exit_levels=exit_levels,
                    fee_percent=fee_percent,
                    slippage_percent=slippage_percent,
                )
                bars_in_market += bars_held
                gross_proceeds = units * (exit_trigger_price * (Decimal("1") - slippage_percent / Decimal("100")))
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
                entry_conditions_snapshot = []
                entry_indicator_snapshot = {}
                entry_candle_snapshot = {}
                entry_stop_snapshot = {}
                entry_sizing_snapshot = {}
                highest_since_entry = Decimal("0")
                lowest_since_entry = Decimal("0")
                breakeven_armed = False
                trailing_armed = False
                active_stop_price = Decimal("0")
                continue

            current_position_value = units * price
            allow_averaging = str(risk.get("allow_averaging", "false")).lower() in {"1", "true", "yes", "on"}
            if entry_passed and cash > 0 and (units == 0 or allow_averaging):
                entry_stop_raw = self.engine._risk_stop_snapshot(
                    risk_config=risk,
                    frames=frames,
                    candles=candles,
                    index=index,
                    price=price,
                    latest_high=high,
                )
                if entry_stop_raw["invalid_for_entry"]:
                    continue
                sizing = self.engine._sizing_snapshot(
                    risk,
                    latest_price=price,
                    current_symbol_value=current_position_value,
                    sizing_capital=cash + current_position_value,
                    stop_price=entry_stop_raw["active_stop_price"],
                    stop_model=entry_stop_raw["stop_model"],
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
                active_stop_price = sizing["stop_price"]
                entry_conditions_snapshot = self._json_safe(entry_evaluations)
                entry_indicator_snapshot = self._indicator_snapshot(frames, index, entry_evaluations)
                entry_candle_snapshot = self._candle_snapshot(candle, index)
                entry_stop_snapshot = self._json_safe(entry_stop_raw)
                entry_sizing_snapshot = self._json_safe(sizing)
                set_committed_value(
                    run,
                    "diagnostics",
                    {
                        **(run.diagnostics or {}),
                        "last_entry_conditions": entry_evaluations,
                        "last_sizing": {
                            key: _json_number(value) if isinstance(value, Decimal) else value
                            for key, value in sizing.items()
                        },
                    },
                )

            if index % 250 == 0:
                await self._save_progress(
                    run,
                    claim_id=claim_id,
                    progress=min(95, int(index / max(1, len(candles)) * 100)),
                    stage="simulating",
                    stage_label="Running strategy simulation",
                )

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
                entry_conditions=entry_conditions_snapshot,
                entry_indicators=entry_indicator_snapshot,
                entry_candle=entry_candle_snapshot,
                entry_stop=entry_stop_snapshot,
                entry_sizing=entry_sizing_snapshot,
                exit_evaluations=[],
                exit_indicators={},
                exit_candle=self._candle_snapshot(last_candle, len(candles) - 1),
                exit_stop={},
                exit_levels={},
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
            active_equity_returns=active_equity_returns,
            time_weighted_equity_returns=equity_returns,
            timeframe=run.timeframe,
            initial_capital=initial_capital,
            ending_equity=ending_equity,
            max_drawdown=max_drawdown,
            period_start=run.period_start,
            period_end=run.period_end,
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
            "stage": "completed",
            "stage_label": "Backtest completed",
            "curve_points_full": len(equity_curve),
            "curve_points_stored": len(stored_equity_curve),
            "curve_downsample_max_points": 2000,
        }
        run.finished_at = datetime.now(timezone.utc)
        await self.db.commit()

    async def _save_progress(
        self,
        run: BotBacktestRun,
        *,
        claim_id: str,
        progress: int,
        stage: str,
        stage_label: str,
    ) -> None:
        """Persist a visible worker stage without waiting for the full run."""
        diagnostics = dict(run.diagnostics or {})
        if diagnostics.get("worker_claim_id") != claim_id:
            raise RuntimeError("Backtest worker claim lost")
        updated_diagnostics = {
            **diagnostics,
            "stage": stage,
            "stage_label": stage_label,
            "stage_updated_at": datetime.now(timezone.utc).isoformat(),
        }
        set_committed_value(run, "progress", progress)
        set_committed_value(run, "diagnostics", updated_diagnostics)
        async with async_session_maker() as progress_session:
            await progress_session.execute(
                update(BotBacktestRun)
                .where(
                    BotBacktestRun.id == run.id,
                    BotBacktestRun.status == BotBacktestStatus.RUNNING,
                )
                .values(progress=progress, diagnostics=updated_diagnostics)
            )
            await progress_session.commit()

    def _parse_datetime(self, value: object) -> datetime | None:
        if not isinstance(value, str) or not value:
            return None
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError:
            return None
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)

    async def _preload_exchange_candles(self, run: BotBacktestRun, *, limit: int) -> dict:
        """Fetch the requested symbol/timeframe before simulating a customer bot.

        Scanner snapshots are intentionally cheap and usually store 1h/1d data.
        Institutional backtests can request 4h+ windows for basket assets that
        were never ingested in that exact timeframe. Preloading here keeps the
        worker self-sufficient and prevents a misleading fallback to legacy
        ticker-only price history.
        """
        if run.exchange_id is None:
            return {
                "status": "skipped",
                "reason": "missing_exchange_id",
            }
        local_before = await self._available_history(run)
        if self._history_covers_request(local_before):
            return {
                "status": "skipped",
                "reason": "local_coverage_sufficient",
                "local_coverage": local_before,
            }
        try:
            service = MarketDataIngestionService(self.db)
            result = await service.sync_exchange_candles(
                exchange_id=run.exchange_id,
                organization_id=run.organization_id,
                symbols=[run.symbol],
                timeframes=[run.timeframe],
                limit=limit,
                market_type=run.market_type,
                period_start=run.period_start,
                period_end=run.period_end,
            )
            await self.db.flush()
            local_after = await self._available_history(run)
            return {
                "status": "completed",
                **result,
                "local_coverage_before": local_before,
                "local_coverage_after": local_after,
            }
        except Exception as exc:
            logger.warning(
                "Backtest candle preload failed",
                extra={
                    "run_id": str(run.id),
                    "exchange_id": str(run.exchange_id),
                    "symbol": run.symbol,
                    "timeframe": run.timeframe,
                },
                exc_info=True,
            )
            return {
                "status": "failed",
                "error_type": exc.__class__.__name__,
                "message": "Exchange candle preload failed; using any candles already stored locally.",
                "local_coverage_before": local_before,
            }

    def _json_safe(self, value: object) -> object:
        if isinstance(value, Decimal):
            return _json_number(value)
        if isinstance(value, datetime):
            return value.isoformat()
        if isinstance(value, dict):
            return {str(key): self._json_safe(item) for key, item in value.items()}
        if isinstance(value, list):
            return [self._json_safe(item) for item in value]
        if isinstance(value, tuple):
            return [self._json_safe(item) for item in value]
        return value

    def _indicator_snapshot(
        self,
        frames: dict[str, dict[str, list[float | None]]],
        index: int,
        condition_evaluations: list[dict] | None = None,
    ) -> dict:
        snapshot: dict[str, dict] = {}
        for indicator_key in self._audit_indicator_keys(frames, condition_evaluations):
            outputs = frames.get(indicator_key)
            if not isinstance(outputs, dict):
                continue
            indicator_values: dict[str, dict] = {}
            for output_key, series in list(outputs.items())[:8]:
                if not isinstance(series, list):
                    continue
                value = series[index] if 0 <= index < len(series) else None
                previous = series[index - 1] if index > 0 and index - 1 < len(series) else None
                if value is None and previous is None:
                    continue
                indicator_values[str(output_key)] = {
                    "value": _json_number(value) if value is not None else None,
                    "previous": _json_number(previous) if previous is not None else None,
                }
            if indicator_values:
                snapshot[str(indicator_key)] = indicator_values
        return snapshot

    def _audit_indicator_keys(
        self,
        frames: dict[str, dict[str, list[float | None]]],
        condition_evaluations: list[dict] | None,
    ) -> list[str]:
        selected: list[str] = []
        for condition in condition_evaluations or []:
            if not isinstance(condition, dict):
                continue
            for key_name in ("indicator", "compare_to"):
                value = condition.get(key_name)
                if isinstance(value, str) and value in frames and value not in selected:
                    selected.append(value)
        fallback_candidates = (
            "bc_alpha_trend",
            "alpha_trend",
            "atr",
            "atr_stop",
            "ma20",
            "ma50",
            "sma20",
            "sma50",
        )
        for indicator_key in fallback_candidates:
            if indicator_key in frames and indicator_key not in selected:
                selected.append(indicator_key)
        if not selected:
            selected.extend(list(frames.keys())[:4])
        return selected[:8]

    def _candle_snapshot(self, candle: object, index: int) -> dict:
        close = _candle_close_value(candle)
        return {
            "index": index,
            "time": _candle_timestamp(candle).isoformat(),
            "open": _json_number(getattr(candle, "open", close)),
            "high": _json_number(_candle_high_value(candle, close)),
            "low": _json_number(_candle_low_value(candle, close)),
            "close": _json_number(close),
            "volume": _json_number(_candle_volume_value(candle)),
        }

    async def _available_history(self, run: BotBacktestRun) -> dict:
        """Return the stored candle range for the exact market requested."""
        exchange = normalize_exchange_key(run.exchange)
        symbol = normalize_strategy_symbol(run.symbol)
        market_type = normalize_market_type(run.market_type)
        base_filters = (
            MarketCandle.exchange == exchange,
            MarketCandle.symbol == symbol,
            MarketCandle.market_type == market_type,
            MarketCandle.timeframe == run.timeframe,
        )
        result = await self.db.execute(
            select(
                func.count(MarketCandle.id),
                func.min(MarketCandle.open_time),
                func.max(MarketCandle.open_time),
            ).where(*base_filters)
        )
        count, first_at, last_at = result.one()
        period_result = await self.db.execute(
            select(
                func.count(MarketCandle.id),
                func.min(MarketCandle.open_time),
                func.max(MarketCandle.open_time),
            ).where(
                *base_filters,
                MarketCandle.open_time >= run.period_start,
                MarketCandle.open_time <= run.period_end,
            )
        )
        period_count, period_first_at, period_last_at = period_result.one()
        expected_rows = self._expected_rows(run.timeframe, run.period_start, run.period_end)
        period_coverage_percent = (
            Decimal(int(period_count or 0)) / Decimal(expected_rows) * Decimal("100")
            if expected_rows
            else Decimal("100")
        )
        period_covers_request = (
            int(period_count or 0) >= math.floor(expected_rows * 0.95)
            and period_first_at is not None
            and period_last_at is not None
            and self._coerce_utc(period_first_at) <= self._coerce_utc(run.period_start) + self._timeframe_tolerance(run.timeframe)
            and self._coerce_utc(period_last_at) >= self._coerce_utc(run.period_end) - self._timeframe_tolerance(run.timeframe)
        )
        return {
            "exchange": exchange,
            "symbol": symbol,
            "market_type": market_type,
            "timeframe": run.timeframe,
            "stored_rows": int(count or 0),
            "first_candle_at": first_at.isoformat() if first_at else None,
            "last_candle_at": last_at.isoformat() if last_at else None,
            "period_rows": int(period_count or 0),
            "period_first_candle_at": period_first_at.isoformat() if period_first_at else None,
            "period_last_candle_at": period_last_at.isoformat() if period_last_at else None,
            "expected_rows": expected_rows,
            "period_coverage_percent": _json_number(min(period_coverage_percent, Decimal("100"))),
            "period_covers_request": period_covers_request,
            "requested_period_start": run.period_start.isoformat(),
            "requested_period_end": run.period_end.isoformat(),
        }

    def _history_covers_request(self, snapshot: dict) -> bool:
        return bool(snapshot.get("period_covers_request"))

    def _insufficient_history_message(
        self,
        *,
        run: BotBacktestRun,
        available_history: dict,
        sample_count: int,
    ) -> str:
        first_at = available_history.get("first_candle_at")
        last_at = available_history.get("last_candle_at")
        if first_at and last_at:
            return (
                "Not enough exchange candles for this backtest window. "
                f"{run.symbol} {run.timeframe} is available from {first_at} to {last_at}; "
                f"requested {run.period_start.isoformat()} to {run.period_end.isoformat()}."
            )
        if sample_count > 0:
            return (
                "Not enough exchange candles for this backtest window. "
                f"Only {sample_count} candle(s) matched the requested period."
            )
        return (
            "Not enough exchange candles for this backtest window. "
            "The exchange did not return usable OHLCV history for the requested symbol/timeframe yet."
        )

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
        entry_conditions: list[dict],
        entry_indicators: dict,
        entry_candle: dict,
        entry_stop: dict,
        entry_sizing: dict,
        exit_evaluations: list[dict],
        exit_indicators: dict,
        exit_candle: dict,
        exit_stop: dict,
        exit_levels: dict,
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
                raw_payload=self._json_safe(
                    {
                        "entry_conditions": entry_conditions,
                        "exit_conditions": exit_evaluations,
                        "entry": {
                            "reason": entry_reason,
                            "conditions": entry_conditions,
                            "indicators": entry_indicators,
                            "candle": entry_candle,
                            "stop": entry_stop,
                            "sizing": entry_sizing,
                            "execution_price": entry_price,
                        },
                        "exit": {
                            "reason": exit_reason,
                            "conditions": exit_evaluations,
                            "indicators": exit_indicators,
                            "candle": exit_candle,
                            "stop": exit_stop,
                            "levels": exit_levels,
                            "trigger_price": price,
                            "execution_price": execution_price,
                            "gross_pnl": gross_pnl,
                            "net_pnl": net_pnl,
                            "return_percent": return_percent,
                        },
                        "risk_controls": {
                            "fee_percent": fee_percent,
                            "slippage_percent": slippage_percent,
                            "mae_percent": mae_percent,
                            "mfe_percent": mfe_percent,
                        },
                    }
                ),
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
        expected_rows = self._expected_rows(timeframe, period_start, period_end)
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
            "requested_period_start": normalized_start.isoformat(),
            "requested_period_end": normalized_end.isoformat(),
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

    def _expected_rows(self, timeframe: str, period_start: datetime, period_end: datetime) -> int:
        seconds = self._timeframe_seconds(timeframe)
        return max(1, int((period_end - period_start).total_seconds() // seconds))

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
        active_equity_returns: list[float],
        time_weighted_equity_returns: list[float],
        timeframe: str,
        initial_capital: Decimal,
        ending_equity: Decimal,
        max_drawdown: Decimal,
        period_start: datetime | None,
        period_end: datetime | None,
    ) -> dict:
        minimum_days = 30
        periods_per_year = 365 * 24 * 3600 / self._timeframe_seconds(timeframe)
        period_days = self._period_days(
            period_start=period_start,
            period_end=period_end,
            fallback_bar_count=len(time_weighted_equity_returns),
            timeframe=timeframe,
        )
        active_ratios = self._annualized_return_ratios(active_equity_returns, periods_per_year)
        time_weighted_ratios = self._annualized_return_ratios(time_weighted_equity_returns, periods_per_year)
        total_return = float(ending_equity / initial_capital) if initial_capital > 0 else 0.0
        can_annualize = period_days >= minimum_days and total_return > 0
        annualized_return = ((total_return ** (365 / period_days) - 1) * 100) if can_annualize else None
        calmar = (
            annualized_return / float(max_drawdown)
            if annualized_return is not None and max_drawdown > 0
            else None
        )
        return {
            "annualized_return_percent": self._finite_number_or_none(annualized_return),
            "annualized_volatility_percent": active_ratios["volatility_percent"],
            "sharpe_ratio": active_ratios["sharpe"],
            "sortino_ratio": active_ratios["sortino"],
            "calmar_ratio": self._finite_number_or_none(calmar),
            "return_sampling": "position_bars",
            "position_bar_count": len(active_equity_returns),
            "time_weighted_bar_count": len(time_weighted_equity_returns),
            "time_weighted_annualized_volatility_percent": time_weighted_ratios["volatility_percent"],
            "time_weighted_sharpe_ratio": time_weighted_ratios["sharpe"],
            "time_weighted_sortino_ratio": time_weighted_ratios["sortino"],
            "annualization_period_days": self._finite_number(period_days),
            "annualization_min_days": minimum_days,
            "annualization_status": "ok" if can_annualize else "insufficient_period",
            "risk_free_rate_assumption": 0,
        }

    def _annualized_return_ratios(self, returns: list[float], periods_per_year: float) -> dict:
        clean_returns = [item for item in returns if math.isfinite(item)]
        if len(clean_returns) < 2:
            return {"volatility_percent": None, "sharpe": None, "sortino": None}
        mean_return = sum(clean_returns) / len(clean_returns)
        volatility = self._stddev(clean_returns)
        downside = self._stddev([item for item in clean_returns if item < 0])
        sharpe = mean_return / volatility * math.sqrt(periods_per_year) if volatility > 0 else None
        sortino = mean_return / downside * math.sqrt(periods_per_year) if downside > 0 else None
        return {
            "volatility_percent": self._finite_number_or_none(volatility * math.sqrt(periods_per_year) * 100),
            "sharpe": self._finite_number_or_none(sharpe),
            "sortino": self._finite_number_or_none(sortino),
        }

    def _period_days(
        self,
        *,
        period_start: datetime | None,
        period_end: datetime | None,
        fallback_bar_count: int,
        timeframe: str,
    ) -> float:
        if period_start is not None and period_end is not None:
            return max(0.0, (period_end - period_start).total_seconds() / 86400)
        return fallback_bar_count * self._timeframe_seconds(timeframe) / 86400

    def _stddev(self, values: list[float]) -> float:
        clean_values = [item for item in values if math.isfinite(item)]
        if len(clean_values) < 2:
            return 0.0
        mean = sum(clean_values) / len(clean_values)
        variance = sum((item - mean) ** 2 for item in clean_values) / (len(clean_values) - 1)
        return math.sqrt(max(0.0, variance))

    def _finite_number(self, value: float) -> float:
        return value if math.isfinite(value) else 0.0

    def _finite_number_or_none(self, value: float | None) -> float | None:
        if value is None:
            return None
        return value if math.isfinite(value) else None

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
