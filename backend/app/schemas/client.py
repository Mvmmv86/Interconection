"""Client schemas."""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import EmailStr, Field

from app.schemas.common import BaseSchema


class ClientBase(BaseSchema):
    """Base client schema."""

    name: str = Field(min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    notes: Optional[str] = None
    color: str = Field(default="#4ECDC4", pattern=r"^#[0-9A-Fa-f]{6}$")


class ClientCreate(ClientBase):
    """Schema for creating a client."""

    pass


class ClientUpdate(BaseSchema):
    """Schema for updating a client."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    notes: Optional[str] = None
    color: Optional[str] = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")


class ClientResponse(ClientBase):
    """Client response schema."""

    id: UUID
    organization_id: UUID
    created_at: datetime
    updated_at: datetime


class ClientPortfolioSummary(BaseSchema):
    """Client portfolio summary schema."""

    total_value_usd: Decimal
    total_holding_usd: Decimal
    total_staking_usd: Decimal
    total_lending_usd: Decimal
    total_lp_usd: Decimal
    total_pnl_usd: Decimal
    total_pnl_percent: Decimal
    pending_rewards_usd: Decimal
    average_apy: Decimal
    asset_count: int
    wallet_count: int
    exchange_count: int


class ClientWithPortfolio(ClientResponse):
    """Client response with portfolio summary."""

    portfolio: ClientPortfolioSummary


class ClientListResponse(BaseSchema):
    """Client list item for quick display."""

    id: UUID
    name: str
    email: Optional[str] = None
    color: str
    total_value_usd: Decimal = Decimal("0")
    pnl_24h_percent: Decimal = Decimal("0")
    wallet_count: int = 0
    exchange_count: int = 0
