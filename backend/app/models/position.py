"""Position model."""

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.client import Client
    from app.models.asset import Asset


class SourceType(str, enum.Enum):
    """Position source types."""

    WALLET = "wallet"
    EXCHANGE = "exchange"
    MANUAL = "manual"
    DETECTED = "detected"


class PositionType(str, enum.Enum):
    """Position types."""

    SPOT = "spot"
    STAKING = "staking"
    LENDING = "lending"
    LP = "lp"
    MARGIN = "margin"
    FUTURES = "futures"


class Position(Base, UUIDMixin, TimestampMixin):
    """Position model - represents a crypto position."""

    __tablename__ = "positions"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    client_id: Mapped[UUID] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
    )
    asset_id: Mapped[UUID] = mapped_column(
        ForeignKey("assets.id", ondelete="RESTRICT"),
        nullable=False,
    )
    source_type: Mapped[SourceType] = mapped_column(
        SAEnum(SourceType),
        nullable=False,
    )
    source_id: Mapped[Optional[UUID]] = mapped_column(nullable=True)  # wallet_id, exchange_id, etc
    position_type: Mapped[PositionType] = mapped_column(
        SAEnum(PositionType),
        nullable=False,
    )

    # Amounts
    quantity: Mapped[Decimal] = mapped_column(Numeric(32, 18), nullable=False)
    entry_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(24, 12), nullable=True)
    current_price: Mapped[Decimal] = mapped_column(Numeric(24, 12), nullable=False)
    current_value_usd: Mapped[Decimal] = mapped_column(Numeric(24, 2), nullable=False)

    # P&L
    cost_basis: Mapped[Optional[Decimal]] = mapped_column(Numeric(24, 2), nullable=True)
    unrealized_pnl: Mapped[Decimal] = mapped_column(Numeric(24, 2), default=Decimal("0"), nullable=False)
    unrealized_pnl_percent: Mapped[Decimal] = mapped_column(Numeric(10, 4), default=Decimal("0"), nullable=False)

    # Yield (for staking/lending/lp)
    apy: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    pending_rewards: Mapped[Optional[Decimal]] = mapped_column(Numeric(32, 18), nullable=True)
    pending_rewards_usd: Mapped[Optional[Decimal]] = mapped_column(Numeric(24, 2), nullable=True)

    # DeFi specific
    protocol: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # lido, uniswap-v3, etc
    pool_address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # LP specific
    token0_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(32, 18), nullable=True)
    token1_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(32, 18), nullable=True)
    price_lower: Mapped[Optional[Decimal]] = mapped_column(Numeric(24, 12), nullable=True)
    price_upper: Mapped[Optional[Decimal]] = mapped_column(Numeric(24, 12), nullable=True)
    in_range: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    impermanent_loss: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)

    # Extra data
    position_metadata: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True, default=dict)

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization")
    client: Mapped["Client"] = relationship("Client", back_populates="positions")
    asset: Mapped["Asset"] = relationship("Asset")

    def __repr__(self) -> str:
        return f"<Position(id={self.id}, type='{self.position_type.value}', value=${self.current_value_usd})>"
