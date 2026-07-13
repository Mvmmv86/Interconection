"""Bot catalog and customer activation endpoints."""

import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Annotated, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.api.deps import (
    DBSession,
    MembershipAuthContext,
    SuperUser,
    apply_client_scope_filter,
    is_scope_specific_enforcement_enabled,
    rbac_route_guard,
    require_permission,
    require_superuser,
)
from app.models.audit_log import AuditAction
from app.models.bot import (
    BotBacktest,
    BotBacktestRun,
    BotBacktestStatus,
    BotBacktestTrade,
    BotIndicator,
    BotInstance,
    BotInstanceMode,
    BotInstanceStatus,
    BotRun,
    BotSignal,
    BotStrategy,
    BotStrategyStatus,
    BotTemplate,
    BotTemplateParameter,
    BotTemplateStatus,
)
from app.models.client import Client
from app.models.exchange import Exchange
from app.models.market_candle import MarketCandle
from app.models.market_ranking import MarketRankingSnapshot, MarketUniverseAsset
from app.models.organization import Organization, PlanType
from app.schemas.exchange import SUPPORTED_EXCHANGES as ENABLED_EXCHANGE_CONNECTORS
from app.schemas.bot import (
    AdminBotInstanceUpdate,
    AdminBotTemplateCreate,
    AdminBotTemplateUpdate,
    BotBacktestCreate,
    BotBacktestCandleResponse,
    BotBacktestChartResponse,
    BotBacktestRunResponse,
    BotBacktestResponse,
    BotBacktestTradeResponse,
    BotBasketRefreshResponse,
    BotIndicatorResponse,
    BotInstanceBacktestCreate,
    BotInstanceCreate,
    BotInstanceResponse,
    BotInstanceUpdate,
    BotLiveEnableRequest,
    BotMarketCandleSyncRequest,
    BotMarketCandleSyncResponse,
    BotMarketRankingGenerateRequest,
    BotMarketRankingItemResponse,
    BotMarketRankingResponse,
    BotMarketScannerBootstrapRequest,
    BotMarketScannerBootstrapResponse,
    BotMarketUniverseAssetResponse,
    BotRunRequest,
    BotRunBatchResponse,
    BotRunResponse,
    BotSchedulerRunRequest,
    BotSchedulerRunResponse,
    BotSignalResponse,
    BotStrategyCreate,
    BotStrategyResponse,
    BotStrategyUpdate,
    BotTemplateParameterCreate,
    BotTemplateParameterResponse,
    BotTemplateResponse,
)
from app.services.audit_service import record_audit_event, record_audit_event_immediate
from app.services.bot_engine_service import BotEngineService
from app.services.bot_scheduler_service import BotSchedulerService
from app.services.market_data_ingestion_service import (
    MarketDataIngestionService,
    normalize_exchange_key,
    normalize_market_type,
    normalize_strategy_symbol,
    resolve_strategy_market_type,
    resolve_strategy_symbols,
    resolve_strategy_timeframe,
)
from app.services.market_ranking_service import MarketRankingService
from app.services.market_scanner_bootstrap_service import MarketScannerBootstrapService
from app.services.plan_limits import enforce_plan_limit
from app.workers.bot_backtest_tasks import run_bot_backtest_task

router = APIRouter(dependencies=[Depends(rbac_route_guard("bots"))])
admin_router = APIRouter(dependencies=[Depends(require_superuser)])
logger = logging.getLogger(__name__)

PLAN_RANK = {
    PlanType.FREE: 0,
    PlanType.PRO: 1,
    PlanType.ENTERPRISE: 2,
}


def _enum_value(value: object) -> str:
    return value.value if hasattr(value, "value") else str(value)


def _stable_json(value: object) -> str:
    return json.dumps(value, sort_keys=True, default=str, separators=(",", ":"))


def _template_parameter_response(parameter: BotTemplateParameter) -> BotTemplateParameterResponse:
    return BotTemplateParameterResponse(
        id=parameter.id,
        template_id=parameter.template_id,
        key=parameter.key,
        label=parameter.label,
        type=parameter.type,
        required=parameter.required,
        default_value=parameter.default_value,
        min_value=parameter.min_value,
        max_value=parameter.max_value,
        options=parameter.options,
        help_text=parameter.help_text,
        created_at=parameter.created_at,
        updated_at=parameter.updated_at,
    )


def _template_response(
    template: BotTemplate,
    *,
    active_instance_count: int = 0,
    total_instance_count: int = 0,
) -> BotTemplateResponse:
    parameters = [_template_parameter_response(parameter) for parameter in template.parameters]
    return BotTemplateResponse(
        id=template.id,
        name=template.name,
        slug=template.slug,
        description=template.description,
        type=_enum_value(template.type),
        status=_enum_value(template.status),
        required_plan=_enum_value(template.required_plan),
        requires_trade_permission=template.requires_trade_permission,
        supported_exchanges=list(template.supported_exchanges or []),
        supported_assets=list(template.supported_assets or []),
        default_parameters=dict(template.default_parameters or {}),
        risk_notes=template.risk_notes,
        strategy_id=template.strategy_id,
        strategy_name=template.strategy.name if template.strategy else None,
        parameter_count=len(parameters),
        active_instance_count=active_instance_count,
        total_instance_count=total_instance_count,
        parameters=parameters,
        created_by_user_id=template.created_by_user_id,
        created_at=template.created_at,
        updated_at=template.updated_at,
    )


def _instance_response(instance: BotInstance) -> BotInstanceResponse:
    return BotInstanceResponse(
        id=instance.id,
        template_id=instance.template_id,
        template_name=instance.template.name if instance.template else None,
        template_type=_enum_value(instance.template.type) if instance.template else None,
        organization_id=instance.organization_id,
        organization_name=instance.organization.name if instance.organization else None,
        client_id=instance.client_id,
        client_name=instance.client.name,
        exchange_id=instance.exchange_id,
        exchange_name=instance.exchange.label if instance.exchange else None,
        strategy_id=instance.strategy_id,
        strategy_name=instance.strategy.name if instance.strategy else None,
        name=instance.name,
        mode=_enum_value(instance.mode),
        status=_enum_value(instance.status),
        live_enabled=instance.live_enabled,
        parameters=dict(instance.parameters or {}),
        risk_config=dict(instance.risk_config or {}),
        last_error=instance.last_error,
        last_heartbeat_at=instance.last_heartbeat_at,
        last_run_at=instance.last_run_at,
        started_at=instance.started_at,
        paused_at=instance.paused_at,
        disabled_at=instance.disabled_at,
        created_by_user_id=instance.created_by_user_id,
        created_at=instance.created_at,
        updated_at=instance.updated_at,
    )


def _apply_status_timestamps(instance: BotInstance, status_value: BotInstanceStatus) -> None:
    now = datetime.now(timezone.utc)
    if status_value == BotInstanceStatus.ACTIVE:
        instance.started_at = instance.started_at or now
        instance.paused_at = None
        instance.disabled_at = None
    elif status_value == BotInstanceStatus.PAUSED:
        instance.paused_at = now
    elif status_value == BotInstanceStatus.DISABLED:
        instance.disabled_at = now


def _merge_parameters(template: BotTemplate, overrides: dict) -> dict:
    parameters = dict(template.default_parameters or {})
    parameters.update(overrides or {})
    missing_required = [
        parameter.key
        for parameter in template.parameters
        if parameter.required and parameters.get(parameter.key) in (None, "")
    ]
    if missing_required:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Missing required bot parameters", "keys": missing_required},
        )
    return parameters


async def _get_customer_client(
    db: DBSession,
    permission_ctx: MembershipAuthContext,
    client_id: UUID,
) -> Client:
    if (
        is_scope_specific_enforcement_enabled("bots")
        and not permission_ctx.can_access_client(client_id)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden by membership client scope",
        )
    client = await db.scalar(
        select(Client).where(
            Client.id == client_id,
            Client.organization_id == permission_ctx.organization_id,
        )
    )
    if client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return client


async def _get_customer_exchange(
    db: DBSession,
    client_id: UUID,
    exchange_id: UUID | None,
) -> Exchange | None:
    if exchange_id is None:
        return None
    exchange = await db.scalar(
        select(Exchange).where(
            Exchange.id == exchange_id,
            Exchange.client_id == client_id,
        )
    )
    if exchange is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exchange not found")
    return exchange


async def _get_organization(db: DBSession, organization_id: UUID) -> Organization:
    organization = await db.get(Organization, organization_id)
    if organization is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return organization


def _ensure_plan_allows_template(organization: Organization, template: BotTemplate) -> None:
    if PLAN_RANK[organization.plan] < PLAN_RANK[template.required_plan]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "message": "Bot requires a higher plan",
                "required_plan": template.required_plan.value,
                "current_plan": organization.plan.value,
            },
        )


def _ensure_exchange_supported(template: BotTemplate | None, exchange: Exchange | None) -> None:
    if template is None:
        return
    supported = [item.lower() for item in (template.supported_exchanges or [])]
    if exchange is None:
        if supported:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This bot requires a supported exchange connection",
            )
        return
    connector = exchange.exchange.lower()
    if connector not in ENABLED_EXCHANGE_CONNECTORS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected exchange connector is not enabled for bot automation",
        )
    if not exchange.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected exchange connection is inactive",
        )
    if supported and connector not in supported:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected exchange is not supported by this bot",
        )


def _replace_template_parameters(template: BotTemplate, parameters: list[BotTemplateParameterCreate]) -> None:
    template.parameters.clear()
    for parameter in parameters:
        if not isinstance(parameter, BotTemplateParameterCreate):
            parameter = BotTemplateParameterCreate(**parameter)
        template.parameters.append(BotTemplateParameter(id=uuid4(), **parameter.model_dump()))


async def _load_instance_for_response(db: DBSession, instance_id: UUID) -> BotInstance:
    instance = await db.scalar(
        select(BotInstance)
        .options(
            selectinload(BotInstance.template),
            selectinload(BotInstance.strategy),
            selectinload(BotInstance.organization),
            selectinload(BotInstance.client),
            selectinload(BotInstance.exchange),
        )
        .where(BotInstance.id == instance_id)
    )
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot instance not found")
    return instance


async def _load_template_for_response(db: DBSession, template_id: UUID) -> BotTemplate:
    template = await db.scalar(
        select(BotTemplate)
        .options(selectinload(BotTemplate.parameters), selectinload(BotTemplate.strategy))
        .where(BotTemplate.id == template_id)
    )
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot template not found")
    return template


def _strategy_response(
    strategy: BotStrategy,
    *,
    template_count: int = 0,
    instance_count: int = 0,
    backtest_count: int = 0,
) -> BotStrategyResponse:
    return BotStrategyResponse(
        id=strategy.id,
        name=strategy.name,
        slug=strategy.slug,
        description=strategy.description,
        type=_enum_value(strategy.type),
        status=_enum_value(strategy.status),
        version=strategy.version,
        market_config=dict(strategy.market_config or {}),
        indicator_config=dict(strategy.indicator_config or {}),
        rule_config=dict(strategy.rule_config or {}),
        risk_defaults=dict(strategy.risk_defaults or {}),
        template_count=template_count,
        instance_count=instance_count,
        backtest_count=backtest_count,
        created_by_user_id=strategy.created_by_user_id,
        created_at=strategy.created_at,
        updated_at=strategy.updated_at,
    )


def _run_response(run: BotRun) -> BotRunResponse:
    return BotRunResponse(
        id=run.id,
        instance_id=run.instance_id,
        organization_id=run.organization_id,
        client_id=run.client_id,
        exchange_id=run.exchange_id,
        strategy_id=run.strategy_id,
        mode=_enum_value(run.mode),
        status=_enum_value(run.status),
        cycle_key=run.cycle_key,
        input_snapshot=dict(run.input_snapshot or {}),
        decision_snapshot=dict(run.decision_snapshot or {}),
        risk_snapshot=dict(run.risk_snapshot or {}),
        error=run.error,
        started_at=run.started_at,
        completed_at=run.completed_at,
        created_at=run.created_at,
        updated_at=run.updated_at,
    )


def _signal_response(signal: BotSignal) -> BotSignalResponse:
    return BotSignalResponse(
        id=signal.id,
        instance_id=signal.instance_id,
        run_id=signal.run_id,
        organization_id=signal.organization_id,
        client_id=signal.client_id,
        exchange_id=signal.exchange_id,
        strategy_id=signal.strategy_id,
        action=_enum_value(signal.action),
        status=_enum_value(signal.status),
        symbol=signal.symbol,
        confidence=float(signal.confidence) if signal.confidence is not None else None,
        price_usd=float(signal.price_usd) if signal.price_usd is not None else None,
        quantity=float(signal.quantity) if signal.quantity is not None else None,
        notional_usd=float(signal.notional_usd) if signal.notional_usd is not None else None,
        reason=signal.reason,
        input_snapshot=dict(signal.input_snapshot or {}),
        risk_snapshot=dict(signal.risk_snapshot or {}),
        generated_at=signal.generated_at,
        created_at=signal.created_at,
        updated_at=signal.updated_at,
    )


async def _load_customer_bot_instance_for_action(
    db: DBSession,
    permission_ctx: MembershipAuthContext,
    instance_id: UUID,
) -> BotInstance:
    instance = await db.scalar(
        select(BotInstance)
        .options(
            selectinload(BotInstance.template),
            selectinload(BotInstance.strategy),
            selectinload(BotInstance.exchange),
            selectinload(BotInstance.client),
        )
        .where(
            BotInstance.id == instance_id,
            BotInstance.organization_id == permission_ctx.organization_id,
        )
    )
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot instance not found")
    if (
        is_scope_specific_enforcement_enabled("bots")
        and not permission_ctx.can_access_client(instance.client_id)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden by membership client scope",
        )
    if instance.strategy is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bot instance has no strategy configured",
        )
    return instance


async def _resolve_instance_basket_for_action(
    db: DBSession,
    instance: BotInstance,
    *,
    refresh_snapshot: bool,
    force_refresh: bool = False,
) -> tuple[list[str], dict]:
    ranking_service = MarketRankingService(db)
    fallback_symbols = resolve_strategy_symbols(instance.strategy, instance)
    symbols, basket_metadata = await ranking_service.resolve_instance_basket_symbols(
        instance=instance,
        fallback_symbols=fallback_symbols,
        refresh_snapshot=refresh_snapshot,
        force_refresh=force_refresh,
    )
    if not symbols:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Bot instance has no symbols to evaluate",
                "basket": basket_metadata,
            },
        )
    return symbols, basket_metadata


async def _run_paper_symbol(
    db: DBSession,
    *,
    instance: BotInstance,
    organization_id: UUID,
    user_id: UUID,
    symbol: str,
    timeframe: str,
    market_snapshot: dict,
    cycle_key: str | None,
    triggered_by: str,
    candle_limit: int = 500,
) -> BotRun:
    requested_symbol = normalize_strategy_symbol(symbol)
    market_type = resolve_strategy_market_type(instance.strategy, instance)
    if instance.exchange_id is not None and instance.exchange is not None:
        ingestion = MarketDataIngestionService(db)
        await ingestion.sync_exchange_candles(
            exchange_id=instance.exchange_id,
            organization_id=instance.organization_id,
            symbols=[requested_symbol],
            timeframes=[timeframe],
            limit=max(100, min(candle_limit, 1000)),
            market_type=market_type,
        )
        latest = await ingestion.latest_closed_candle(
            exchange=instance.exchange.exchange,
            symbol=requested_symbol,
            timeframe=timeframe,
            market_type=market_type,
        )
        if latest is not None:
            cycle_key = cycle_key or (
                f"paper:{instance.id}:{latest.exchange}:{latest.symbol}:"
                f"{latest.market_type}:{latest.timeframe}:{latest.close_time.isoformat()}"
            )
    cycle_key = cycle_key or (
        f"paper:{instance.id}:{requested_symbol}:{timeframe}:"
        f"{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}"
    )
    engine = BotEngineService(db)
    return await engine.run_paper_cycle(
        instance_id=instance.id,
        organization_id=organization_id,
        user_id=user_id,
        cycle_key=cycle_key,
        symbol=requested_symbol,
        timeframe=timeframe,
        triggered_by=triggered_by,
        market_snapshot=market_snapshot,
    )


def _backtest_response(backtest) -> BotBacktestResponse:
    return BotBacktestResponse(
        id=backtest.id,
        strategy_id=backtest.strategy_id,
        template_id=backtest.template_id,
        organization_id=backtest.organization_id,
        name=backtest.name,
        symbol=backtest.symbol,
        timeframe=backtest.timeframe,
        status=_enum_value(backtest.status),
        period_start=backtest.period_start,
        period_end=backtest.period_end,
        initial_capital_usd=float(backtest.initial_capital_usd),
        result_summary=dict(backtest.result_summary or {}),
        metrics=dict(backtest.metrics or {}),
        logs=list(backtest.logs or []),
        error=backtest.error,
        created_by_user_id=backtest.created_by_user_id,
        started_at=backtest.started_at,
        completed_at=backtest.completed_at,
        created_at=backtest.created_at,
        updated_at=backtest.updated_at,
    )


def _backtest_run_response(run: BotBacktestRun) -> BotBacktestRunResponse:
    return BotBacktestRunResponse(
        id=run.id,
        organization_id=run.organization_id,
        user_id=run.user_id,
        instance_id=run.instance_id,
        strategy_id=run.strategy_id,
        strategy_version=run.strategy_version,
        client_id=run.client_id,
        exchange_id=run.exchange_id,
        symbol=run.symbol,
        exchange=run.exchange,
        market_type=run.market_type,
        timeframe=run.timeframe,
        period_start=run.period_start,
        period_end=run.period_end,
        status=_enum_value(run.status),
        progress=float(run.progress or 0),
        initial_capital_usd=float(run.initial_capital_usd),
        config_hash=run.config_hash,
        config_snapshot=dict(run.config_snapshot or {}),
        strategy_snapshot=dict(run.strategy_snapshot or {}),
        risk_snapshot=dict(run.risk_snapshot or {}),
        cost_snapshot=dict(run.cost_snapshot or {}),
        data_quality=dict(run.data_quality or {}),
        result_summary=dict(run.result_summary or {}),
        metrics=dict(run.metrics or {}),
        equity_curve=list(run.equity_curve or []),
        drawdown_curve=list(run.drawdown_curve or []),
        diagnostics=dict(run.diagnostics or {}),
        error_message=run.error_message,
        started_at=run.started_at,
        finished_at=run.finished_at,
        created_at=run.created_at,
        updated_at=run.updated_at,
    )


def _backtest_trade_response(trade: BotBacktestTrade) -> BotBacktestTradeResponse:
    return BotBacktestTradeResponse(
        id=trade.id,
        run_id=trade.run_id,
        organization_id=trade.organization_id,
        instance_id=trade.instance_id,
        symbol=trade.symbol,
        side=trade.side,
        entry_time=trade.entry_time,
        exit_time=trade.exit_time,
        entry_price=float(trade.entry_price),
        exit_price=float(trade.exit_price) if trade.exit_price is not None else None,
        quantity=float(trade.quantity),
        gross_pnl=float(trade.gross_pnl),
        fee_paid=float(trade.fee_paid),
        slippage_paid=float(trade.slippage_paid),
        net_pnl=float(trade.net_pnl),
        return_percent=float(trade.return_percent),
        mae_percent=float(trade.mae_percent),
        mfe_percent=float(trade.mfe_percent),
        entry_reason=trade.entry_reason,
        exit_reason=trade.exit_reason,
        bars_held=trade.bars_held,
        raw_payload=dict(trade.raw_payload or {}),
        created_at=trade.created_at,
        updated_at=trade.updated_at,
    )


def _backtest_candle_response(candle: MarketCandle) -> BotBacktestCandleResponse:
    return BotBacktestCandleResponse(
        open_time=candle.open_time,
        close_time=candle.close_time,
        open=float(candle.open),
        high=float(candle.high),
        low=float(candle.low),
        close=float(candle.close),
        volume=float(candle.volume),
        quote_volume=float(candle.quote_volume),
    )


def _sample_backtest_chart_items(items: list, max_points: int = 1500) -> list:
    if len(items) <= max_points or max_points <= 2:
        return items
    last_index = len(items) - 1
    indexes = {
        round(index * last_index / (max_points - 1))
        for index in range(max_points)
    }
    indexes.add(0)
    indexes.add(last_index)
    return [items[index] for index in sorted(indexes)]


def _market_ranking_response(
    snapshot: MarketRankingSnapshot | None,
    *,
    exchange: str,
    market_type: str,
    timeframe: str,
    direction: str,
    top_n: int,
    min_quote_volume: Decimal | None = None,
    min_price: Decimal | None = None,
    max_price: Decimal | None = None,
    quote_asset: str | None = None,
    include_symbols: set[str] | None = None,
    exclude_symbols: set[str] | None = None,
) -> BotMarketRankingResponse:
    if snapshot is None:
        return BotMarketRankingResponse(
            exchange=exchange,
            market_type=market_type,
            timeframe=timeframe,
            direction=direction,
            top_n=top_n,
            items=[],
        )
    filtered_items = []
    normalized_quote_asset = str(quote_asset or "").strip().upper()
    for item in snapshot.items:
        if min_quote_volume is not None and item.quote_volume < min_quote_volume:
            continue
        if min_price is not None and item.price < min_price:
            continue
        if max_price is not None and item.price > max_price:
            continue
        if normalized_quote_asset and item.quote_asset != normalized_quote_asset:
            continue
        if include_symbols and item.symbol not in include_symbols:
            continue
        if exclude_symbols and item.symbol in exclude_symbols:
            continue
        filtered_items.append(item)

    items = [
        BotMarketRankingItemResponse(
            id=item.id,
            rank=item.rank,
            symbol=item.symbol,
            base_asset=item.base_asset,
            quote_asset=item.quote_asset,
            price=float(item.price),
            change_percent=float(item.change_percent),
            volume=float(item.volume),
            quote_volume=float(item.quote_volume),
            market_cap=float(item.market_cap) if item.market_cap is not None else None,
            candle_close_time=item.candle_close_time,
            raw_payload=dict(item.raw_payload or {}),
        )
        for item in filtered_items[:top_n]
    ]
    metadata = dict(snapshot.metadata_json or {})
    metadata["response_filters"] = {
        "min_quote_volume": str(min_quote_volume) if min_quote_volume is not None else None,
        "min_price": str(min_price) if min_price is not None else None,
        "max_price": str(max_price) if max_price is not None else None,
        "quote_asset": normalized_quote_asset or None,
        "include_symbols": sorted(include_symbols or []),
        "exclude_symbols": sorted(exclude_symbols or []),
        "item_count_before_filter": len(snapshot.items),
        "item_count_after_filter": len(filtered_items),
        "note": "Response filters are applied to the latest stored snapshot. Scheduler/admin generation produces authoritative filtered snapshots.",
    }
    return BotMarketRankingResponse(
        snapshot_id=snapshot.id,
        source=snapshot.source,
        exchange=snapshot.exchange,
        market_type=snapshot.market_type,
        timeframe=snapshot.timeframe,
        source_timeframe=snapshot.source_timeframe,
        direction=snapshot.direction,
        metric=snapshot.metric,
        top_n=top_n,
        generated_at=snapshot.generated_at,
        candle_time=snapshot.candle_time,
        metadata=metadata,
        items=items,
    )


def _market_universe_asset_response(asset: MarketUniverseAsset) -> BotMarketUniverseAssetResponse:
    return BotMarketUniverseAssetResponse(
        id=asset.id,
        exchange=asset.exchange,
        market_type=asset.market_type,
        symbol=asset.symbol,
        base_asset=asset.base_asset,
        quote_asset=asset.quote_asset,
        display_name=asset.display_name,
        is_tradeable=asset.is_tradeable,
        status=asset.status,
        last_price=float(asset.last_price) if asset.last_price is not None else None,
        quote_volume_24h=float(asset.quote_volume_24h or 0),
        change_1h_percent=float(asset.change_1h_percent) if asset.change_1h_percent is not None else None,
        change_24h_percent=float(asset.change_24h_percent) if asset.change_24h_percent is not None else None,
        change_7d_percent=float(asset.change_7d_percent) if asset.change_7d_percent is not None else None,
        change_30d_percent=float(asset.change_30d_percent) if asset.change_30d_percent is not None else None,
        last_seen_at=asset.last_seen_at,
        raw_payload=dict(asset.raw_payload or {}),
        created_at=asset.created_at,
        updated_at=asset.updated_at,
    )


def _indicator_response(indicator: BotIndicator) -> BotIndicatorResponse:
    return BotIndicatorResponse(
        id=indicator.id,
        key=indicator.key,
        name=indicator.name,
        category=indicator.category,
        description=indicator.description,
        status=indicator.status,
        parameter_schema=dict(indicator.parameter_schema or {}),
        output_schema=dict(indicator.output_schema or {}),
        default_parameters=dict(indicator.default_parameters or {}),
        supported_timeframes=list(indicator.supported_timeframes or []),
        required_inputs=list(indicator.required_inputs or []),
        engine_handler=indicator.engine_handler,
        sort_order=indicator.sort_order,
        created_at=indicator.created_at,
        updated_at=indicator.updated_at,
    )


def _extract_strategy_indicator_keys(indicator_config: dict) -> set[str]:
    indicators = indicator_config.get("indicators")
    if not isinstance(indicators, list):
        return set()
    keys: set[str] = set()
    for item in indicators:
        if isinstance(item, dict) and item.get("key"):
            keys.add(str(item["key"]).strip().lower())
    return keys


def _sanitize_strategy_rule_config(rule_config: dict) -> dict:
    """Drop incomplete conditions so direct API calls cannot persist no-op rules."""
    if not isinstance(rule_config, dict):
        return {}
    sanitized = dict(rule_config)
    for side in ("entry", "exit"):
        group = sanitized.get(side)
        if not isinstance(group, dict):
            continue
        cleaned_group = dict(group)
        conditions = cleaned_group.get("conditions")
        if isinstance(conditions, list):
            cleaned_group["conditions"] = [
                condition
                for condition in conditions
                if isinstance(condition, dict)
                and condition.get("indicator")
                and (
                    condition.get("right_type") != "indicator"
                    or (
                        isinstance(condition.get("compare_to"), dict)
                        and condition["compare_to"].get("indicator")
                    )
                )
            ]
        sanitized[side] = cleaned_group
    return sanitized


def _strategy_contract_version(strategy: BotStrategy | None = None, rule_config: dict | None = None) -> int:
    versions = [1]
    if strategy is not None:
        versions.append(int(strategy.version or 1))
    if isinstance(rule_config, dict):
        try:
            versions.append(int(rule_config.get("version") or 1))
        except (TypeError, ValueError):
            versions.append(1)
    return max(versions)


async def _ensure_strategy_indicators_exist(db: DBSession, indicator_config: dict) -> None:
    keys = _extract_strategy_indicator_keys(indicator_config)
    if not keys:
        return
    result = await db.execute(
        select(BotIndicator.key).where(
            BotIndicator.key.in_(keys),
            BotIndicator.status == "active",
        )
    )
    existing_keys = {str(key) for key in result.scalars().all()}
    missing = sorted(keys - existing_keys)
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Unknown or inactive strategy indicators", "keys": missing},
    )


@router.get("/market-rankings", response_model=BotMarketRankingResponse)
async def get_bot_market_ranking(
    _permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("bots:view", route_key="bots", force=True)),
    ],
    db: DBSession,
    exchange: str = Query(default="bingx", max_length=32),
    market_type: str = Query(default="spot", max_length=24),
    timeframe: str = Query(default="24h", max_length=16),
    direction: str = Query(default="gainers", max_length=16),
    top_n: int = Query(default=10, ge=1, le=100),
    min_quote_volume: Decimal | None = Query(default=None, ge=0),
    min_price: Decimal | None = Query(default=None, ge=0),
    max_price: Decimal | None = Query(default=None, ge=0),
    quote_asset: str | None = Query(default="USDT", max_length=24),
    include_symbols: list[str] | None = Query(default=None),
    exclude_symbols: list[str] | None = Query(default=None),
) -> BotMarketRankingResponse:
    """Return the latest market scanner snapshot for the bot UI."""
    service = MarketRankingService(db)
    try:
        snapshot = await service.get_latest_snapshot(
            exchange=exchange,
            market_type=market_type,
            timeframe=timeframe,
            direction=direction,
            top_n=top_n,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _market_ranking_response(
        snapshot,
        exchange=exchange,
        market_type=market_type,
        timeframe=timeframe,
        direction=direction,
        top_n=top_n,
        min_quote_volume=min_quote_volume,
        min_price=min_price,
        max_price=max_price,
        quote_asset=quote_asset,
        include_symbols={normalize_strategy_symbol(symbol) for symbol in (include_symbols or []) if symbol.strip()},
        exclude_symbols={normalize_strategy_symbol(symbol) for symbol in (exclude_symbols or []) if symbol.strip()},
    )


@router.get("/market-universe", response_model=list[BotMarketUniverseAssetResponse])
async def list_bot_market_universe(
    _permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("bots:view", route_key="bots", force=True)),
    ],
    db: DBSession,
    exchange: str = Query(default="bingx", max_length=32),
    market_type: str = Query(default="futures", max_length=24),
    quote_asset: str | None = Query(default="USDT", max_length=24),
    only_tradeable: bool = Query(default=True),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[BotMarketUniverseAssetResponse]:
    """List the tradable market universe used by bot scanners."""
    query = (
        select(MarketUniverseAsset)
        .where(
            MarketUniverseAsset.exchange == exchange.strip().lower(),
            MarketUniverseAsset.market_type == market_type.strip().lower(),
        )
        .order_by(MarketUniverseAsset.quote_volume_24h.desc(), MarketUniverseAsset.symbol.asc())
        .limit(limit)
    )
    if quote_asset:
        query = query.where(MarketUniverseAsset.quote_asset == quote_asset.strip().upper())
    if only_tradeable:
        query = query.where(MarketUniverseAsset.is_tradeable == True, MarketUniverseAsset.status == "active")
    result = await db.execute(query)
    return [_market_universe_asset_response(asset) for asset in result.scalars().all()]


@router.get("/templates", response_model=list[BotTemplateResponse])
async def list_available_bot_templates(
    _permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("bots:view", route_key="bots", force=True)),
    ],
    db: DBSession,
) -> list[BotTemplateResponse]:
    """List bot products published by the platform."""
    result = await db.execute(
        select(BotTemplate)
        .options(selectinload(BotTemplate.parameters), selectinload(BotTemplate.strategy))
        .where(BotTemplate.status == BotTemplateStatus.PUBLISHED)
        .order_by(BotTemplate.name)
    )
    return [_template_response(template) for template in result.scalars().unique().all()]


@router.get("/strategies", response_model=list[BotStrategyResponse])
async def list_available_bot_strategies(
    _permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("strategies:view", route_key="bots", force=True)),
    ],
    db: DBSession,
) -> list[BotStrategyResponse]:
    """List published platform strategies visible to customer accounts."""
    result = await db.execute(
        select(BotStrategy)
        .where(BotStrategy.status == BotStrategyStatus.PUBLISHED)
        .order_by(BotStrategy.name)
    )
    return [_strategy_response(strategy) for strategy in result.scalars().all()]


@router.get("/indicators", response_model=list[BotIndicatorResponse])
async def list_available_bot_indicators(
    _permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("strategies:view", route_key="bots", force=True)),
    ],
    db: DBSession,
    category: Optional[str] = Query(default=None),
) -> list[BotIndicatorResponse]:
    """List active technical indicators available to customer-readable strategies."""
    query = (
        select(BotIndicator)
        .where(BotIndicator.status == "active")
        .order_by(BotIndicator.category, BotIndicator.sort_order, BotIndicator.name)
    )
    if category:
        query = query.where(BotIndicator.category == category)
    result = await db.execute(query)
    return [_indicator_response(indicator) for indicator in result.scalars().all()]


@router.get("/instances", response_model=list[BotInstanceResponse])
async def list_bot_instances(
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("bots:view", route_key="bots", force=True)),
    ],
    db: DBSession,
) -> list[BotInstanceResponse]:
    """List bot instances in the active tenant."""
    query = (
        select(BotInstance)
        .options(
            selectinload(BotInstance.template),
            selectinload(BotInstance.strategy),
            selectinload(BotInstance.organization),
            selectinload(BotInstance.client),
            selectinload(BotInstance.exchange),
        )
        .where(BotInstance.organization_id == permission_ctx.organization_id)
        .where(BotInstance.status != BotInstanceStatus.DISABLED)
        .order_by(BotInstance.created_at.desc())
    )
    query = apply_client_scope_filter(permission_ctx, query, BotInstance.client_id, "bots")
    result = await db.execute(query)
    instances = result.scalars().unique().all()
    return [_instance_response(instance) for instance in instances]


@router.post("/instances", response_model=BotInstanceResponse, status_code=status.HTTP_201_CREATED)
async def create_bot_instance(
    data: BotInstanceCreate,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("bots:activate", route_key="bots", force=True)),
    ],
    db: DBSession,
    request: Request,
) -> BotInstanceResponse:
    """Activate a published bot template for a customer portfolio."""
    if data.mode == BotInstanceMode.LIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Live bot mode is not enabled in this foundation release",
        )
    template = await db.scalar(
        select(BotTemplate)
        .options(selectinload(BotTemplate.parameters), selectinload(BotTemplate.strategy))
        .where(
            BotTemplate.id == data.template_id,
            BotTemplate.status == BotTemplateStatus.PUBLISHED,
        )
    )
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Published bot template not found")
    selected_strategy = template.strategy
    if data.strategy_id is not None:
        selected_strategy = await db.get(BotStrategy, data.strategy_id)
        if selected_strategy is None or selected_strategy.status != BotStrategyStatus.PUBLISHED:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Published strategy not found")

    organization = await _get_organization(db, permission_ctx.organization_id)
    _ensure_plan_allows_template(organization, template)
    client = await _get_customer_client(db, permission_ctx, data.client_id)
    exchange = await _get_customer_exchange(db, data.client_id, data.exchange_id)
    _ensure_exchange_supported(template, exchange)
    organization_id = permission_ctx.organization_id
    actor_user_id = permission_ctx.user.id
    template_id = template.id
    template_name = template.name
    client_id = client.id
    exchange_id = exchange.id if exchange else None
    strategy_id = selected_strategy.id if selected_strategy else None
    merged_parameters = _merge_parameters(template, data.parameters)
    merged_risk_config = {**(selected_strategy.risk_defaults if selected_strategy else {}), **data.risk_config}
    existing = await db.scalar(
        select(BotInstance)
        .options(
            selectinload(BotInstance.template).selectinload(BotTemplate.parameters),
            selectinload(BotInstance.strategy),
            selectinload(BotInstance.organization),
            selectinload(BotInstance.client),
            selectinload(BotInstance.exchange),
        )
        .where(
            BotInstance.organization_id == organization_id,
            BotInstance.client_id == client_id,
            BotInstance.template_id == template_id,
            BotInstance.exchange_id == exchange_id,
            BotInstance.strategy_id == strategy_id,
            BotInstance.mode == data.mode,
            BotInstance.live_enabled == False,
            BotInstance.status != BotInstanceStatus.DISABLED,
        )
        .with_for_update()
    )
    if existing is not None:
        existing.name = data.name or existing.name or template_name
        existing.parameters = merged_parameters
        existing.risk_config = merged_risk_config
        if existing.status in {BotInstanceStatus.PAUSED, BotInstanceStatus.ERROR}:
            _apply_status_timestamps(existing, BotInstanceStatus.CONFIGURED)
            existing.status = BotInstanceStatus.CONFIGURED
        await db.flush()
        await record_audit_event(
            db,
            organization_id=organization_id,
            user_id=actor_user_id,
            action=AuditAction.UPDATE,
            resource_type="bot_instance",
            resource_id=existing.id,
            description="Customer reused existing bot instance activation",
            metadata={"template_id": template.id, "client_id": client.id, "exchange_id": data.exchange_id},
            request=request,
        )
        return _instance_response(await _load_instance_for_response(db, existing.id))

    await enforce_plan_limit(db, organization_id, "bots")

    instance = BotInstance(
        id=uuid4(),
        template_id=template_id,
        organization_id=organization_id,
        client_id=client_id,
        exchange_id=exchange_id,
        strategy_id=strategy_id,
        name=data.name or template_name,
        mode=data.mode,
        status=BotInstanceStatus.CONFIGURED,
        parameters=merged_parameters,
        risk_config=merged_risk_config,
        created_by_user_id=actor_user_id,
    )
    db.add(instance)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        existing_after_conflict = await db.scalar(
            select(BotInstance)
            .options(
                selectinload(BotInstance.template).selectinload(BotTemplate.parameters),
                selectinload(BotInstance.strategy),
                selectinload(BotInstance.organization),
                selectinload(BotInstance.client),
                selectinload(BotInstance.exchange),
            )
            .where(
                BotInstance.organization_id == organization_id,
                BotInstance.client_id == client_id,
                BotInstance.template_id == template_id,
                BotInstance.exchange_id == exchange_id,
                BotInstance.strategy_id == strategy_id,
                BotInstance.mode == data.mode,
                BotInstance.live_enabled == False,
                BotInstance.status != BotInstanceStatus.DISABLED,
            )
            .with_for_update()
        )
        if existing_after_conflict is None:
            raise
        existing_after_conflict.name = data.name or existing_after_conflict.name or template_name
        existing_after_conflict.parameters = merged_parameters
        existing_after_conflict.risk_config = merged_risk_config
        if existing_after_conflict.status in {BotInstanceStatus.PAUSED, BotInstanceStatus.ERROR}:
            _apply_status_timestamps(existing_after_conflict, BotInstanceStatus.CONFIGURED)
            existing_after_conflict.status = BotInstanceStatus.CONFIGURED
        await db.flush()
        await record_audit_event(
            db,
            organization_id=organization_id,
            user_id=actor_user_id,
            action=AuditAction.UPDATE,
            resource_type="bot_instance",
            resource_id=existing_after_conflict.id,
            description="Customer reused existing bot instance after concurrent activation",
            metadata={"template_id": template_id, "client_id": client_id, "exchange_id": data.exchange_id},
            request=request,
        )
        return _instance_response(await _load_instance_for_response(db, existing_after_conflict.id))
    await record_audit_event(
        db,
        organization_id=organization_id,
        user_id=actor_user_id,
        action=AuditAction.CREATE,
        resource_type="bot_instance",
        resource_id=instance.id,
        description="Customer activated bot instance",
        metadata={"template_id": template.id, "client_id": client.id, "exchange_id": data.exchange_id},
        request=request,
    )
    return _instance_response(await _load_instance_for_response(db, instance.id))


@router.patch("/instances/{instance_id}", response_model=BotInstanceResponse)
async def update_bot_instance(
    instance_id: UUID,
    data: BotInstanceUpdate,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("bots:edit", route_key="bots", force=True)),
    ],
    db: DBSession,
    request: Request,
) -> BotInstanceResponse:
    """Update a customer bot instance configuration or lifecycle state."""
    result = await db.execute(
        select(BotInstance)
        .options(
            selectinload(BotInstance.template).selectinload(BotTemplate.parameters),
            selectinload(BotInstance.strategy),
            selectinload(BotInstance.organization),
            selectinload(BotInstance.client),
            selectinload(BotInstance.exchange),
        )
        .where(
            BotInstance.id == instance_id,
            BotInstance.organization_id == permission_ctx.organization_id,
        )
        .with_for_update()
    )
    instance = result.scalar_one_or_none()
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot instance not found")
    if (
        is_scope_specific_enforcement_enabled("bots")
        and not permission_ctx.can_access_client(instance.client_id)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden by membership client scope",
        )

    update_data = data.model_dump(exclude_unset=True)
    if "mode" in update_data and update_data["mode"] == BotInstanceMode.LIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Live bot mode is not enabled in this foundation release",
        )
    if "client_id" in update_data and update_data["client_id"] is not None:
        client = await _get_customer_client(db, permission_ctx, update_data["client_id"])
        instance.client_id = client.id
        if instance.exchange_id is not None:
            exchange = await _get_customer_exchange(db, client.id, instance.exchange_id)
            _ensure_exchange_supported(instance.template, exchange)
    if "exchange_id" in update_data:
        exchange = await _get_customer_exchange(db, instance.client_id, update_data["exchange_id"])
        _ensure_exchange_supported(instance.template, exchange)
        instance.exchange_id = exchange.id if exchange else None
    if "strategy_id" in update_data:
        if update_data["strategy_id"] is None:
            instance.strategy_id = None
        else:
            strategy = await db.get(BotStrategy, update_data["strategy_id"])
            if strategy is None or strategy.status != BotStrategyStatus.PUBLISHED:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Published strategy not found")
            instance.strategy_id = strategy.id
    if "parameters" in update_data and update_data["parameters"] is not None:
        instance.parameters = _merge_parameters(instance.template, update_data["parameters"])
    if "risk_config" in update_data and update_data["risk_config"] is not None:
        instance.risk_config = update_data["risk_config"]
    if "status" in update_data and update_data["status"] is not None:
        status_value = update_data["status"]
        _apply_status_timestamps(instance, status_value)
        instance.status = status_value
    if "name" in update_data and update_data["name"] is not None:
        instance.name = update_data["name"]
    if "mode" in update_data and update_data["mode"] is not None:
        instance.mode = update_data["mode"]

    await db.flush()
    await record_audit_event(
        db,
        organization_id=permission_ctx.organization_id,
        user_id=permission_ctx.user.id,
        action=AuditAction.UPDATE,
        resource_type="bot_instance",
        resource_id=instance.id,
        description="Customer updated bot instance",
        metadata={"updated_fields": list(update_data.keys())},
        request=request,
    )
    return _instance_response(await _load_instance_for_response(db, instance.id))


@router.post("/instances/{instance_id}/run-paper", response_model=BotRunResponse)
async def run_bot_instance_paper_cycle(
    instance_id: UUID,
    data: BotRunRequest,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("bots:run", route_key="bots", force=True)),
    ],
    db: DBSession,
    request: Request,
) -> BotRunResponse:
    """Run one idempotent paper cycle and persist the generated signal."""
    instance = await _load_customer_bot_instance_for_action(db, permission_ctx, instance_id)
    symbols, basket_metadata = await _resolve_instance_basket_for_action(
        db,
        instance,
        refresh_snapshot=True,
    )
    requested_symbol = normalize_strategy_symbol(data.symbol) if data.symbol else symbols[0]
    if requested_symbol not in symbols:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Requested symbol is outside the bot basket",
        )
    requested_timeframe = data.timeframe or resolve_strategy_timeframe(instance.strategy, instance)

    engine = BotEngineService(db)
    market_snapshot = await engine.build_market_snapshot(instance)
    market_snapshot["market_basket"] = basket_metadata
    market_snapshot["allowed_symbols"] = symbols
    run = await _run_paper_symbol(
        db,
        instance=instance,
        organization_id=permission_ctx.organization_id,
        user_id=permission_ctx.user.id,
        symbol=requested_symbol,
        timeframe=requested_timeframe,
        market_snapshot=market_snapshot,
        cycle_key=data.cycle_key,
        triggered_by="manual",
    )
    await record_audit_event(
        db,
        organization_id=permission_ctx.organization_id,
        user_id=permission_ctx.user.id,
        action=AuditAction.UPDATE,
        resource_type="bot_run",
        resource_id=run.id,
        description="Customer ran bot paper cycle",
        metadata={"instance_id": instance_id, "cycle_key": run.cycle_key},
        request=request,
    )
    return _run_response(run)


@router.post("/instances/{instance_id}/run-paper-basket", response_model=BotRunBatchResponse)
async def run_bot_instance_paper_basket(
    instance_id: UUID,
    data: BotRunRequest,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("bots:run", route_key="bots", force=True)),
    ],
    db: DBSession,
    request: Request,
) -> BotRunBatchResponse:
    """Run paper evaluation over the current operational basket."""
    instance = await _load_customer_bot_instance_for_action(db, permission_ctx, instance_id)
    symbols, basket_metadata = await _resolve_instance_basket_for_action(
        db,
        instance,
        refresh_snapshot=True,
    )
    requested_timeframe = data.timeframe or resolve_strategy_timeframe(instance.strategy, instance)
    requested_symbol = normalize_strategy_symbol(data.symbol) if data.symbol else None
    if requested_symbol is not None and requested_symbol not in symbols:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Requested symbol is outside the bot basket",
        )
    target_symbols = [requested_symbol] if requested_symbol else symbols
    engine = BotEngineService(db)
    market_snapshot = await engine.build_market_snapshot(instance)
    market_snapshot["market_basket"] = basket_metadata
    market_snapshot["allowed_symbols"] = symbols
    runs: list[BotRunResponse] = []
    skipped: list[dict[str, object]] = []
    for symbol in target_symbols[:50]:
        try:
            run = await _run_paper_symbol(
                db,
                instance=instance,
                organization_id=permission_ctx.organization_id,
                user_id=permission_ctx.user.id,
                symbol=symbol,
                timeframe=requested_timeframe,
                market_snapshot=market_snapshot,
                cycle_key=None,
                triggered_by="manual_batch",
            )
            runs.append(_run_response(run))
            await db.commit()
        except Exception as exc:
            logger.warning(
                "Paper basket symbol failed",
                extra={"instance_id": str(instance_id), "symbol": symbol},
                exc_info=True,
            )
            skipped.append({
                "symbol": symbol,
                "reason": "paper_cycle_failed",
                "message": "Nao foi possivel avaliar este ativo neste ciclo. Tente novamente apos sincronizar candles.",
            })
            await db.rollback()
            instance = await _load_customer_bot_instance_for_action(db, permission_ctx, instance_id)

    await record_audit_event(
        db,
        organization_id=permission_ctx.organization_id,
        user_id=permission_ctx.user.id,
        action=AuditAction.UPDATE,
        resource_type="bot_instance",
        resource_id=instance.id,
        description="Customer ran bot paper basket",
        metadata={
            "instance_id": instance_id,
            "run_count": len(runs),
            "skipped_count": len(skipped),
            "symbol_count": len(target_symbols),
        },
        request=request,
    )
    return BotRunBatchResponse(
        instance_id=instance.id,
        symbol_count=len(target_symbols),
        run_count=len(runs),
        skipped_count=len(skipped),
        runs=runs,
        skipped=skipped,
        basket=basket_metadata,
    )


@router.post("/instances/{instance_id}/basket/refresh", response_model=BotBasketRefreshResponse)
async def refresh_bot_instance_basket(
    instance_id: UUID,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("bots:run", route_key="bots", force=True)),
    ],
    db: DBSession,
    request: Request,
) -> BotBasketRefreshResponse:
    """Force-resolve the operational basket from the latest market ranking snapshots."""
    instance = await _load_customer_bot_instance_for_action(db, permission_ctx, instance_id)
    symbols, basket_metadata = await _resolve_instance_basket_for_action(
        db,
        instance,
        refresh_snapshot=True,
        force_refresh=True,
    )
    await db.flush()
    await record_audit_event(
        db,
        organization_id=permission_ctx.organization_id,
        user_id=permission_ctx.user.id,
        action=AuditAction.UPDATE,
        resource_type="bot_instance",
        resource_id=instance.id,
        description="Customer refreshed bot basket",
        metadata={"instance_id": instance_id, "symbol_count": len(symbols), "basket": basket_metadata},
        request=request,
    )
    return BotBasketRefreshResponse(
        instance=_instance_response(await _load_instance_for_response(db, instance.id)),
        symbols=symbols,
        symbol_count=len(symbols),
        basket=basket_metadata,
    )


@router.post("/instances/{instance_id}/backtests", response_model=BotBacktestRunResponse, status_code=status.HTTP_202_ACCEPTED)
async def queue_bot_instance_backtest(
    instance_id: UUID,
    data: BotInstanceBacktestCreate,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("bots:backtest", route_key="bots", force=True)),
    ],
    db: DBSession,
    request: Request,
) -> BotBacktestRunResponse:
    """Queue a heavy instance-scoped backtest in the Celery worker."""
    instance = await db.scalar(
        select(BotInstance)
        .options(
            selectinload(BotInstance.template).selectinload(BotTemplate.parameters),
            selectinload(BotInstance.strategy),
            selectinload(BotInstance.exchange),
        )
        .where(
            BotInstance.id == instance_id,
            BotInstance.organization_id == permission_ctx.organization_id,
        )
    )
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot instance not found")
    if (
        is_scope_specific_enforcement_enabled("bots")
        and not permission_ctx.can_access_client(instance.client_id)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden by membership client scope",
        )
    if instance.strategy is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Bot instance has no strategy configured")

    strategy = instance.strategy
    symbol = normalize_strategy_symbol(data.symbol)
    if not symbol:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid symbol")
    ranking_service = MarketRankingService(db)
    fallback_symbols = resolve_strategy_symbols(strategy, instance)
    symbols, basket_metadata = await ranking_service.resolve_instance_basket_symbols(
        instance=instance,
        fallback_symbols=fallback_symbols,
        refresh_snapshot=False,
    )
    if not symbols:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "Bot instance has no symbols to backtest", "basket": basket_metadata},
        )
    if symbol not in symbols:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Requested symbol is outside the bot basket",
        )

    period_end = data.period_end or datetime.now(timezone.utc).replace(second=0, microsecond=0)
    period_start = data.period_start or (period_end - timedelta(days=365))
    if period_start >= period_end:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="period_start must be before period_end")
    max_backtest_window = timedelta(days=550)
    if period_end - period_start > max_backtest_window:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Backtest window cannot exceed 18 months",
        )

    exchange_key = normalize_exchange_key(
        str(instance.exchange.exchange if instance.exchange else (strategy.market_config or {}).get("default_exchange") or "bingx")
    )
    market_type = normalize_market_type(resolve_strategy_market_type(strategy, instance))
    timeframe = str(data.timeframe or resolve_strategy_timeframe(strategy, instance)).lower()
    allowed_backtest_timeframes = {"1h", "4h", "1d"}
    if timeframe not in allowed_backtest_timeframes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Backtest timeframe must be one of: 1h, 4h, 1d",
        )
    engine = BotEngineService(db)
    risk_snapshot = engine._merged_risk_config(strategy, instance=instance, overrides=data.risk_overrides)
    cost_snapshot = {
        "fee_percent": data.fee_percent,
        "slippage_percent": data.slippage_percent,
    }
    risk_snapshot.update(cost_snapshot)
    strategy_snapshot = {
        "id": str(strategy.id),
        "name": strategy.name,
        "slug": strategy.slug,
        "version": strategy.version,
        "market_config": strategy.market_config or {},
        "indicator_config": strategy.indicator_config or {},
        "rule_config": strategy.rule_config or {},
        "risk_defaults": strategy.risk_defaults or {},
    }
    config_snapshot = {
        "organization_id": str(permission_ctx.organization_id),
        "instance_id": str(instance.id),
        "strategy_id": str(strategy.id),
        "strategy_version": strategy.version,
        "client_id": str(instance.client_id),
        "exchange_id": str(instance.exchange_id) if instance.exchange_id else None,
        "exchange": exchange_key,
        "market_type": market_type,
        "symbol": symbol,
        "timeframe": timeframe,
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "initial_capital_usd": data.initial_capital_usd,
        "allowed_symbols": symbols,
        "basket": basket_metadata,
        "risk_snapshot": risk_snapshot,
        "engine_version": "instance_backtest_v1",
    }
    config_hash = hashlib.sha256(_stable_json(config_snapshot).encode("utf-8")).hexdigest()
    existing = await db.scalar(select(BotBacktestRun).where(BotBacktestRun.config_hash == config_hash))
    if existing is not None:
        if existing.status == BotBacktestStatus.FAILED:
            existing.status = BotBacktestStatus.RUNNING
            existing.progress = 0
            existing.error_message = None
            existing.started_at = None
            existing.finished_at = None
            existing.data_quality = {}
            existing.result_summary = {}
            existing.metrics = {}
            existing.equity_curve = []
            existing.drawdown_curve = []
            existing_diagnostics = {
                key: value
                for key, value in dict(existing.diagnostics or {}).items()
                if key not in {"worker_claim_id", "worker_claimed_at", "duplicate_worker_skipped_at"}
            }
            existing.diagnostics = {
                **existing_diagnostics,
                "stage": "queued",
                "stage_label": "Queued for retry",
                "retry_requested_at": datetime.now(timezone.utc).isoformat(),
            }
            await record_audit_event(
                db,
                organization_id=permission_ctx.organization_id,
                user_id=permission_ctx.user.id,
                action=AuditAction.UPDATE,
                resource_type="bot_backtest_run",
                resource_id=existing.id,
                description="Customer retried failed bot instance backtest",
                metadata={"instance_id": instance.id, "symbol": symbol, "timeframe": timeframe, "config_hash": config_hash},
                request=request,
            )
            await db.commit()
            try:
                run_bot_backtest_task.delay(str(existing.id))
            except Exception as exc:
                existing.status = BotBacktestStatus.FAILED
                existing.error_message = f"Failed to enqueue Celery backtest task: {exc}"
                existing.progress = 100
                existing.finished_at = datetime.now(timezone.utc)
                await db.commit()
        return _backtest_run_response(existing)

    run = BotBacktestRun(
        id=uuid4(),
        organization_id=permission_ctx.organization_id,
        user_id=permission_ctx.user.id,
        instance_id=instance.id,
        strategy_id=strategy.id,
        strategy_version=strategy.version,
        client_id=instance.client_id,
        exchange_id=instance.exchange_id,
        symbol=symbol,
        exchange=exchange_key,
        market_type=market_type,
        timeframe=timeframe,
        period_start=period_start,
        period_end=period_end,
        status=BotBacktestStatus.RUNNING,
        progress=0,
        initial_capital_usd=Decimal(str(data.initial_capital_usd)),
        config_hash=config_hash,
        config_snapshot=config_snapshot,
        strategy_snapshot=strategy_snapshot,
        risk_snapshot=risk_snapshot,
        cost_snapshot=cost_snapshot,
        data_quality={},
        result_summary={},
        metrics={},
        equity_curve=[],
        drawdown_curve=[],
        diagnostics={
            "queue": "backtests",
            "stage": "queued",
            "stage_label": "Queued for worker",
        },
    )
    db.add(run)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        existing = await db.scalar(select(BotBacktestRun).where(BotBacktestRun.config_hash == config_hash))
        if existing is None:
            raise
        return _backtest_run_response(existing)
    await record_audit_event(
        db,
        organization_id=permission_ctx.organization_id,
        user_id=permission_ctx.user.id,
        action=AuditAction.CREATE,
        resource_type="bot_backtest_run",
        resource_id=run.id,
        description="Customer queued bot instance backtest",
        metadata={"instance_id": instance.id, "symbol": symbol, "timeframe": timeframe, "config_hash": config_hash},
        request=request,
    )
    await db.commit()
    try:
        run_bot_backtest_task.delay(str(run.id))
    except Exception as exc:
        run.status = BotBacktestStatus.FAILED
        run.error_message = f"Failed to enqueue Celery backtest task: {exc}"
        run.progress = 100
        run.finished_at = datetime.now(timezone.utc)
        await db.commit()
    return _backtest_run_response(run)


@router.get("/backtests/{run_id}", response_model=BotBacktestRunResponse)
async def get_bot_backtest_run(
    run_id: UUID,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("bots:view", route_key="bots", force=True)),
    ],
    db: DBSession,
) -> BotBacktestRunResponse:
    """Get one instance-scoped backtest run."""
    run = await db.scalar(
        select(BotBacktestRun).where(
            BotBacktestRun.id == run_id,
            BotBacktestRun.organization_id == permission_ctx.organization_id,
        )
    )
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backtest run not found")
    if (
        is_scope_specific_enforcement_enabled("bots")
        and not permission_ctx.can_access_client(run.client_id)
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden by membership client scope")
    return _backtest_run_response(run)


@router.get("/backtests/{run_id}/trades", response_model=list[BotBacktestTradeResponse])
async def list_bot_backtest_trades(
    run_id: UUID,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("bots:view", route_key="bots", force=True)),
    ],
    db: DBSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
) -> list[BotBacktestTradeResponse]:
    """List normalized trades for one instance-scoped backtest run."""
    run = await db.scalar(
        select(BotBacktestRun).where(
            BotBacktestRun.id == run_id,
            BotBacktestRun.organization_id == permission_ctx.organization_id,
        )
    )
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backtest run not found")
    if (
        is_scope_specific_enforcement_enabled("bots")
        and not permission_ctx.can_access_client(run.client_id)
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden by membership client scope")
    result = await db.execute(
        select(BotBacktestTrade)
        .where(BotBacktestTrade.run_id == run_id)
        .order_by(BotBacktestTrade.entry_time.asc())
        .offset(skip)
        .limit(limit)
    )
    return [_backtest_trade_response(trade) for trade in result.scalars().all()]


@router.get("/backtests/{run_id}/chart", response_model=BotBacktestChartResponse)
async def get_bot_backtest_chart(
    run_id: UUID,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("bots:view", route_key="bots", force=True)),
    ],
    db: DBSession,
) -> BotBacktestChartResponse:
    """Return OHLCV candles plus simulated trades for one backtest chart."""
    candle_limit = 30000
    trade_limit = 1000
    run = await db.scalar(
        select(BotBacktestRun).where(
            BotBacktestRun.id == run_id,
            BotBacktestRun.organization_id == permission_ctx.organization_id,
        )
    )
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backtest run not found")
    if (
        is_scope_specific_enforcement_enabled("bots")
        and not permission_ctx.can_access_client(run.client_id)
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden by membership client scope")

    candle_filters = (
        MarketCandle.exchange == run.exchange,
        MarketCandle.symbol == run.symbol,
        MarketCandle.market_type == run.market_type,
        MarketCandle.timeframe == run.timeframe,
        MarketCandle.open_time >= run.period_start,
        MarketCandle.open_time <= run.period_end,
    )
    candle_count_full = await db.scalar(select(func.count()).select_from(MarketCandle).where(*candle_filters))
    candle_result = await db.execute(
        select(MarketCandle)
        .where(*candle_filters)
        .order_by(MarketCandle.open_time.asc())
        .limit(candle_limit)
    )
    candles = candle_result.scalars().all()
    sampled_candles = _sample_backtest_chart_items(list(candles))

    trade_result = await db.execute(
        select(BotBacktestTrade)
        .where(BotBacktestTrade.run_id == run_id)
        .order_by(BotBacktestTrade.entry_time.asc())
        .limit(trade_limit)
    )
    trades = trade_result.scalars().all()

    return BotBacktestChartResponse(
        run_id=run.id,
        symbol=run.symbol,
        exchange=run.exchange,
        market_type=run.market_type,
        timeframe=run.timeframe,
        period_start=run.period_start,
        period_end=run.period_end,
        candle_count_full=int(candle_count_full or 0),
        candle_count_loaded=len(candles),
        candle_count_returned=len(sampled_candles),
        trade_count_returned=len(trades),
        trade_limit=trade_limit,
        candles=[_backtest_candle_response(candle) for candle in sampled_candles],
        trades=[_backtest_trade_response(trade) for trade in trades],
    )


@router.get("/instances/{instance_id}/backtests", response_model=list[BotBacktestRunResponse])
async def list_bot_instance_backtests(
    instance_id: UUID,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("bots:view", route_key="bots", force=True)),
    ],
    db: DBSession,
    symbol: Optional[str] = Query(default=None, max_length=40),
    limit: int = Query(20, ge=1, le=100),
) -> list[BotBacktestRunResponse]:
    """List recent backtests for one customer bot instance."""
    instance = await db.scalar(
        select(BotInstance).where(
            BotInstance.id == instance_id,
            BotInstance.organization_id == permission_ctx.organization_id,
        )
    )
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot instance not found")
    if (
        is_scope_specific_enforcement_enabled("bots")
        and not permission_ctx.can_access_client(instance.client_id)
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden by membership client scope")
    query = (
        select(BotBacktestRun)
        .where(BotBacktestRun.instance_id == instance_id)
        .order_by(BotBacktestRun.created_at.desc())
        .limit(limit)
    )
    if symbol:
        query = query.where(BotBacktestRun.symbol == normalize_strategy_symbol(symbol))
    result = await db.execute(query)
    return [_backtest_run_response(run) for run in result.scalars().all()]


@router.get("/instances/{instance_id}/runs", response_model=list[BotRunResponse])
async def list_bot_instance_runs(
    instance_id: UUID,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("bots:view", route_key="bots", force=True)),
    ],
    db: DBSession,
    limit: int = Query(20, ge=1, le=100),
) -> list[BotRunResponse]:
    """List recent paper cycles for one customer bot instance."""
    instance = await db.scalar(
        select(BotInstance).where(
            BotInstance.id == instance_id,
            BotInstance.organization_id == permission_ctx.organization_id,
        )
    )
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot instance not found")
    if (
        is_scope_specific_enforcement_enabled("bots")
        and not permission_ctx.can_access_client(instance.client_id)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden by membership client scope",
        )
    result = await db.execute(
        select(BotRun)
        .where(BotRun.instance_id == instance_id)
        .order_by(BotRun.created_at.desc())
        .limit(limit)
    )
    return [_run_response(run) for run in result.scalars().all()]


@router.get("/instances/{instance_id}/signals", response_model=list[BotSignalResponse])
async def list_bot_instance_signals(
    instance_id: UUID,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("bots:view", route_key="bots", force=True)),
    ],
    db: DBSession,
    limit: int = Query(20, ge=1, le=100),
) -> list[BotSignalResponse]:
    """List recent generated signals for one customer bot instance."""
    instance = await db.scalar(
        select(BotInstance).where(
            BotInstance.id == instance_id,
            BotInstance.organization_id == permission_ctx.organization_id,
        )
    )
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot instance not found")
    if (
        is_scope_specific_enforcement_enabled("bots")
        and not permission_ctx.can_access_client(instance.client_id)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden by membership client scope",
        )
    result = await db.execute(
        select(BotSignal)
        .where(BotSignal.instance_id == instance_id)
        .order_by(BotSignal.generated_at.desc())
        .limit(limit)
    )
    return [_signal_response(signal) for signal in result.scalars().all()]


@router.post("/instances/{instance_id}/live/enable", response_model=BotInstanceResponse)
async def request_live_bot_enable(
    instance_id: UUID,
    data: BotLiveEnableRequest,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("bots:activate", route_key="bots", force=True)),
    ],
    db: DBSession,
    request: Request,
) -> BotInstanceResponse:
    """Guarded live-mode request.

    Live trading remains blocked until the dedicated executor, order
    reconciliation, and kill-switch flow are implemented and approved.
    """
    instance = await db.scalar(
        select(BotInstance).where(
            BotInstance.id == instance_id,
            BotInstance.organization_id == permission_ctx.organization_id,
        )
    )
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot instance not found")
    await record_audit_event_immediate(
        organization_id=permission_ctx.organization_id,
        user_id=permission_ctx.user.id,
        action=AuditAction.UPDATE,
        resource_type="bot_instance",
        resource_id=instance.id,
        description="Customer requested live bot enable but live trading is gated",
        metadata={"confirm_risk": data.confirm_risk, "reason": data.reason},
        request=request,
    )
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Live trading is gated until executor, reconciliation and kill-switch are approved",
    )


@admin_router.get("/strategies", response_model=list[BotStrategyResponse])
async def list_admin_bot_strategies(
    _superuser: SuperUser,
    db: DBSession,
    status_filter: Optional[BotStrategyStatus] = Query(default=None, alias="status"),
) -> list[BotStrategyResponse]:
    """List platform strategies with aggregate usage counts."""
    template_counts = (
        select(BotTemplate.strategy_id, func.count(BotTemplate.id).label("template_count"))
        .where(BotTemplate.strategy_id.is_not(None))
        .group_by(BotTemplate.strategy_id)
        .subquery()
    )
    instance_counts = (
        select(BotInstance.strategy_id, func.count(BotInstance.id).label("instance_count"))
        .where(BotInstance.strategy_id.is_not(None))
        .group_by(BotInstance.strategy_id)
        .subquery()
    )
    backtest_counts = (
        select(BotBacktest.strategy_id, func.count(BotBacktest.id).label("backtest_count"))
        .group_by(BotBacktest.strategy_id)
        .subquery()
    )
    query = (
        select(
            BotStrategy,
            func.coalesce(template_counts.c.template_count, 0),
            func.coalesce(instance_counts.c.instance_count, 0),
            func.coalesce(backtest_counts.c.backtest_count, 0),
        )
        .outerjoin(template_counts, template_counts.c.strategy_id == BotStrategy.id)
        .outerjoin(instance_counts, instance_counts.c.strategy_id == BotStrategy.id)
        .outerjoin(backtest_counts, backtest_counts.c.strategy_id == BotStrategy.id)
        .order_by(BotStrategy.created_at.desc())
    )
    if status_filter is not None:
        query = query.where(BotStrategy.status == status_filter)
    result = await db.execute(query)
    return [
        _strategy_response(
            strategy,
            template_count=int(template_count or 0),
            instance_count=int(instance_count or 0),
            backtest_count=int(backtest_count or 0),
        )
        for strategy, template_count, instance_count, backtest_count in result.all()
    ]


@admin_router.get("/indicators", response_model=list[BotIndicatorResponse])
async def list_admin_bot_indicators(
    _superuser: SuperUser,
    db: DBSession,
    category: Optional[str] = Query(default=None),
    active_only: bool = Query(default=True),
) -> list[BotIndicatorResponse]:
    """List technical indicators available to the admin strategy builder."""
    query = select(BotIndicator).order_by(BotIndicator.category, BotIndicator.sort_order, BotIndicator.name)
    if category:
        query = query.where(BotIndicator.category == category)
    if active_only:
        query = query.where(BotIndicator.status == "active")
    result = await db.execute(query)
    return [_indicator_response(indicator) for indicator in result.scalars().all()]


@admin_router.post("/strategies", response_model=BotStrategyResponse, status_code=status.HTTP_201_CREATED)
async def create_admin_bot_strategy(
    data: BotStrategyCreate,
    superuser: SuperUser,
    db: DBSession,
    request: Request,
) -> BotStrategyResponse:
    """Create a reusable strategy for bot products."""
    await _ensure_strategy_indicators_exist(db, data.indicator_config)
    rule_config = _sanitize_strategy_rule_config(data.rule_config)
    strategy = BotStrategy(
        id=uuid4(),
        name=data.name,
        slug=data.slug.strip().lower(),
        description=data.description,
        type=data.type,
        status=data.status,
        market_config=data.market_config,
        indicator_config=data.indicator_config,
        rule_config=rule_config,
        risk_defaults=data.risk_defaults,
        version=_strategy_contract_version(rule_config=rule_config),
        created_by_user_id=superuser.id,
    )
    db.add(strategy)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bot strategy slug already exists",
        ) from exc
    await record_audit_event(
        db,
        organization_id=superuser.organization_id,
        user_id=superuser.id,
        action=AuditAction.CREATE,
        resource_type="bot_strategy",
        resource_id=strategy.id,
        description="Platform admin created bot strategy",
        metadata={"slug": strategy.slug, "status": strategy.status.value},
        request=request,
    )
    return _strategy_response(strategy)


@admin_router.patch("/strategies/{strategy_id}", response_model=BotStrategyResponse)
async def update_admin_bot_strategy(
    strategy_id: UUID,
    data: BotStrategyUpdate,
    superuser: SuperUser,
    db: DBSession,
    request: Request,
) -> BotStrategyResponse:
    """Update a reusable strategy."""
    result = await db.execute(select(BotStrategy).where(BotStrategy.id == strategy_id).with_for_update())
    strategy = result.scalar_one_or_none()
    if strategy is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot strategy not found")
    update_data = data.model_dump(exclude_unset=True)
    if "slug" in update_data and update_data["slug"] is not None:
        update_data["slug"] = update_data["slug"].strip().lower()
    if "indicator_config" in update_data and update_data["indicator_config"] is not None:
        await _ensure_strategy_indicators_exist(db, update_data["indicator_config"])
    if "rule_config" in update_data and update_data["rule_config"] is not None:
        update_data["rule_config"] = _sanitize_strategy_rule_config(update_data["rule_config"])
    for field, value in update_data.items():
        setattr(strategy, field, value)
    if update_data:
        strategy.version = _strategy_contract_version(strategy, strategy.rule_config)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bot strategy slug already exists",
        ) from exc
    await record_audit_event(
        db,
        organization_id=superuser.organization_id,
        user_id=superuser.id,
        action=AuditAction.UPDATE,
        resource_type="bot_strategy",
        resource_id=strategy.id,
        description="Platform admin updated bot strategy",
        metadata={"updated_fields": list(update_data.keys()), "version": strategy.version},
        request=request,
    )
    return _strategy_response(strategy)


@admin_router.post("/strategies/{strategy_id}/backtests", response_model=BotBacktestResponse)
async def run_admin_bot_strategy_backtest(
    strategy_id: UUID,
    data: BotBacktestCreate,
    superuser: SuperUser,
    db: DBSession,
    request: Request,
) -> BotBacktestResponse:
    """Run a strategy backtest against stored price history."""
    strategy = await db.get(BotStrategy, strategy_id)
    if strategy is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot strategy not found")
    engine = BotEngineService(db)
    backtest = await engine.run_backtest(
        strategy=strategy,
        name=data.name or f"{strategy.name} - {data.symbol.upper()}",
        symbol=data.symbol,
        timeframe=data.timeframe,
        initial_capital_usd=Decimal(str(data.initial_capital_usd)),
        period_start=data.period_start,
        period_end=data.period_end,
        risk_overrides=data.risk_overrides,
        user_id=superuser.id,
    )
    await record_audit_event(
        db,
        organization_id=superuser.organization_id,
        user_id=superuser.id,
        action=AuditAction.CREATE,
        resource_type="bot_backtest",
        resource_id=backtest.id,
        description="Platform admin ran bot strategy backtest",
        metadata={"strategy_id": strategy_id, "symbol": data.symbol.upper(), "status": backtest.status.value},
        request=request,
    )
    return _backtest_response(backtest)


@admin_router.get("/backtests", response_model=list[BotBacktestResponse])
async def list_admin_bot_backtests(
    _superuser: SuperUser,
    db: DBSession,
    strategy_id: Optional[UUID] = None,
    limit: int = Query(50, ge=1, le=200),
) -> list[BotBacktestResponse]:
    """List recent platform backtests."""
    query = select(BotBacktest).order_by(BotBacktest.created_at.desc()).limit(limit)
    if strategy_id is not None:
        query = query.where(BotBacktest.strategy_id == strategy_id)
    result = await db.execute(query)
    return [_backtest_response(backtest) for backtest in result.scalars().all()]


@admin_router.post("/market-candles/sync", response_model=BotMarketCandleSyncResponse)
async def sync_admin_market_candles(
    data: BotMarketCandleSyncRequest,
    superuser: SuperUser,
    db: DBSession,
    request: Request,
) -> BotMarketCandleSyncResponse:
    """Fetch exchange OHLCV candles into the normalized market_candles table."""
    service = MarketDataIngestionService(db)
    result = await service.sync_exchange_candles(
        exchange_id=data.exchange_id,
        organization_id=None,
        symbols=data.symbols,
        timeframes=data.timeframes,
        limit=data.limit,
        market_type=data.market_type,
        period_start=data.period_start,
        period_end=data.period_end,
    )
    await record_audit_event(
        db,
        organization_id=superuser.organization_id,
        user_id=superuser.id,
        action=AuditAction.UPDATE,
        resource_type="market_candles",
        resource_id=data.exchange_id,
        description="Platform admin synced bot market candles",
        metadata=result,
        request=request,
    )
    return BotMarketCandleSyncResponse(**result)


@admin_router.post("/market-rankings/generate", response_model=BotMarketRankingResponse)
async def generate_admin_market_ranking(
    data: BotMarketRankingGenerateRequest,
    superuser: SuperUser,
    db: DBSession,
    request: Request,
) -> BotMarketRankingResponse:
    """Generate a market scanner snapshot from normalized exchange candles."""
    service = MarketRankingService(db)
    try:
        snapshot = await service.generate_snapshot(
            exchange=data.exchange,
            market_type=data.market_type,
            timeframe=data.timeframe,
            direction=data.direction,
            top_n=data.top_n,
            source_timeframe=data.source_timeframe,
            min_quote_volume=Decimal(str(data.min_quote_volume)),
            min_price=Decimal(str(data.min_price)) if data.min_price is not None else None,
            max_price=Decimal(str(data.max_price)) if data.max_price is not None else None,
            quote_asset=data.quote_asset,
            include_symbols=data.include_symbols,
            exclude_symbols=data.exclude_symbols,
            only_tradeable=data.only_tradeable,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    await record_audit_event(
        db,
        organization_id=superuser.organization_id,
        user_id=superuser.id,
        action=AuditAction.CREATE,
        resource_type="market_ranking_snapshot",
        resource_id=snapshot.id,
        description="Platform admin generated bot market ranking",
        metadata={
            "exchange": snapshot.exchange,
            "market_type": snapshot.market_type,
            "timeframe": snapshot.timeframe,
            "direction": snapshot.direction,
            "top_n": snapshot.top_n,
            "item_count": len(snapshot.items),
        },
        request=request,
    )
    return _market_ranking_response(
        snapshot,
        exchange=data.exchange,
        market_type=data.market_type,
        timeframe=data.timeframe,
        direction=data.direction,
        top_n=data.top_n,
    )


@admin_router.post("/market-scanner/bootstrap", response_model=BotMarketScannerBootstrapResponse)
async def bootstrap_admin_market_scanner(
    data: BotMarketScannerBootstrapRequest,
    superuser: SuperUser,
    db: DBSession,
    request: Request,
) -> BotMarketScannerBootstrapResponse:
    """Refresh public market universe, candles and ranking snapshots in one safe cycle."""
    service = MarketScannerBootstrapService(db)
    try:
        result = await service.bootstrap(
            exchange=data.exchange,
            market_type=data.market_type,
            quote_asset=data.quote_asset,
            universe_limit=data.universe_limit,
            candle_symbol_limit=data.candle_symbol_limit,
            candle_timeframes=data.candle_timeframes,
            ranking_timeframes=data.ranking_timeframes,
            directions=data.directions,
            top_n=data.top_n,
            min_quote_volume=Decimal(str(data.min_quote_volume)),
            min_price=Decimal(str(data.min_price)) if data.min_price is not None else None,
            max_price=Decimal(str(data.max_price)) if data.max_price is not None else None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    await record_audit_event(
        db,
        organization_id=superuser.organization_id,
        user_id=superuser.id,
        action=AuditAction.UPDATE,
        resource_type="market_scanner",
        resource_id=superuser.id,
        description="Platform admin bootstrapped bot market scanner",
        metadata=result,
        request=request,
    )
    return BotMarketScannerBootstrapResponse(**result)


@admin_router.post("/scheduler/run-paper", response_model=BotSchedulerRunResponse)
async def run_admin_bot_scheduler(
    data: BotSchedulerRunRequest,
    superuser: SuperUser,
    db: DBSession,
    request: Request,
) -> BotSchedulerRunResponse:
    """Run due active paper bots once per latest closed market candle."""
    service = BotSchedulerService(db)
    result = await service.run_due_paper_cycles(
        organization_id=data.organization_id,
        limit=data.limit,
        candle_limit=data.candle_limit,
    )
    await record_audit_event(
        db,
        organization_id=superuser.organization_id,
        user_id=superuser.id,
        action=AuditAction.UPDATE,
        resource_type="bot_scheduler",
        resource_id=superuser.id,
        description="Platform admin ran paper bot scheduler",
        metadata=result,
        request=request,
    )
    return BotSchedulerRunResponse(**result)


@admin_router.get("/templates", response_model=list[BotTemplateResponse])
async def list_admin_bot_templates(
    _superuser: SuperUser,
    db: DBSession,
    status_filter: Optional[BotTemplateStatus] = Query(default=None, alias="status"),
) -> list[BotTemplateResponse]:
    """List platform bot products with aggregate usage counts."""
    active_counts = (
        select(BotInstance.template_id, func.count(BotInstance.id).label("active_count"))
        .where(BotInstance.status == BotInstanceStatus.ACTIVE)
        .group_by(BotInstance.template_id)
        .subquery()
    )
    total_counts = (
        select(BotInstance.template_id, func.count(BotInstance.id).label("total_count"))
        .group_by(BotInstance.template_id)
        .subquery()
    )
    query = (
        select(
            BotTemplate,
            func.coalesce(active_counts.c.active_count, 0),
            func.coalesce(total_counts.c.total_count, 0),
        )
        .outerjoin(active_counts, active_counts.c.template_id == BotTemplate.id)
        .outerjoin(total_counts, total_counts.c.template_id == BotTemplate.id)
        .options(selectinload(BotTemplate.parameters), selectinload(BotTemplate.strategy))
        .order_by(BotTemplate.created_at.desc())
    )
    if status_filter is not None:
        query = query.where(BotTemplate.status == status_filter)
    result = await db.execute(query)
    return [
        _template_response(
            template,
            active_instance_count=int(active_count or 0),
            total_instance_count=int(total_count or 0),
        )
        for template, active_count, total_count in result.all()
    ]


@admin_router.post("/templates", response_model=BotTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_admin_bot_template(
    data: AdminBotTemplateCreate,
    superuser: SuperUser,
    db: DBSession,
    request: Request,
) -> BotTemplateResponse:
    """Create a bot product in the platform catalog."""
    if data.strategy_id is not None:
        strategy = await db.get(BotStrategy, data.strategy_id)
        if strategy is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot strategy not found")
    template = BotTemplate(
        id=uuid4(),
        name=data.name,
        slug=data.slug.strip().lower(),
        description=data.description,
        type=data.type,
        status=data.status,
        required_plan=data.required_plan,
        requires_trade_permission=data.requires_trade_permission,
        supported_exchanges=data.supported_exchanges,
        supported_assets=data.supported_assets,
        default_parameters=data.default_parameters,
        risk_notes=data.risk_notes,
        strategy_id=data.strategy_id,
        created_by_user_id=superuser.id,
    )
    _replace_template_parameters(template, data.parameters)
    db.add(template)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bot template slug already exists",
        ) from exc
    await record_audit_event(
        db,
        organization_id=superuser.organization_id,
        user_id=superuser.id,
        action=AuditAction.CREATE,
        resource_type="bot_template",
        resource_id=template.id,
        description="Platform admin created bot template",
        metadata={"slug": template.slug, "status": template.status.value},
        request=request,
    )
    return _template_response(await _load_template_for_response(db, template.id))


@admin_router.patch("/templates/{template_id}", response_model=BotTemplateResponse)
async def update_admin_bot_template(
    template_id: UUID,
    data: AdminBotTemplateUpdate,
    superuser: SuperUser,
    db: DBSession,
    request: Request,
) -> BotTemplateResponse:
    """Update a platform bot product."""
    result = await db.execute(
        select(BotTemplate)
        .options(selectinload(BotTemplate.parameters), selectinload(BotTemplate.strategy))
        .where(BotTemplate.id == template_id)
        .with_for_update()
    )
    template = result.scalar_one_or_none()
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot template not found")

    update_data = data.model_dump(exclude_unset=True)
    parameters = update_data.pop("parameters", None)
    affected_instance_count = 0
    if "slug" in update_data and update_data["slug"] is not None:
        update_data["slug"] = update_data["slug"].strip().lower()
    if "strategy_id" in update_data and update_data["strategy_id"] is not None:
        strategy = await db.get(BotStrategy, update_data["strategy_id"])
        if strategy is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot strategy not found")
    for field, value in update_data.items():
        setattr(template, field, value)
    if parameters is not None:
        affected_instance_count = int(
            await db.scalar(
                select(func.count(BotInstance.id)).where(
                    BotInstance.template_id == template.id,
                    BotInstance.status != BotInstanceStatus.DISABLED,
                )
            )
            or 0
        )
        _replace_template_parameters(template, parameters)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bot template slug already exists",
        ) from exc
    await record_audit_event(
        db,
        organization_id=superuser.organization_id,
        user_id=superuser.id,
        action=AuditAction.UPDATE,
        resource_type="bot_template",
        resource_id=template.id,
        description="Platform admin updated bot template",
        metadata={
            "updated_fields": list(update_data.keys()) + (["parameters"] if parameters is not None else []),
            "parameter_replacement": parameters is not None,
            "affected_instances": affected_instance_count,
            "parameter_keys": [
                parameter.key if isinstance(parameter, BotTemplateParameterCreate) else parameter.get("key")
                for parameter in parameters
            ]
            if parameters is not None
            else None,
        },
        request=request,
    )
    return _template_response(await _load_template_for_response(db, template.id))


@admin_router.get("/instances", response_model=list[BotInstanceResponse])
async def list_admin_bot_instances(
    _superuser: SuperUser,
    db: DBSession,
    organization_id: Optional[UUID] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
) -> list[BotInstanceResponse]:
    """List customer bot activations across the platform."""
    query = (
        select(BotInstance)
        .options(
            selectinload(BotInstance.template),
            selectinload(BotInstance.strategy),
            selectinload(BotInstance.organization),
            selectinload(BotInstance.client),
            selectinload(BotInstance.exchange),
        )
        .order_by(BotInstance.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    if organization_id is not None:
        query = query.where(BotInstance.organization_id == organization_id)
    result = await db.execute(query)
    return [_instance_response(instance) for instance in result.scalars().unique().all()]


@admin_router.patch("/instances/{instance_id}", response_model=BotInstanceResponse)
async def update_admin_bot_instance(
    instance_id: UUID,
    data: AdminBotInstanceUpdate,
    superuser: SuperUser,
    db: DBSession,
    request: Request,
) -> BotInstanceResponse:
    """Operationally pause, disable, or mark a customer bot instance."""
    result = await db.execute(
        select(BotInstance)
        .options(
            selectinload(BotInstance.template),
            selectinload(BotInstance.strategy),
            selectinload(BotInstance.organization),
            selectinload(BotInstance.client),
            selectinload(BotInstance.exchange),
        )
        .where(BotInstance.id == instance_id)
        .with_for_update()
    )
    instance = result.scalar_one_or_none()
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot instance not found")
    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data and update_data["status"] is not None:
        _apply_status_timestamps(instance, update_data["status"])
        instance.status = update_data["status"]
    if "last_error" in update_data:
        instance.last_error = update_data["last_error"]
    await db.flush()
    await record_audit_event(
        db,
        organization_id=instance.organization_id,
        user_id=superuser.id,
        action=AuditAction.UPDATE,
        resource_type="bot_instance",
        resource_id=instance.id,
        description="Platform admin updated bot instance",
        metadata={"updated_fields": list(update_data.keys())},
        request=request,
    )
    return _instance_response(instance)
