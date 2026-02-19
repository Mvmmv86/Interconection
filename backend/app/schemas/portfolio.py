"""Portfolio schemas."""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import Field

from app.schemas.common import BaseSchema


class PortfolioSummary(BaseSchema):
    """Portfolio summary schema."""

    total_value_usd: Decimal
    total_holding_usd: Decimal
    total_staking_usd: Decimal
    total_lending_usd: Decimal
    total_lp_usd: Decimal

    # P&L
    pnl_24h: Decimal
    pnl_24h_percent: Decimal
    pnl_7d: Decimal
    pnl_7d_percent: Decimal
    pnl_30d: Decimal
    pnl_30d_percent: Decimal
    pnl_total: Decimal
    pnl_total_percent: Decimal

    # Yield
    pending_rewards_usd: Decimal
    average_apy: Decimal
    projected_yearly_yield: Decimal
    projected_monthly_yield: Decimal

    # Counts
    client_count: int
    position_count: int
    wallet_count: int
    exchange_count: int

    last_updated: datetime


class AllocationItem(BaseSchema):
    """Single allocation item."""

    name: str
    value_usd: Decimal
    percentage: Decimal
    color: Optional[str] = None


class PortfolioAllocation(BaseSchema):
    """Portfolio allocation breakdown."""

    by_type: List[AllocationItem]  # spot, staking, lending, lp
    by_chain: List[AllocationItem]  # ethereum, solana, etc
    by_asset: List[AllocationItem]  # BTC, ETH, SOL, etc
    by_protocol: List[AllocationItem]  # Lido, Uniswap, etc
    by_client: List[AllocationItem]  # Client breakdown


class PortfolioHistoryPoint(BaseSchema):
    """Single point in portfolio history."""

    timestamp: datetime
    total_value_usd: Decimal
    pnl_usd: Decimal
    pnl_percent: Decimal


class PortfolioHistory(BaseSchema):
    """Portfolio historical data."""

    period: str  # 24h, 7d, 30d, 90d, 1y, all
    data_points: List[PortfolioHistoryPoint]
    start_value: Decimal
    end_value: Decimal
    high_value: Decimal
    low_value: Decimal
    change_usd: Decimal
    change_percent: Decimal


class PortfolioSnapshot(BaseSchema):
    """Daily portfolio snapshot."""

    id: UUID
    timestamp: datetime
    total_value_usd: Decimal
    total_holding_usd: Decimal
    total_staking_usd: Decimal
    total_lending_usd: Decimal
    total_lp_usd: Decimal
    pnl_24h: Decimal
    pending_rewards_usd: Decimal
    average_apy: Decimal


class TopPerformer(BaseSchema):
    """Top performing asset."""

    asset_symbol: str
    asset_name: str
    logo_url: Optional[str] = None
    value_usd: Decimal
    pnl_usd: Decimal
    pnl_percent: Decimal
    quantity: Decimal


class PortfolioDashboard(BaseSchema):
    """Complete dashboard data."""

    summary: PortfolioSummary
    allocation: PortfolioAllocation
    recent_history: List[PortfolioHistoryPoint]
    top_gainers: List[TopPerformer]
    top_losers: List[TopPerformer]
    recent_transactions_count: int
    active_alerts_count: int
