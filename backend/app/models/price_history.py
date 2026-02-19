"""Price History model - for storing historical price data."""

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDMixin


class PriceHistory(Base, UUIDMixin):
    """Price History model - stores historical price data for assets."""

    __tablename__ = "price_history"
    __table_args__ = (
        Index("ix_price_history_asset_timestamp", "asset_id", "timestamp"),
        Index("ix_price_history_symbol_timestamp", "symbol", "timestamp"),
    )

    asset_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("assets.id", ondelete="CASCADE"),
        nullable=True,
    )
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)

    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    price_usd: Mapped[Decimal] = mapped_column(Numeric(24, 12), nullable=False)

    # Optional detailed metrics
    market_cap: Mapped[Optional[Decimal]] = mapped_column(Numeric(24, 2), nullable=True)
    volume_24h: Mapped[Optional[Decimal]] = mapped_column(Numeric(24, 2), nullable=True)
    price_change_24h: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)

    # High/Low for the period
    high_24h: Mapped[Optional[Decimal]] = mapped_column(Numeric(24, 12), nullable=True)
    low_24h: Mapped[Optional[Decimal]] = mapped_column(Numeric(24, 12), nullable=True)

    def __repr__(self) -> str:
        return f"<PriceHistory(symbol='{self.symbol}', timestamp={self.timestamp}, price=${self.price_usd})>"


class PoolMetricsHistory(Base, UUIDMixin):
    """Pool Metrics History - stores historical metrics for LP pools."""

    __tablename__ = "pool_metrics_history"
    __table_args__ = (
        Index("ix_pool_metrics_pool_timestamp", "pool_address", "timestamp"),
    )

    pool_address: Mapped[str] = mapped_column(String(255), nullable=False)
    protocol: Mapped[str] = mapped_column(String(50), nullable=False)
    chain: Mapped[str] = mapped_column(String(50), nullable=False)

    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Metrics
    tvl_usd: Mapped[Decimal] = mapped_column(Numeric(24, 2), nullable=False)
    volume_24h: Mapped[Decimal] = mapped_column(Numeric(24, 2), default=Decimal("0"), nullable=False)
    fees_24h: Mapped[Decimal] = mapped_column(Numeric(24, 2), default=Decimal("0"), nullable=False)
    apr_24h: Mapped[Decimal] = mapped_column(Numeric(10, 4), default=Decimal("0"), nullable=False)
    tx_count_24h: Mapped[int] = mapped_column(default=0, nullable=False)

    # Token prices at this time
    token0_price: Mapped[Decimal] = mapped_column(Numeric(24, 12), nullable=False)
    token1_price: Mapped[Decimal] = mapped_column(Numeric(24, 12), nullable=False)

    def __repr__(self) -> str:
        return f"<PoolMetricsHistory(pool='{self.pool_address[:10]}...', timestamp={self.timestamp})>"
