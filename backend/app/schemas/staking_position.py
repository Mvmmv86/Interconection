"""Staking Position schemas."""

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import Field

from app.schemas.common import BaseSchema
from app.models.staking_position import StakingProtocol, StakingType, StakingNetwork


class StakingPositionBase(BaseSchema):
    """Base staking position schema."""

    protocol: StakingProtocol
    network: StakingNetwork
    token: str = Field(min_length=1, max_length=20)
    staked_token: str = Field(min_length=1, max_length=20)
    amount: Decimal = Field(gt=0)
    apy: Decimal = Field(ge=0)
    type: StakingType = StakingType.LIQUID


class StakingPositionCreate(StakingPositionBase):
    """Schema for creating a staking position."""

    protocol_address: Optional[str] = None
    token_address: Optional[str] = None
    staked_token_address: Optional[str] = None
    value_usd: Decimal = Field(ge=0)
    validator_address: Optional[str] = None
    validator_name: Optional[str] = None
    validator_commission: Optional[Decimal] = None
    unlock_date: Optional[datetime] = None
    auto_compound: bool = False
    metadata: Optional[dict] = None


class StakingPositionUpdate(BaseSchema):
    """Schema for updating a staking position."""

    amount: Optional[Decimal] = Field(None, gt=0)
    value_usd: Optional[Decimal] = Field(None, ge=0)
    apy: Optional[Decimal] = Field(None, ge=0)
    rewards_pending: Optional[Decimal] = None
    rewards_pending_usd: Optional[Decimal] = None
    rewards_claimed: Optional[Decimal] = None
    rewards_claimed_usd: Optional[Decimal] = None
    unlock_date: Optional[datetime] = None
    auto_compound: Optional[bool] = None
    validator_commission: Optional[Decimal] = None
    metadata: Optional[dict] = None


class StakingPositionResponse(StakingPositionBase):
    """Staking position response schema."""

    id: UUID
    organization_id: UUID
    client_id: UUID
    wallet_id: Optional[UUID] = None

    # Protocol info
    protocol_address: Optional[str] = None

    # Token addresses
    token_address: Optional[str] = None
    staked_token_address: Optional[str] = None

    # Value
    value_usd: Decimal

    # Rewards
    rewards_pending: Decimal
    rewards_pending_usd: Decimal
    rewards_claimed: Decimal
    rewards_claimed_usd: Decimal

    # Unlock info
    unlock_date: Optional[datetime] = None
    auto_compound: bool

    # Validator info
    validator_address: Optional[str] = None
    validator_name: Optional[str] = None
    validator_commission: Optional[Decimal] = None

    # Detection info
    detected_at: datetime
    last_updated: datetime

    # Metadata
    metadata: Optional[dict] = None

    # Timestamps
    created_at: datetime
    updated_at: datetime

    # Computed properties
    @property
    def estimated_yearly_rewards(self) -> Decimal:
        """Calculate estimated yearly rewards in USD."""
        return self.value_usd * self.apy / 100

    @property
    def estimated_monthly_rewards(self) -> Decimal:
        """Calculate estimated monthly rewards in USD."""
        return self.estimated_yearly_rewards / 12


class StakingPositionSummary(BaseSchema):
    """Summary of staking positions."""

    total_positions: int
    total_value_usd: Decimal
    total_rewards_pending_usd: Decimal
    total_rewards_claimed_usd: Decimal
    weighted_average_apy: Decimal
    estimated_yearly_rewards: Decimal
    by_protocol: dict[str, Decimal]
    by_network: dict[str, Decimal]
    by_type: dict[str, Decimal]
