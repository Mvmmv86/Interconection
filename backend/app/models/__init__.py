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
from app.models.manual_asset import ManualAsset
from app.models.pool_position import PoolPosition
from app.models.pool_position_baseline import PoolPositionBaseline, BaselineSource
from app.models.staking_position import StakingPosition
from app.models.protocol_registry import ProtocolRegistry, ChainRegistry, ExchangeRegistry
from app.models.price_history import PriceHistory, PoolMetricsHistory
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
]
