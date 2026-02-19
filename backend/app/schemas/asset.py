"""Asset schemas."""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from app.schemas.common import BaseSchema


class AssetBase(BaseSchema):
    """Base asset schema."""

    symbol: str
    name: str


class AssetResponse(AssetBase):
    """Asset response schema."""

    id: UUID
    coingecko_id: Optional[str] = None
    logo_url: Optional[str] = None
    decimals: int
    chain: Optional[str] = None
    contract_address: Optional[str] = None
    current_price_usd: Decimal
    price_change_24h: Decimal
    market_cap: Optional[Decimal] = None
    last_price_update: Optional[datetime] = None
    created_at: datetime


class AssetPriceHistory(BaseSchema):
    """Asset price history point."""

    timestamp: datetime
    price_usd: Decimal
    market_cap: Optional[Decimal] = None
    volume_24h: Optional[Decimal] = None


class AssetWithHistory(AssetResponse):
    """Asset with price history."""

    price_history: List[AssetPriceHistory]


class AssetSearchResult(BaseSchema):
    """Asset search result."""

    id: UUID
    symbol: str
    name: str
    logo_url: Optional[str] = None
    current_price_usd: Decimal
    price_change_24h: Decimal
