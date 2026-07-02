"""Normalized exchange OHLCV candles for bot strategy engines."""

from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, DateTime, Index, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDMixin


class MarketCandle(Base, UUIDMixin):
    """Exchange-normalized OHLCV candle keyed by exchange/symbol/timeframe."""

    __tablename__ = "market_candles"
    __table_args__ = (
        UniqueConstraint(
            "exchange",
            "symbol",
            "timeframe",
            "open_time",
            name="uq_market_candles_exchange_symbol_timeframe_open",
        ),
        Index("ix_market_candles_symbol_timeframe_close", "symbol", "timeframe", "close_time"),
        Index("ix_market_candles_exchange_timeframe_close", "exchange", "timeframe", "close_time"),
    )

    exchange: Mapped[str] = mapped_column(String(32), nullable=False)
    symbol: Mapped[str] = mapped_column(String(40), nullable=False)
    timeframe: Mapped[str] = mapped_column(String(16), nullable=False)
    open_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    close_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    open: Mapped[Decimal] = mapped_column(Numeric(28, 12), nullable=False)
    high: Mapped[Decimal] = mapped_column(Numeric(28, 12), nullable=False)
    low: Mapped[Decimal] = mapped_column(Numeric(28, 12), nullable=False)
    close: Mapped[Decimal] = mapped_column(Numeric(28, 12), nullable=False)
    volume: Mapped[Decimal] = mapped_column(Numeric(32, 12), default=Decimal("0"), nullable=False)
    quote_volume: Mapped[Decimal] = mapped_column(Numeric(32, 12), default=Decimal("0"), nullable=False)
    trade_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_closed: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    source: Mapped[str] = mapped_column(String(32), default="exchange", nullable=False)
    raw_payload: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    @property
    def timestamp(self) -> datetime:
        """Compatibility shim for legacy PriceHistory consumers."""
        return self.close_time

    @property
    def price_usd(self) -> Decimal:
        """Compatibility shim for legacy PriceHistory consumers."""
        return self.close

    @property
    def high_24h(self) -> Decimal:
        """Compatibility shim for old range-based indicator code."""
        return self.high

    @property
    def low_24h(self) -> Decimal:
        """Compatibility shim for old range-based indicator code."""
        return self.low

    @property
    def volume_24h(self) -> Decimal:
        """Compatibility shim for old volume-based indicator code."""
        return self.volume
