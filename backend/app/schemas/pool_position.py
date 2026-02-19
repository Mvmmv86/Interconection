"""Pool Position schemas."""

from datetime import datetime
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from pydantic import Field

from app.schemas.common import BaseSchema
from app.models.pool_position import PoolProtocol, PoolChain, PoolStatus, NetworkType


class TokenInfo(BaseSchema):
    """Token information for pool."""

    symbol: str
    name: str
    address: Optional[str] = None
    decimals: int = 18
    logo: Optional[str] = None
    price: Decimal = Decimal("0")


class PoolReward(BaseSchema):
    """Reward token info."""

    token: str
    amount: Decimal
    value_usd: Decimal
    apr: Decimal


class PoolPositionBase(BaseSchema):
    """Base pool position schema."""

    pool_address: str
    nft_id: Optional[str] = None
    protocol: PoolProtocol
    chain: PoolChain
    network_type: NetworkType
    token0: dict
    token1: dict
    fee_tier: Decimal = Field(ge=0)


class PoolPositionCreate(PoolPositionBase):
    """Schema for creating a pool position."""

    liquidity: Optional[str] = None
    tick_lower: Optional[int] = None
    tick_upper: Optional[int] = None
    current_tick: Optional[int] = None
    price_lower: Optional[Decimal] = None
    price_upper: Optional[Decimal] = None
    current_price: Decimal
    token0_amount: Decimal
    token1_amount: Decimal
    total_value_usd: Decimal
    initial_value_usd: Decimal


class PoolPositionUpdate(BaseSchema):
    """Schema for updating a pool position."""

    token0_amount: Optional[Decimal] = None
    token1_amount: Optional[Decimal] = None
    total_value_usd: Optional[Decimal] = None
    current_price: Optional[Decimal] = None
    current_tick: Optional[int] = None
    fees_earned_token0: Optional[Decimal] = None
    fees_earned_token1: Optional[Decimal] = None
    fees_unclaimed_token0: Optional[Decimal] = None
    fees_unclaimed_token1: Optional[Decimal] = None
    status: Optional[PoolStatus] = None
    auto_compound: Optional[bool] = None
    auto_compound_threshold: Optional[Decimal] = None
    auto_range: Optional[bool] = None
    auto_range_percent: Optional[Decimal] = None
    auto_exit: Optional[bool] = None
    auto_exit_price: Optional[Decimal] = None
    auto_exit_token: Optional[str] = None


class PoolPositionResponse(PoolPositionBase):
    """Pool position response schema."""

    id: UUID
    organization_id: UUID
    client_id: UUID
    wallet_id: Optional[UUID] = None

    # Position details
    liquidity: Optional[str] = None
    tick_lower: Optional[int] = None
    tick_upper: Optional[int] = None
    current_tick: Optional[int] = None

    # Price range
    price_lower: Optional[Decimal] = None
    price_upper: Optional[Decimal] = None
    current_price: Decimal

    # Token amounts
    token0_amount: Decimal
    token1_amount: Decimal
    total_value_usd: Decimal

    # Fees earned
    fees_earned_token0: Decimal
    fees_earned_token1: Decimal
    fees_earned_usd: Decimal

    # Unclaimed fees
    fees_unclaimed_token0: Decimal
    fees_unclaimed_token1: Decimal
    fees_unclaimed_usd: Decimal

    # P&L and IL
    initial_value_usd: Decimal
    pnl_usd: Decimal
    pnl_percent: Decimal
    impermanent_loss: Decimal
    impermanent_loss_usd: Decimal
    hodl_value_usd: Decimal

    # APR/APY
    fee_apr: Decimal
    rewards_apr: Decimal
    total_apr: Decimal

    # Status
    status: PoolStatus
    in_range_percent: Decimal

    # Automation settings
    auto_compound: bool
    auto_compound_threshold: Optional[Decimal] = None
    auto_range: bool
    auto_range_percent: Optional[Decimal] = None
    auto_exit: bool
    auto_exit_price: Optional[Decimal] = None
    auto_exit_token: Optional[str] = None

    # Rewards
    rewards: Optional[list[dict]] = None

    # Metadata
    metadata: Optional[dict] = None

    created_at: datetime
    updated_at: datetime


class PoolPositionSummary(BaseSchema):
    """Summary of pool positions."""

    total_positions: int
    total_value_usd: Decimal
    total_fees_earned_usd: Decimal
    total_fees_unclaimed_usd: Decimal
    total_il_usd: Decimal
    average_apr: Decimal
    positions_in_range: int
    positions_out_of_range: int
    by_protocol: dict[str, Decimal]
    by_chain: dict[str, Decimal]
