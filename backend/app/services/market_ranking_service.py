"""Market scanner rankings for bot baskets and customer UI."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.market_candle import MarketCandle
from app.models.market_ranking import MarketRankingItem, MarketRankingSnapshot, MarketUniverseAsset
from app.services.market_data_ingestion_service import (
    normalize_exchange_key,
    normalize_market_type,
    normalize_strategy_symbol,
)


LOOKBACKS: dict[str, timedelta] = {
    "1h": timedelta(hours=1),
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
}

DEFAULT_SOURCE_TIMEFRAME: dict[str, str] = {
    "1h": "1h",
    "24h": "1h",
    "7d": "1h",
    "30d": "1d",
}

QUOTE_SUFFIXES = ("USDT", "USDC", "USD", "BTC", "ETH")


@dataclass(frozen=True)
class RankingCandidate:
    symbol: str
    base_asset: str
    quote_asset: str
    price: Decimal
    change_percent: Decimal
    volume: Decimal
    quote_volume: Decimal
    candle_close_time: datetime
    lookback_close_time: datetime
    lookback_price: Decimal


def _split_symbol(symbol: str) -> tuple[str, str]:
    normalized = normalize_strategy_symbol(symbol)
    for suffix in QUOTE_SUFFIXES:
        if normalized.endswith(suffix) and len(normalized) > len(suffix):
            return normalized[: -len(suffix)], suffix
    return normalized, "USDT"


def _validate_timeframe(timeframe: str) -> str:
    normalized = str(timeframe or "24h").strip().lower()
    if normalized not in LOOKBACKS:
        raise ValueError("ranking_timeframe_not_supported")
    return normalized


def _validate_direction(direction: str) -> str:
    normalized = str(direction or "gainers").strip().lower()
    if normalized not in {"gainers", "losers"}:
        raise ValueError("ranking_direction_not_supported")
    return normalized


class MarketRankingService:
    """Build and read deterministic market ranking snapshots."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def generate_snapshot(
        self,
        *,
        exchange: str,
        market_type: str = "spot",
        timeframe: str = "24h",
        direction: str = "gainers",
        top_n: int = 10,
        source_timeframe: str | None = None,
        min_quote_volume: Decimal | int | str = Decimal("0"),
        min_price: Decimal | int | str | None = None,
        max_price: Decimal | int | str | None = None,
        quote_asset: str | None = "USDT",
        include_symbols: list[str] | None = None,
        exclude_symbols: list[str] | None = None,
        only_tradeable: bool = True,
    ) -> MarketRankingSnapshot:
        """Create an immutable top gainers/losers snapshot from stored candles."""
        normalized_exchange = normalize_exchange_key(exchange)
        normalized_market_type = normalize_market_type(market_type)
        ranking_timeframe = _validate_timeframe(timeframe)
        ranking_direction = _validate_direction(direction)
        candle_timeframe = str(source_timeframe or DEFAULT_SOURCE_TIMEFRAME[ranking_timeframe]).strip()
        top_n = max(1, min(int(top_n or 10), 100))
        min_quote_volume_decimal = Decimal(str(min_quote_volume or 0))
        min_price_decimal = Decimal(str(min_price)) if min_price is not None else None
        max_price_decimal = Decimal(str(max_price)) if max_price is not None else None
        normalized_quote_asset = str(quote_asset or "").strip().upper()
        include_set = {
            normalize_strategy_symbol(symbol)
            for symbol in (include_symbols or [])
            if str(symbol or "").strip()
        }
        exclude_set = {
            normalize_strategy_symbol(symbol)
            for symbol in (exclude_symbols or [])
            if str(symbol or "").strip()
        }

        now = datetime.now(timezone.utc)
        lookback = LOOKBACKS[ranking_timeframe]
        base_filters = (
            MarketCandle.exchange == normalized_exchange,
            MarketCandle.market_type == normalized_market_type,
            MarketCandle.timeframe == candle_timeframe,
            MarketCandle.is_closed == True,
            MarketCandle.close > 0,
        )
        anchor_time = await self.db.scalar(select(func.max(MarketCandle.close_time)).where(*base_filters))
        history_anchor = anchor_time or now
        history_start = history_anchor - lookback - max(timedelta(hours=4), lookback / 10)

        result = await self.db.execute(
            select(MarketCandle)
            .where(*base_filters, MarketCandle.close_time >= history_start, MarketCandle.close_time <= history_anchor)
            .order_by(MarketCandle.symbol, MarketCandle.close_time)
        )
        candles = result.scalars().all()
        grouped: dict[str, list[MarketCandle]] = {}
        for candle in candles:
            grouped.setdefault(candle.symbol, []).append(candle)

        blocked_universe_symbols: set[str] = set()
        if only_tradeable:
            universe_query = select(MarketUniverseAsset.symbol, MarketUniverseAsset.is_tradeable, MarketUniverseAsset.status).where(
                MarketUniverseAsset.exchange == normalized_exchange,
                MarketUniverseAsset.market_type == normalized_market_type,
            )
            if normalized_quote_asset:
                universe_query = universe_query.where(MarketUniverseAsset.quote_asset == normalized_quote_asset)
            universe_result = await self.db.execute(universe_query)
            blocked_universe_symbols = {
                normalize_strategy_symbol(symbol)
                for symbol, is_tradeable, asset_status in universe_result.all()
                if not is_tradeable or str(asset_status or "").strip().lower() != "active"
            }

        candidates: list[RankingCandidate] = []
        for symbol, rows in grouped.items():
            normalized_symbol = normalize_strategy_symbol(symbol)
            if include_set and normalized_symbol not in include_set:
                continue
            if exclude_set and normalized_symbol in exclude_set:
                continue
            if normalized_symbol in blocked_universe_symbols:
                continue
            if len(rows) < 2:
                continue
            latest = rows[-1]
            target_time = latest.close_time - lookback
            baseline = None
            for row in rows:
                if row.close_time <= target_time:
                    baseline = row
                else:
                    break
            if baseline is None:
                baseline = rows[0]
            if baseline.close <= 0 or latest.close <= 0:
                continue
            if min_price_decimal is not None and latest.close < min_price_decimal:
                continue
            if max_price_decimal is not None and latest.close > max_price_decimal:
                continue
            period_rows = [row for row in rows if target_time < row.close_time <= latest.close_time]
            if not period_rows:
                period_rows = [latest]
            period_volume = sum((row.volume for row in period_rows), Decimal("0"))
            period_quote_volume = sum((row.quote_volume for row in period_rows), Decimal("0"))
            if period_quote_volume < min_quote_volume_decimal:
                continue

            change_percent = ((latest.close - baseline.close) / baseline.close) * Decimal("100")
            base_asset, quote_asset = _split_symbol(normalized_symbol)
            if normalized_quote_asset and quote_asset != normalized_quote_asset:
                continue
            candidates.append(
                RankingCandidate(
                    symbol=normalized_symbol,
                    base_asset=base_asset,
                    quote_asset=quote_asset,
                    price=latest.close,
                    change_percent=change_percent,
                    volume=period_volume,
                    quote_volume=period_quote_volume,
                    candle_close_time=latest.close_time,
                    lookback_close_time=baseline.close_time,
                    lookback_price=baseline.close,
                )
            )

        reverse = ranking_direction == "gainers"
        ranked = sorted(candidates, key=lambda item: item.change_percent, reverse=reverse)[:top_n]
        await self._upsert_market_universe(
            exchange=normalized_exchange,
            market_type=normalized_market_type,
            timeframe=ranking_timeframe,
            candidates=candidates,
            now=now,
        )
        snapshot = MarketRankingSnapshot(
            id=uuid4(),
            source="market_candles",
            exchange=normalized_exchange,
            market_type=normalized_market_type,
            timeframe=ranking_timeframe,
            source_timeframe=candle_timeframe,
            direction=ranking_direction,
            metric="price_change_percent",
            top_n=top_n,
            generated_at=now,
            candle_time=max((item.candle_close_time for item in ranked), default=anchor_time),
            metadata_json={
                "candidate_count": len(candidates),
                "lookback_seconds": int(lookback.total_seconds()),
                "filters": {
                    "min_quote_volume": str(min_quote_volume_decimal),
                    "min_price": str(min_price_decimal) if min_price_decimal is not None else None,
                    "max_price": str(max_price_decimal) if max_price_decimal is not None else None,
                    "quote_asset": normalized_quote_asset or None,
                    "include_symbols": sorted(include_set),
                    "exclude_symbols": sorted(exclude_set),
                    "only_tradeable": only_tradeable,
                },
            },
        )
        for index, candidate in enumerate(ranked, start=1):
            snapshot.items.append(
                MarketRankingItem(
                    id=uuid4(),
                    rank=index,
                    symbol=candidate.symbol,
                    base_asset=candidate.base_asset,
                    quote_asset=candidate.quote_asset,
                    price=candidate.price,
                    change_percent=candidate.change_percent,
                    volume=candidate.volume,
                    quote_volume=candidate.quote_volume,
                    candle_close_time=candidate.candle_close_time,
                    raw_payload={
                        "lookback_close_time": candidate.lookback_close_time.isoformat(),
                        "lookback_price": str(candidate.lookback_price),
                    },
                )
            )
        self.db.add(snapshot)
        await self.db.flush()
        return snapshot

    async def _upsert_market_universe(
        self,
        *,
        exchange: str,
        market_type: str,
        timeframe: str,
        candidates: list[RankingCandidate],
        now: datetime,
    ) -> None:
        """Keep the visual market universe fresh from generated ranking candidates."""
        if not candidates:
            return

        change_field_by_timeframe = {
            "1h": "change_1h_percent",
            "24h": "change_24h_percent",
            "7d": "change_7d_percent",
            "30d": "change_30d_percent",
        }
        change_field = change_field_by_timeframe.get(timeframe)
        rows: list[dict[str, Any]] = []
        for candidate in candidates:
            row: dict[str, Any] = {
                "id": uuid4(),
                "exchange": exchange,
                "market_type": market_type,
                "symbol": candidate.symbol,
                "base_asset": candidate.base_asset,
                "quote_asset": candidate.quote_asset,
                "display_name": candidate.base_asset,
                "is_tradeable": True,
                "status": "active",
                "last_price": candidate.price,
                "last_seen_at": candidate.candle_close_time,
                "raw_payload": {
                    "source": "market_ranking",
                    "last_ranking_timeframe": timeframe,
                    "last_change_percent": str(candidate.change_percent),
                    "last_ranked_at": now.isoformat(),
                },
                "updated_at": now,
            }
            if timeframe == "24h":
                row["quote_volume_24h"] = candidate.quote_volume
            if change_field:
                row[change_field] = candidate.change_percent
            rows.append(row)

        bind = self.db.get_bind()
        if bind.dialect.name != "postgresql":
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
        update_values: dict[str, Any] = {
            "base_asset": excluded.base_asset,
            "quote_asset": excluded.quote_asset,
            "display_name": excluded.display_name,
            "is_tradeable": excluded.is_tradeable,
            "status": excluded.status,
            "last_price": excluded.last_price,
            "last_seen_at": excluded.last_seen_at,
            "raw_payload": excluded.raw_payload,
            "updated_at": now,
        }
        if timeframe == "24h":
            update_values["quote_volume_24h"] = excluded.quote_volume_24h
        if change_field:
            update_values[change_field] = getattr(excluded, change_field)

        await self.db.execute(
            stmt.on_conflict_do_update(
                index_elements=["exchange", "market_type", "symbol"],
                set_=update_values,
            )
        )

    async def get_latest_snapshot(
        self,
        *,
        exchange: str,
        market_type: str = "spot",
        timeframe: str = "24h",
        direction: str = "gainers",
        top_n: int = 10,
    ) -> MarketRankingSnapshot | None:
        """Return the latest matching snapshot with ranked items eagerly loaded."""
        normalized_exchange = normalize_exchange_key(exchange)
        normalized_market_type = normalize_market_type(market_type)
        ranking_timeframe = _validate_timeframe(timeframe)
        ranking_direction = _validate_direction(direction)
        requested_top_n = max(1, min(int(top_n or 10), 100))

        result = await self.db.execute(
            select(MarketRankingSnapshot)
            .options(selectinload(MarketRankingSnapshot.items))
            .where(
                MarketRankingSnapshot.exchange == normalized_exchange,
                MarketRankingSnapshot.market_type == normalized_market_type,
                MarketRankingSnapshot.timeframe == ranking_timeframe,
                MarketRankingSnapshot.direction == ranking_direction,
                MarketRankingSnapshot.top_n >= requested_top_n,
            )
            .order_by(MarketRankingSnapshot.generated_at.desc())
            .limit(1)
        )
        snapshot = result.scalar_one_or_none()
        return snapshot

    async def resolve_instance_basket_symbols(
        self,
        *,
        instance: Any,
        fallback_symbols: list[str],
        refresh_snapshot: bool = False,
    ) -> tuple[list[str], dict]:
        """Resolve dynamic market-ranking baskets for a bot instance."""
        risk_config = getattr(instance, "risk_config", None) or {}
        market_basket = risk_config.get("market_basket")
        if not isinstance(market_basket, dict) or market_basket.get("source") != "market_ranking":
            return fallback_symbols, {"source": "static", "symbol_count": len(fallback_symbols)}

        exchange = market_basket.get("exchange") or getattr(getattr(instance, "exchange", None), "exchange", None)
        if not exchange:
            return [], {"source": "market_ranking", "error": "missing_exchange"}

        market_type = market_basket.get("market_type") or "futures"
        timeframe = market_basket.get("timeframe") or "24h"
        direction = market_basket.get("direction") or "gainers"
        top_n = int(market_basket.get("top_n") or 10)

        snapshot = None
        if refresh_snapshot:
            try:
                snapshot = await self.generate_snapshot(
                    exchange=str(exchange),
                    market_type=str(market_type),
                    timeframe=str(timeframe),
                    direction=str(direction),
                    top_n=top_n,
                    source_timeframe=market_basket.get("source_timeframe"),
                    min_quote_volume=market_basket.get("min_quote_volume") or 0,
                    min_price=market_basket.get("min_price"),
                    max_price=market_basket.get("max_price"),
                    quote_asset=market_basket.get("quote_asset"),
                    include_symbols=market_basket.get("include_symbols"),
                    exclude_symbols=market_basket.get("exclude_symbols"),
                    only_tradeable=market_basket.get("only_tradeable", True) is not False,
                )
            except ValueError:
                snapshot = None

        if snapshot is None:
            snapshot = await self.get_latest_snapshot(
                exchange=str(exchange),
                market_type=str(market_type),
                timeframe=str(timeframe),
                direction=str(direction),
                top_n=top_n,
            )
        if snapshot is None or not snapshot.items:
            if fallback_symbols:
                return fallback_symbols, {
                    "source": "market_ranking_fallback_static",
                    "error": "missing_snapshot",
                    "exchange": str(exchange),
                    "market_type": str(market_type),
                    "timeframe": str(timeframe),
                    "direction": str(direction),
                    "symbol_count": len(fallback_symbols),
                }
            return [], {
                "source": "market_ranking",
                "error": "missing_snapshot",
                "exchange": str(exchange),
                "market_type": str(market_type),
                "timeframe": str(timeframe),
                "direction": str(direction),
            }

        symbols = [normalize_strategy_symbol(item.symbol) for item in snapshot.items[:top_n]]
        return symbols, {
            "source": "market_ranking",
            "snapshot_id": str(snapshot.id),
            "generated_at": snapshot.generated_at.isoformat(),
            "exchange": snapshot.exchange,
            "market_type": snapshot.market_type,
            "timeframe": snapshot.timeframe,
            "direction": snapshot.direction,
            "symbol_count": len(symbols),
        }
