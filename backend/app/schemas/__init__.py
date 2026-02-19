"""Pydantic schemas for request/response validation."""

from app.schemas.common import (
    SuccessResponse,
    PaginatedResponse,
    ErrorResponse,
)
from app.schemas.user import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserLogin,
    TokenResponse,
)
from app.schemas.client import (
    ClientCreate,
    ClientUpdate,
    ClientResponse,
    ClientWithPortfolio,
)
from app.schemas.wallet import (
    WalletCreate,
    WalletResponse,
)
from app.schemas.exchange import (
    ExchangeCreate,
    ExchangeResponse,
)
from app.schemas.position import (
    PositionResponse,
    PositionSummary,
)
from app.schemas.portfolio import (
    PortfolioSummary,
    PortfolioAllocation,
    PortfolioHistory,
)
from app.schemas.alert import (
    AlertCreate,
    AlertUpdate,
    AlertResponse,
)
from app.schemas.manual_asset import (
    ManualAssetCreate,
    ManualAssetUpdate,
    ManualAssetResponse,
)
from app.schemas.staking_position import (
    StakingPositionCreate,
    StakingPositionUpdate,
    StakingPositionResponse,
    StakingPositionSummary,
)
from app.schemas.pool_position import (
    PoolPositionCreate,
    PoolPositionUpdate,
    PoolPositionResponse,
    PoolPositionSummary,
)
from app.schemas.integration import (
    IntegrationCreate,
    IntegrationUpdate,
    IntegrationResponse,
    IntegrationSyncRequest,
    IntegrationSyncResponse,
    SyncLogResponse,
)
from app.schemas.client_portfolio import (
    ClientPortfolio,
    ClientPortfolioSummary,
    ClientPortfolioListItem,
    ClientPortfolioHistory,
    ClientWallet,
    ClientExchange,
)

__all__ = [
    # Common
    "SuccessResponse",
    "PaginatedResponse",
    "ErrorResponse",
    # User
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "UserLogin",
    "TokenResponse",
    # Client
    "ClientCreate",
    "ClientUpdate",
    "ClientResponse",
    "ClientWithPortfolio",
    # Wallet
    "WalletCreate",
    "WalletResponse",
    # Exchange
    "ExchangeCreate",
    "ExchangeResponse",
    # Position
    "PositionResponse",
    "PositionSummary",
    # Portfolio
    "PortfolioSummary",
    "PortfolioAllocation",
    "PortfolioHistory",
    # Alert
    "AlertCreate",
    "AlertUpdate",
    "AlertResponse",
    # Manual Asset
    "ManualAssetCreate",
    "ManualAssetUpdate",
    "ManualAssetResponse",
    # Staking Position
    "StakingPositionCreate",
    "StakingPositionUpdate",
    "StakingPositionResponse",
    "StakingPositionSummary",
    # Pool Position
    "PoolPositionCreate",
    "PoolPositionUpdate",
    "PoolPositionResponse",
    "PoolPositionSummary",
    # Integration
    "IntegrationCreate",
    "IntegrationUpdate",
    "IntegrationResponse",
    "IntegrationSyncRequest",
    "IntegrationSyncResponse",
    "SyncLogResponse",
    # Client Portfolio
    "ClientPortfolio",
    "ClientPortfolioSummary",
    "ClientPortfolioListItem",
    "ClientPortfolioHistory",
    "ClientWallet",
    "ClientExchange",
]
