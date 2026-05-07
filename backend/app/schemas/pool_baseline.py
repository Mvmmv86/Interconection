"""Pydantic schemas for pool position baselines (IL fallback feature)."""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import Field

from app.schemas.common import BaseSchema
from app.models.pool_position_baseline import BaselineSource


class PoolBaselineUpsert(BaseSchema):
    """Payload to create or update a baseline (idempotent on key)."""

    wallet_address: str = Field(min_length=1, max_length=120)
    position_key: str = Field(min_length=1, max_length=255)
    protocol: str = Field(min_length=1, max_length=50)
    chain: str = Field(min_length=1, max_length=50)
    token0_symbol: str = Field(max_length=20)
    token1_symbol: str = Field(max_length=20)
    token0_amount: Decimal
    token1_amount: Decimal
    token0_price_usd: Decimal
    token1_price_usd: Decimal
    baseline_value_usd: Decimal
    baseline_at: datetime
    source: BaselineSource = BaselineSource.FIRST_OBSERVED


class PoolBaselineResponse(BaseSchema):
    """Single baseline returned to the frontend."""

    id: UUID
    organization_id: UUID
    wallet_address: str
    position_key: str
    protocol: str
    chain: str
    token0_symbol: str
    token1_symbol: str
    token0_amount: Decimal
    token1_amount: Decimal
    token0_price_usd: Decimal
    token1_price_usd: Decimal
    baseline_value_usd: Decimal
    baseline_at: datetime
    source: BaselineSource
    resnapshot_count: int
    created_at: datetime
    updated_at: datetime


class PoolBaselineListResponse(BaseSchema):
    """List of baselines for a wallet (or all wallets when none specified)."""

    items: List[PoolBaselineResponse]
    count: int
