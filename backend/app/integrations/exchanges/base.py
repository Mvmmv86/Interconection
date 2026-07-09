"""Base Exchange Adapter - Abstract base class for exchange integrations."""

from abc import ABC, abstractmethod
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class AccountType(str, Enum):
    """Account types supported by exchanges."""
    UNIFIED = "unified"
    SPOT = "spot"
    MARGIN = "margin"
    FUTURES = "futures"
    FUNDING = "funding"
    EARN = "earn"


class ExchangeOrderSide(str, Enum):
    """Normalized exchange order side."""

    BUY = "buy"
    SELL = "sell"


class ExchangeOrderType(str, Enum):
    """Normalized exchange order type."""

    MARKET = "market"
    LIMIT = "limit"


class ExchangeOrderStatus(str, Enum):
    """Normalized order status returned by adapters."""

    SUBMITTED = "submitted"
    OPEN = "open"
    FILLED = "filled"
    PARTIALLY_FILLED = "partially_filled"
    CANCELLED = "cancelled"
    REJECTED = "rejected"
    UNKNOWN = "unknown"


class ExchangeBalance(BaseModel):
    """Base balance model for exchange assets."""

    asset: str
    free: Decimal = Field(default=Decimal("0"))
    locked: Decimal = Field(default=Decimal("0"))
    total: Decimal = Field(default=Decimal("0"))
    value_usd: Decimal = Field(default=Decimal("0"))
    price_usd: Decimal = Field(default=Decimal("0"))
    change_24h: Decimal = Field(default=Decimal("0"))  # 24h price change %


class SpotBalance(ExchangeBalance):
    """Spot wallet balance."""

    pass


class FundingBalance(ExchangeBalance):
    """Funding/Main wallet balance (separate from trading accounts)."""

    transferable: Decimal = Field(default=Decimal("0"))


class MarginBalance(ExchangeBalance):
    """Margin account balance."""

    borrowed: Decimal = Field(default=Decimal("0"))
    interest: Decimal = Field(default=Decimal("0"))
    net_asset: Decimal = Field(default=Decimal("0"))  # total - borrowed


class FuturesPosition(BaseModel):
    """Futures/Derivatives position."""

    symbol: str
    side: str  # "long" or "short"
    size: Decimal
    entry_price: Decimal
    mark_price: Decimal
    liquidation_price: Optional[Decimal] = None
    unrealized_pnl: Decimal = Field(default=Decimal("0"))
    unrealized_pnl_percent: Decimal = Field(default=Decimal("0"))
    realized_pnl: Decimal = Field(default=Decimal("0"))
    margin: Decimal = Field(default=Decimal("0"))
    leverage: int = 1
    position_value: Decimal = Field(default=Decimal("0"))
    category: str = "linear"  # "linear", "inverse", "option"
    settle_coin: str = "USDT"  # Settlement currency


class EarnPosition(BaseModel):
    """Earn/Staking position."""

    product_id: str
    product_type: str  # "FlexibleSaving", "FixedStaking", etc.
    coin: str
    amount: Decimal
    total_pnl: Decimal = Field(default=Decimal("0"))
    claimable_yield: Decimal = Field(default=Decimal("0"))
    status: str = "Active"
    apy: Optional[Decimal] = None
    value_usd: Decimal = Field(default=Decimal("0"))
    settlement_time: Optional[datetime] = None


class ExchangeTransaction(BaseModel):
    """Transaction from an exchange (deposit, withdrawal, internal transfer)."""

    id: str
    exchange: str = ""
    exchange_label: str = ""
    type: str  # "deposit", "withdrawal", "internal_transfer"
    coin: str
    amount: Decimal = Field(default=Decimal("0"))
    fee: Decimal = Field(default=Decimal("0"))
    value_usd: Decimal = Field(default=Decimal("0"))
    status: str = "completed"  # "pending", "completed", "failed", "cancelled"
    tx_id: Optional[str] = None  # on-chain tx hash
    from_account: Optional[str] = None  # for internal transfers
    to_account: Optional[str] = None
    chain: Optional[str] = None
    address: Optional[str] = None  # destination/source address
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ExchangeOrderRequest(BaseModel):
    """Normalized request to place an order through an exchange adapter."""

    symbol: str
    side: ExchangeOrderSide
    order_type: ExchangeOrderType = ExchangeOrderType.MARKET
    quantity: Decimal = Field(gt=Decimal("0"))
    price: Optional[Decimal] = None
    category: str = "spot"  # spot, linear, inverse, futures, swap
    time_in_force: Optional[str] = None
    client_order_id: str = Field(min_length=1)
    reduce_only: bool = False
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ExchangeOrderResult(BaseModel):
    """Normalized order result returned by an exchange adapter."""

    exchange: str
    order_id: Optional[str] = None
    client_order_id: Optional[str] = None
    symbol: str
    side: Optional[ExchangeOrderSide] = None
    order_type: ExchangeOrderType
    status: ExchangeOrderStatus = ExchangeOrderStatus.SUBMITTED
    raw_response: Dict[str, Any] = Field(default_factory=dict)


class MarketCandleData(BaseModel):
    """Normalized OHLCV candle returned by exchange market-data endpoints."""

    exchange: str
    symbol: str
    timeframe: str
    open_time: datetime
    close_time: datetime
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: Decimal = Field(default=Decimal("0"))
    quote_volume: Decimal = Field(default=Decimal("0"))
    trade_count: Optional[int] = None
    is_closed: bool = True
    raw_response: Dict[str, Any] = Field(default_factory=dict)


class SubAccount(BaseModel):
    """Sub-account information."""

    uid: str
    username: str
    member_type: int  # 1 = standard, 6 = custodial
    status: int  # 1 = normal, 2 = login banned, 4 = frozen
    account_mode: int  # 1 = Classic, 3 = UTA1.0, 4 = UTA1.0 Pro, 5 = UTA2.0
    remark: Optional[str] = None


class SubAccountSummary(BaseModel):
    """Summary of a sub-account's holdings."""

    uid: str
    username: str
    total_value_usd: Decimal = Field(default=Decimal("0"))
    spot_balances: List[SpotBalance] = Field(default_factory=list)
    futures_positions: List[FuturesPosition] = Field(default_factory=list)


class ExchangeAccountSummary(BaseModel):
    """Complete exchange account summary."""

    # Balances by account type
    spot_balances: List[SpotBalance] = Field(default_factory=list)
    funding_balances: List[FundingBalance] = Field(default_factory=list)
    margin_balances: List[MarginBalance] = Field(default_factory=list)
    futures_positions: List[FuturesPosition] = Field(default_factory=list)
    earn_positions: List[EarnPosition] = Field(default_factory=list)

    # Totals in USD
    total_spot_usd: Decimal = Field(default=Decimal("0"))
    total_funding_usd: Decimal = Field(default=Decimal("0"))
    total_margin_usd: Decimal = Field(default=Decimal("0"))
    total_futures_usd: Decimal = Field(default=Decimal("0"))
    total_earn_usd: Decimal = Field(default=Decimal("0"))
    total_value_usd: Decimal = Field(default=Decimal("0"))

    # Unrealized P&L from futures
    total_unrealized_pnl: Decimal = Field(default=Decimal("0"))

    # Metadata
    last_updated: datetime = Field(default_factory=datetime.utcnow)
    position_count: int = 0

    # Subaccounts (if master account)
    subaccounts: List[SubAccountSummary] = Field(default_factory=list)
    total_subaccounts_value_usd: Decimal = Field(default=Decimal("0"))


class BaseExchangeAdapter(ABC):
    """
    Abstract base class for exchange integrations.

    Each exchange adapter must implement these methods to provide
    a consistent interface for fetching account data.
    """

    exchange_name: str = "unknown"
    supports_spot: bool = True
    supports_margin: bool = False
    supports_futures: bool = False
    supports_funding: bool = False
    supports_earn: bool = False
    supports_subaccounts: bool = False

    @abstractmethod
    async def test_connection(self) -> bool:
        """
        Test if the API credentials are valid.

        Returns:
            bool: True if credentials are valid and API is accessible
        """
        ...

    @abstractmethod
    async def get_spot_balances(self) -> List[SpotBalance]:
        """
        Get all spot wallet balances.

        Returns:
            List of SpotBalance objects with non-zero balances
        """
        ...

    @abstractmethod
    async def get_margin_balances(self) -> List[MarginBalance]:
        """
        Get all margin account balances.

        Returns:
            List of MarginBalance objects (empty if margin not supported)
        """
        ...

    @abstractmethod
    async def get_futures_positions(self) -> List[FuturesPosition]:
        """
        Get all open futures/derivatives positions.

        Returns:
            List of FuturesPosition objects (empty if futures not supported)
        """
        ...

    async def get_funding_balances(self) -> List[FundingBalance]:
        """
        Get funding/main wallet balances.

        Returns:
            List of FundingBalance objects (empty if not supported)
        """
        return []

    async def get_earn_positions(self) -> List[EarnPosition]:
        """
        Get all earn/staking positions.

        Returns:
            List of EarnPosition objects (empty if not supported)
        """
        return []

    async def get_subaccounts(self) -> List[SubAccount]:
        """
        Get list of sub-accounts (for master accounts).

        Returns:
            List of SubAccount objects (empty if not supported or not master)
        """
        return []

    async def get_subaccount_balances(self, member_id: str) -> List[SpotBalance]:
        """
        Get balances for a specific sub-account.

        Args:
            member_id: The UID of the sub-account

        Returns:
            List of SpotBalance objects for the sub-account
        """
        return []

    async def get_deposit_history(self, limit: int = 50) -> List[ExchangeTransaction]:
        """
        Get deposit history.

        Returns:
            List of ExchangeTransaction for deposits
        """
        return []

    async def get_withdrawal_history(self, limit: int = 50) -> List[ExchangeTransaction]:
        """
        Get withdrawal history.

        Returns:
            List of ExchangeTransaction for withdrawals
        """
        return []

    async def get_internal_transfers(self, limit: int = 50) -> List[ExchangeTransaction]:
        """
        Get internal transfer history (between accounts/sub-accounts).

        Returns:
            List of ExchangeTransaction for internal transfers
        """
        return []

    async def get_all_transactions(self, limit: int = 50) -> List[ExchangeTransaction]:
        """
        Get all recent transactions (deposits + withdrawals + transfers).

        Combines results from all transaction methods and sorts by timestamp.
        """
        import asyncio
        import logging
        _logger = logging.getLogger(__name__)

        results = await asyncio.gather(
            self.get_deposit_history(limit),
            self.get_withdrawal_history(limit),
            self.get_internal_transfers(limit),
            return_exceptions=True,
        )

        import sys
        labels = ["deposits", "withdrawals", "transfers"]
        transactions: List[ExchangeTransaction] = []
        for label, result in zip(labels, results):
            if isinstance(result, Exception):
                print(f"[TX-DEBUG] [{self.exchange_name}] Failed to get {label}: {result}", file=sys.stderr, flush=True)
                continue
            print(f"[TX-DEBUG] [{self.exchange_name}] Got {len(result)} {label}", file=sys.stderr, flush=True)
            transactions.extend(result)

        # Sort by timestamp descending
        transactions.sort(key=lambda t: t.timestamp, reverse=True)
        return transactions[:limit]

    async def place_order(self, order: ExchangeOrderRequest) -> ExchangeOrderResult:
        """
        Place an order on the exchange.

        Adapters opt in explicitly. Bot execution should call this only through
        the dedicated executor/service layer with idempotency, risk checks and
        reconciliation enabled.
        """
        raise NotImplementedError(f"{self.exchange_name} does not support order placement")

    async def cancel_order(
        self,
        symbol: str,
        order_id: Optional[str] = None,
        client_order_id: Optional[str] = None,
        category: str = "spot",
    ) -> ExchangeOrderResult:
        """Cancel an order on the exchange."""
        raise NotImplementedError(f"{self.exchange_name} does not support order cancellation")

    async def get_order(
        self,
        symbol: str,
        order_id: Optional[str] = None,
        client_order_id: Optional[str] = None,
        category: str = "spot",
    ) -> ExchangeOrderResult:
        """Fetch order status from the exchange."""
        raise NotImplementedError(f"{self.exchange_name} does not support order lookup")

    async def get_ohlcv_candles(
        self,
        symbol: str,
        timeframe: str = "1h",
        limit: int = 200,
        category: str = "spot",
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> List[MarketCandleData]:
        """
        Fetch normalized OHLCV candles for strategy engines.

        Public market data is intentionally exposed through adapters so bot
        ingestion can reuse exchange-specific symbol and interval handling.
        """
        raise NotImplementedError(f"{self.exchange_name} does not support OHLCV candles")

    async def get_account_summary(self, include_subaccounts: bool = False) -> ExchangeAccountSummary:
        """
        Get complete account summary with all balances and positions.

        This method aggregates data from spot, margin, futures, and earn accounts.
        Can be overridden if exchange provides a single endpoint for all data.

        Args:
            include_subaccounts: Whether to include sub-account data

        Returns:
            ExchangeAccountSummary with all account data
        """
        spot_balances = await self.get_spot_balances()
        funding_balances = await self.get_funding_balances() if self.supports_funding else []
        margin_balances = await self.get_margin_balances() if self.supports_margin else []
        futures_positions = await self.get_futures_positions() if self.supports_futures else []
        earn_positions = await self.get_earn_positions() if self.supports_earn else []

        # Calculate totals
        total_spot = sum(b.value_usd for b in spot_balances)
        total_funding = sum(b.value_usd for b in funding_balances)
        total_margin = sum(b.value_usd for b in margin_balances)
        total_futures = sum(p.margin + p.unrealized_pnl for p in futures_positions)
        total_earn = sum(p.value_usd for p in earn_positions)
        total_unrealized_pnl = sum(p.unrealized_pnl for p in futures_positions)

        # Count total positions
        position_count = (
            len(spot_balances) +
            len(funding_balances) +
            len(margin_balances) +
            len(futures_positions) +
            len(earn_positions)
        )

        # Subaccounts
        subaccount_summaries = []
        total_subaccounts_value = Decimal("0")

        if include_subaccounts and self.supports_subaccounts:
            subaccounts = await self.get_subaccounts()
            for sub in subaccounts:
                sub_balances = await self.get_subaccount_balances(sub.uid)
                sub_total = sum(b.value_usd for b in sub_balances)
                subaccount_summaries.append(SubAccountSummary(
                    uid=sub.uid,
                    username=sub.username,
                    total_value_usd=sub_total,
                    spot_balances=sub_balances,
                ))
                total_subaccounts_value += sub_total

        return ExchangeAccountSummary(
            spot_balances=spot_balances,
            funding_balances=funding_balances,
            margin_balances=margin_balances,
            futures_positions=futures_positions,
            earn_positions=earn_positions,
            total_spot_usd=total_spot,
            total_funding_usd=total_funding,
            total_margin_usd=total_margin,
            total_futures_usd=total_futures,
            total_earn_usd=total_earn,
            total_value_usd=total_spot + total_funding + total_margin + total_futures + total_earn,
            total_unrealized_pnl=total_unrealized_pnl,
            position_count=position_count,
            subaccounts=subaccount_summaries,
            total_subaccounts_value_usd=total_subaccounts_value,
        )

    async def close(self) -> None:
        """
        Cleanup resources (close HTTP clients, etc).
        Override if adapter uses persistent connections.
        """
        pass


class ExchangeAdapterError(Exception):
    """Base exception for exchange adapter errors."""

    def __init__(self, message: str, exchange: str = "unknown", details: dict = None):
        self.message = message
        self.exchange = exchange
        self.details = details or {}
        super().__init__(f"[{exchange}] {message}")


class ExchangeAuthError(ExchangeAdapterError):
    """Authentication failed - invalid API key or secret."""

    pass


class ExchangeRateLimitError(ExchangeAdapterError):
    """Rate limit exceeded."""

    def __init__(self, exchange: str, retry_after: int = None):
        super().__init__(
            f"Rate limit exceeded. Retry after {retry_after}s" if retry_after else "Rate limit exceeded",
            exchange=exchange,
            details={"retry_after": retry_after},
        )
        self.retry_after = retry_after


class ExchangeAPIError(ExchangeAdapterError):
    """General API error from exchange."""

    def __init__(self, exchange: str, status_code: int, message: str):
        super().__init__(
            message,
            exchange=exchange,
            details={"status_code": status_code},
        )
        self.status_code = status_code
