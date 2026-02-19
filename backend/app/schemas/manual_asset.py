"""Manual Asset schemas."""

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import Field

from app.schemas.common import BaseSchema
from app.models.manual_asset import ManualAssetType, ManualAssetNetwork


class ManualAssetBase(BaseSchema):
    """Base manual asset schema."""

    token: str = Field(min_length=1, max_length=20)
    token_name: str = Field(min_length=1, max_length=100)
    network: ManualAssetNetwork
    quantity: Decimal = Field(gt=0)
    purchase_price: Decimal = Field(ge=0)
    purchase_date: datetime
    type: ManualAssetType = ManualAssetType.HOLDING
    staking_provider: Optional[str] = Field(None, max_length=50)
    apy: Optional[Decimal] = Field(None, ge=0, le=10000)  # 0-10000%
    notes: Optional[str] = None


class ManualAssetCreate(ManualAssetBase):
    """Schema for creating a manual asset."""

    pass


class ManualAssetUpdate(BaseSchema):
    """Schema for updating a manual asset."""

    quantity: Optional[Decimal] = Field(None, gt=0)
    purchase_price: Optional[Decimal] = Field(None, ge=0)
    type: Optional[ManualAssetType] = None
    staking_provider: Optional[str] = Field(None, max_length=50)
    apy: Optional[Decimal] = Field(None, ge=0, le=10000)
    notes: Optional[str] = None


class ManualAssetResponse(ManualAssetBase):
    """Manual asset response schema."""

    id: UUID
    client_id: UUID
    current_price: Optional[Decimal] = None
    created_at: datetime
    updated_at: datetime

    # Computed fields
    current_value_usd: Decimal
    cost_basis: Decimal
    unrealized_pnl: Decimal
    unrealized_pnl_percent: Decimal
