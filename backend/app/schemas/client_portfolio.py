"""Client Portfolio composite schema - matches frontend ClientPortfolio interface."""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import Field

from app.schemas.common import BaseSchema
from app.schemas.client import ClientResponse
from app.schemas.wallet import WalletResponse, WalletTokenBalance
from app.schemas.exchange import ExchangeResponse, ExchangeBalance
from app.schemas.manual_asset import ManualAssetResponse
from app.schemas.staking_position import StakingPositionResponse
from app.schemas.pool_position import PoolPositionResponse


# Extended wallet with balance data
class ClientWallet(WalletResponse):
    """Wallet with balance summary for client portfolio."""

    total_value_usd: Decimal = Decimal("0")
    token_count: int = 0
    tokens: List[WalletTokenBalance] = []


# Extended exchange with balance data
class ClientExchange(ExchangeResponse):
    """Exchange with balance summary for client portfolio."""

    total_value_usd: Decimal = Decimal("0")
    asset_count: int = 0
    balances: List[ExchangeBalance] = []


# Portfolio summary matching frontend interface
class ClientPortfolioSummary(BaseSchema):
    """Portfolio summary with all metrics."""

    # Total values by category
    total_value_usd: Decimal = Decimal("0")
    total_holding_usd: Decimal = Decimal("0")
    total_staking_usd: Decimal = Decimal("0")
    total_lending_usd: Decimal = Decimal("0")
    total_lp_usd: Decimal = Decimal("0")

    # P&L
    total_pnl_usd: Decimal = Decimal("0")
    total_pnl_percent: Decimal = Decimal("0")
    pnl_24h_usd: Decimal = Decimal("0")
    pnl_24h_percent: Decimal = Decimal("0")
    pnl_7d_usd: Decimal = Decimal("0")
    pnl_7d_percent: Decimal = Decimal("0")
    pnl_30d_usd: Decimal = Decimal("0")
    pnl_30d_percent: Decimal = Decimal("0")

    # Rewards and yield
    pending_rewards_usd: Decimal = Decimal("0")
    claimed_rewards_usd: Decimal = Decimal("0")
    average_apy: Decimal = Decimal("0")
    estimated_yearly_yield: Decimal = Decimal("0")

    # LP specific
    total_fees_earned_usd: Decimal = Decimal("0")
    total_il_usd: Decimal = Decimal("0")

    # Counts
    asset_count: int = 0
    wallet_count: int = 0
    exchange_count: int = 0
    staking_position_count: int = 0
    lp_position_count: int = 0
    manual_asset_count: int = 0

    # Allocation breakdown
    allocation_by_type: dict = Field(default_factory=dict)  # {holding: %, staking: %, lp: %}
    allocation_by_chain: dict = Field(default_factory=dict)  # {ethereum: %, solana: %}
    allocation_by_asset: dict = Field(default_factory=dict)  # {BTC: %, ETH: %}

    # Risk metrics (optional)
    var_95: Optional[Decimal] = None
    max_drawdown: Optional[Decimal] = None
    sharpe_ratio: Optional[Decimal] = None


# Main composite response matching frontend ClientPortfolio interface
class ClientPortfolio(BaseSchema):
    """Complete client portfolio data - matches frontend interface."""

    client: ClientResponse
    wallets: List[ClientWallet] = []
    exchanges: List[ClientExchange] = []
    manual_assets: List[ManualAssetResponse] = []
    staking_positions: List[StakingPositionResponse] = []
    pool_positions: List[PoolPositionResponse] = []
    summary: ClientPortfolioSummary


# Lightweight version for list views
class ClientPortfolioListItem(BaseSchema):
    """Lightweight client portfolio for list display."""

    id: UUID
    name: str
    email: Optional[str] = None
    color: str
    total_value_usd: Decimal = Decimal("0")
    pnl_24h_percent: Decimal = Decimal("0")
    wallet_count: int = 0
    exchange_count: int = 0
    position_count: int = 0
    pending_rewards_usd: Decimal = Decimal("0")
    average_apy: Decimal = Decimal("0")


# Historical portfolio value for charts
class PortfolioHistoryPoint(BaseSchema):
    """Single point in portfolio history."""

    timestamp: datetime
    total_value_usd: Decimal
    holding_usd: Decimal
    staking_usd: Decimal
    lp_usd: Decimal
    pnl_usd: Decimal
    pnl_percent: Decimal


class ClientPortfolioHistory(BaseSchema):
    """Historical portfolio data for a client."""

    client_id: UUID
    period: str  # "24h", "7d", "30d", "90d", "1y", "all"
    data_points: List[PortfolioHistoryPoint] = []
    start_value: Decimal
    end_value: Decimal
    change_usd: Decimal
    change_percent: Decimal
    high_value: Decimal
    low_value: Decimal
