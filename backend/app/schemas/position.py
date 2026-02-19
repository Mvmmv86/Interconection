"""Position schemas."""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import Field

from app.schemas.common import BaseSchema
from app.models.position import SourceType, PositionType


class PositionBase(BaseSchema):
    """Base position schema."""

    source_type: SourceType
    position_type: PositionType
    quantity: Decimal
    current_price: Decimal
    current_value_usd: Decimal


class PositionResponse(PositionBase):
    """Position response schema."""

    id: UUID
    organization_id: UUID
    client_id: UUID
    asset_id: UUID
    source_id: Optional[UUID] = None

    # Asset info
    asset_symbol: str
    asset_name: str
    asset_logo_url: Optional[str] = None

    # P&L
    entry_price: Optional[Decimal] = None
    cost_basis: Optional[Decimal] = None
    unrealized_pnl: Decimal
    unrealized_pnl_percent: Decimal

    # Yield
    apy: Optional[Decimal] = None
    pending_rewards: Optional[Decimal] = None
    pending_rewards_usd: Optional[Decimal] = None

    # DeFi specific
    protocol: Optional[str] = None
    pool_address: Optional[str] = None

    # LP specific
    token0_amount: Optional[Decimal] = None
    token1_amount: Optional[Decimal] = None
    price_lower: Optional[Decimal] = None
    price_upper: Optional[Decimal] = None
    in_range: Optional[bool] = None
    impermanent_loss: Optional[Decimal] = None

    created_at: datetime
    updated_at: datetime


class PositionSummary(BaseSchema):
    """Summary of positions."""

    total_positions: int
    total_value_usd: Decimal
    total_pnl_usd: Decimal
    total_pnl_percent: Decimal

    # By type
    spot_value: Decimal
    staking_value: Decimal
    lending_value: Decimal
    lp_value: Decimal

    # Yield
    total_pending_rewards_usd: Decimal
    weighted_average_apy: Decimal


class PositionsByType(BaseSchema):
    """Positions grouped by type."""

    type: PositionType
    count: int
    total_value_usd: Decimal
    total_pnl_usd: Decimal
    positions: List[PositionResponse]


class PositionsByChain(BaseSchema):
    """Positions grouped by chain."""

    chain: str
    count: int
    total_value_usd: Decimal
    positions: List[PositionResponse]


class PositionsByProtocol(BaseSchema):
    """Positions grouped by DeFi protocol."""

    protocol: str
    count: int
    total_value_usd: Decimal
    average_apy: Decimal
    positions: List[PositionResponse]


class StakingPosition(BaseSchema):
    """Staking position detail."""

    id: UUID
    client_id: UUID
    protocol: str
    protocol_logo_url: Optional[str] = None
    staked_token: str
    received_token: str
    amount_staked: Decimal
    value_usd: Decimal
    apy: Decimal
    pending_rewards: Decimal
    pending_rewards_usd: Decimal
    staking_type: str  # liquid, locked, validator
    unlock_date: Optional[datetime] = None
    auto_compound: bool


class LPPosition(BaseSchema):
    """LP position detail."""

    id: UUID
    client_id: UUID
    protocol: str
    protocol_logo_url: Optional[str] = None
    pool_name: str  # e.g., "ETH/USDC"
    token0_symbol: str
    token0_amount: Decimal
    token0_value_usd: Decimal
    token1_symbol: str
    token1_amount: Decimal
    token1_value_usd: Decimal
    total_value_usd: Decimal
    fee_tier: Optional[Decimal] = None
    price_lower: Optional[Decimal] = None
    price_upper: Optional[Decimal] = None
    current_price: Decimal
    in_range: bool
    impermanent_loss: Decimal
    impermanent_loss_usd: Decimal
    fees_earned_usd: Decimal
    apy: Decimal
