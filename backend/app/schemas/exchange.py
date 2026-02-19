"""Exchange schemas."""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import Field

from app.schemas.common import BaseSchema


# Supported exchanges
SUPPORTED_EXCHANGES = [
    "binance",
    "coinbase",
    "kraken",
    "bybit",
    "okx",
    "kucoin",
    "gateio",
    "mexc",
]


class ExchangeBase(BaseSchema):
    """Base exchange schema."""

    exchange: str = Field(min_length=1, max_length=50)
    label: str = Field(min_length=1, max_length=100)


class ExchangeCreate(ExchangeBase):
    """Schema for creating an exchange connection."""

    api_key: str = Field(min_length=10)
    api_secret: str = Field(min_length=10)


class ExchangeResponse(ExchangeBase):
    """Exchange response schema."""

    id: UUID
    client_id: UUID
    api_key_masked: str
    is_active: bool
    added_at: datetime
    last_sync_at: Optional[datetime] = None
    sync_error: Optional[str] = None


class ExchangeBalance(BaseSchema):
    """Balance in exchange."""

    asset: str
    free: Decimal
    locked: Decimal
    total: Decimal
    value_usd: Decimal
    price_usd: Decimal = Decimal("0")
    change_24h: Decimal = Decimal("0")
    # PnL fields
    entry_price: Optional[Decimal] = None
    cost_basis: Optional[Decimal] = None
    unrealized_pnl: Decimal = Decimal("0")
    unrealized_pnl_percent: Decimal = Decimal("0")
    # Yield fields
    apy: Optional[Decimal] = None
    position_type: Optional[str] = None  # "spot", "staking", "earn"


class FundingBalance(ExchangeBalance):
    """Funding account balance (separate from trading account)."""

    transferable: Decimal = Decimal("0")


class MarginBalance(ExchangeBalance):
    """Margin account balance with borrow info."""

    borrowed: Decimal = Decimal("0")
    interest: Decimal = Decimal("0")
    net_asset: Decimal = Decimal("0")


class FuturesPositionData(BaseSchema):
    """Futures position data."""

    symbol: str
    side: str  # "long" or "short"
    size: Decimal
    entry_price: Decimal
    mark_price: Decimal
    liquidation_price: Optional[Decimal] = None
    unrealized_pnl: Decimal = Decimal("0")
    unrealized_pnl_percent: Decimal = Decimal("0")
    realized_pnl: Decimal = Decimal("0")
    margin: Decimal = Decimal("0")
    leverage: int = 1
    position_value: Decimal = Decimal("0")
    category: str = "linear"  # "linear", "inverse", "option"
    settle_coin: str = "USDT"


class EarnPositionData(BaseSchema):
    """Earn/Staking position data."""

    product_id: str
    product_type: str  # "FlexibleSaving", "FixedStaking"
    coin: str
    amount: Decimal
    total_pnl: Decimal = Decimal("0")
    claimable_yield: Decimal = Decimal("0")
    status: str = "Active"
    apy: Optional[Decimal] = None
    value_usd: Decimal = Decimal("0")


class SubAccountBalance(BaseSchema):
    """Balance within a sub-account."""

    asset: str
    total: Decimal
    value_usd: Decimal
    price_usd: Decimal = Decimal("0")
    change_24h: Decimal = Decimal("0")


class SubAccountData(BaseSchema):
    """Sub-account information with balances."""

    uid: str
    username: str
    status: str = "active"
    total_value_usd: Decimal = Decimal("0")
    balances_count: int = 0
    balances: List[SubAccountBalance] = Field(default_factory=list)


class ExchangeWithBalances(ExchangeResponse):
    """Exchange response with balances."""

    total_value_usd: Decimal
    balances: List[ExchangeBalance]


class ExchangeSyncResult(BaseSchema):
    """Result of exchange sync."""

    exchange_id: UUID
    assets_synced: int
    total_value_usd: Decimal
    sync_time_ms: int
    error: Optional[str] = None


class SupportedExchangeInfo(BaseSchema):
    """Info about a supported exchange."""

    id: str
    name: str
    logo_url: str
    supports_spot: bool = True
    supports_futures: bool = False
    supports_margin: bool = False
    supports_funding: bool = False
    supports_earn: bool = False
    supports_subaccounts: bool = False
    requires_passphrase: bool = False


# ============================================
# Aggregated Exchange Position Schemas
# (For Exchange Positions page display)
# ============================================


class TopAsset(BaseSchema):
    """Top asset within an exchange."""

    symbol: str
    value: Decimal
    change: Decimal = Decimal("0")  # 24h price change %


class ExchangeAccountData(BaseSchema):
    """Complete exchange data for frontend display."""

    id: str  # UUID as string for frontend
    name: str  # "Binance", "Bybit"
    logo: str  # 2-letter code: "BN", "BY"
    status: str  # "connected", "syncing", "error", "pending"
    last_sync: str  # "2 min ago", "never"
    total_value: Decimal
    spot_value: Decimal
    funding_value: Decimal = Decimal("0")
    margin_value: Decimal
    futures_value: Decimal
    earn_value: Decimal = Decimal("0")
    pnl_24h: Decimal = Decimal("0")  # 24h P&L percentage
    unrealized_pnl: Decimal = Decimal("0")
    positions: int  # Number of positions
    top_assets: List[TopAsset] = Field(default_factory=list)
    subaccounts_count: int = 0
    subaccounts_value: Decimal = Decimal("0")


class ExchangePositionsSummary(BaseSchema):
    """Summary for the Exchange Positions page header cards."""

    total_value: Decimal
    spot_holdings: Decimal
    funding_holdings: Decimal = Decimal("0")
    margin_positions: Decimal
    futures_positions: Decimal
    earn_positions: Decimal = Decimal("0")
    unrealized_pnl: Decimal = Decimal("0")
    exchanges: List[ExchangeAccountData] = Field(default_factory=list)


class ExchangeDetailedData(BaseSchema):
    """Detailed exchange data including all position types."""

    id: str
    name: str
    logo: str
    status: str
    last_sync: str

    # Balances
    spot_balances: List[ExchangeBalance] = Field(default_factory=list)
    funding_balances: List[FundingBalance] = Field(default_factory=list)
    margin_balances: List[MarginBalance] = Field(default_factory=list)
    futures_positions: List[FuturesPositionData] = Field(default_factory=list)
    earn_positions: List[EarnPositionData] = Field(default_factory=list)

    # Totals
    total_spot_usd: Decimal = Decimal("0")
    total_funding_usd: Decimal = Decimal("0")
    total_margin_usd: Decimal = Decimal("0")
    total_futures_usd: Decimal = Decimal("0")
    total_earn_usd: Decimal = Decimal("0")
    total_value_usd: Decimal = Decimal("0")
    total_unrealized_pnl: Decimal = Decimal("0")

    # Subaccounts
    subaccounts: List[SubAccountData] = Field(default_factory=list)
    total_subaccounts_value: Decimal = Decimal("0")


class ExchangeTestConnectionRequest(BaseSchema):
    """Request to test exchange connection."""

    exchange: str = Field(min_length=1, max_length=50)
    api_key: str = Field(min_length=10)
    api_secret: str = Field(min_length=10)
    passphrase: Optional[str] = None


class ExchangeTestConnectionResponse(BaseSchema):
    """Response from connection test."""

    success: bool
    message: str
    assets_found: int = 0
    total_value_usd: Decimal = Decimal("0")
    spot_value: Decimal = Decimal("0")
    futures_value: Decimal = Decimal("0")
    earn_value: Decimal = Decimal("0")
