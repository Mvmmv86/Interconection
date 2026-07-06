"""Market candle ingestion for bot strategy engines."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.exchanges.base import MarketCandleData
from app.models.client import Client
from app.models.exchange import Exchange
from app.models.market_candle import MarketCandle
from app.services.exchange_service import ExchangeService


def normalize_strategy_symbol(symbol: str) -> str:
    """Normalize strategy symbols to USDT market pairs."""
    value = str(symbol or "").strip().upper().replace("/", "").replace("-", "")
    if not value:
        return value
    if value.endswith(("USDT", "USDC", "USD")):
        return value
    return f"{value}USDT"


def normalize_exchange_key(exchange: str) -> str:
    """Normalize exchange names to the canonical key used by candle storage."""
    return str(exchange or "").strip().lower()


def normalize_market_type(market_type: str | None) -> str:
    """Normalize exchange market categories to storage keys."""
    value = str(market_type or "").strip().lower()
    if value in {"futures", "future", "swap", "linear", "perpetual", "perp"}:
        return "futures"
    return "spot"


def _coerce_list(value: object) -> list[object]:
    if value is None:
        return []
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    if isinstance(value, list):
        return value
    return []


def resolve_strategy_symbols(strategy: object | None, instance: object | None = None) -> list[str]:
    """Resolve strategy symbols once so scheduler and engine cannot drift."""
    market_config = getattr(strategy, "market_config", None) or {}
    template = getattr(instance, "template", None) if instance is not None else None
    strategy_defaults = getattr(strategy, "risk_defaults", None) or {}
    template_defaults = getattr(template, "default_parameters", None) or {}
    instance_risk = getattr(instance, "risk_config", None) or {}
    instance_parameters = getattr(instance, "parameters", None) or {}
    market_basket = instance_risk.get("market_basket")
    uses_dynamic_market_basket = (
        isinstance(market_basket, dict)
        and market_basket.get("source") in {"market_ranking", "market_extremes"}
    )

    catalog_symbols = [
        normalize_strategy_symbol(str(item))
        for item in _coerce_list(market_config.get("allowed_symbols") or getattr(template, "supported_assets", None))
    ] if not uses_dynamic_market_basket else []

    raw_symbols = (
        instance_risk.get("allowed_symbols")
        or instance_parameters.get("allowed_symbols")
        or instance_parameters.get("symbols")
        or strategy_defaults.get("allowed_symbols")
        or template_defaults.get("allowed_symbols")
        or market_config.get("allowed_symbols")
        or getattr(template, "supported_assets", None)
        or []
    )
    symbols: list[str] = []
    seen: set[str] = set()
    for raw_symbol in _coerce_list(raw_symbols):
        symbol = normalize_strategy_symbol(str(raw_symbol))
        if not symbol or symbol in seen:
            continue
        if catalog_symbols and symbol not in catalog_symbols:
            continue
        seen.add(symbol)
        symbols.append(symbol)
    return symbols


def resolve_strategy_timeframe(strategy: object | None, instance: object | None = None) -> str:
    """Resolve the candle timeframe from a single shared precedence order."""
    parameters = getattr(instance, "parameters", None) or {}
    risk_config = getattr(instance, "risk_config", None) or {}
    market_config = getattr(strategy, "market_config", None) or {}
    supported = market_config.get("supported_timeframes")
    supported_timeframes = [str(item) for item in supported] if isinstance(supported, list) else []

    configured_timeframe = risk_config.get("timeframe") or parameters.get("timeframe")
    if configured_timeframe:
        timeframe = str(configured_timeframe)
        if not supported_timeframes or timeframe in supported_timeframes:
            return timeframe

    if market_config.get("default_timeframe"):
        default_timeframe = str(market_config["default_timeframe"])
        if not supported_timeframes or default_timeframe in supported_timeframes:
            return default_timeframe
    if supported_timeframes:
        return supported_timeframes[0]
    return "1h"


def resolve_strategy_market_type(strategy: object | None, instance: object | None = None) -> str:
    """Resolve spot/futures market type using the same source everywhere."""
    parameters = getattr(instance, "parameters", None) or {}
    if parameters.get("market_type"):
        return str(parameters["market_type"])
    risk_config = getattr(instance, "risk_config", None) or {}
    if risk_config.get("market_type"):
        return str(risk_config["market_type"])
    market_config = getattr(strategy, "market_config", None) or {}
    return str(market_config.get("market_type") or "spot")


class MarketDataIngestionService:
    """Fetches OHLCV from connected exchanges and stores normalized candles."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def _load_exchange(self, exchange_id: UUID, organization_id: UUID | None) -> Exchange:
        query = select(Exchange).join(Client).where(
            Exchange.id == exchange_id,
            Exchange.is_active == True,
        )
        if organization_id is not None:
            query = query.where(Client.organization_id == organization_id)

        result = await self.db.execute(query)
        exchange = result.scalar_one_or_none()
        if exchange is None:
            raise ValueError("Exchange not found")
        return exchange

    async def sync_exchange_candles(
        self,
        *,
        exchange_id: UUID,
        organization_id: UUID | None,
        symbols: Iterable[str],
        timeframes: Iterable[str],
        limit: int = 300,
        market_type: str = "spot",
    ) -> dict:
        """Fetch and upsert candles for one connected exchange."""
        exchange = await self._load_exchange(exchange_id, organization_id)
        adapter = ExchangeService(self.db).get_adapter(exchange)
        normalized_market_type = normalize_market_type(market_type)
        category = "swap" if normalized_market_type == "futures" else "spot"
        requested_symbols = [item for item in (normalize_strategy_symbol(symbol) for symbol in symbols) if item]
        requested_timeframes = [str(timeframe or "").strip() for timeframe in timeframes if str(timeframe or "").strip()]
        if not requested_symbols or not requested_timeframes:
            return {
                "exchange_id": str(exchange_id),
                "exchange": normalize_exchange_key(exchange.exchange),
                "requested": 0,
                "stored": 0,
                "errors": ["missing_symbols_or_timeframes"],
            }

        stored = 0
        errors: list[str] = []
        for symbol in requested_symbols:
            for timeframe in requested_timeframes:
                try:
                    candles = await adapter.get_ohlcv_candles(
                        symbol=symbol,
                        timeframe=timeframe,
                        limit=limit,
                        category=category,
                    )
                except Exception as exc:  # keep ingestion partial and auditable
                    errors.append(f"{exchange.exchange}:{symbol}:{timeframe}:{exc}")
                    continue
                stored += await self.upsert_candles(candles, market_type=normalized_market_type)

        return {
            "exchange_id": str(exchange_id),
            "exchange": normalize_exchange_key(exchange.exchange),
            "requested": len(requested_symbols) * len(requested_timeframes),
            "stored": stored,
            "errors": errors,
        }

    async def upsert_candles(self, candles: Iterable[MarketCandleData], market_type: str = "spot") -> int:
        """Bulk upsert candle rows using the unique market-candle key."""
        rows = [
            {
                "id": uuid4(),
                "exchange": normalize_exchange_key(candle.exchange),
                "symbol": normalize_strategy_symbol(candle.symbol),
                "market_type": normalize_market_type(
                    getattr(candle, "market_type", None) or (candle.raw_response or {}).get("market_type") or market_type
                ),
                "timeframe": candle.timeframe,
                "open_time": candle.open_time,
                "close_time": candle.close_time,
                "open": candle.open,
                "high": candle.high,
                "low": candle.low,
                "close": candle.close,
                "volume": candle.volume,
                "quote_volume": candle.quote_volume,
                "trade_count": candle.trade_count,
                "is_closed": candle.is_closed,
                "source": "exchange",
                "raw_payload": candle.raw_response,
            }
            for candle in candles
            if candle.open > 0 and candle.high > 0 and candle.low > 0 and candle.close > 0
        ]
        if not rows:
            return 0
        statement = insert(MarketCandle).values(rows)
        update_columns = {
            "close_time": statement.excluded.close_time,
            "market_type": statement.excluded.market_type,
            "open": statement.excluded.open,
            "high": statement.excluded.high,
            "low": statement.excluded.low,
            "close": statement.excluded.close,
            "volume": statement.excluded.volume,
            "quote_volume": statement.excluded.quote_volume,
            "trade_count": statement.excluded.trade_count,
            "is_closed": statement.excluded.is_closed,
            "raw_payload": statement.excluded.raw_payload,
        }
        await self.db.execute(
            statement.on_conflict_do_update(
                constraint="uq_market_candles_exchange_symbol_market_timeframe_open",
                set_=update_columns,
            )
        )
        return len(rows)

    async def latest_closed_candle(
        self,
        *,
        exchange: str,
        symbol: str,
        timeframe: str,
        market_type: str = "spot",
    ) -> MarketCandle | None:
        """Return the latest closed candle for a normalized market key."""
        now = datetime.now(timezone.utc)
        return await self.db.scalar(
            select(MarketCandle)
            .where(
                MarketCandle.exchange == normalize_exchange_key(exchange),
                MarketCandle.symbol == normalize_strategy_symbol(symbol),
                MarketCandle.market_type == normalize_market_type(market_type),
                MarketCandle.timeframe == timeframe,
                MarketCandle.is_closed == True,
                MarketCandle.close_time <= now,
            )
            .order_by(MarketCandle.close_time.desc())
            .limit(1)
        )
