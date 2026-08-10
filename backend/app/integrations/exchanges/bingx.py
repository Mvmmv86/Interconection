"""
BingX Exchange Adapter.

Integration for Connectcoin:
- Spot balances
- USDT perpetual futures balances/positions
- Deposit, withdrawal and internal transfer history

Order placement exists as a low-level adapter capability. Bot live trading stays
blocked until the execution engine has reconciliation, idempotency and operator
approvals wired end-to-end.
"""

import asyncio
import hashlib
import hmac
import logging
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from typing import Any
from urllib.parse import urlencode

import httpx

from app.integrations.exchanges.base import (
    BaseExchangeAdapter,
    ExchangeAccountSummary,
    ExchangeAPIError,
    ExchangeAuthError,
    ExchangeOrderRequest,
    ExchangeOrderResult,
    ExchangeOrderSide,
    ExchangeOrderStatus,
    ExchangeOrderType,
    ExchangeRateLimitError,
    ExchangeTransaction,
    FundingBalance,
    FuturesPosition,
    MarginBalance,
    MarketCandleData,
    SpotBalance,
)

logger = logging.getLogger(__name__)


STABLECOIN_PRICES = {
    "USDT": {"price": Decimal("1"), "change_24h": Decimal("0")},
    "USDC": {"price": Decimal("1"), "change_24h": Decimal("0")},
    "DAI": {"price": Decimal("1"), "change_24h": Decimal("0")},
    "BUSD": {"price": Decimal("1"), "change_24h": Decimal("0")},
    "FDUSD": {"price": Decimal("1"), "change_24h": Decimal("0")},
}

BINGX_FUTURES_ACCOUNT_TYPES = {"usdtmperp", "stdfutures", "coinmperp"}
BINGX_SPOT_FUND_ACCOUNT_TYPES = {"spot", "sopt"}

BINGX_KLINE_INTERVALS = {
    "1m": "1m",
    "3m": "3m",
    "5m": "5m",
    "15m": "15m",
    "30m": "30m",
    "1h": "1h",
    "2h": "2h",
    "4h": "4h",
    "6h": "6h",
    "12h": "12h",
    "1d": "1d",
    "1w": "1w",
    "1M": "1M",
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


def safe_decimal(value: Any, default: str = "0") -> Decimal:
    """Convert arbitrary exchange payload values to Decimal safely."""
    if value is None or value == "":
        return Decimal(default)
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return Decimal(default)


def _as_list(payload: Any) -> list[dict]:
    """Normalize BingX list payload variants without raising."""
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict):
        for key in ("list", "rows", "data", "balances", "positions", "orders"):
            value = payload.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
    return []


class BingXAdapter(BaseExchangeAdapter):
    """BingX read-only adapter using the Open API."""

    BASE_URL = "https://open-api.bingx.com"

    exchange_name = "bingx"
    supports_spot = True
    supports_margin = True
    supports_futures = True
    supports_funding = False
    supports_earn = False
    supports_subaccounts = False

    def __init__(
        self,
        api_key: str,
        api_secret: str,
        recv_window: int = 5000,
        max_retries: int = 3,
    ) -> None:
        self.api_key = api_key
        self.api_secret = api_secret
        self.recv_window = recv_window
        self.max_retries = max_retries
        self.client = httpx.AsyncClient(timeout=30.0)

        # Per-adapter request pacing. The platform-level race guard already
        # serializes sync for the same exchange; this lock prevents the adapter
        # itself from bursting private BingX endpoints during one sync.
        self._request_lock = asyncio.Lock()
        self._last_private_request_at = 0.0
        self._private_min_interval = 0.22  # ~4.5 req/s, below 5 req/s private limits

        self._price_cache: dict[str, dict[str, Decimal]] = {}
        self._price_cache_time = 0.0
        self._price_cache_ttl = 60.0
        self._account_balance_cache: list[dict] = []
        self._account_balance_cache_time = 0.0
        self._account_balance_cache_ttl = 30.0

    def _timestamp(self) -> int:
        return int(time.time() * 1000)

    def _normalize_symbol(self, symbol: str) -> str:
        return symbol.replace("-", "").replace("_", "").replace("/", "").upper()

    def _base_asset_from_pair(self, symbol: str) -> str:
        normalized = self._normalize_symbol(symbol)
        for quote in ("USDT", "USDC", "BUSD", "FDUSD", "USD"):
            if normalized.endswith(quote):
                return normalized[: -len(quote)]
        return normalized

    def _bingx_symbol(self, symbol: str, category: str = "spot") -> str:
        _ = category
        raw = symbol.upper().replace("/", "-").replace("_", "-")
        if "-" in raw:
            return raw
        for quote in ("USDT", "USDC", "BUSD", "FDUSD", "USD"):
            if raw.endswith(quote) and len(raw) > len(quote):
                base = raw[: -len(quote)]
                return f"{base}-{quote}"
        return raw

    def _sign(self, params: dict[str, Any]) -> str:
        query = self._canonical_params(params)
        return hmac.new(
            self.api_secret.encode("utf-8"),
            query.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

    def _canonical_params(self, params: dict[str, Any]) -> str:
        """Build BingX canonical query string before URL encoding."""
        return "&".join(
            f"{key}={params[key]}"
            for key in sorted(params)
            if params[key] is not None
        )

    def _encoded_params(self, params: dict[str, Any]) -> str:
        """Encode query values only for the final request URL/body."""
        return urlencode(
            [(key, value) for key, value in sorted(params.items()) if value is not None],
            doseq=False,
        )

    async def _pace_private_request(self) -> None:
        async with self._request_lock:
            elapsed = time.monotonic() - self._last_private_request_at
            if elapsed < self._private_min_interval:
                await asyncio.sleep(self._private_min_interval - elapsed)
            self._last_private_request_at = time.monotonic()

    def _extract_data(self, payload: Any) -> Any:
        if isinstance(payload, dict) and "data" in payload:
            return payload["data"]
        return payload

    def _is_success(self, payload: Any) -> bool:
        if not isinstance(payload, dict):
            return True
        code = payload.get("code")
        if code is None:
            code = payload.get("retCode")
        return str(code) in {"0", "None"} or code is None

    def _api_message(self, payload: Any) -> str:
        if not isinstance(payload, dict):
            return "Unknown BingX API error"
        return str(payload.get("msg") or payload.get("message") or payload.get("retMsg") or "Unknown BingX API error")

    def _raise_for_bingx_error(self, payload: Any) -> None:
        message = self._api_message(payload)
        lower_message = message.lower()
        code = str(payload.get("code") if isinstance(payload, dict) else "")

        if any(token in lower_message for token in ("signature", "api key", "apikey", "permission", "unauthorized")):
            raise ExchangeAuthError(message, exchange=self.exchange_name)
        if code in {"100001", "100202", "80014"}:
            raise ExchangeAuthError(message, exchange=self.exchange_name)
        if "rate" in lower_message or "too many" in lower_message or code in {"100410", "100421"}:
            raise ExchangeRateLimitError(exchange=self.exchange_name)
        try:
            status_code = int(code)
        except (TypeError, ValueError):
            status_code = 400
        raise ExchangeAPIError(exchange=self.exchange_name, status_code=status_code, message=message)

    async def _request(
        self,
        method: str,
        endpoint: str,
        params: dict[str, Any] | None = None,
        signed: bool = True,
    ) -> Any:
        params = dict(params or {})
        url = f"{self.BASE_URL}{endpoint}"
        last_error: Exception | None = None

        for attempt in range(self.max_retries + 1):
            try:
                request_params = dict(params)
                headers = {"Content-Type": "application/json"}

                if signed:
                    await self._pace_private_request()
                    request_params.setdefault("timestamp", self._timestamp())
                    request_params.setdefault("recvWindow", self.recv_window)
                    request_params["signature"] = self._sign(request_params)
                    headers["X-BX-APIKEY"] = self.api_key
                    headers["X-SOURCE-KEY"] = "BX-AI-SKILL"
                else:
                    headers["X-SOURCE-KEY"] = "BX-AI-SKILL"

                request_kwargs: dict[str, Any] = {"headers": headers}
                request_url = url
                if signed:
                    encoded_params = self._encoded_params(request_params)
                    if method.upper() == "POST":
                        headers["Content-Type"] = "application/x-www-form-urlencoded"
                        request_kwargs["content"] = encoded_params
                    else:
                        request_url = f"{url}?{encoded_params}"
                else:
                    request_kwargs["params"] = request_params

                response = await self.client.request(
                    method,
                    request_url,
                    **request_kwargs,
                )

                if response.status_code == 429:
                    if attempt < self.max_retries:
                        await asyncio.sleep((2**attempt) + 0.25)
                        continue
                    raise ExchangeRateLimitError(exchange=self.exchange_name)
                if response.status_code in {401, 403}:
                    raise ExchangeAuthError("Invalid or unauthorized BingX API credentials", exchange=self.exchange_name)
                if response.status_code >= 400:
                    raise ExchangeAPIError(
                        exchange=self.exchange_name,
                        status_code=response.status_code,
                        message=response.text[:500],
                    )

                payload = response.json()
                if self._is_success(payload):
                    return self._extract_data(payload)

                self._raise_for_bingx_error(payload)

            except ExchangeRateLimitError:
                if attempt < self.max_retries:
                    await asyncio.sleep((2**attempt) + 0.25)
                    continue
                raise
            except (httpx.TimeoutException, httpx.RequestError) as exc:
                last_error = exc
                if attempt < self.max_retries:
                    await asyncio.sleep((2**attempt) + 0.25)
                    continue
                break

        raise ExchangeAPIError(
            exchange=self.exchange_name,
            status_code=500,
            message=f"Request failed: {last_error}",
        )

    async def test_connection(self) -> bool:
        """Test credentials against spot first, then futures as fallback."""
        spot_error: Exception | None = None
        try:
            await self._request("GET", "/openApi/spot/v1/account/balance")
            return True
        except Exception as exc:
            spot_error = exc
            logger.debug("BingX spot connection test failed, trying futures: %s", spot_error)

        futures_error: Exception | None = None
        try:
            await self._request("GET", "/openApi/swap/v3/user/balance")
            return True
        except Exception as exc:
            futures_error = exc
            logger.warning("BingX connection test failed: spot=%s futures=%s", spot_error, futures_error)

        for error in (futures_error, spot_error):
            if isinstance(error, ExchangeAuthError):
                raise error
        raise ExchangeAPIError(
            exchange=self.exchange_name,
            status_code=502,
            message=f"BingX connection test failed: spot={spot_error}; futures={futures_error}",
        )

    async def _get_ticker_prices(self) -> dict[str, dict[str, Decimal]]:
        """Fetch spot/futures ticker prices once per sync and cache them."""
        now = time.time()
        if self._price_cache and (now - self._price_cache_time) < self._price_cache_ttl:
            return self._price_cache

        prices: dict[str, dict[str, Decimal]] = dict(STABLECOIN_PRICES)

        async def load_spot_tickers() -> None:
            try:
                payload = await self._request("GET", "/openApi/spot/v1/ticker/24hr", signed=False)
                for ticker in _as_list(payload):
                    symbol = str(ticker.get("symbol") or ticker.get("s") or "")
                    base = self._base_asset_from_pair(symbol)
                    if not base:
                        continue
                    price = safe_decimal(ticker.get("lastPrice") or ticker.get("last") or ticker.get("c"), "0")
                    change = safe_decimal(ticker.get("priceChangePercent") or ticker.get("priceChangePercent24h"), "0")
                    if price > 0:
                        prices[base] = {"price": price, "change_24h": change}
            except Exception as exc:
                logger.debug("Failed to load BingX spot tickers: %s", exc)

        async def load_futures_tickers() -> None:
            try:
                payload = await self._request("GET", "/openApi/swap/v2/quote/ticker", signed=False)
                for ticker in _as_list(payload):
                    symbol = str(ticker.get("symbol") or "")
                    base = self._base_asset_from_pair(symbol)
                    if not base or base in prices:
                        continue
                    price = safe_decimal(ticker.get("lastPrice") or ticker.get("last") or ticker.get("close"), "0")
                    change = safe_decimal(ticker.get("priceChangePercent") or ticker.get("priceChangePercent24h"), "0")
                    if price > 0:
                        prices[base] = {"price": price, "change_24h": change}
            except Exception as exc:
                logger.debug("Failed to load BingX futures tickers: %s", exc)

        await asyncio.gather(load_spot_tickers(), load_futures_tickers())

        self._price_cache = prices
        self._price_cache_time = now
        return prices

    async def _get_all_account_balances(self) -> list[dict]:
        """
        Fetch BingX account-level USDT balances.

        BingX can return zero balances from the detailed spot endpoint while
        the aggregated account endpoint exposes the real spot USDT equivalent
        under accountType=sopt. We use this only as a fallback to avoid
        double-counting detailed asset balances.
        """
        now = time.time()
        if self._account_balance_cache and (now - self._account_balance_cache_time) < self._account_balance_cache_ttl:
            return self._account_balance_cache

        try:
            payload = await self._request("GET", "/openApi/account/v1/allAccountBalance")
        except Exception as exc:
            logger.debug("Failed to load BingX aggregated account balances: %s", exc)
            return []

        self._account_balance_cache = _as_list(payload)
        self._account_balance_cache_time = now
        return self._account_balance_cache

    async def _get_spot_usdt_equivalent(self) -> Decimal:
        total = Decimal("0")
        for account in await self._get_all_account_balances():
            account_type = str(account.get("accountType") or "").lower()
            if account_type in {"spot", "sopt"}:
                total += safe_decimal(account.get("usdtBalance"), "0")
        return total

    async def get_spot_balances(self) -> list[SpotBalance]:
        """Get non-zero spot balances."""
        payload = await self._request("GET", "/openApi/spot/v1/account/balance")
        balances_payload = _as_list(payload)
        if isinstance(payload, dict) and isinstance(payload.get("balances"), list):
            balances_payload = _as_list(payload.get("balances"))

        prices = await self._get_ticker_prices()
        balances: list[SpotBalance] = []

        for item in balances_payload:
            asset = str(item.get("asset") or item.get("coin") or "").upper()
            if not asset:
                continue

            free = safe_decimal(item.get("free") or item.get("available") or item.get("availableBalance"), "0")
            locked = safe_decimal(item.get("locked") or item.get("freeze") or item.get("frozen"), "0")
            total = safe_decimal(item.get("total") or item.get("balance"), "0")
            if total <= 0:
                total = free + locked
            if total <= 0:
                continue

            price_info = prices.get(asset, {"price": Decimal("0"), "change_24h": Decimal("0")})
            price = price_info["price"]
            balances.append(
                SpotBalance(
                    asset=asset,
                    account_type="spot_fund",
                    free=free,
                    locked=locked,
                    total=total,
                    price_usd=price,
                    value_usd=total * price,
                    change_24h=price_info["change_24h"],
                )
            )

        spot_usdt_equivalent = await self._get_spot_usdt_equivalent()
        if spot_usdt_equivalent > 0:
            existing_usdt = next((balance for balance in balances if balance.asset == "USDT"), None)
            if existing_usdt and len(balances) == 1 and existing_usdt.value_usd < spot_usdt_equivalent:
                existing_usdt.free = spot_usdt_equivalent
                existing_usdt.locked = Decimal("0")
                existing_usdt.total = spot_usdt_equivalent
                existing_usdt.price_usd = Decimal("1")
                existing_usdt.value_usd = spot_usdt_equivalent
                existing_usdt.change_24h = Decimal("0")
            elif not balances:
                balances.append(
                    SpotBalance(
                        asset="USDT",
                        account_type="spot_fund",
                        free=spot_usdt_equivalent,
                        locked=Decimal("0"),
                        total=spot_usdt_equivalent,
                        price_usd=Decimal("1"),
                        value_usd=spot_usdt_equivalent,
                        change_24h=Decimal("0"),
                    )
                )

        balances.sort(key=lambda balance: balance.value_usd, reverse=True)
        return balances

    def _account_records_from_balance_payload(self, payload: Any) -> list[dict]:
        if isinstance(payload, dict):
            for key in ("balance", "balances", "list", "rows", "data"):
                value = payload.get(key)
                if isinstance(value, dict):
                    return [value]
                if isinstance(value, list):
                    return [item for item in value if isinstance(item, dict)]
            if any(
                key in payload
                for key in (
                    "asset",
                    "coin",
                    "currency",
                    "equity",
                    "balance",
                    "walletBalance",
                    "accountEquity",
                    "marginBalance",
                )
            ):
                return [payload]
        return _as_list(payload)

    async def get_futures_balances(self) -> list[FundingBalance]:
        """Get BingX futures account equity without treating notional as balance."""
        balances: list[FundingBalance] = []

        try:
            payload = await self._request("GET", "/openApi/swap/v3/user/balance")
        except Exception as exc:
            logger.debug("Failed to load BingX futures account balance: %s", exc)
            payload = None

        for item in self._account_records_from_balance_payload(payload):
            asset = str(item.get("asset") or item.get("coin") or item.get("currency") or "USDT").upper()
            equity = safe_decimal(
                item.get("equity")
                or item.get("accountEquity")
                or item.get("marginBalance")
                or item.get("balance")
                or item.get("walletBalance"),
                "0",
            )
            if equity <= 0:
                continue

            available = safe_decimal(
                item.get("availableMargin")
                or item.get("availableBalance")
                or item.get("available")
                or item.get("free"),
                "0",
            )
            locked = max(equity - available, Decimal("0"))
            balances.append(
                FundingBalance(
                    asset=asset,
                    account_type="futures_balance",
                    free=available if available > 0 else equity,
                    locked=locked,
                    total=equity,
                    transferable=available if available > 0 else Decimal("0"),
                    price_usd=Decimal("1") if asset in STABLECOIN_PRICES else Decimal("0"),
                    value_usd=equity if asset in STABLECOIN_PRICES else Decimal("0"),
                    change_24h=Decimal("0"),
                )
            )

        for account in await self._get_all_account_balances():
            account_type = str(account.get("accountType") or "").lower()
            if account_type not in BINGX_FUTURES_ACCOUNT_TYPES:
                continue
            total = safe_decimal(account.get("usdtBalance"), "0")
            if total <= 0 or any(balance.account_type == "futures_balance" for balance in balances):
                continue
            balances.append(
                FundingBalance(
                    asset="USDT",
                    account_type="futures_balance",
                    free=total,
                    locked=Decimal("0"),
                    total=total,
                    transferable=total,
                    price_usd=Decimal("1"),
                    value_usd=total,
                    change_24h=Decimal("0"),
                )
            )

        return balances

    async def get_margin_balances(self) -> list[MarginBalance]:
        """
        Get non-spot BingX account balances as margin-equivalent holdings.

        BingX exposes account-type USDT equivalents for derivatives/copy/grid
        accounts through allAccountBalance. These are not open futures
        positions, but they are real exchange equity and must be counted in
        portfolio totals even when there is no active position.
        """
        balances: list[MarginBalance] = []
        for account in await self._get_all_account_balances():
            account_type = str(account.get("accountType") or "").lower()
            if account_type in BINGX_SPOT_FUND_ACCOUNT_TYPES or account_type in BINGX_FUTURES_ACCOUNT_TYPES:
                continue

            total = safe_decimal(account.get("usdtBalance"), "0")
            if total <= 0:
                continue

            balances.append(
                MarginBalance(
                    asset="USDT",
                    account_type=account_type or "other_balance",
                    free=total,
                    locked=Decimal("0"),
                    total=total,
                    borrowed=Decimal("0"),
                    interest=Decimal("0"),
                    net_asset=total,
                    price_usd=Decimal("1"),
                    value_usd=total,
                    change_24h=Decimal("0"),
                )
            )

        return balances

    async def get_futures_positions(self) -> list[FuturesPosition]:
        """Get non-zero USDT perpetual positions."""
        payload = await self._request("GET", "/openApi/swap/v2/user/positions")
        prices = await self._get_ticker_prices()
        positions: list[FuturesPosition] = []

        for item in _as_list(payload):
            raw_symbol = str(item.get("symbol") or "")
            symbol = self._normalize_symbol(raw_symbol)
            if not symbol:
                continue

            raw_size = safe_decimal(
                item.get("positionAmt")
                or item.get("positionAmount")
                or item.get("availableAmt")
                or item.get("size"),
                "0",
            )
            if raw_size == 0:
                continue

            side_payload = str(item.get("positionSide") or item.get("side") or "").lower()
            side = "short" if raw_size < 0 or side_payload == "short" else "long"
            size = abs(raw_size)
            base_asset = self._base_asset_from_pair(symbol)
            price_info = prices.get(base_asset, {"price": Decimal("0"), "change_24h": Decimal("0")})

            entry_price = safe_decimal(item.get("avgPrice") or item.get("entryPrice") or item.get("averagePrice"), "0")
            mark_price = safe_decimal(item.get("markPrice") or item.get("lastPrice"), "0")
            if mark_price <= 0:
                mark_price = price_info["price"]

            unrealized_pnl = safe_decimal(item.get("unrealizedProfit") or item.get("unrealizedPnl"), "0")
            position_value = safe_decimal(item.get("positionValue") or item.get("notional"), "0")
            if position_value <= 0 and mark_price > 0:
                position_value = size * mark_price

            margin = safe_decimal(item.get("isolatedMargin") or item.get("margin") or item.get("initialMargin"), "0")
            leverage_decimal = safe_decimal(item.get("leverage"), "1")
            leverage = max(int(leverage_decimal), 1) if leverage_decimal > 0 else 1
            if margin <= 0 and leverage > 0:
                margin = position_value / Decimal(leverage)

            unrealized_pnl_percent = Decimal("0")
            if margin > 0:
                unrealized_pnl_percent = (unrealized_pnl / margin) * 100

            positions.append(
                FuturesPosition(
                    symbol=symbol,
                    side=side,
                    size=size,
                    entry_price=entry_price,
                    mark_price=mark_price,
                    liquidation_price=safe_decimal(item.get("liquidationPrice"), "0") or None,
                    unrealized_pnl=unrealized_pnl,
                    unrealized_pnl_percent=unrealized_pnl_percent,
                    realized_pnl=safe_decimal(item.get("realisedProfit") or item.get("realizedProfit"), "0"),
                    margin=margin,
                    leverage=leverage,
                    position_value=position_value,
                    category="linear",
                    settle_coin="USDT",
                )
            )

        positions.sort(key=lambda position: position.position_value, reverse=True)
        return positions

    def _status_from_deposit(self, status: Any) -> str:
        status_map = {
            "0": "pending",
            "6": "pending",
            "1": "completed",
        }
        return status_map.get(str(status), "completed")

    def _status_from_withdrawal(self, status: Any) -> str:
        status_text = str(status).lower()
        if status_text in {"0", "2", "4", "5", "pending", "reviewing"}:
            return "pending"
        if status_text in {"1", "6", "success", "completed"}:
            return "completed"
        if status_text in {"3", "failed", "rejected"}:
            return "failed"
        if status_text in {"cancel", "cancelled", "canceled"}:
            return "cancelled"
        return "completed"

    def _timestamp_from_record(self, record: dict) -> datetime:
        for key in ("insertTime", "applyTime", "successTime", "createTime", "time", "timestamp", "ts"):
            value = record.get(key)
            if value is None:
                continue
            try:
                raw = int(value)
                if raw > 10_000_000_000:
                    return datetime.utcfromtimestamp(raw / 1000)
                return datetime.utcfromtimestamp(raw)
            except (TypeError, ValueError, OSError):
                continue
        return datetime.utcnow()

    def _order_endpoint_category(self, category: str) -> str:
        normalized = (category or "spot").lower()
        if normalized in {"linear", "futures", "future", "swap", "perp", "perpetual"}:
            return "swap"
        return "spot"

    def _normalize_order_status(self, raw_status: Any) -> ExchangeOrderStatus:
        status_value = str(raw_status or "").lower()
        if status_value in {"new", "pending", "open", "not_traded"}:
            return ExchangeOrderStatus.OPEN
        if status_value in {"partially_filled", "partiallyfilled", "partial_filled"}:
            return ExchangeOrderStatus.PARTIALLY_FILLED
        if status_value in {"filled", "full_filled", "completed"}:
            return ExchangeOrderStatus.FILLED
        if status_value in {"cancelled", "canceled", "cancel"}:
            return ExchangeOrderStatus.CANCELLED
        if status_value in {"rejected", "failed"}:
            return ExchangeOrderStatus.REJECTED
        return ExchangeOrderStatus.SUBMITTED

    async def place_order(self, order: ExchangeOrderRequest) -> ExchangeOrderResult:
        """
        Place a BingX order.

        The caller must pass deterministic client_order_id for bot-generated
        orders. This method is low-level adapter functionality; risk checks and
        reconciliation belong to the bot executor service.
        """
        category = self._order_endpoint_category(order.category)
        symbol = self._bingx_symbol(order.symbol, category)
        side = "BUY" if order.side == ExchangeOrderSide.BUY else "SELL"
        order_type = "MARKET" if order.order_type == ExchangeOrderType.MARKET else "LIMIT"
        params: dict[str, Any] = {
            "symbol": symbol,
            "side": side,
            "type": order_type,
            "quantity": str(order.quantity),
        }

        if order.order_type == ExchangeOrderType.LIMIT:
            if order.price is None or order.price <= 0:
                raise ExchangeAPIError(self.exchange_name, 400, "Limit orders require a positive price")
            params["price"] = str(order.price)
            params["timeInForce"] = order.time_in_force or "GTC"

        if order.client_order_id:
            params["newClientOrderId"] = order.client_order_id
            params["clientOrderID"] = order.client_order_id

        if category == "swap":
            params["positionSide"] = order.metadata.get("positionSide") or ("SHORT" if order.side == ExchangeOrderSide.SELL else "LONG")
            if order.reduce_only:
                params["reduceOnly"] = "true"

        for key, value in order.metadata.items():
            if key not in params and value is not None:
                params[key] = value

        endpoint = "/openApi/swap/v2/trade/order" if category == "swap" else "/openApi/spot/v1/trade/order"
        result = await self._request("POST", endpoint, params=params)
        response = result if isinstance(result, dict) else {}

        return ExchangeOrderResult(
            exchange=self.exchange_name,
            order_id=str(response.get("orderId") or response.get("orderID") or "") or None,
            client_order_id=str(response.get("clientOrderId") or response.get("clientOrderID") or order.client_order_id or "") or None,
            symbol=symbol,
            side=order.side,
            order_type=order.order_type,
            status=ExchangeOrderStatus.SUBMITTED,
            raw_response=response,
        )

    async def cancel_order(
        self,
        symbol: str,
        order_id: str | None = None,
        client_order_id: str | None = None,
        category: str = "spot",
    ) -> ExchangeOrderResult:
        """Cancel a BingX order."""
        endpoint_category = self._order_endpoint_category(category)
        normalized_symbol = self._bingx_symbol(symbol, endpoint_category)
        if not order_id and not client_order_id:
            raise ExchangeAPIError(self.exchange_name, 400, "order_id or client_order_id is required")

        params: dict[str, Any] = {"symbol": normalized_symbol}
        if order_id:
            params["orderId"] = order_id
        if client_order_id:
            params["clientOrderID"] = client_order_id
            params["origClientOrderId"] = client_order_id

        if endpoint_category == "swap":
            endpoint = "/openApi/swap/v2/trade/order"
            result = await self._request("DELETE", endpoint, params=params)
        else:
            endpoint = "/openApi/spot/v1/trade/cancel"
            result = await self._request("POST", endpoint, params=params)

        response = result if isinstance(result, dict) else {}
        return ExchangeOrderResult(
            exchange=self.exchange_name,
            order_id=str(response.get("orderId") or order_id or "") or None,
            client_order_id=str(response.get("clientOrderId") or response.get("clientOrderID") or client_order_id or "") or None,
            symbol=normalized_symbol,
            side=None,
            order_type=ExchangeOrderType.MARKET,
            status=ExchangeOrderStatus.CANCELLED,
            raw_response=response,
        )

    async def get_order(
        self,
        symbol: str,
        order_id: str | None = None,
        client_order_id: str | None = None,
        category: str = "spot",
    ) -> ExchangeOrderResult:
        """Fetch BingX order status."""
        endpoint_category = self._order_endpoint_category(category)
        normalized_symbol = self._bingx_symbol(symbol, endpoint_category)
        params: dict[str, Any] = {"symbol": normalized_symbol}
        if order_id:
            params["orderId"] = order_id
        if client_order_id:
            params["clientOrderID"] = client_order_id
            params["origClientOrderId"] = client_order_id

        endpoint = "/openApi/swap/v2/trade/order" if endpoint_category == "swap" else "/openApi/spot/v1/trade/query"
        result = await self._request("GET", endpoint, params=params)
        response = result if isinstance(result, dict) else {}
        side = str(response.get("side") or "BUY").upper()
        order_type = str(response.get("type") or response.get("orderType") or "MARKET").upper()

        return ExchangeOrderResult(
            exchange=self.exchange_name,
            order_id=str(response.get("orderId") or order_id or "") or None,
            client_order_id=str(response.get("clientOrderId") or response.get("clientOrderID") or client_order_id or "") or None,
            symbol=str(response.get("symbol") or normalized_symbol),
            side=ExchangeOrderSide.SELL if side == "SELL" else ExchangeOrderSide.BUY,
            order_type=ExchangeOrderType.LIMIT if order_type == "LIMIT" else ExchangeOrderType.MARKET,
            status=self._normalize_order_status(response.get("status")),
            raw_response=response,
        )

    def _kline_endpoint_category(self, category: str) -> str:
        category_value = (category or "spot").lower()
        if category_value in {"swap", "future", "futures", "linear"}:
            return "swap"
        return "spot"

    def _parse_kline_row(
        self,
        row: Any,
        *,
        symbol: str,
        timeframe: str,
        delta: timedelta,
        now: datetime,
    ) -> MarketCandleData | None:
        if isinstance(row, dict):
            open_time_raw = row.get("time") or row.get("openTime") or row.get("t") or row.get("timestamp")
            if open_time_raw is None:
                return None
            open_time = datetime.fromtimestamp(int(open_time_raw) / 1000, tz=timezone.utc)
            close_time_raw = row.get("closeTime")
            close_time = (
                datetime.fromtimestamp(int(close_time_raw) / 1000, tz=timezone.utc)
                if close_time_raw is not None
                else open_time + delta
            )
            open_price = safe_decimal(row.get("open") or row.get("o"))
            high_price = safe_decimal(row.get("high") or row.get("h"))
            low_price = safe_decimal(row.get("low") or row.get("l"))
            close_price = safe_decimal(row.get("close") or row.get("c"))
            volume = safe_decimal(row.get("volume") or row.get("v"))
            quote_volume = safe_decimal(
                row.get("quoteVolume")
                or row.get("quoteVolume24h")
                or row.get("turnover")
                or row.get("amount")
                or row.get("quoteAssetVolume")
                or row.get("q")
            )
            if quote_volume <= 0 and volume > 0 and close_price > 0:
                quote_volume = volume * close_price
            return MarketCandleData(
                exchange=self.exchange_name,
                symbol=symbol,
                timeframe=timeframe,
                open_time=open_time,
                close_time=close_time,
                open=open_price,
                high=high_price,
                low=low_price,
                close=close_price,
                volume=volume,
                quote_volume=quote_volume,
                trade_count=int(row["tradeNum"]) if str(row.get("tradeNum") or "").isdigit() else None,
                is_closed=close_time <= now,
                raw_response=row,
            )
        if isinstance(row, list) and len(row) >= 6:
            open_time = datetime.fromtimestamp(int(row[0]) / 1000, tz=timezone.utc)
            close_time = open_time + delta
            close_price = safe_decimal(row[4])
            volume = safe_decimal(row[5])
            quote_volume = safe_decimal(row[6]) if len(row) > 6 else Decimal("0")
            if quote_volume <= 0 and volume > 0 and close_price > 0:
                quote_volume = volume * close_price
            return MarketCandleData(
                exchange=self.exchange_name,
                symbol=symbol,
                timeframe=timeframe,
                open_time=open_time,
                close_time=close_time,
                open=safe_decimal(row[1]),
                high=safe_decimal(row[2]),
                low=safe_decimal(row[3]),
                close=close_price,
                volume=volume,
                quote_volume=quote_volume,
                trade_count=None,
                is_closed=close_time <= now,
                raw_response={"row": row},
            )
        return None

    async def get_ohlcv_candles(
        self,
        symbol: str,
        timeframe: str = "1h",
        limit: int = 200,
        category: str = "spot",
        start_time: datetime | None = None,
        end_time: datetime | None = None,
    ) -> list[MarketCandleData]:
        """Fetch public BingX OHLCV candles for spot or USDT-M swap markets."""
        normalized_timeframe = timeframe if timeframe in BINGX_KLINE_INTERVALS else "1h"
        endpoint_category = self._kline_endpoint_category(category)
        normalized_symbol = self._bingx_symbol(symbol, endpoint_category)
        endpoint = (
            "/openApi/swap/v3/quote/klines"
            if endpoint_category == "swap"
            else "/openApi/spot/v1/market/kline"
        )
        params = {
            "symbol": normalized_symbol,
            "interval": BINGX_KLINE_INTERVALS[normalized_timeframe],
            "limit": max(1, min(int(limit or 200), 1000)),
        }
        if start_time is not None:
            params["startTime"] = int(start_time.timestamp() * 1000)
        if end_time is not None:
            params["endTime"] = int(end_time.timestamp() * 1000)
        payload = await self._request(
            "GET",
            endpoint,
            params=params,
            signed=False,
        )
        rows = _as_list(payload)
        if not rows and isinstance(payload, list):
            rows = payload
        now = datetime.now(timezone.utc)
        delta = TIMEFRAME_DELTAS[normalized_timeframe]
        candles = [
            candle
            for candle in (
                self._parse_kline_row(
                    row,
                    symbol=normalized_symbol,
                    timeframe=normalized_timeframe,
                    delta=delta,
                    now=now,
                )
                for row in rows
            )
            if candle is not None
        ]
        return sorted(candles, key=lambda candle: candle.open_time)

    async def get_deposit_history(self, limit: int = 50) -> list[ExchangeTransaction]:
        """Get recent deposit records."""
        end_time = int(time.time() * 1000)
        start_time = int((datetime.utcnow() - timedelta(days=90)).timestamp() * 1000)
        payload = await self._request(
            "GET",
            "/openApi/api/v3/capital/deposit/hisrec",
            {
                "limit": min(limit, 100),
                "startTime": start_time,
                "endTime": end_time,
            },
        )
        prices = await self._get_ticker_prices()
        transactions: list[ExchangeTransaction] = []

        for record in _as_list(payload)[:limit]:
            coin = str(record.get("coin") or record.get("asset") or "").upper()
            amount = safe_decimal(record.get("amount"), "0")
            price = prices.get(coin, {"price": Decimal("0")})["price"]
            transactions.append(
                ExchangeTransaction(
                    id=str(record.get("id") or record.get("txId") or record.get("txID") or f"bingx-deposit-{len(transactions)}"),
                    exchange=self.exchange_name,
                    type="deposit",
                    coin=coin,
                    amount=amount,
                    fee=Decimal("0"),
                    value_usd=amount * price,
                    status=self._status_from_deposit(record.get("status")),
                    tx_id=record.get("txId") or record.get("txID"),
                    chain=record.get("network") or record.get("chain"),
                    address=record.get("address") or record.get("toAddress"),
                    timestamp=self._timestamp_from_record(record),
                )
            )

        return transactions

    async def get_withdrawal_history(self, limit: int = 50) -> list[ExchangeTransaction]:
        """Get recent withdrawal records."""
        end_time = int(time.time() * 1000)
        start_time = int((datetime.utcnow() - timedelta(days=90)).timestamp() * 1000)
        payload = await self._request(
            "GET",
            "/openApi/api/v3/capital/withdraw/history",
            {
                "limit": min(limit, 100),
                "startTime": start_time,
                "endTime": end_time,
            },
        )
        prices = await self._get_ticker_prices()
        transactions: list[ExchangeTransaction] = []

        for record in _as_list(payload)[:limit]:
            coin = str(record.get("coin") or record.get("asset") or "").upper()
            amount = safe_decimal(record.get("amount"), "0")
            fee = safe_decimal(record.get("transactionFee") or record.get("fee"), "0")
            price = prices.get(coin, {"price": Decimal("0")})["price"]
            transactions.append(
                ExchangeTransaction(
                    id=str(record.get("id") or record.get("withdrawOrderId") or f"bingx-withdrawal-{len(transactions)}"),
                    exchange=self.exchange_name,
                    type="withdrawal",
                    coin=coin,
                    amount=amount,
                    fee=fee,
                    value_usd=amount * price,
                    status=self._status_from_withdrawal(record.get("status")),
                    tx_id=record.get("txId") or record.get("txID"),
                    chain=record.get("network") or record.get("chain"),
                    address=record.get("address") or record.get("toAddress"),
                    timestamp=self._timestamp_from_record(record),
                )
            )

        return transactions

    async def get_internal_transfers(self, limit: int = 50) -> list[ExchangeTransaction]:
        """Get recent account transfer records."""
        prices = await self._get_ticker_prices()
        transactions: list[ExchangeTransaction] = []
        seen_ids: set[str] = set()
        end_time = int(time.time() * 1000)
        start_time = int((datetime.utcnow() - timedelta(days=90)).timestamp() * 1000)

        account_pairs = [
            ("fund", "spot"),
            ("spot", "fund"),
            ("fund", "USDTMPerp"),
            ("USDTMPerp", "fund"),
            ("spot", "USDTMPerp"),
            ("USDTMPerp", "spot"),
            ("fund", "stdFutures"),
            ("stdFutures", "fund"),
            ("spot", "stdFutures"),
            ("stdFutures", "spot"),
        ]

        for from_account, to_account in account_pairs:
            if len(transactions) >= limit:
                break

            try:
                payload = await self._request(
                    "GET",
                    "/openApi/api/v3/asset/transferRecord",
                    {
                        "fromAccount": from_account,
                        "toAccount": to_account,
                        "pageIndex": 1,
                        "pageSize": min(limit, 100),
                        "startTime": start_time,
                        "endTime": end_time,
                    },
                )
            except Exception as exc:
                logger.debug("Failed to load BingX transfer records %s->%s: %s", from_account, to_account, exc)
                continue

            for record in _as_list(payload):
                record_id = str(record.get("transferId") or record.get("tranId") or record.get("id") or "")
                if not record_id:
                    record_id = f"{from_account}-{to_account}-{record.get('asset')}-{record.get('timestamp')}-{record.get('amount')}"
                if record_id in seen_ids:
                    continue
                seen_ids.add(record_id)

                coin = str(record.get("asset") or record.get("coin") or "").upper()
                amount = safe_decimal(record.get("amount"), "0")
                price = prices.get(coin, {"price": Decimal("0")})["price"]
                transactions.append(
                    ExchangeTransaction(
                        id=f"bingx-transfer-{record_id}",
                        exchange=self.exchange_name,
                        type="internal_transfer",
                        coin=coin,
                        amount=amount,
                        fee=Decimal("0"),
                        value_usd=amount * price,
                        status="completed",
                        from_account=record.get("fromAccount") or from_account,
                        to_account=record.get("toAccount") or to_account,
                        timestamp=self._timestamp_from_record(record),
                    )
                )

        if transactions:
            transactions.sort(key=lambda item: item.timestamp, reverse=True)
            return transactions[:limit]

        try:
            payload = await self._request(
                "GET",
                "/openApi/api/v3/asset/transfer",
                {"type": "FUND_SFUTURES", "current": 1, "size": min(limit, 100), "startTime": start_time, "endTime": end_time},
            )
        except Exception as exc:
            logger.debug("Failed to load BingX legacy transfer records: %s", exc)
            return []

        for record in _as_list(payload)[:limit]:
            coin = str(record.get("asset") or record.get("coin") or "").upper()
            amount = safe_decimal(record.get("amount"), "0")
            price = prices.get(coin, {"price": Decimal("0")})["price"]
            transactions.append(
                ExchangeTransaction(
                    id=str(record.get("tranId") or record.get("id") or f"bingx-transfer-{len(transactions)}"),
                    exchange=self.exchange_name,
                    type="internal_transfer",
                    coin=coin,
                    amount=amount,
                    fee=Decimal("0"),
                    value_usd=amount * price,
                    status="completed",
                    from_account=record.get("fromAccount") or record.get("fromAccountType") or record.get("type"),
                    to_account=record.get("toAccount") or record.get("toAccountType"),
                    timestamp=self._timestamp_from_record(record),
                )
            )

        return transactions

    async def _get_trade_symbols_for_cost_basis(self) -> list[str]:
        """Build a small symbol list from current non-stable spot holdings."""
        balances = await self.get_spot_balances()
        symbols: list[str] = []
        stable_assets = set(STABLECOIN_PRICES)
        for balance in balances:
            asset = balance.asset.upper()
            if asset in stable_assets:
                continue
            symbols.append(f"{asset}-USDT")
        return symbols

    async def get_trade_history(
        self,
        category: str = "spot",
        limit: int = 200,
        days: int = 365,
    ) -> list[dict]:
        """
        Get BingX trade/fill history in the normalized shape used by cost basis.

        Spot fills require a symbol on BingX, so we query only symbols for
        assets currently held by the account. This keeps sync scalable and
        avoids a large all-market N+1 scan.
        """
        now_ms = int(time.time() * 1000)
        start_ms = int((datetime.utcnow() - timedelta(days=days)).timestamp() * 1000)

        if category.lower() in {"linear", "futures", "future", "swap", "perp", "perpetual"}:
            return await self.get_futures_trade_history(limit=limit, days=days)

        symbols = await self._get_trade_symbols_for_cost_basis()
        if not symbols:
            return []

        all_trades: list[dict] = []
        for symbol in symbols:
            try:
                payload = await self._request(
                    "GET",
                    "/openApi/spot/v1/trade/myTrades",
                    {
                        "symbol": symbol,
                        "startTime": start_ms,
                        "endTime": now_ms,
                        "limit": min(limit, 1000),
                    },
                )
            except Exception as exc:
                logger.debug("Failed to load BingX spot trades for %s: %s", symbol, exc)
                continue

            data = payload if isinstance(payload, dict) else {}
            fills = data.get("fills") if isinstance(data.get("fills"), list) else _as_list(payload)
            for fill in fills:
                is_buyer = fill.get("isBuyer")
                side = "buy" if is_buyer is True or str(is_buyer).lower() == "true" else "sell"
                all_trades.append(
                    {
                        **fill,
                        "symbol": str(fill.get("symbol") or symbol).replace("-", ""),
                        "side": side,
                        "qty": fill.get("qty"),
                        "price": fill.get("price"),
                        "execQty": fill.get("qty"),
                        "execPrice": fill.get("price"),
                        "execTime": fill.get("time"),
                    }
                )

        all_trades.sort(key=lambda trade: int(trade.get("time") or trade.get("execTime") or 0), reverse=True)
        return all_trades[:limit]

    async def get_futures_trade_history(self, limit: int = 200, days: int = 90) -> list[dict]:
        """Fetch recent BingX perpetual fill history for known open symbols."""
        positions = await self.get_futures_positions()
        if not positions:
            return []

        end_ms = int(time.time() * 1000)
        start_ms = int((datetime.utcnow() - timedelta(days=min(days, 90))).timestamp() * 1000)
        fills: list[dict] = []

        for position in positions:
            try:
                payload = await self._request(
                    "GET",
                    "/openApi/swap/v2/trade/fillHistory",
                    {
                        "symbol": self._bingx_symbol(position.symbol, "swap"),
                        "currency": position.settle_coin,
                        "startTs": start_ms,
                        "endTs": end_ms,
                        "pageIndex": 1,
                        "pageSize": min(limit, 1000),
                    },
                )
            except Exception as exc:
                logger.debug("Failed to load BingX futures fills for %s: %s", position.symbol, exc)
                continue

            data = payload if isinstance(payload, dict) else {}
            fills.extend(_as_list(data.get("fill_orders") if isinstance(data, dict) else payload))

        return fills[:limit]

    def calculate_cost_basis(self, trades: list[dict]) -> dict[str, dict]:
        """Calculate average spot cost basis from BingX fills."""
        holdings: dict[str, dict] = {}

        for trade in trades:
            symbol = str(trade.get("symbol") or "").replace("-", "").upper()
            side = str(trade.get("side") or "").lower()
            qty = safe_decimal(trade.get("execQty") or trade.get("qty"), "0")
            price = safe_decimal(trade.get("execPrice") or trade.get("price"), "0")

            if qty <= 0 or price <= 0:
                continue

            base_asset = self._base_asset_from_pair(symbol)
            if not base_asset or base_asset in STABLECOIN_PRICES:
                continue

            if base_asset not in holdings:
                holdings[base_asset] = {
                    "total_qty": Decimal("0"),
                    "total_cost": Decimal("0"),
                    "avg_price": Decimal("0"),
                }

            holding = holdings[base_asset]
            if side == "buy":
                holding["total_cost"] += qty * price
                holding["total_qty"] += qty
            elif side == "sell" and holding["total_qty"] > 0:
                avg_cost = holding["total_cost"] / holding["total_qty"]
                holding["total_cost"] = max(holding["total_cost"] - (qty * avg_cost), Decimal("0"))
                holding["total_qty"] = max(holding["total_qty"] - qty, Decimal("0"))

            holding["avg_price"] = (
                holding["total_cost"] / holding["total_qty"]
                if holding["total_qty"] > 0
                else Decimal("0")
            )

        return holdings

    async def get_account_summary(self, include_subaccounts: bool = False) -> ExchangeAccountSummary:
        """Fetch BingX spot and futures data with graceful partial failure."""
        _ = include_subaccounts
        results = await asyncio.gather(
            self.get_spot_balances(),
            self.get_futures_balances(),
            self.get_margin_balances(),
            self.get_futures_positions(),
            return_exceptions=True,
        )

        spot_balances = results[0] if not isinstance(results[0], Exception) else []
        futures_balances = results[1] if not isinstance(results[1], Exception) else []
        margin_balances = results[2] if not isinstance(results[2], Exception) else []
        futures_positions = results[3] if not isinstance(results[3], Exception) else []

        if isinstance(results[0], Exception):
            logger.warning("Failed to get BingX spot balances: %s", results[0])
        if isinstance(results[1], Exception):
            logger.warning("Failed to get BingX futures balance: %s", results[1])
        if isinstance(results[2], Exception):
            logger.warning("Failed to get BingX account balances: %s", results[2])
        if isinstance(results[3], Exception):
            logger.warning("Failed to get BingX futures positions: %s", results[3])
        if all(isinstance(result, Exception) for result in results):
            for result in results:
                if isinstance(result, ExchangeAuthError):
                    raise result
            raise ExchangeAPIError(
                exchange=self.exchange_name,
                status_code=502,
                message=(
                    "Failed to load BingX account data: "
                    f"spot={results[0]}; futures_balance={results[1]}; "
                    f"margin={results[2]}; futures_positions={results[3]}"
                ),
            )

        total_spot = sum(balance.value_usd for balance in spot_balances)
        total_futures_balance = sum(balance.value_usd for balance in futures_balances)
        total_margin = sum(balance.value_usd for balance in margin_balances)
        open_futures_equity = sum(position.margin + position.unrealized_pnl for position in futures_positions)
        total_futures = total_futures_balance if total_futures_balance > 0 else open_futures_equity
        total_unrealized_pnl = sum(position.unrealized_pnl for position in futures_positions)

        return ExchangeAccountSummary(
            spot_balances=spot_balances,
            futures_balances=futures_balances,
            margin_balances=margin_balances,
            futures_positions=futures_positions,
            total_spot_usd=total_spot,
            total_futures_balance_usd=total_futures_balance,
            total_margin_usd=total_margin,
            total_futures_usd=total_futures,
            total_value_usd=total_spot + total_margin + total_futures,
            total_unrealized_pnl=total_unrealized_pnl,
            position_count=len(spot_balances) + len(futures_balances) + len(margin_balances) + len(futures_positions),
        )

    async def close(self) -> None:
        await self.client.aclose()
