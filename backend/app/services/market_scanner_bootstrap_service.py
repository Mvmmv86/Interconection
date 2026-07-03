"""Public market scanner feeder for bot baskets.

This service intentionally uses public market-data endpoints instead of
customer exchange credentials. The customer UI reads precomputed snapshots; it
must not fan out to exchanges on every page load.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import uuid4

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.exchanges.base import MarketCandleData
from app.integrations.exchanges.bingx import BingXAdapter, _as_list as bingx_as_list, safe_decimal as bingx_decimal
from app.integrations.exchanges.bybit import BybitAdapter, safe_decimal as bybit_decimal
from app.models.market_ranking import MarketUniverseAsset
from app.services.market_data_ingestion_service import (
    MarketDataIngestionService,
    normalize_exchange_key,
    normalize_market_type,
    normalize_strategy_symbol,
)
from app.services.market_ranking_service import MarketRankingService


SCANNER_LOCK_KEY = 861_202_607
QUOTE_SUFFIXES = ("USDT", "USDC", "USD", "BTC", "ETH")
DEFAULT_RANKING_TIMEFRAMES = ("1h", "24h", "7d", "30d")
DEFAULT_RANKING_DIRECTIONS = ("gainers", "losers")
DEFAULT_CANDLE_TIMEFRAMES = ("1h", "1d")


@dataclass(frozen=True)
class PublicTickerAsset:
    """Normalized public ticker row used to seed universe/candle sync."""

    exchange: str
    market_type: str
    symbol: str
    base_asset: str
    quote_asset: str
    last_price: Decimal
    quote_volume_24h: Decimal
    volume_24h: Decimal
    change_24h_percent: Decimal | None
    raw_payload: dict[str, Any]


def _split_symbol(symbol: str) -> tuple[str, str]:
    normalized = normalize_strategy_symbol(symbol)
    for suffix in QUOTE_SUFFIXES:
        if normalized.endswith(suffix) and len(normalized) > len(suffix):
            return normalized[: -len(suffix)], suffix
    return normalized, "USDT"


def _decimal_or_zero(value: Any, *, provider: str) -> Decimal:
    if provider == "bingx":
        return bingx_decimal(value, "0")
    return bybit_decimal(value, "0")


def _normalize_percent(value: Any, *, provider: str, ratio_value: bool = False) -> Decimal | None:
    if value is None or value == "":
        return None
    parsed = _decimal_or_zero(value, provider=provider)
    return parsed * Decimal("100") if ratio_value else parsed


class MarketScannerBootstrapService:
    """Fetch public market data, store candles and generate scanner snapshots."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def bootstrap(
        self,
        *,
        exchange: str = "bingx",
        market_type: str = "futures",
        quote_asset: str = "USDT",
        universe_limit: int = 120,
        candle_symbol_limit: int = 50,
        candle_timeframes: list[str] | tuple[str, ...] | None = None,
        ranking_timeframes: list[str] | tuple[str, ...] | None = None,
        directions: list[str] | tuple[str, ...] | None = None,
        top_n: int = 50,
        min_quote_volume: Decimal | int | str = Decimal("0"),
        min_price: Decimal | int | str | None = None,
        max_price: Decimal | int | str | None = None,
    ) -> dict[str, Any]:
        """Run one complete public scanner cycle under a DB advisory lock."""
        normalized_exchange = normalize_exchange_key(exchange)
        normalized_market_type = normalize_market_type(market_type)
        normalized_quote = str(quote_asset or "USDT").strip().upper()
        universe_limit = max(1, min(int(universe_limit or 120), 500))
        candle_symbol_limit = max(1, min(int(candle_symbol_limit or 50), universe_limit))
        top_n = max(1, min(int(top_n or 50), 100))
        candle_frames = [str(item).strip() for item in (candle_timeframes or DEFAULT_CANDLE_TIMEFRAMES) if str(item).strip()]
        ranking_frames = [str(item).strip().lower() for item in (ranking_timeframes or DEFAULT_RANKING_TIMEFRAMES) if str(item).strip()]
        ranking_directions = [str(item).strip().lower() for item in (directions or DEFAULT_RANKING_DIRECTIONS) if str(item).strip()]

        lock_acquired = await self._try_lock()
        if not lock_acquired:
            return {
                "exchange": normalized_exchange,
                "market_type": normalized_market_type,
                "status": "skipped",
                "reason": "scanner_cycle_already_running",
                "universe_count": 0,
                "candle_symbol_count": 0,
                "candles_stored": 0,
                "snapshots_generated": 0,
                "snapshot_item_count": 0,
                "errors": [],
            }

        errors: list[str] = []
        try:
            try:
                tickers = await self._fetch_public_tickers(
                    exchange=normalized_exchange,
                    market_type=normalized_market_type,
                    quote_asset=normalized_quote,
                    limit=universe_limit,
                )
            except ValueError:
                raise
            except Exception as exc:
                return {
                    "exchange": normalized_exchange,
                    "market_type": normalized_market_type,
                    "status": "failed",
                    "universe_count": 0,
                    "candle_symbol_count": 0,
                    "candles_stored": 0,
                    "snapshots_generated": 0,
                    "snapshot_item_count": 0,
                    "errors": [f"ticker_fetch:{normalized_exchange}:{normalized_market_type}:{exc}"],
                }
            if not tickers:
                return {
                    "exchange": normalized_exchange,
                    "market_type": normalized_market_type,
                    "status": "failed",
                    "reason": "empty_public_market_universe",
                    "universe_count": 0,
                    "candle_symbol_count": 0,
                    "candles_stored": 0,
                    "snapshots_generated": 0,
                    "snapshot_item_count": 0,
                    "errors": [f"ticker_fetch:{normalized_exchange}:{normalized_market_type}:empty_universe"],
                }
            await self._upsert_universe_assets(tickers)

            candle_symbols = [ticker.symbol for ticker in tickers[:candle_symbol_limit]]
            candles_stored = await self._sync_public_candles(
                exchange=normalized_exchange,
                market_type=normalized_market_type,
                symbols=candle_symbols,
                timeframes=candle_frames,
                errors=errors,
            )

            ranking_service = MarketRankingService(self.db)
            snapshots_generated = 0
            snapshot_item_count = 0
            for timeframe in ranking_frames:
                for direction in ranking_directions:
                    try:
                        snapshot = await ranking_service.generate_snapshot(
                            exchange=normalized_exchange,
                            market_type=normalized_market_type,
                            timeframe=timeframe,
                            direction=direction,
                            top_n=top_n,
                            min_quote_volume=Decimal(str(min_quote_volume or 0)),
                            min_price=Decimal(str(min_price)) if min_price is not None else None,
                            max_price=Decimal(str(max_price)) if max_price is not None else None,
                            quote_asset=normalized_quote,
                            only_tradeable=True,
                        )
                    except Exception as exc:
                        errors.append(f"snapshot:{timeframe}:{direction}:{exc}")
                        continue
                    snapshots_generated += 1
                    snapshot_item_count += len(snapshot.items)

            return {
                "exchange": normalized_exchange,
                "market_type": normalized_market_type,
                "status": "completed",
                "universe_count": len(tickers),
                "candle_symbol_count": len(candle_symbols),
                "candles_stored": candles_stored,
                "snapshots_generated": snapshots_generated,
                "snapshot_item_count": snapshot_item_count,
                "errors": errors,
            }
        finally:
            await self._unlock()

    async def _try_lock(self) -> bool:
        if self.db.get_bind().dialect.name != "postgresql":
            return True
        return bool(await self.db.scalar(text("SELECT pg_try_advisory_lock(:key)"), {"key": SCANNER_LOCK_KEY}))

    async def _unlock(self) -> None:
        if self.db.get_bind().dialect.name != "postgresql":
            return
        await self.db.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": SCANNER_LOCK_KEY})

    async def _fetch_public_tickers(
        self,
        *,
        exchange: str,
        market_type: str,
        quote_asset: str,
        limit: int,
    ) -> list[PublicTickerAsset]:
        if exchange == "bybit":
            return await self._fetch_bybit_tickers(market_type=market_type, quote_asset=quote_asset, limit=limit)
        if exchange == "bingx":
            return await self._fetch_bingx_tickers(market_type=market_type, quote_asset=quote_asset, limit=limit)
        raise ValueError("market_scanner_exchange_not_supported")

    async def _fetch_bingx_tickers(self, *, market_type: str, quote_asset: str, limit: int) -> list[PublicTickerAsset]:
        adapter = BingXAdapter(api_key="", api_secret="")
        endpoint = "/openApi/swap/v2/quote/ticker" if market_type == "futures" else "/openApi/spot/v1/ticker/24hr"
        try:
            payload = await adapter._request("GET", endpoint, signed=False)
            rows = bingx_as_list(payload)
            assets: list[PublicTickerAsset] = []
            for row in rows:
                symbol = normalize_strategy_symbol(str(row.get("symbol") or row.get("s") or ""))
                if not symbol:
                    continue
                base_asset, detected_quote = _split_symbol(symbol)
                if detected_quote != quote_asset:
                    continue
                price = _decimal_or_zero(row.get("lastPrice") or row.get("last") or row.get("close") or row.get("c"), provider="bingx")
                if price <= 0:
                    continue
                quote_volume = _decimal_or_zero(
                    row.get("quoteVolume")
                    or row.get("quoteVolume24h")
                    or row.get("turnover")
                    or row.get("amount")
                    or row.get("q"),
                    provider="bingx",
                )
                volume = _decimal_or_zero(row.get("volume") or row.get("volume24h") or row.get("baseVolume") or row.get("v"), provider="bingx")
                assets.append(
                    PublicTickerAsset(
                        exchange="bingx",
                        market_type=market_type,
                        symbol=symbol,
                        base_asset=base_asset,
                        quote_asset=detected_quote,
                        last_price=price,
                        quote_volume_24h=quote_volume,
                        volume_24h=volume,
                        change_24h_percent=_normalize_percent(
                            row.get("priceChangePercent") or row.get("priceChangePercent24h") or row.get("priceChangeRate"),
                            provider="bingx",
                        ),
                        raw_payload={"provider": "bingx", "ticker": row},
                    )
                )
            return sorted(assets, key=lambda item: item.quote_volume_24h, reverse=True)[:limit]
        finally:
            await adapter.client.aclose()

    async def _fetch_bybit_tickers(self, *, market_type: str, quote_asset: str, limit: int) -> list[PublicTickerAsset]:
        adapter = BybitAdapter(api_key="", api_secret="")
        category = "linear" if market_type == "futures" else "spot"
        try:
            payload = await adapter._request("GET", "/v5/market/tickers", params={"category": category}, signed=False)
            rows = payload.get("list", []) if isinstance(payload, dict) else []
            assets: list[PublicTickerAsset] = []
            for row in rows:
                if not isinstance(row, dict):
                    continue
                symbol = normalize_strategy_symbol(str(row.get("symbol") or ""))
                if not symbol:
                    continue
                base_asset, detected_quote = _split_symbol(symbol)
                if detected_quote != quote_asset:
                    continue
                price = _decimal_or_zero(row.get("lastPrice"), provider="bybit")
                if price <= 0:
                    continue
                assets.append(
                    PublicTickerAsset(
                        exchange="bybit",
                        market_type=market_type,
                        symbol=symbol,
                        base_asset=base_asset,
                        quote_asset=detected_quote,
                        last_price=price,
                        quote_volume_24h=_decimal_or_zero(row.get("turnover24h"), provider="bybit"),
                        volume_24h=_decimal_or_zero(row.get("volume24h"), provider="bybit"),
                        change_24h_percent=_normalize_percent(row.get("price24hPcnt"), provider="bybit", ratio_value=True),
                        raw_payload={"provider": "bybit", "ticker": row},
                    )
                )
            return sorted(assets, key=lambda item: item.quote_volume_24h, reverse=True)[:limit]
        finally:
            await adapter.client.aclose()

    async def _upsert_universe_assets(self, assets: list[PublicTickerAsset]) -> None:
        if not assets:
            return
        now = datetime.now(timezone.utc)
        rows = [
            {
                "id": uuid4(),
                "exchange": asset.exchange,
                "market_type": asset.market_type,
                "symbol": asset.symbol,
                "base_asset": asset.base_asset,
                "quote_asset": asset.quote_asset,
                "display_name": asset.base_asset,
                "is_tradeable": True,
                "status": "active",
                "last_price": asset.last_price,
                "quote_volume_24h": asset.quote_volume_24h,
                "change_24h_percent": asset.change_24h_percent,
                "last_seen_at": now,
                "raw_payload": asset.raw_payload,
                "updated_at": now,
            }
            for asset in assets
        ]
        if self.db.get_bind().dialect.name != "postgresql":
            for row in rows:
                existing = await self.db.scalar(
                    select(MarketUniverseAsset).where(
                        MarketUniverseAsset.exchange == row["exchange"],
                        MarketUniverseAsset.market_type == row["market_type"],
                        MarketUniverseAsset.symbol == row["symbol"],
                    )
                )
                if existing is None:
                    self.db.add(MarketUniverseAsset(**row))
                    continue
                for key, value in row.items():
                    if key == "id":
                        continue
                    setattr(existing, key, value)
            await self.db.flush()
            return

        stmt = pg_insert(MarketUniverseAsset).values(rows)
        excluded = stmt.excluded
        await self.db.execute(
            stmt.on_conflict_do_update(
                index_elements=["exchange", "market_type", "symbol"],
                set_={
                    "base_asset": excluded.base_asset,
                    "quote_asset": excluded.quote_asset,
                    "display_name": excluded.display_name,
                    "is_tradeable": excluded.is_tradeable,
                    "status": excluded.status,
                    "last_price": excluded.last_price,
                    "quote_volume_24h": excluded.quote_volume_24h,
                    "change_24h_percent": excluded.change_24h_percent,
                    "last_seen_at": excluded.last_seen_at,
                    "raw_payload": excluded.raw_payload,
                    "updated_at": now,
                },
            )
        )

    async def _sync_public_candles(
        self,
        *,
        exchange: str,
        market_type: str,
        symbols: list[str],
        timeframes: list[str],
        errors: list[str],
    ) -> int:
        if not symbols or not timeframes:
            return 0

        adapter = BybitAdapter(api_key="", api_secret="") if exchange == "bybit" else BingXAdapter(api_key="", api_secret="")
        ingestion = MarketDataIngestionService(self.db)
        category = "swap" if market_type == "futures" else "spot"
        limits_by_timeframe = {"1h": 220, "1d": 45}
        stored = 0
        semaphore = asyncio.Semaphore(5)

        async def fetch_one(symbol: str, timeframe: str) -> list[MarketCandleData]:
            async with semaphore:
                try:
                    return await adapter.get_ohlcv_candles(
                        symbol=symbol,
                        timeframe=timeframe,
                        limit=limits_by_timeframe.get(timeframe, 220),
                        category=category,
                    )
                except Exception as exc:
                    errors.append(f"candles:{exchange}:{market_type}:{symbol}:{timeframe}:{exc}")
                    return []

        try:
            batches = await asyncio.gather(
                *(fetch_one(symbol, timeframe) for symbol in symbols for timeframe in timeframes)
            )
            for candles in batches:
                stored += await ingestion.upsert_candles(candles, market_type=market_type)
            return stored
        finally:
            await adapter.client.aclose()
