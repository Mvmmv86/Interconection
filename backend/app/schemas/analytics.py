"""Analytics schemas."""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from app.schemas.common import BaseSchema


class PerformanceMetrics(BaseSchema):
    """Performance metrics schema."""

    period: str  # 24h, 7d, 30d, 90d, 1y
    start_value: Decimal
    end_value: Decimal
    absolute_return: Decimal
    percent_return: Decimal
    best_day: Decimal
    worst_day: Decimal
    positive_days: int
    negative_days: int
    win_rate: Decimal  # percentage of positive days


class RiskMetrics(BaseSchema):
    """Risk metrics schema."""

    period: str
    volatility_daily: Decimal
    volatility_annualized: Decimal
    var_95: Decimal  # Value at Risk 95%
    var_99: Decimal  # Value at Risk 99%
    max_drawdown: Decimal
    max_drawdown_duration_days: int
    sharpe_ratio: Decimal
    sortino_ratio: Decimal
    beta: Optional[Decimal] = None  # vs BTC or market
    correlation_btc: Optional[Decimal] = None


class PnLBreakdown(BaseSchema):
    """P&L breakdown schema."""

    period: str
    total_pnl: Decimal
    realized_pnl: Decimal
    unrealized_pnl: Decimal
    fees_paid: Decimal
    rewards_earned: Decimal
    il_losses: Decimal  # Impermanent Loss
    net_pnl: Decimal

    # By category
    pnl_by_type: dict  # {spot: X, staking: Y, ...}
    pnl_by_chain: dict  # {ethereum: X, solana: Y, ...}
    pnl_by_asset: dict  # {BTC: X, ETH: Y, ...}


class YieldAnalysis(BaseSchema):
    """Yield analysis schema."""

    total_staked_value: Decimal
    total_lending_value: Decimal
    total_lp_value: Decimal
    weighted_average_apy: Decimal

    projected_daily_yield: Decimal
    projected_weekly_yield: Decimal
    projected_monthly_yield: Decimal
    projected_yearly_yield: Decimal

    pending_rewards_total: Decimal

    # By protocol
    yield_by_protocol: List[dict]  # [{protocol, value, apy, rewards}]


class CorrelationMatrix(BaseSchema):
    """Asset correlation matrix."""

    assets: List[str]
    matrix: List[List[Decimal]]
    period: str


class AssetCorrelation(BaseSchema):
    """Single asset correlation."""

    asset_a: str
    asset_b: str
    correlation: Decimal
    period: str


class AnalyticsDashboard(BaseSchema):
    """Complete analytics dashboard."""

    performance: PerformanceMetrics
    risk: RiskMetrics
    pnl: PnLBreakdown
    yield_analysis: YieldAnalysis
    top_correlations: List[AssetCorrelation]
    generated_at: datetime
