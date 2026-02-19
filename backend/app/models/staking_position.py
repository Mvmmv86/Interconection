"""Staking Position model - for detected staking positions."""

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional
from uuid import UUID

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.client import Client
    from app.models.wallet import Wallet


class StakingProtocol(str, enum.Enum):
    """Supported staking protocols."""

    # EVM Protocols
    LIDO = "lido"
    ROCKET_POOL = "rocketpool"
    COINBASE = "coinbase"
    FRAX = "frax"
    EIGENLAYER = "eigenlayer"

    # Solana Protocols
    MARINADE = "marinade"
    JITO = "jito"
    BLAZESTAKE = "blazestake"
    SANCTUM = "sanctum"
    JUPITER = "jupiter"

    # Other
    NATIVE = "native"  # Native chain staking


class StakingType(str, enum.Enum):
    """Staking position types."""

    LIQUID = "liquid"  # Can be redeemed anytime (stETH, mSOL)
    LOCKED = "locked"  # Has lock period
    VALIDATOR = "validator"  # Direct validator staking


class StakingNetwork(str, enum.Enum):
    """Supported staking networks."""

    ETHEREUM = "ethereum"
    SOLANA = "solana"
    COSMOS = "cosmos"
    POLYGON = "polygon"


class StakingPosition(Base, UUIDMixin, TimestampMixin):
    """Staking Position model - tracks staking positions across protocols."""

    __tablename__ = "staking_positions"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    client_id: Mapped[UUID] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
    )
    wallet_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("wallets.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Protocol info
    protocol: Mapped[StakingProtocol] = mapped_column(SAEnum(StakingProtocol), nullable=False)
    protocol_address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    network: Mapped[StakingNetwork] = mapped_column(SAEnum(StakingNetwork), nullable=False)

    # Token info
    token: Mapped[str] = mapped_column(String(20), nullable=False)  # ETH, SOL
    staked_token: Mapped[str] = mapped_column(String(20), nullable=False)  # stETH, mSOL, JitoSOL
    token_address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    staked_token_address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Amounts
    amount: Mapped[Decimal] = mapped_column(Numeric(32, 18), nullable=False)  # Staked amount
    value_usd: Mapped[Decimal] = mapped_column(Numeric(24, 2), nullable=False)

    # Yield info
    apy: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False)

    # Rewards
    rewards_pending: Mapped[Decimal] = mapped_column(Numeric(32, 18), default=Decimal("0"), nullable=False)
    rewards_pending_usd: Mapped[Decimal] = mapped_column(Numeric(24, 2), default=Decimal("0"), nullable=False)
    rewards_claimed: Mapped[Decimal] = mapped_column(Numeric(32, 18), default=Decimal("0"), nullable=False)
    rewards_claimed_usd: Mapped[Decimal] = mapped_column(Numeric(24, 2), default=Decimal("0"), nullable=False)

    # Type and status
    type: Mapped[StakingType] = mapped_column(SAEnum(StakingType), nullable=False)
    unlock_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    auto_compound: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Validator info (for validator staking)
    validator_address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    validator_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    validator_commission: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)

    # Detection info
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

    # Extra data
    extra_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization")
    client: Mapped["Client"] = relationship("Client")
    wallet: Mapped[Optional["Wallet"]] = relationship("Wallet")

    @property
    def estimated_yearly_rewards(self) -> Decimal:
        """Calculate estimated yearly rewards in USD."""
        return self.value_usd * self.apy / 100

    @property
    def estimated_monthly_rewards(self) -> Decimal:
        """Calculate estimated monthly rewards in USD."""
        return self.estimated_yearly_rewards / 12

    def __repr__(self) -> str:
        return f"<StakingPosition(id={self.id}, protocol='{self.protocol.value}', value=${self.value_usd})>"
