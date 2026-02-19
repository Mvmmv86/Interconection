"""Exchange integrations."""

from app.integrations.exchanges.base import (
    # Base classes
    BaseExchangeAdapter,
    ExchangeBalance,
    SpotBalance,
    FundingBalance,
    MarginBalance,
    FuturesPosition,
    EarnPosition,
    SubAccount,
    SubAccountSummary,
    ExchangeAccountSummary,
    ExchangeTransaction,
    AccountType,
    # Errors
    ExchangeAdapterError,
    ExchangeAuthError,
    ExchangeRateLimitError,
    ExchangeAPIError,
)
from app.integrations.exchanges.bybit import BybitAdapter

__all__ = [
    # Base classes
    "BaseExchangeAdapter",
    "ExchangeBalance",
    "SpotBalance",
    "FundingBalance",
    "MarginBalance",
    "FuturesPosition",
    "EarnPosition",
    "SubAccount",
    "SubAccountSummary",
    "ExchangeAccountSummary",
    "ExchangeTransaction",
    "AccountType",
    # Errors
    "ExchangeAdapterError",
    "ExchangeAuthError",
    "ExchangeRateLimitError",
    "ExchangeAPIError",
    # Adapters
    "BybitAdapter",
]
