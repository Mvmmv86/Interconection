"""Wallet schemas."""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import Field

from app.schemas.common import BaseSchema
from app.models.wallet import NetworkType


class WalletBase(BaseSchema):
    """Base wallet schema."""

    address: str = Field(min_length=10, max_length=255)
    network: NetworkType
    chain: str = Field(min_length=1, max_length=50)
    label: str = Field(min_length=1, max_length=100)


class WalletCreate(WalletBase):
    """Schema for creating a wallet."""

    pass


class WalletResponse(WalletBase):
    """Wallet response schema."""

    id: UUID
    client_id: UUID
    is_active: bool
    added_at: datetime
    last_scan_at: Optional[datetime] = None


class WalletTokenBalance(BaseSchema):
    """Token balance in wallet."""

    symbol: str
    name: str
    contract_address: Optional[str] = None
    balance: Decimal
    balance_usd: Decimal
    price_usd: Decimal
    price_change_24h: Decimal
    logo_url: Optional[str] = None


class WalletWithBalances(WalletResponse):
    """Wallet response with token balances."""

    total_value_usd: Decimal
    tokens: List[WalletTokenBalance]


class WalletScanResult(BaseSchema):
    """Result of wallet scan."""

    wallet_id: UUID
    tokens_found: int
    total_value_usd: Decimal
    new_positions_detected: int
    scan_time_ms: int
