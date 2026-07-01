"""
BingX Exchange Adapter.

Read-only integration for Connectcoin:
- Spot balances
- USDT perpetual futures balances/positions
- Deposit, withdrawal and internal transfer history

The adapter intentionally does not implement order placement. Trading stays
blocked at this layer until the execution engine has reconciliation, idempotency
and operator approvals wired end-to-end.
"""

import asyncio
import hashlib
import hmac
import logging
import time
from datetime import datetime, timedelta
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
    FuturesPosition,
    MarginBalance,
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
    supports_margin = False
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
        query = urlencode(sorted((key, value) for key, value in params.items() if value is not None))
        return hmac.new(
            self.api_secret.encode("utf-8"),
            query.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

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

                response = await self.client.request(
                    method,
                    url,
                    params=request_params,
                    headers=headers,
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

        try:
            await self._request("GET", "/openApi/swap/v2/user/balance")
            return True
        except Exception as futures_error:
            logger.warning("BingX connection test failed: spot=%s futures=%s", spot_error, futures_error)
            return False

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
                    free=free,
                    locked=locked,
                    total=total,
                    price_usd=price,
                    value_usd=total * price,
                    change_24h=price_info["change_24h"],
                )
            )

        balances.sort(key=lambda balance: balance.value_usd, reverse=True)
        return balances

    async def get_margin_balances(self) -> list[MarginBalance]:
        """BingX margin is not exposed in the initial Connectcoin read-only MVP."""
        return []

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
        payload = await self._request(
            "GET",
            "/openApi/api/v3/asset/transfer",
            {"limit": min(limit, 100)},
        )
        prices = await self._get_ticker_prices()
        transactions: list[ExchangeTransaction] = []

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

    async def get_account_summary(self, include_subaccounts: bool = False) -> ExchangeAccountSummary:
        """Fetch BingX spot and futures data with graceful partial failure."""
        _ = include_subaccounts
        results = await asyncio.gather(
            self.get_spot_balances(),
            self.get_futures_positions(),
            return_exceptions=True,
        )

        spot_balances = results[0] if not isinstance(results[0], Exception) else []
        futures_positions = results[1] if not isinstance(results[1], Exception) else []

        if isinstance(results[0], Exception):
            logger.warning("Failed to get BingX spot balances: %s", results[0])
        if isinstance(results[1], Exception):
            logger.warning("Failed to get BingX futures positions: %s", results[1])
        if isinstance(results[0], Exception) and isinstance(results[1], Exception):
            if isinstance(results[0], ExchangeAuthError):
                raise results[0]
            if isinstance(results[1], ExchangeAuthError):
                raise results[1]
            raise ExchangeAPIError(
                exchange=self.exchange_name,
                status_code=502,
                message=f"Failed to load BingX account data: spot={results[0]}; futures={results[1]}",
            )

        total_spot = sum(balance.value_usd for balance in spot_balances)
        total_futures = sum(position.margin + position.unrealized_pnl for position in futures_positions)
        total_unrealized_pnl = sum(position.unrealized_pnl for position in futures_positions)

        return ExchangeAccountSummary(
            spot_balances=spot_balances,
            futures_positions=futures_positions,
            total_spot_usd=total_spot,
            total_futures_usd=total_futures,
            total_value_usd=total_spot + total_futures,
            total_unrealized_pnl=total_unrealized_pnl,
            position_count=len(spot_balances) + len(futures_positions),
        )

    async def close(self) -> None:
        await self.client.aclose()
