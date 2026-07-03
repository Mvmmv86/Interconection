"""Market ranking snapshots used by bot scanners and trading baskets."""

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class MarketRankingSnapshot(Base, UUIDMixin, TimestampMixin):
    """Immutable top gainers/losers snapshot for one exchange/time window."""

    __tablename__ = "market_ranking_snapshots"
    __table_args__ = (
        Index(
            "ix_market_ranking_snapshots_lookup",
            "exchange",
            "market_type",
            "timeframe",
            "direction",
            "generated_at",
        ),
    )

    source: Mapped[str] = mapped_column(String(32), default="market_candles", nullable=False)
    exchange: Mapped[str] = mapped_column(String(32), nullable=False)
    market_type: Mapped[str] = mapped_column(String(24), default="spot", nullable=False)
    timeframe: Mapped[str] = mapped_column(String(16), nullable=False)
    source_timeframe: Mapped[str] = mapped_column(String(16), default="1h", nullable=False)
    direction: Mapped[str] = mapped_column(String(16), nullable=False)
    metric: Mapped[str] = mapped_column(String(40), default="price_change_percent", nullable=False)
    top_n: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    candle_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, nullable=False)

    items: Mapped[list["MarketRankingItem"]] = relationship(
        "MarketRankingItem",
        back_populates="snapshot",
        cascade="all, delete-orphan",
        order_by="MarketRankingItem.rank",
    )


class MarketUniverseAsset(Base, UUIDMixin, TimestampMixin):
    """Tradable asset universe discovered from exchanges for scanners/bots."""

    __tablename__ = "market_universe_assets"
    __table_args__ = (
        UniqueConstraint("exchange", "market_type", "symbol", name="uq_market_universe_exchange_market_symbol"),
        Index("ix_market_universe_lookup", "exchange", "market_type", "quote_asset", "is_tradeable"),
        Index("ix_market_universe_symbol", "symbol"),
    )

    exchange: Mapped[str] = mapped_column(String(32), nullable=False)
    market_type: Mapped[str] = mapped_column(String(24), default="spot", nullable=False)
    symbol: Mapped[str] = mapped_column(String(40), nullable=False)
    base_asset: Mapped[str] = mapped_column(String(24), nullable=False)
    quote_asset: Mapped[str] = mapped_column(String(24), default="USDT", nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    is_tradeable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    last_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(28, 12), nullable=True)
    quote_volume_24h: Mapped[Decimal] = mapped_column(Numeric(32, 12), default=Decimal("0"), nullable=False)
    change_1h_percent: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 8), nullable=True)
    change_24h_percent: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 8), nullable=True)
    change_7d_percent: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 8), nullable=True)
    change_30d_percent: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 8), nullable=True)
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    raw_payload: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)


class MarketRankingItem(Base, UUIDMixin, TimestampMixin):
    """Ranked asset row inside a market scanner snapshot."""

    __tablename__ = "market_ranking_items"
    __table_args__ = (
        UniqueConstraint("snapshot_id", "rank", name="uq_market_ranking_items_snapshot_rank"),
        UniqueConstraint("snapshot_id", "symbol", name="uq_market_ranking_items_snapshot_symbol"),
        Index("ix_market_ranking_items_snapshot_rank", "snapshot_id", "rank"),
        Index("ix_market_ranking_items_symbol", "symbol"),
    )

    snapshot_id: Mapped[UUID] = mapped_column(
        ForeignKey("market_ranking_snapshots.id", ondelete="CASCADE"),
        nullable=False,
    )
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    symbol: Mapped[str] = mapped_column(String(40), nullable=False)
    base_asset: Mapped[str] = mapped_column(String(24), nullable=False)
    quote_asset: Mapped[str] = mapped_column(String(24), default="USDT", nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(28, 12), nullable=False)
    change_percent: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    volume: Mapped[Decimal] = mapped_column(Numeric(32, 12), default=Decimal("0"), nullable=False)
    quote_volume: Mapped[Decimal] = mapped_column(Numeric(32, 12), default=Decimal("0"), nullable=False)
    market_cap: Mapped[Optional[Decimal]] = mapped_column(Numeric(32, 2), nullable=True)
    candle_close_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    raw_payload: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    snapshot: Mapped[MarketRankingSnapshot] = relationship("MarketRankingSnapshot", back_populates="items")
