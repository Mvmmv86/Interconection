"""DeFi position cache and notification history models."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
import enum

from app.db.base import Base, UUIDMixin


class DefiCategory(str, enum.Enum):
    """DeFi position categories."""

    LENDING = "lending"
    LP = "lp"
    STAKING = "staking"
    YIELD = "yield"
    FARMING = "farming"
    BRIDGE = "bridge"
    OTHER = "other"


class DefiPositionCache(Base, UUIDMixin):
    """Cached DeFi positions detected from wallet scans.

    Populated from Zerion API (EVM + Solana) and Shyft (Solana LP).
    Serves as a persistent cache so positions don't disappear when APIs are slow.
    """

    __tablename__ = "defi_positions_cache"

    wallet_id: Mapped[UUID] = mapped_column(
        ForeignKey("wallets.id", ondelete="CASCADE"),
        nullable=False,
    )

    protocol: Mapped[str] = mapped_column(String(100), nullable=False)  # Uniswap V3, Aave, Orca
    protocol_icon: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    protocol_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    category: Mapped[DefiCategory] = mapped_column(
        SAEnum(DefiCategory),
        nullable=False,
        default=DefiCategory.OTHER,
    )
    position_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # deposit, stake, liquidity

    asset_symbol: Mapped[str] = mapped_column(String(50), nullable=False)
    asset_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    asset_icon: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    quantity: Mapped[float] = mapped_column(Numeric(28, 12), nullable=False, default=0)
    value_usd: Mapped[float] = mapped_column(Numeric(20, 2), nullable=False, default=0)
    price_usd: Mapped[Optional[float]] = mapped_column(Numeric(20, 8), nullable=True)

    chain: Mapped[str] = mapped_column(String(30), nullable=False)
    chain_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    apy: Mapped[Optional[float]] = mapped_column(Numeric(10, 4), nullable=True)
    rewards_pending: Mapped[Optional[float]] = mapped_column(Numeric(28, 12), nullable=True)
    rewards_pending_usd: Mapped[Optional[float]] = mapped_column(Numeric(20, 2), nullable=True)

    # For LP positions
    pool_address: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    token0_symbol: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    token0_amount: Mapped[Optional[float]] = mapped_column(Numeric(28, 12), nullable=True)
    token1_symbol: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    token1_amount: Mapped[Optional[float]] = mapped_column(Numeric(28, 12), nullable=True)
    fee_tier: Mapped[Optional[float]] = mapped_column(Numeric(10, 4), nullable=True)
    in_range: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    # Raw data from API
    raw_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )
    last_updated: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<DefiCache({self.protocol} {self.asset_symbol}: ${self.value_usd})>"


class NotificationHistory(Base, UUIDMixin):
    """Notification/alert history - records triggered alerts."""

    __tablename__ = "notification_history"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    alert_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("alerts.id", ondelete="SET NULL"),
        nullable=True,
    )
    user_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="info")  # info, warning, danger, success

    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Metadata
    notification_type: Mapped[str] = mapped_column(String(50), nullable=False, default="alert")  # alert, system, sync
    data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)  # Extra context data

    triggered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Notification({self.title}, read={self.is_read})>"
