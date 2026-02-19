"""Pool Position model - for DeFi LP positions."""

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional
from uuid import UUID

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
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


class PoolProtocol(str, enum.Enum):
    """Supported LP pool protocols."""

    # EVM Protocols
    UNISWAP_V3 = "uniswap-v3"
    UNISWAP_V2 = "uniswap-v2"
    SUSHISWAP = "sushiswap"
    CURVE = "curve"
    BALANCER = "balancer"
    PANCAKESWAP = "pancakeswap"
    CAMELOT = "camelot"
    AERODROME = "aerodrome"
    VELODROME = "velodrome"

    # Solana Protocols
    RAYDIUM = "raydium"
    RAYDIUM_CLMM = "raydium-clmm"
    ORCA = "orca"
    ORCA_WHIRLPOOL = "orca-whirlpool"
    METEORA = "meteora"
    METEORA_DLMM = "meteora-dlmm"
    LIFINITY = "lifinity"
    PHOENIX = "phoenix"


class PoolChain(str, enum.Enum):
    """Supported chains for LP pools."""

    # EVM
    ETHEREUM = "ethereum"
    ARBITRUM = "arbitrum"
    OPTIMISM = "optimism"
    POLYGON = "polygon"
    BASE = "base"
    BSC = "bsc"
    AVALANCHE = "avalanche"

    # Solana
    SOLANA = "solana"
    ECLIPSE = "eclipse"


class PoolStatus(str, enum.Enum):
    """Pool position status."""

    IN_RANGE = "in-range"
    OUT_OF_RANGE = "out-of-range"
    CLOSED = "closed"


class NetworkType(str, enum.Enum):
    """Network type."""

    EVM = "evm"
    SOLANA = "solana"


class PoolPosition(Base, UUIDMixin, TimestampMixin):
    """Pool Position model - tracks LP positions in DeFi protocols."""

    __tablename__ = "pool_positions"

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

    # Pool identification
    pool_address: Mapped[str] = mapped_column(String(255), nullable=False)
    nft_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # For Uniswap V3 style positions
    protocol: Mapped[PoolProtocol] = mapped_column(SAEnum(PoolProtocol), nullable=False)
    chain: Mapped[PoolChain] = mapped_column(SAEnum(PoolChain), nullable=False)
    network_type: Mapped[NetworkType] = mapped_column(SAEnum(NetworkType), nullable=False)

    # Token pair info (stored as JSON for flexibility)
    token0: Mapped[dict] = mapped_column(JSONB, nullable=False)  # {symbol, name, address, decimals, logo, price}
    token1: Mapped[dict] = mapped_column(JSONB, nullable=False)
    fee_tier: Mapped[Decimal] = mapped_column(Numeric(10, 6), nullable=False)  # 0.0001 = 0.01%

    # Position details (for concentrated liquidity)
    liquidity: Mapped[str] = mapped_column(String(100), nullable=True)  # BigInt as string
    tick_lower: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tick_upper: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    current_tick: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Price range
    price_lower: Mapped[Optional[Decimal]] = mapped_column(Numeric(36, 18), nullable=True)
    price_upper: Mapped[Optional[Decimal]] = mapped_column(Numeric(36, 18), nullable=True)
    current_price: Mapped[Decimal] = mapped_column(Numeric(36, 18), nullable=False)

    # Token amounts
    token0_amount: Mapped[Decimal] = mapped_column(Numeric(32, 18), nullable=False)
    token1_amount: Mapped[Decimal] = mapped_column(Numeric(32, 18), nullable=False)
    total_value_usd: Mapped[Decimal] = mapped_column(Numeric(24, 2), nullable=False)

    # Fees earned
    fees_earned_token0: Mapped[Decimal] = mapped_column(Numeric(32, 18), default=Decimal("0"), nullable=False)
    fees_earned_token1: Mapped[Decimal] = mapped_column(Numeric(32, 18), default=Decimal("0"), nullable=False)
    fees_earned_usd: Mapped[Decimal] = mapped_column(Numeric(24, 2), default=Decimal("0"), nullable=False)

    # Unclaimed fees
    fees_unclaimed_token0: Mapped[Decimal] = mapped_column(Numeric(32, 18), default=Decimal("0"), nullable=False)
    fees_unclaimed_token1: Mapped[Decimal] = mapped_column(Numeric(32, 18), default=Decimal("0"), nullable=False)
    fees_unclaimed_usd: Mapped[Decimal] = mapped_column(Numeric(24, 2), default=Decimal("0"), nullable=False)

    # P&L and IL
    initial_value_usd: Mapped[Decimal] = mapped_column(Numeric(24, 2), nullable=False)
    pnl_usd: Mapped[Decimal] = mapped_column(Numeric(24, 2), default=Decimal("0"), nullable=False)
    pnl_percent: Mapped[Decimal] = mapped_column(Numeric(10, 4), default=Decimal("0"), nullable=False)
    impermanent_loss: Mapped[Decimal] = mapped_column(Numeric(10, 4), default=Decimal("0"), nullable=False)  # Percentage
    impermanent_loss_usd: Mapped[Decimal] = mapped_column(Numeric(24, 2), default=Decimal("0"), nullable=False)
    hodl_value_usd: Mapped[Decimal] = mapped_column(Numeric(24, 2), default=Decimal("0"), nullable=False)

    # APR/APY
    fee_apr: Mapped[Decimal] = mapped_column(Numeric(10, 4), default=Decimal("0"), nullable=False)
    rewards_apr: Mapped[Decimal] = mapped_column(Numeric(10, 4), default=Decimal("0"), nullable=False)
    total_apr: Mapped[Decimal] = mapped_column(Numeric(10, 4), default=Decimal("0"), nullable=False)

    # Status
    status: Mapped[PoolStatus] = mapped_column(
        SAEnum(PoolStatus),
        default=PoolStatus.IN_RANGE,
        nullable=False,
    )
    in_range_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("100"), nullable=False)

    # Automation settings
    auto_compound: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    auto_compound_threshold: Mapped[Optional[Decimal]] = mapped_column(Numeric(24, 2), nullable=True)
    auto_range: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    auto_range_percent: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    auto_exit: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    auto_exit_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(36, 18), nullable=True)
    auto_exit_token: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # 'token0' or 'token1'

    # Rewards (for incentivized pools)
    rewards: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)  # [{token, amount, valueUsd, apr}]

    # Extra data
    extra_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization")
    client: Mapped["Client"] = relationship("Client")
    wallet: Mapped[Optional["Wallet"]] = relationship("Wallet")

    def __repr__(self) -> str:
        return f"<PoolPosition(id={self.id}, protocol='{self.protocol.value}', value=${self.total_value_usd})>"
