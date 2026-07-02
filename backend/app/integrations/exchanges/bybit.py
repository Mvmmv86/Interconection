"""
Bybit Exchange Adapter - Integration with Bybit API v5.

Implements full support for:
- Unified Trading Account (UTA) balances
- Funding Account balances
- Linear (USDT) perpetual positions
- Inverse perpetual positions
- Earn/Staking positions
- Sub-accounts management
- Rate limit handling with exponential backoff

API Docs: https://bybit-exchange.github.io/docs/v5/intro
"""

import asyncio
import hashlib
import hmac
import logging
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from typing import List, Optional, Tuple
from urllib.parse import urlencode

import httpx


def safe_decimal(value, default: str = "0") -> Decimal:
    """
    Safely convert a value to Decimal, returning default if conversion fails.

    Handles: None, empty strings, invalid strings, etc.
    """
    if value is None or value == "":
        return Decimal(default)
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return Decimal(default)

from app.integrations.exchanges.base import (
    BaseExchangeAdapter,
    SpotBalance,
    FundingBalance,
    MarginBalance,
    FuturesPosition,
    EarnPosition,
    SubAccount,
    ExchangeAccountSummary,
    SubAccountSummary,
    ExchangeTransaction,
    ExchangeOrderRequest,
    ExchangeOrderResult,
    ExchangeOrderStatus,
    ExchangeOrderType,
    MarketCandleData,
    ExchangeAuthError,
    ExchangeRateLimitError,
    ExchangeAPIError,
)

logger = logging.getLogger(__name__)


# Common coins to query - these are the most likely to have balances
# Used when we need to query specific coins (post Jan 2025 requirement)
COMMON_COINS = [
    "BTC", "ETH", "USDT", "USDC", "SOL", "XRP", "DOGE", "ADA",
    "AVAX", "DOT", "MATIC", "LINK", "UNI", "ATOM", "LTC", "BCH",
    "APT", "ARB", "OP", "INJ", "SUI", "SEI", "TIA", "JUP",
    "PEPE", "WIF", "BONK", "SHIB", "FTM", "NEAR", "ALGO", "SAND",
]

BYBIT_KLINE_INTERVALS = {
    "1m": "1",
    "3m": "3",
    "5m": "5",
    "15m": "15",
    "30m": "30",
    "1h": "60",
    "2h": "120",
    "4h": "240",
    "6h": "360",
    "12h": "720",
    "1d": "D",
    "1w": "W",
    "1M": "M",
}

TIMEFRAME_DELTAS = {
    "1m": timedelta(minutes=1),
    "3m": timedelta(minutes=3),
    "5m": timedelta(minutes=5),
    "15m": timedelta(minutes=15),
    "30m": timedelta(minutes=30),
    "1h": timedelta(hours=1),
    "2h": timedelta(hours=2),
    "4h": timedelta(hours=4),
    "6h": timedelta(hours=6),
    "12h": timedelta(hours=12),
    "1d": timedelta(days=1),
    "1w": timedelta(days=7),
    "1M": timedelta(days=31),
}


class BybitAdapter(BaseExchangeAdapter):
    """
    Bybit Exchange Adapter using API v5.

    Bybit uses a Unified Trading Account (UTA) which combines
    spot, margin, and derivatives in a single account.

    Key Features:
    - Unified Account balance queries (with Jan 2025 coin requirement)
    - Funding Account (main wallet) support
    - Linear and Inverse perpetual positions
    - Earn/Staking positions
    - Sub-accounts support for master accounts
    - Automatic retry with exponential backoff for rate limits

    API Docs: https://bybit-exchange.github.io/docs/v5/intro
    """

    BASE_URL = "https://api.bybit.com"
    TESTNET_URL = "https://api-testnet.bybit.com"

    exchange_name = "bybit"
    supports_spot = True
    supports_margin = True  # Via unified account
    supports_futures = True
    supports_funding = True
    supports_earn = True
    supports_subaccounts = True

    def __init__(
        self,
        api_key: str,
        api_secret: str,
        testnet: bool = False,
        recv_window: int = 20000,
        max_retries: int = 3,
    ):
        """
        Initialize Bybit adapter.

        Args:
            api_key: Bybit API key
            api_secret: Bybit API secret
            testnet: Use testnet API instead of production
            recv_window: Request validity window in milliseconds
            max_retries: Maximum retries for rate-limited requests
        """
        self.api_key = api_key
        self.api_secret = api_secret
        self.base_url = self.TESTNET_URL if testnet else self.BASE_URL
        self.recv_window = str(recv_window)
        self.max_retries = max_retries
        self.client = httpx.AsyncClient(timeout=30.0)

        # Cache for prices (to avoid multiple API calls)
        self._price_cache: dict[str, dict] = {}
        self._price_cache_time: float = 0
        self._price_cache_ttl: float = 60.0  # 60 seconds cache

        # Rate limit tracking
        self._rate_limit_remaining: int = 100
        self._rate_limit_reset: int = 0

        # Time offset for clock sync (server_time - local_time)
        self._time_offset: int = 0
        self._time_synced: bool = False

    async def _sync_time(self) -> None:
        """Sync local time with Bybit server time."""
        if self._time_synced:
            return

        try:
            local_time = int(time.time() * 1000)
            response = await self.client.get(f"{self.base_url}/v5/market/time")
            data = response.json()

            if data.get("retCode") == 0:
                server_time = int(data["result"]["timeSecond"]) * 1000
                self._time_offset = server_time - local_time
                self._time_synced = True
                logger.info(f"Bybit time sync: offset={self._time_offset}ms")
        except Exception as e:
            logger.warning(f"Failed to sync time with Bybit: {e}")
            # Continue without sync, might still work

    def _get_timestamp(self) -> str:
        """Get timestamp adjusted for server time."""
        local_time = int(time.time() * 1000)
        adjusted_time = local_time + self._time_offset
        return str(adjusted_time)

    def _generate_signature(self, timestamp: str, params: dict = None, body: str = None) -> str:
        """
        Generate HMAC-SHA256 signature for Bybit API v5.

        For GET requests: timestamp + api_key + recv_window + query_string
        For POST requests: timestamp + api_key + recv_window + body
        """
        if body:
            sign_str = f"{timestamp}{self.api_key}{self.recv_window}{body}"
        else:
            param_str = urlencode(params) if params else ""
            sign_str = f"{timestamp}{self.api_key}{self.recv_window}{param_str}"

        return hmac.new(
            self.api_secret.encode("utf-8"),
            sign_str.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

    def _get_headers(self, params: dict = None, body: str = None) -> dict:
        """Generate authenticated headers for API request."""
        timestamp = self._get_timestamp()
        signature = self._generate_signature(timestamp, params, body)

        return {
            "X-BAPI-API-KEY": self.api_key,
            "X-BAPI-TIMESTAMP": timestamp,
            "X-BAPI-RECV-WINDOW": self.recv_window,
            "X-BAPI-SIGN": signature,
            "Content-Type": "application/json",
        }

    def _update_rate_limits(self, headers: dict) -> None:
        """Update rate limit tracking from response headers."""
        if "X-Bapi-Limit-Status" in headers:
            self._rate_limit_remaining = int(headers["X-Bapi-Limit-Status"])
        if "X-Bapi-Limit-Reset-Timestamp" in headers:
            self._rate_limit_reset = int(headers["X-Bapi-Limit-Reset-Timestamp"])

    async def _request(
        self,
        method: str,
        endpoint: str,
        params: dict = None,
        body: dict = None,
        signed: bool = True,
    ) -> dict:
        """
        Make authenticated request to Bybit API with automatic retry.

        Args:
            method: HTTP method (GET, POST)
            endpoint: API endpoint path
            params: Query parameters
            body: Request body for POST requests
            signed: Whether request needs authentication

        Returns:
            API response data

        Raises:
            ExchangeAuthError: Invalid credentials
            ExchangeRateLimitError: Rate limit exceeded after retries
            ExchangeAPIError: Other API errors
        """
        url = f"{self.base_url}{endpoint}"
        last_error = None

        # Sync time before first signed request
        if signed and not self._time_synced:
            await self._sync_time()

        for attempt in range(self.max_retries + 1):
            try:
                if signed:
                    if method == "GET":
                        headers = self._get_headers(params)
                    else:
                        import json
                        body_str = json.dumps(body, separators=(",", ":")) if body else ""
                        headers = self._get_headers(body=body_str)
                else:
                    headers = {"Content-Type": "application/json"}

                if method == "GET":
                    response = await self.client.get(url, params=params, headers=headers)
                else:
                    response = await self.client.post(url, content=body_str if signed else None, json=None if signed else body, headers=headers)

                # Update rate limit tracking
                self._update_rate_limits(dict(response.headers))

                data = response.json()
                ret_code = data.get("retCode", 0)

                # Success
                if ret_code == 0:
                    return data.get("result", {})

                # Auth error - no retry
                if ret_code == 10003:
                    raise ExchangeAuthError("Invalid API key", exchange=self.exchange_name)

                if ret_code == 10004:
                    raise ExchangeAuthError("Invalid signature", exchange=self.exchange_name)

                # Rate limit - retry with backoff
                if ret_code == 10006:
                    if attempt < self.max_retries:
                        wait_time = (2 ** attempt) + 0.5  # Exponential backoff
                        logger.warning(f"Rate limit hit, waiting {wait_time}s before retry {attempt + 1}")
                        await asyncio.sleep(wait_time)
                        continue
                    raise ExchangeRateLimitError(exchange=self.exchange_name)

                # Other errors
                raise ExchangeAPIError(
                    exchange=self.exchange_name,
                    status_code=ret_code,
                    message=data.get("retMsg", "Unknown error"),
                )

            except httpx.TimeoutException:
                last_error = ExchangeAPIError(
                    exchange=self.exchange_name,
                    status_code=408,
                    message="Request timeout",
                )
                if attempt < self.max_retries:
                    await asyncio.sleep(1)
                    continue

            except httpx.RequestError as e:
                last_error = ExchangeAPIError(
                    exchange=self.exchange_name,
                    status_code=500,
                    message=f"Request failed: {str(e)}",
                )
                if attempt < self.max_retries:
                    await asyncio.sleep(1)
                    continue

        if last_error:
            raise last_error
        raise ExchangeAPIError(self.exchange_name, 500, "Unknown error after retries")

    async def test_connection(self) -> bool:
        """Test API credentials by fetching account info."""
        try:
            # Try to get a single coin balance to verify credentials
            await self._request(
                "GET",
                "/v5/account/wallet-balance",
                {"accountType": "UNIFIED", "coin": "USDT"},
            )
            return True
        except ExchangeAuthError:
            return False
        except Exception as e:
            logger.error(f"Connection test failed: {e}")
            return False

    async def _get_ticker_prices(self) -> dict[str, dict]:
        """
        Get current prices for all trading pairs with caching.

        Returns dict with symbol -> {price, change_24h}
        """
        # Check cache
        now = time.time()
        if self._price_cache and (now - self._price_cache_time) < self._price_cache_ttl:
            return self._price_cache

        # Fetch spot tickers
        result = await self._request(
            "GET",
            "/v5/market/tickers",
            {"category": "spot"},
            signed=False,
        )

        prices = {}
        for ticker in result.get("list", []):
            symbol = ticker.get("symbol", "")
            # Remove USDT suffix for matching
            base_symbol = symbol.replace("USDT", "")
            prices[base_symbol] = {
                "price": safe_decimal(ticker.get("lastPrice"), "0"),
                "change_24h": safe_decimal(ticker.get("price24hPcnt"), "0") * 100,
            }

        # Add stablecoins
        prices["USDT"] = {"price": Decimal("1"), "change_24h": Decimal("0")}
        prices["USDC"] = {"price": Decimal("1"), "change_24h": Decimal("0")}
        prices["DAI"] = {"price": Decimal("1"), "change_24h": Decimal("0")}
        prices["BUSD"] = {"price": Decimal("1"), "change_24h": Decimal("0")}

        # Update cache
        self._price_cache = prices
        self._price_cache_time = now

        return prices

    async def _get_available_coins_from_all_balance(self) -> List[str]:
        """
        Get list of coins with balance by trying multiple strategies.

        The goal is to find coins that the user ACTUALLY has balance for,
        not all supported coins.

        Strategy 1: Try FUND account balance (often has real balances)
        Strategy 2: Query UNIFIED with common coins in small batches
        Strategy 3: Fallback to most common coins only
        """
        found_coins = []

        # Strategy 1: Try FUND account balance (usually has actual balances)
        try:
            result = await self._request(
                "GET",
                "/v5/asset/transfer/query-account-coins-balance",
                {"accountType": "FUND", "withBonus": "0"},
            )
            for balance in result.get("balance", []):
                wallet_balance = safe_decimal(balance.get("walletBalance"), "0")
                if wallet_balance > 0:
                    coin = balance.get("coin")
                    if coin:
                        found_coins.append(coin)
                        logger.debug(f"Found coin in FUND: {coin} = {wallet_balance}")
        except Exception as e:
            logger.debug(f"FUND balance endpoint failed: {e}")

        # Strategy 2: Query UNIFIED with small batches of common coins
        # This is more reliable because we check actual balances
        priority_coins = ["BTC", "ETH", "USDT", "USDC", "SOL", "XRP", "BNB", "DOGE", "ADA", "AVAX"]

        try:
            result = await self._request(
                "GET",
                "/v5/account/wallet-balance",
                {"accountType": "UNIFIED", "coin": ",".join(priority_coins)},
            )
            for account in result.get("list", []):
                for coin_data in account.get("coin", []):
                    coin = coin_data.get("coin", "")
                    wallet_balance = safe_decimal(coin_data.get("walletBalance"), "0")
                    if wallet_balance > 0 and coin not in found_coins:
                        found_coins.append(coin)
                        logger.debug(f"Found coin in UNIFIED: {coin} = {wallet_balance}")
        except Exception as e:
            logger.debug(f"UNIFIED priority query failed: {e}")

        if found_coins:
            logger.info(f"Found {len(found_coins)} coins with balance")
            return found_coins

        # Strategy 3: Fallback to common coins if no balance found yet
        logger.warning("No coins found, using fallback common coins list")
        return COMMON_COINS[:20]  # Return limited common coins

    async def _get_wallet_balance_batch(self, coins: List[str]) -> dict:
        """
        Get wallet balance for a batch of coins (max 10).

        Args:
            coins: List of coin symbols (max 10)

        Returns:
            API result data
        """
        if not coins:
            return {"list": []}

        return await self._request(
            "GET",
            "/v5/account/wallet-balance",
            {"accountType": "UNIFIED", "coin": ",".join(coins[:10])},
        )

    async def get_spot_balances(self) -> List[SpotBalance]:
        """
        Get spot/unified account balances.

        Updated for Jan 2025 requirement: coin parameter is now mandatory.
        Strategy: First get available coins, then fetch balances in batches of 10.
        """
        # Get coins that have balance
        available_coins = await self._get_available_coins_from_all_balance()

        if not available_coins:
            return []

        # Get prices for USD conversion
        prices = await self._get_ticker_prices()

        # Fetch balances in batches of 10
        balances = []
        for i in range(0, len(available_coins), 10):
            batch = available_coins[i:i + 10]
            result = await self._get_wallet_balance_batch(batch)

            for account in result.get("list", []):
                for coin in account.get("coin", []):
                    asset = coin.get("coin", "")
                    wallet_balance = safe_decimal(coin.get("walletBalance"), "0")
                    available = safe_decimal(coin.get("availableToWithdraw"), "0")
                    locked = wallet_balance - available

                    # Skip zero balances
                    if wallet_balance <= 0:
                        continue

                    # Get price info
                    price_info = prices.get(asset, {"price": Decimal("0"), "change_24h": Decimal("0")})
                    price_usd = price_info["price"]
                    value_usd = wallet_balance * price_usd

                    balances.append(SpotBalance(
                        asset=asset,
                        free=available,
                        locked=locked,
                        total=wallet_balance,
                        price_usd=price_usd,
                        value_usd=value_usd,
                        change_24h=price_info["change_24h"],
                    ))

        # Sort by value descending
        balances.sort(key=lambda x: x.value_usd, reverse=True)
        return balances

    async def get_funding_balances(self) -> List[FundingBalance]:
        """
        Get funding account (main wallet) balances.

        The funding account is separate from the unified trading account
        and holds funds not actively being traded.
        """
        try:
            result = await self._request(
                "GET",
                "/v5/asset/transfer/query-account-coins-balance",
                {"accountType": "FUND", "withBonus": "0"},
            )
        except ExchangeAPIError:
            return []

        prices = await self._get_ticker_prices()
        balances = []

        for balance in result.get("balance", []):
            asset = balance.get("coin", "")
            wallet_balance = safe_decimal(balance.get("walletBalance"), "0")
            transferable = safe_decimal(balance.get("transferBalance"), "0")

            if wallet_balance <= 0:
                continue

            price_info = prices.get(asset, {"price": Decimal("0"), "change_24h": Decimal("0")})
            price_usd = price_info["price"]

            balances.append(FundingBalance(
                asset=asset,
                free=transferable,
                locked=wallet_balance - transferable,
                total=wallet_balance,
                transferable=transferable,
                price_usd=price_usd,
                value_usd=wallet_balance * price_usd,
                change_24h=price_info["change_24h"],
            ))

        balances.sort(key=lambda x: x.value_usd, reverse=True)
        return balances

    async def get_margin_balances(self) -> List[MarginBalance]:
        """
        Get margin balances.

        In Bybit's Unified Account, margin is part of the same wallet.
        We check for borrowed amounts to identify margin positions.
        """
        available_coins = await self._get_available_coins_from_all_balance()

        if not available_coins:
            return []

        prices = await self._get_ticker_prices()
        margin_balances = []

        for i in range(0, len(available_coins), 10):
            batch = available_coins[i:i + 10]
            result = await self._get_wallet_balance_batch(batch)

            for account in result.get("list", []):
                for coin in account.get("coin", []):
                    borrowed = safe_decimal(coin.get("borrowAmount"), "0")

                    # Only include if there's borrowed amount (margin used)
                    if borrowed <= 0:
                        continue

                    asset = coin.get("coin", "")
                    wallet_balance = safe_decimal(coin.get("walletBalance"), "0")
                    available = safe_decimal(coin.get("availableToWithdraw"), "0")

                    price_info = prices.get(asset, {"price": Decimal("0"), "change_24h": Decimal("0")})
                    price_usd = price_info["price"]

                    margin_balances.append(MarginBalance(
                        asset=asset,
                        free=available,
                        locked=wallet_balance - available,
                        total=wallet_balance,
                        borrowed=borrowed,
                        interest=safe_decimal(coin.get("accruedInterest"), "0"),
                        net_asset=wallet_balance - borrowed,
                        price_usd=price_usd,
                        value_usd=wallet_balance * price_usd,
                        change_24h=price_info["change_24h"],
                    ))

        return margin_balances

    async def _get_positions_by_category(
        self,
        category: str,
        settle_coin: Optional[str] = None,
    ) -> List[FuturesPosition]:
        """
        Get positions for a specific category.

        Args:
            category: "linear", "inverse", or "option"
            settle_coin: Settlement currency (e.g., "USDT" for linear)

        Returns:
            List of FuturesPosition objects
        """
        params = {"category": category}
        if settle_coin:
            params["settleCoin"] = settle_coin

        try:
            result = await self._request("GET", "/v5/position/list", params)
        except ExchangeAPIError as e:
            logger.warning(f"Failed to get {category} positions: {e}")
            return []

        positions = []

        for pos in result.get("list", []):
            size = safe_decimal(pos.get("size"), "0")

            # Skip empty positions
            if size <= 0:
                continue

            side = pos.get("side", "").lower()
            entry_price = safe_decimal(pos.get("avgPrice"), "0")
            mark_price = safe_decimal(pos.get("markPrice"), "0")
            unrealized_pnl = safe_decimal(pos.get("unrealisedPnl"), "0")
            position_value = safe_decimal(pos.get("positionValue"), "0")

            # Calculate PnL percentage
            pnl_percent = Decimal("0")
            if position_value > 0:
                pnl_percent = (unrealized_pnl / position_value) * 100

            liq_price_str = pos.get("liqPrice", "")
            liq_price = safe_decimal(liq_price_str, "0") if liq_price_str else None

            # Determine settle coin from symbol
            symbol = pos.get("symbol", "")
            if category == "inverse":
                pos_settle_coin = symbol.replace("USD", "")  # BTCUSD -> BTC
            else:
                pos_settle_coin = settle_coin or "USDT"

            positions.append(FuturesPosition(
                symbol=symbol,
                side="long" if side == "buy" else "short",
                size=size,
                entry_price=entry_price,
                mark_price=mark_price,
                liquidation_price=liq_price,
                unrealized_pnl=unrealized_pnl,
                unrealized_pnl_percent=pnl_percent,
                realized_pnl=safe_decimal(pos.get("cumRealisedPnl"), "0"),
                margin=safe_decimal(pos.get("positionIM"), "0"),
                leverage=int(pos.get("leverage") or "1"),
                position_value=position_value,
                category=category,
                settle_coin=pos_settle_coin,
            ))

        return positions

    async def get_futures_positions(self) -> List[FuturesPosition]:
        """
        Get all open futures positions (linear + inverse).

        Fetches both USDT perpetual (linear) and coin-margined (inverse) positions
        in parallel for better performance.
        """
        # Fetch linear (USDT + USDC) and inverse positions in parallel
        linear_usdt_task = self._get_positions_by_category("linear", "USDT")
        linear_usdc_task = self._get_positions_by_category("linear", "USDC")
        inverse_task = self._get_positions_by_category("inverse")

        results = await asyncio.gather(linear_usdt_task, linear_usdc_task, inverse_task, return_exceptions=True)

        positions = []

        for result in results:
            if isinstance(result, Exception):
                logger.warning(f"Failed to get some positions: {result}")
                continue
            positions.extend(result)

        # Sort by position value descending
        positions.sort(key=lambda x: x.position_value, reverse=True)
        return positions

    async def get_earn_positions(self) -> List[EarnPosition]:
        """
        Get all earn/staking positions.

        Includes Flexible Savings and Fixed Staking products.
        """
        prices = await self._get_ticker_prices()
        all_positions = []

        # Fetch different earn product types
        product_types = ["FlexibleSaving", "FixedStaking"]

        for product_type in product_types:
            try:
                result = await self._request(
                    "GET",
                    "/v5/earn/position",
                    {"category": product_type},
                )

                for pos in result.get("list", []):
                    coin = pos.get("coin", "")
                    amount = safe_decimal(pos.get("amount"), "0")

                    if amount <= 0:
                        continue

                    price_info = prices.get(coin, {"price": Decimal("0"), "change_24h": Decimal("0")})

                    settlement_time = None
                    if pos.get("settlementTime"):
                        try:
                            settlement_time = datetime.fromtimestamp(
                                int(pos.get("settlementTime")) / 1000
                            )
                        except (ValueError, TypeError):
                            pass

                    # Try to get APY from various possible field names
                    apy_value = None
                    for apy_field in ["apy", "estApy", "rate", "annualRate", "apr", "estimatedApy"]:
                        raw_apy = pos.get(apy_field)
                        if raw_apy is not None:
                            apy_value = safe_decimal(raw_apy, "0")
                            # Convert to percentage if it looks like a decimal (e.g., 0.05 -> 5%)
                            if apy_value > 0 and apy_value < 1:
                                apy_value = apy_value * 100
                            break

                    all_positions.append(EarnPosition(
                        product_id=pos.get("productId", ""),
                        product_type=product_type,
                        coin=coin,
                        amount=amount,
                        total_pnl=safe_decimal(pos.get("totalPnl"), "0"),
                        claimable_yield=safe_decimal(pos.get("claimableYield"), "0"),
                        status=pos.get("status", "Active"),
                        apy=apy_value,
                        value_usd=amount * price_info["price"],
                        settlement_time=settlement_time,
                    ))

            except ExchangeAPIError as e:
                logger.warning(f"Failed to get {product_type} positions: {e}")
                continue

        return all_positions

    async def get_subaccounts(self) -> List[SubAccount]:
        """
        Get list of all sub-accounts under master account.

        Requires API key with "Account Transfer", "Subaccount Transfer",
        or "Withdrawal" permissions.
        """
        try:
            result = await self._request(
                "GET",
                "/v5/user/submembers",
                {"pageSize": "100"},
            )

            subaccounts = []
            for sub in result.get("subMembers", []):
                subaccounts.append(SubAccount(
                    uid=sub.get("uid", ""),
                    username=sub.get("username", ""),
                    member_type=int(sub.get("memberType", 1)),
                    status=int(sub.get("status", 1)),
                    account_mode=int(sub.get("accountMode", 1)),
                    remark=sub.get("remark"),
                ))

            return subaccounts

        except ExchangeAPIError as e:
            # This endpoint requires specific permissions
            logger.debug(f"Could not fetch subaccounts (may not be master account): {e}")
            return []

    async def get_subaccount_balances(self, member_id: str) -> List[SpotBalance]:
        """
        Get balances for a specific sub-account.

        Args:
            member_id: The UID of the sub-account

        Returns:
            List of SpotBalance objects for the sub-account
        """
        try:
            result = await self._request(
                "GET",
                "/v5/asset/transfer/query-account-coins-balance",
                {"accountType": "UNIFIED", "memberId": member_id, "withBonus": "0"},
            )
        except ExchangeAPIError as e:
            logger.warning(f"Failed to get subaccount {member_id} balances: {e}")
            return []

        prices = await self._get_ticker_prices()
        balances = []

        for balance in result.get("balance", []):
            asset = balance.get("coin", "")
            wallet_balance = safe_decimal(balance.get("walletBalance"), "0")
            transferable = safe_decimal(balance.get("transferBalance"), "0")

            if wallet_balance <= 0:
                continue

            price_info = prices.get(asset, {"price": Decimal("0"), "change_24h": Decimal("0")})
            price_usd = price_info["price"]

            balances.append(SpotBalance(
                asset=asset,
                free=transferable,
                locked=wallet_balance - transferable,
                total=wallet_balance,
                price_usd=price_usd,
                value_usd=wallet_balance * price_usd,
                change_24h=price_info["change_24h"],
            ))

        balances.sort(key=lambda x: x.value_usd, reverse=True)
        return balances

    async def get_deposit_history(self, limit: int = 50) -> List[ExchangeTransaction]:
        """
        Get deposit history from Bybit.

        Uses /v5/asset/deposit/query-record endpoint.
        """
        try:
            # Bybit requires both startTime and endTime, max 30-day window per request.
            # Query last 90 days in 30-day chunks.
            import time as _t
            now_ms = int(_t.time() * 1000)
            all_rows: list = []
            for chunk in range(3):  # 3 chunks of 30 days = 90 days
                end_ms = now_ms - chunk * 30 * 86400 * 1000
                start_ms = now_ms - (chunk + 1) * 30 * 86400 * 1000
                chunk_result = await self._request(
                    "GET",
                    "/v5/asset/deposit/query-record",
                    {"limit": str(min(limit, 50)), "startTime": str(start_ms), "endTime": str(end_ms)},
                )
                all_rows.extend(chunk_result.get("rows", []))
                if len(all_rows) >= limit:
                    break
            result = {"rows": all_rows[:limit]}
        except ExchangeAPIError as e:
            logger.warning(f"Failed to get deposit history: {e}")
            return []

        prices = await self._get_ticker_prices()
        transactions = []

        for record in result.get("rows", []):
            coin = record.get("coin", "")
            amount = safe_decimal(record.get("amount"), "0")
            price_info = prices.get(coin, {"price": Decimal("0")})

            # Map Bybit status to our status
            status_map = {
                "0": "pending",    # unknown
                "1": "pending",    # toConfirm
                "2": "pending",    # processing
                "3": "completed",  # success
                "4": "completed",  # deposit finished (manual review)
            }
            status = status_map.get(str(record.get("status", "3")), "completed")

            timestamp = datetime.utcnow()
            if record.get("successAt"):
                try:
                    ts_ms = int(record["successAt"])
                    timestamp = datetime.utcfromtimestamp(ts_ms / 1000)
                except (ValueError, TypeError):
                    pass

            chain_name = record.get("chain", "")
            # Normalize chain names
            chain_map = {
                "ETH": "Ethereum", "BTC": "Bitcoin", "SOL": "Solana",
                "ARBI": "Arbitrum", "MATIC": "Polygon", "OP": "Optimism",
                "AVAXC": "Avalanche", "BSC": "BSC", "BASE": "Base",
                "TRX": "Tron",
            }
            chain = chain_map.get(chain_name, chain_name)

            transactions.append(ExchangeTransaction(
                id=record.get("id", str(record.get("txIndex", ""))),
                exchange=self.exchange_name,
                type="deposit",
                coin=coin,
                amount=amount,
                fee=Decimal("0"),
                value_usd=amount * price_info["price"],
                status=status,
                tx_id=record.get("txID"),
                chain=chain,
                address=record.get("toAddress"),
                timestamp=timestamp,
            ))

        return transactions

    async def get_withdrawal_history(self, limit: int = 50) -> List[ExchangeTransaction]:
        """
        Get withdrawal history from Bybit.

        Uses /v5/asset/withdraw/query-record endpoint.
        """
        try:
            # Bybit requires both startTime and endTime, max 30-day window per request.
            import time as _tw
            now_ms_w = int(_tw.time() * 1000)
            all_rows_w: list = []
            for chunk in range(3):  # 3 chunks of 30 days = 90 days
                end_ms = now_ms_w - chunk * 30 * 86400 * 1000
                start_ms = now_ms_w - (chunk + 1) * 30 * 86400 * 1000
                chunk_result = await self._request(
                    "GET",
                    "/v5/asset/withdraw/query-record",
                    {"limit": str(min(limit, 50)), "startTime": str(start_ms), "endTime": str(end_ms)},
                )
                all_rows_w.extend(chunk_result.get("rows", []))
                if len(all_rows_w) >= limit:
                    break
            result = {"rows": all_rows_w[:limit]}
        except ExchangeAPIError as e:
            logger.warning(f"Failed to get withdrawal history: {e}")
            return []

        prices = await self._get_ticker_prices()
        transactions = []

        for record in result.get("rows", []):
            coin = record.get("coin", "")
            amount = safe_decimal(record.get("amount"), "0")
            fee = safe_decimal(record.get("withdrawFee", record.get("fee", "0")), "0")
            price_info = prices.get(coin, {"price": Decimal("0")})

            # Map Bybit withdrawal status
            status_map = {
                "SecurityCheck": "pending",
                "Pending": "pending",
                "success": "completed",
                "CancelByUser": "cancelled",
                "Reject": "failed",
                "Fail": "failed",
                "BlockchainConfirmed": "completed",
            }
            raw_status = record.get("status", "success")
            status = status_map.get(raw_status, "completed")

            timestamp = datetime.utcnow()
            if record.get("createTime"):
                try:
                    ts_ms = int(record["createTime"])
                    timestamp = datetime.utcfromtimestamp(ts_ms / 1000)
                except (ValueError, TypeError):
                    pass

            chain_name = record.get("chain", "")
            chain_map = {
                "ETH": "Ethereum", "BTC": "Bitcoin", "SOL": "Solana",
                "ARBI": "Arbitrum", "MATIC": "Polygon", "OP": "Optimism",
                "AVAXC": "Avalanche", "BSC": "BSC", "BASE": "Base",
                "TRX": "Tron",
            }
            chain = chain_map.get(chain_name, chain_name)

            transactions.append(ExchangeTransaction(
                id=record.get("withdrawId", ""),
                exchange=self.exchange_name,
                type="withdrawal",
                coin=coin,
                amount=amount,
                fee=fee,
                value_usd=amount * price_info["price"],
                status=status,
                tx_id=record.get("txID"),
                chain=chain,
                address=record.get("toAddress"),
                timestamp=timestamp,
            ))

        return transactions

    async def get_internal_transfers(self, limit: int = 50) -> List[ExchangeTransaction]:
        """
        Get internal transfer history from Bybit.

        Tries both universal transfers (intra-account) and inter-account transfers.
        """
        account_type_map = {
            "UNIFIED": "Unified Trading",
            "SPOT": "Spot",
            "FUND": "Funding",
            "CONTRACT": "Derivatives",
            "OPTION": "Options",
        }

        prices = await self._get_ticker_prices()
        transactions = []

        # 1) Try universal transfer list (intra-account transfers: UNIFIED <-> FUND etc.)
        try:
            result = await self._request(
                "GET",
                "/v5/asset/transfer/query-universal-transfer-list",
                {"limit": str(min(limit, 50))},
            )

            for record in result.get("list", []):
                coin = record.get("coin", "")
                amount = safe_decimal(record.get("amount"), "0")
                price_info = prices.get(coin, {"price": Decimal("0")})

                from_account = account_type_map.get(
                    record.get("fromAccountType", ""), record.get("fromAccountType", "")
                )
                to_account = account_type_map.get(
                    record.get("toAccountType", ""), record.get("toAccountType", "")
                )

                status_map = {"SUCCESS": "completed", "PENDING": "pending", "FAILED": "failed"}
                status = status_map.get(record.get("status", "SUCCESS"), "completed")

                timestamp = datetime.utcnow()
                if record.get("timestamp"):
                    try:
                        ts_ms = int(record["timestamp"])
                        timestamp = datetime.utcfromtimestamp(ts_ms / 1000)
                    except (ValueError, TypeError):
                        pass

                transactions.append(ExchangeTransaction(
                    id=record.get("transferId", ""),
                    exchange=self.exchange_name,
                    type="internal_transfer",
                    coin=coin,
                    amount=amount,
                    fee=Decimal("0"),
                    value_usd=amount * price_info["price"],
                    status=status,
                    from_account=from_account,
                    to_account=to_account,
                    timestamp=timestamp,
                ))
        except ExchangeAPIError as e:
            logger.debug(f"Universal transfers not available: {e}")

        # 2) Try inter-account transfers (between sub-accounts)
        try:
            result = await self._request(
                "GET",
                "/v5/asset/transfer/query-inter-transfer-list",
                {"limit": str(min(limit, 50))},
            )

            for record in result.get("list", []):
                coin = record.get("coin", "")
                amount = safe_decimal(record.get("amount"), "0")
                price_info = prices.get(coin, {"price": Decimal("0")})

                from_account = account_type_map.get(
                    record.get("fromAccountType", ""), record.get("fromAccountType", "")
                )
                to_account = account_type_map.get(
                    record.get("toAccountType", ""), record.get("toAccountType", "")
                )

                status_map = {"SUCCESS": "completed", "PENDING": "pending", "FAILED": "failed"}
                status = status_map.get(record.get("status", "SUCCESS"), "completed")

                timestamp = datetime.utcnow()
                if record.get("timestamp"):
                    try:
                        ts_ms = int(record["timestamp"])
                        timestamp = datetime.utcfromtimestamp(ts_ms / 1000)
                    except (ValueError, TypeError):
                        pass

                transactions.append(ExchangeTransaction(
                    id=record.get("transferId", ""),
                    exchange=self.exchange_name,
                    type="internal_transfer",
                    coin=coin,
                    amount=amount,
                    fee=Decimal("0"),
                    value_usd=amount * price_info["price"],
                    status=status,
                    from_account=from_account,
                    to_account=to_account,
                    timestamp=timestamp,
                ))
        except ExchangeAPIError as e:
            logger.debug(f"Inter-account transfers not available: {e}")

        return transactions

    async def get_trade_history(
        self,
        category: str = "spot",
        limit: int = 200,
        days: int = 365,
    ) -> List[dict]:
        """
        Get trade/execution history from Bybit.

        Args:
            category: "spot", "linear", or "inverse"
            limit: Max trades to return per request
            days: Number of days to look back (default: 365 for 1 year)

        Returns:
            List of trade records with: symbol, side, qty, price, timestamp
        """
        import time as _t

        all_trades = []
        now_ms = int(_t.time() * 1000)

        # Query in 7-day chunks (Bybit limitation)
        chunk_days = 7
        num_chunks = (days // chunk_days) + 1

        logger.info(f"Fetching trade history for {days} days ({num_chunks} chunks)")

        for chunk in range(num_chunks):
            end_ms = now_ms - chunk * chunk_days * 86400 * 1000
            start_ms = now_ms - (chunk + 1) * chunk_days * 86400 * 1000

            try:
                result = await self._request(
                    "GET",
                    "/v5/execution/list",
                    {
                        "category": category,
                        "limit": str(min(limit, 100)),
                        "startTime": str(start_ms),
                        "endTime": str(end_ms),
                    },
                )

                trades = result.get("list", [])
                all_trades.extend(trades)

                # Log progress every 10 chunks
                if chunk > 0 and chunk % 10 == 0:
                    logger.debug(f"Fetched {len(all_trades)} trades so far (chunk {chunk}/{num_chunks})")

            except ExchangeAPIError as e:
                logger.warning(f"Failed to get trade history chunk {chunk}: {e}")
                continue

        logger.info(f"Total trades fetched: {len(all_trades)}")
        return all_trades

    def calculate_cost_basis(self, trades: List[dict]) -> dict[str, dict]:
        """
        Calculate average cost basis per coin from trade history.

        Uses FIFO (First-In, First-Out) to track cost basis.

        Args:
            trades: List of trade records from get_trade_history

        Returns:
            Dict of coin -> {avg_price, total_cost, total_qty}
        """
        # Group trades by base asset
        holdings: dict[str, dict] = {}

        for trade in trades:
            symbol = trade.get("symbol", "")
            side = trade.get("side", "").lower()
            qty = safe_decimal(trade.get("execQty") or trade.get("qty"), "0")
            price = safe_decimal(trade.get("execPrice") or trade.get("price"), "0")

            if qty <= 0:
                continue

            # Extract base asset (e.g., BTCUSDT -> BTC)
            base_asset = symbol.replace("USDT", "").replace("USDC", "").replace("USD", "")

            if not base_asset:
                continue

            if base_asset not in holdings:
                holdings[base_asset] = {
                    "total_qty": Decimal("0"),
                    "total_cost": Decimal("0"),
                    "avg_price": Decimal("0"),
                }

            h = holdings[base_asset]

            if side == "buy":
                # Add to holdings with new cost
                h["total_cost"] += qty * price
                h["total_qty"] += qty
            elif side == "sell":
                # Remove from holdings (reduce cost proportionally)
                if h["total_qty"] > 0:
                    avg_cost = h["total_cost"] / h["total_qty"]
                    h["total_cost"] -= qty * avg_cost
                    h["total_qty"] -= qty
                    # Ensure non-negative
                    h["total_cost"] = max(h["total_cost"], Decimal("0"))
                    h["total_qty"] = max(h["total_qty"], Decimal("0"))

            # Update average price
            if h["total_qty"] > 0:
                h["avg_price"] = h["total_cost"] / h["total_qty"]
            else:
                h["avg_price"] = Decimal("0")

        return holdings

    def _normalize_order_category(self, category: str) -> str:
        normalized = (category or "spot").lower()
        if normalized in {"futures", "future", "swap", "perp", "perpetual"}:
            return "linear"
        if normalized in {"spot", "linear", "inverse", "option"}:
            return normalized
        return "spot"

    def _normalize_order_status(self, status: str | None) -> ExchangeOrderStatus:
        status_value = (status or "").lower()
        if status_value in {"new", "created", "untriggered", "active"}:
            return ExchangeOrderStatus.OPEN
        if status_value in {"partiallyfilled", "partially_filled", "partialfilled"}:
            return ExchangeOrderStatus.PARTIALLY_FILLED
        if status_value in {"filled"}:
            return ExchangeOrderStatus.FILLED
        if status_value in {"cancelled", "canceled", "deactivated"}:
            return ExchangeOrderStatus.CANCELLED
        if status_value in {"rejected"}:
            return ExchangeOrderStatus.REJECTED
        return ExchangeOrderStatus.SUBMITTED

    async def place_order(self, order: ExchangeOrderRequest) -> ExchangeOrderResult:
        """
        Place a Bybit order.

        Requires an API key with trade permission. The caller must provide a
        deterministic client_order_id when orders are generated by bots so
        retries do not create duplicate exchange orders.
        """
        category = self._normalize_order_category(order.category)
        symbol = order.symbol.replace("-", "").replace("/", "").upper()
        payload = {
            "category": category,
            "symbol": symbol,
            "side": "Buy" if order.side.value == "buy" else "Sell",
            "orderType": "Market" if order.order_type == ExchangeOrderType.MARKET else "Limit",
            "qty": str(order.quantity),
        }

        if order.order_type == ExchangeOrderType.LIMIT:
            if order.price is None or order.price <= 0:
                raise ExchangeAPIError(self.exchange_name, 400, "Limit orders require a positive price")
            payload["price"] = str(order.price)
            payload["timeInForce"] = order.time_in_force or "GTC"

        if order.client_order_id:
            payload["orderLinkId"] = order.client_order_id
        if category != "spot":
            payload["reduceOnly"] = order.reduce_only

        for key, value in order.metadata.items():
            if key not in payload and value is not None:
                payload[key] = value

        result = await self._request("POST", "/v5/order/create", body=payload)
        return ExchangeOrderResult(
            exchange=self.exchange_name,
            order_id=result.get("orderId"),
            client_order_id=result.get("orderLinkId") or order.client_order_id,
            symbol=symbol,
            side=order.side,
            order_type=order.order_type,
            status=ExchangeOrderStatus.SUBMITTED,
            raw_response=result,
        )

    async def cancel_order(
        self,
        symbol: str,
        order_id: str | None = None,
        client_order_id: str | None = None,
        category: str = "spot",
    ) -> ExchangeOrderResult:
        """Cancel a Bybit order by exchange order id or client order id."""
        normalized_category = self._normalize_order_category(category)
        normalized_symbol = symbol.replace("-", "").replace("/", "").upper()
        if not order_id and not client_order_id:
            raise ExchangeAPIError(self.exchange_name, 400, "order_id or client_order_id is required")

        payload = {
            "category": normalized_category,
            "symbol": normalized_symbol,
        }
        if order_id:
            payload["orderId"] = order_id
        if client_order_id:
            payload["orderLinkId"] = client_order_id

        result = await self._request("POST", "/v5/order/cancel", body=payload)
        return ExchangeOrderResult(
            exchange=self.exchange_name,
            order_id=result.get("orderId") or order_id,
            client_order_id=result.get("orderLinkId") or client_order_id,
            symbol=normalized_symbol,
            side=None,
            order_type=ExchangeOrderType.MARKET,
            status=ExchangeOrderStatus.CANCELLED,
            raw_response=result,
        )

    async def get_order(
        self,
        symbol: str,
        order_id: str | None = None,
        client_order_id: str | None = None,
        category: str = "spot",
    ) -> ExchangeOrderResult:
        """Fetch Bybit order status."""
        normalized_category = self._normalize_order_category(category)
        normalized_symbol = symbol.replace("-", "").replace("/", "").upper()
        params = {
            "category": normalized_category,
            "symbol": normalized_symbol,
        }
        if order_id:
            params["orderId"] = order_id
        if client_order_id:
            params["orderLinkId"] = client_order_id

        result = await self._request("GET", "/v5/order/realtime", params=params)
        orders = result.get("list", []) if isinstance(result, dict) else []
        order_data = orders[0] if orders else {}
        side = str(order_data.get("side") or "Buy").lower()
        order_type = str(order_data.get("orderType") or "Market").lower()

        return ExchangeOrderResult(
            exchange=self.exchange_name,
            order_id=order_data.get("orderId") or order_id,
            client_order_id=order_data.get("orderLinkId") or client_order_id,
            symbol=order_data.get("symbol") or normalized_symbol,
            side="sell" if side == "sell" else "buy",
            order_type=ExchangeOrderType.LIMIT if order_type == "limit" else ExchangeOrderType.MARKET,
            status=self._normalize_order_status(order_data.get("orderStatus")),
            raw_response=order_data,
        )

    def _market_symbol(self, symbol: str) -> str:
        normalized = symbol.replace("-", "").replace("/", "").upper()
        if normalized.endswith(("USDT", "USDC", "USD")):
            return normalized
        return f"{normalized}USDT"

    def _market_category(self, category: str) -> str:
        category_value = (category or "spot").lower()
        if category_value in {"swap", "future", "futures", "linear"}:
            return "linear"
        if category_value == "inverse":
            return "inverse"
        return "spot"

    async def get_ohlcv_candles(
        self,
        symbol: str,
        timeframe: str = "1h",
        limit: int = 200,
        category: str = "spot",
    ) -> List[MarketCandleData]:
        """Fetch public Bybit OHLCV candles using v5 market kline."""
        normalized_timeframe = timeframe if timeframe in BYBIT_KLINE_INTERVALS else "1h"
        interval = BYBIT_KLINE_INTERVALS[normalized_timeframe]
        delta = TIMEFRAME_DELTAS[normalized_timeframe]
        normalized_symbol = self._market_symbol(symbol)
        result = await self._request(
            "GET",
            "/v5/market/kline",
            params={
                "category": self._market_category(category),
                "symbol": normalized_symbol,
                "interval": interval,
                "limit": max(1, min(int(limit or 200), 1000)),
            },
            signed=False,
        )
        rows = result.get("list", []) if isinstance(result, dict) else []
        now = datetime.now(timezone.utc)
        candles: List[MarketCandleData] = []
        for row in rows:
            if not isinstance(row, list) or len(row) < 6:
                continue
            open_time = datetime.fromtimestamp(int(row[0]) / 1000, tz=timezone.utc)
            close_time = open_time + delta
            candles.append(
                MarketCandleData(
                    exchange=self.exchange_name,
                    symbol=normalized_symbol,
                    timeframe=normalized_timeframe,
                    open_time=open_time,
                    close_time=close_time,
                    open=safe_decimal(row[1]),
                    high=safe_decimal(row[2]),
                    low=safe_decimal(row[3]),
                    close=safe_decimal(row[4]),
                    volume=safe_decimal(row[5]),
                    quote_volume=safe_decimal(row[6]) if len(row) > 6 else Decimal("0"),
                    trade_count=None,
                    is_closed=close_time <= now,
                    raw_response={"row": row},
                )
            )
        return sorted(candles, key=lambda candle: candle.open_time)

    async def get_account_summary(self, include_subaccounts: bool = False) -> ExchangeAccountSummary:
        """
        Get complete account summary optimized for Bybit.

        Fetches all data in parallel for better performance.

        Args:
            include_subaccounts: Whether to include sub-account data

        Returns:
            ExchangeAccountSummary with all account data
        """
        # Fetch all data in parallel
        tasks = [
            self.get_spot_balances(),
            self.get_funding_balances(),
            self.get_margin_balances(),
            self.get_futures_positions(),
            self.get_earn_positions(),
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results, using empty lists for failures
        spot_balances = results[0] if not isinstance(results[0], Exception) else []
        funding_balances = results[1] if not isinstance(results[1], Exception) else []
        margin_balances = results[2] if not isinstance(results[2], Exception) else []
        futures_positions = results[3] if not isinstance(results[3], Exception) else []
        earn_positions = results[4] if not isinstance(results[4], Exception) else []

        # Log any errors
        task_names = ["spot", "funding", "margin", "futures", "earn"]
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.warning(f"Failed to get {task_names[i]} data: {result}")

        # Calculate totals
        total_spot = sum(b.value_usd for b in spot_balances)
        total_funding = sum(b.value_usd for b in funding_balances)
        total_margin = sum(b.value_usd for b in margin_balances)
        total_futures = sum(p.margin + p.unrealized_pnl for p in futures_positions)
        total_earn = sum(p.value_usd for p in earn_positions)
        total_unrealized_pnl = sum(p.unrealized_pnl for p in futures_positions)

        # Position count
        position_count = (
            len(spot_balances) +
            len(funding_balances) +
            len(futures_positions) +
            len(earn_positions)
        )

        # Subaccounts
        subaccount_summaries = []
        total_subaccounts_value = Decimal("0")

        if include_subaccounts:
            subaccounts = await self.get_subaccounts()
            for sub in subaccounts:
                if sub.status != 1:  # Skip non-active subaccounts
                    continue
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
        """Close HTTP client."""
        await self.client.aclose()
