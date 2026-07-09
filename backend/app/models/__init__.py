"""SQLAlchemy models."""

from app.models.organization import Organization
from app.models.user import User
from app.models.client import Client
from app.models.wallet import Wallet
from app.models.exchange import Exchange
from app.models.asset import Asset
from app.models.position import Position
from app.models.transaction import Transaction
from app.models.alert import Alert
from app.models.portfolio_snapshot import PortfolioSnapshot
from app.models.audit_log import AuditLog
from app.models.billing import (
    BillingInvoice,
    BillingInvoiceStatus,
    BillingPayment,
    BillingPaymentStatus,
    BillingProvider,
    BillingSubscription,
    BillingSubscriptionStatus,
)
from app.models.bot import (
    BotBacktest,
    BotBacktestRun,
    BotBacktestStatus,
    BotBacktestTrade,
    BotIndicator,
    BotInstance,
    BotInstanceMode,
    BotInstanceStatus,
    BotRun,
    BotRunStatus,
    BotSignal,
    BotSignalAction,
    BotSignalStatus,
    BotStrategy,
    BotStrategyStatus,
    BotTemplate,
    BotTemplateParameter,
    BotTemplateStatus,
    BotTemplateType,
)
from app.models.manual_asset import ManualAsset
from app.models.pool_position import PoolPosition
from app.models.pool_position_baseline import PoolPositionBaseline, BaselineSource
from app.models.staking_position import StakingPosition
from app.models.protocol_registry import ProtocolRegistry, ChainRegistry, ExchangeRegistry
from app.models.price_history import PriceHistory, PoolMetricsHistory
from app.models.market_candle import MarketCandle
from app.models.market_ranking import MarketRankingItem, MarketRankingSnapshot, MarketUniverseAsset
from app.models.integration import Integration, SyncLog
# New models
from app.models.ai import AIReport, AISettings
from app.models.risk_threshold import RiskThreshold
from app.models.exchange_balance import (
    ExchangeBalance,
    ExchangeFuturesPosition,
    ExchangeEarnPosition,
    ExchangeSubaccount,
)
from app.models.exchange_transaction import ExchangeTransaction
from app.models.wallet_data import WalletToken, WalletTransaction
from app.models.defi_cache import DefiPositionCache, NotificationHistory
from app.models.membership import (
    Role,
    RolePermission,
    Membership,
    MembershipPermissionOverride,
    MembershipClient,
    Invitation,
    Team,
    TeamMember,
    TeamClient,
)

__all__ = [
    # Core
    "Organization",
    "User",
    "Client",
    "Wallet",
    "Exchange",
    "Asset",
    "Position",
    "Transaction",
    "Alert",
    "PortfolioSnapshot",
    "AuditLog",
    "BillingProvider",
    "BillingSubscriptionStatus",
    "BillingInvoiceStatus",
    "BillingPaymentStatus",
    "BillingSubscription",
    "BillingInvoice",
    "BillingPayment",
    "BotTemplateStatus",
    "BotTemplateType",
    "BotStrategyStatus",
    "BotRunStatus",
    "BotSignalAction",
    "BotSignalStatus",
    "BotBacktestStatus",
    "BotIndicator",
    "BotStrategy",
    "BotInstanceMode",
    "BotInstanceStatus",
    "BotTemplate",
    "BotTemplateParameter",
    "BotInstance",
    "BotRun",
    "BotSignal",
    "BotBacktest",
    "BotBacktestRun",
    "BotBacktestTrade",
    # DeFi Positions
    "ManualAsset",
    "PoolPosition",
    "PoolPositionBaseline",
    "BaselineSource",
    "StakingPosition",
    # Registries
    "ProtocolRegistry",
    "ChainRegistry",
    "ExchangeRegistry",
    # History
    "PriceHistory",
    "MarketCandle",
    "MarketRankingSnapshot",
    "MarketRankingItem",
    "MarketUniverseAsset",
    "PoolMetricsHistory",
    # Integrations
    "Integration",
    "SyncLog",
    # AI
    "AIReport",
    "AISettings",
    # Risk
    "RiskThreshold",
    # Exchange Details
    "ExchangeBalance",
    "ExchangeFuturesPosition",
    "ExchangeEarnPosition",
    "ExchangeSubaccount",
    "ExchangeTransaction",
    # Wallet Details
    "WalletToken",
    "WalletTransaction",
    # Cache & Notifications
    "DefiPositionCache",
    "NotificationHistory",
    # Team membership & RBAC
    "Role",
    "RolePermission",
    "Membership",
    "MembershipPermissionOverride",
    "MembershipClient",
    "Invitation",
    "Team",
    "TeamMember",
    "TeamClient",
]
