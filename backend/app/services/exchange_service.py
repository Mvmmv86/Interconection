"""Exchange Service - Business logic for exchange operations.

Updated to use 24h change as fallback PnL when trade history is unavailable.
"""

import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import decrypt_api_key
from app.models.exchange import Exchange
from app.models.client import Client
from app.models.position import Position, SourceType, PositionType
from app.models.asset import Asset
from app.integrations.exchanges import (
    BaseExchangeAdapter,
    BybitAdapter,
    ExchangeAccountSummary,
    ExchangeTransaction,
    ExchangeAdapterError,
    ExchangeAuthError,
)

logger = logging.getLogger(__name__)


# Exchange logo mappings (2-letter codes)
EXCHANGE_LOGOS = {
    "bybit": "BY",
    "binance": "BN",
    "coinbase": "CB",
    "kraken": "KR",
    "okx": "OK",
    "kucoin": "KC",
    "gateio": "GT",
    "mexc": "MX",
}

# Human-readable exchange names
EXCHANGE_NAMES = {
    "bybit": "Bybit",
    "binance": "Binance",
    "coinbase": "Coinbase",
    "kraken": "Kraken",
    "okx": "OKX",
    "kucoin": "KuCoin",
    "gateio": "Gate.io",
    "mexc": "MEXC",
}


class ExchangeService:
    """Service for managing exchange connections and data sync."""

    def __init__(self, db: AsyncSession):
        self.db = db

    def get_adapter(self, exchange: Exchange) -> BaseExchangeAdapter:
        """
        Factory method to get appropriate exchange adapter.

        Args:
            exchange: Exchange model with encrypted credentials

        Returns:
            Configured exchange adapter

        Raises:
            ValueError: If exchange type is not supported
        """
        api_key = decrypt_api_key(exchange.api_key_encrypted)
        api_secret = decrypt_api_key(exchange.api_secret_encrypted)

        if exchange.exchange == "bybit":
            return BybitAdapter(api_key, api_secret)

        # Future: Add more exchanges here
        # if exchange.exchange == "binance":
        #     return BinanceAdapter(api_key, api_secret)

        raise ValueError(f"Unsupported exchange: {exchange.exchange}")

    async def test_connection(self, exchange: Exchange) -> tuple[bool, Optional[str]]:
        """
        Test exchange connection with provided credentials.

        Returns:
            Tuple of (success, error_message)
        """
        try:
            adapter = self.get_adapter(exchange)
            success = await adapter.test_connection()
            await adapter.close()
            return success, None if success else "Connection test failed"
        except ExchangeAuthError as e:
            return False, "Invalid API credentials"
        except ExchangeAdapterError as e:
            return False, str(e)
        except ValueError as e:
            return False, str(e)
        except Exception as e:
            logger.exception(f"Unexpected error testing connection: {e}")
            return False, f"Unexpected error: {str(e)}"

    async def test_connection_with_summary(
        self,
        exchange: Exchange,
    ) -> tuple[bool, Optional[str], Optional[ExchangeAccountSummary]]:
        """
        Test exchange connection and return account summary.

        Returns:
            Tuple of (success, error_message, account_summary)
        """
        try:
            adapter = self.get_adapter(exchange)
            success = await adapter.test_connection()

            if not success:
                await adapter.close()
                return False, "Connection test failed", None

            # Fetch account summary for preview
            summary = await adapter.get_account_summary()
            await adapter.close()

            return True, None, summary

        except ExchangeAuthError as e:
            return False, "Invalid API credentials", None
        except ExchangeAdapterError as e:
            return False, str(e), None
        except ValueError as e:
            return False, str(e), None
        except Exception as e:
            logger.exception(f"Unexpected error testing connection: {e}")
            return False, f"Unexpected error: {str(e)}", None

    async def sync_exchange(
        self,
        exchange_id: UUID,
        organization_id: UUID,
        include_subaccounts: bool = False,
    ) -> dict:
        """
        Sync all data from an exchange.

        Fetches balances and positions from the exchange API
        and updates the local database.

        Args:
            exchange_id: Exchange UUID
            organization_id: Organization UUID for access control
            include_subaccounts: Whether to fetch subaccount data

        Returns:
            Sync result with stats
        """
        # Get exchange record
        result = await self.db.execute(
            select(Exchange)
            .join(Client)
            .where(
                Exchange.id == exchange_id,
                Client.organization_id == organization_id,
            )
            .options(selectinload(Exchange.client))
        )
        exchange = result.scalar_one_or_none()

        if not exchange:
            raise ValueError("Exchange not found")

        try:
            adapter = self.get_adapter(exchange)
            summary = await adapter.get_account_summary(include_subaccounts=include_subaccounts)

            # Fetch trade history and calculate cost basis for PnL (BEFORE closing adapter)
            # Using 365 days to get a full year of trade history for accurate cost basis
            cost_basis_data = {}
            try:
                if hasattr(adapter, 'get_trade_history'):
                    logger.info(f"Fetching trade history for exchange {exchange.id}...")
                    trades = await adapter.get_trade_history(category="spot", days=365)
                    logger.info(f"Fetched {len(trades)} trades from exchange")

                    if trades and hasattr(adapter, 'calculate_cost_basis'):
                        cost_basis_data = adapter.calculate_cost_basis(trades)
                        logger.info(f"Calculated cost basis for {len(cost_basis_data)} assets from {len(trades)} trades")
                        # Log which assets have cost basis
                        for asset, data in cost_basis_data.items():
                            logger.debug(f"Cost basis for {asset}: avg_price={data.get('avg_price')}, total_qty={data.get('total_qty')}")
                    else:
                        logger.warning(f"No trades found for exchange {exchange.id} - PnL will not be calculated")
                else:
                    logger.warning(f"Adapter for {exchange.exchange} does not support get_trade_history")
            except Exception as e:
                logger.warning(f"Failed to get trade history for PnL: {e}", exc_info=True)

            # Close adapter after all API calls are done
            await adapter.close()

            # Update exchange sync status
            exchange.last_sync_at = datetime.now(timezone.utc)
            exchange.sync_error = None

            # Store positions in database
            positions_synced = await self._store_positions(
                exchange=exchange,
                summary=summary,
                cost_basis_data=cost_basis_data,
            )

            await self.db.flush()

            return {
                "exchange_id": str(exchange_id),
                "success": True,
                "positions_synced": positions_synced,
                "total_value_usd": float(summary.total_value_usd),
                "spot_value": float(summary.total_spot_usd),
                "funding_value": float(summary.total_funding_usd),
                "margin_value": float(summary.total_margin_usd),
                "futures_value": float(summary.total_futures_usd),
                "earn_value": float(summary.total_earn_usd),
                "unrealized_pnl": float(summary.total_unrealized_pnl),
                "subaccounts_count": len(summary.subaccounts),
                "subaccounts_value": float(summary.total_subaccounts_value_usd),
            }

        except ExchangeAdapterError as e:
            exchange.sync_error = str(e)
            await self.db.flush()
            raise

    async def _store_positions(
        self,
        exchange: Exchange,
        summary: ExchangeAccountSummary,
        cost_basis_data: dict = None,
    ) -> int:
        """
        Store fetched positions in database.

        Args:
            exchange: Exchange model
            summary: Account summary from adapter
            cost_basis_data: Dict of asset -> {avg_price, total_cost, total_qty} for PnL

        Returns number of positions synced.
        """
        if cost_basis_data is None:
            cost_basis_data = {}
        # Delete old positions from this exchange
        await self.db.execute(
            delete(Position).where(
                Position.source_type == SourceType.EXCHANGE,
                Position.source_id == exchange.id,
            )
        )

        positions_count = 0

        # Store spot balances
        for balance in summary.spot_balances:
            asset = await self._get_or_create_asset(
                symbol=balance.asset,
                price_usd=balance.price_usd,
                change_24h=balance.change_24h,
            )

            # Calculate PnL using cost basis data
            entry_price = None
            cost_basis = None
            unrealized_pnl = Decimal("0")
            unrealized_pnl_percent = Decimal("0")

            if balance.asset in cost_basis_data:
                cb_data = cost_basis_data[balance.asset]
                avg_price = cb_data.get("avg_price", Decimal("0"))
                if avg_price > 0:
                    entry_price = avg_price
                    cost_basis = balance.total * avg_price
                    unrealized_pnl = balance.value_usd - cost_basis
                    if cost_basis > 0:
                        unrealized_pnl_percent = (unrealized_pnl / cost_basis) * 100
                    logger.info(f"PnL for {balance.asset} (spot): entry=${entry_price:.4f}, cost=${cost_basis:.2f}, pnl=${unrealized_pnl:.2f} ({unrealized_pnl_percent:.2f}%)")
            else:
                # No trade history available for cost basis calculation
                # PnL will be calculated in frontend from 24h price change
                logger.debug(f"No cost basis for {balance.asset} - PnL fallback handled in frontend")

            position = Position(
                organization_id=exchange.client.organization_id,
                client_id=exchange.client_id,
                asset_id=asset.id,
                source_type=SourceType.EXCHANGE,
                source_id=exchange.id,
                position_type=PositionType.SPOT,
                quantity=balance.total,
                entry_price=entry_price,
                current_price=balance.price_usd,
                current_value_usd=balance.value_usd,
                cost_basis=cost_basis,
                unrealized_pnl=unrealized_pnl,
                unrealized_pnl_percent=unrealized_pnl_percent,
                position_metadata={
                    "exchange": exchange.exchange,
                    "account_type": "unified",
                    "free": str(balance.free),
                    "locked": str(balance.locked),
                },
            )
            self.db.add(position)
            positions_count += 1

        # Store funding balances
        for balance in summary.funding_balances:
            asset = await self._get_or_create_asset(
                symbol=balance.asset,
                price_usd=balance.price_usd,
                change_24h=balance.change_24h,
            )

            # Calculate PnL using cost basis data
            entry_price = None
            cost_basis = None
            unrealized_pnl = Decimal("0")
            unrealized_pnl_percent = Decimal("0")

            if balance.asset in cost_basis_data:
                cb_data = cost_basis_data[balance.asset]
                avg_price = cb_data.get("avg_price", Decimal("0"))
                if avg_price > 0:
                    entry_price = avg_price
                    cost_basis = balance.total * avg_price
                    unrealized_pnl = balance.value_usd - cost_basis
                    if cost_basis > 0:
                        unrealized_pnl_percent = (unrealized_pnl / cost_basis) * 100
            else:
                # No trade history available - PnL fallback handled in frontend
                pass

            position = Position(
                organization_id=exchange.client.organization_id,
                client_id=exchange.client_id,
                asset_id=asset.id,
                source_type=SourceType.EXCHANGE,
                source_id=exchange.id,
                position_type=PositionType.SPOT,  # Funding is essentially spot
                quantity=balance.total,
                entry_price=entry_price,
                current_price=balance.price_usd,
                current_value_usd=balance.value_usd,
                cost_basis=cost_basis,
                unrealized_pnl=unrealized_pnl,
                unrealized_pnl_percent=unrealized_pnl_percent,
                position_metadata={
                    "exchange": exchange.exchange,
                    "account_type": "funding",
                    "free": str(balance.free),
                    "locked": str(balance.locked),
                    "transferable": str(balance.transferable),
                },
            )
            self.db.add(position)
            positions_count += 1

        # Store margin balances
        for balance in summary.margin_balances:
            asset = await self._get_or_create_asset(
                symbol=balance.asset,
                price_usd=balance.price_usd,
                change_24h=balance.change_24h,
            )

            position = Position(
                organization_id=exchange.client.organization_id,
                client_id=exchange.client_id,
                asset_id=asset.id,
                source_type=SourceType.EXCHANGE,
                source_id=exchange.id,
                position_type=PositionType.MARGIN,
                quantity=balance.total,
                current_price=balance.price_usd,
                current_value_usd=balance.value_usd,
                unrealized_pnl=Decimal("0"),
                unrealized_pnl_percent=Decimal("0"),
                position_metadata={
                    "exchange": exchange.exchange,
                    "account_type": "margin",
                    "borrowed": str(balance.borrowed),
                    "interest": str(balance.interest),
                    "net_asset": str(balance.net_asset),
                },
            )
            self.db.add(position)
            positions_count += 1

        # Store futures positions
        for futures in summary.futures_positions:
            # Extract base asset from symbol
            base_asset = futures.symbol.replace("USDT", "").replace("USD", "").replace("PERP", "")

            asset = await self._get_or_create_asset(
                symbol=base_asset,
                price_usd=futures.mark_price,
            )

            position = Position(
                organization_id=exchange.client.organization_id,
                client_id=exchange.client_id,
                asset_id=asset.id,
                source_type=SourceType.EXCHANGE,
                source_id=exchange.id,
                position_type=PositionType.FUTURES,
                quantity=futures.size,
                entry_price=futures.entry_price,
                current_price=futures.mark_price,
                current_value_usd=futures.position_value,
                unrealized_pnl=futures.unrealized_pnl,
                unrealized_pnl_percent=futures.unrealized_pnl_percent,
                position_metadata={
                    "exchange": exchange.exchange,
                    "symbol": futures.symbol,
                    "side": futures.side,
                    "leverage": futures.leverage,
                    "category": futures.category,
                    "settle_coin": futures.settle_coin,
                    "liquidation_price": str(futures.liquidation_price) if futures.liquidation_price else None,
                    "margin": str(futures.margin),
                    "realized_pnl": str(futures.realized_pnl),
                },
            )
            self.db.add(position)
            positions_count += 1

        # Store earn positions
        for earn in summary.earn_positions:
            asset = await self._get_or_create_asset(
                symbol=earn.coin,
                price_usd=earn.value_usd / earn.amount if earn.amount > 0 else Decimal("0"),
            )

            position = Position(
                organization_id=exchange.client.organization_id,
                client_id=exchange.client_id,
                asset_id=asset.id,
                source_type=SourceType.EXCHANGE,
                source_id=exchange.id,
                position_type=PositionType.STAKING,  # Earn is similar to staking
                quantity=earn.amount,
                current_price=earn.value_usd / earn.amount if earn.amount > 0 else Decimal("0"),
                current_value_usd=earn.value_usd,
                unrealized_pnl=earn.total_pnl,
                unrealized_pnl_percent=Decimal("0"),
                apy=earn.apy,  # Store APY in dedicated field
                position_metadata={
                    "exchange": exchange.exchange,
                    "account_type": "earn",
                    "product_id": earn.product_id,
                    "product_type": earn.product_type,
                    "status": earn.status,
                    "claimable_yield": str(earn.claimable_yield),
                },
            )
            self.db.add(position)
            positions_count += 1

        return positions_count

    async def _get_or_create_asset(
        self,
        symbol: str,
        price_usd: Decimal,
        change_24h: Decimal = Decimal("0"),
    ) -> Asset:
        """Get existing asset or create new one."""
        result = await self.db.execute(
            select(Asset).where(Asset.symbol == symbol)
        )
        asset = result.scalar_one_or_none()

        if asset:
            # Update price
            asset.current_price_usd = price_usd
            asset.price_change_24h = change_24h
            asset.last_price_update = datetime.now(timezone.utc)
        else:
            asset = Asset(
                symbol=symbol,
                name=symbol,  # Will be updated by price feed later
                current_price_usd=price_usd,
                price_change_24h=change_24h,
                decimals=18,
                last_price_update=datetime.now(timezone.utc),
            )
            self.db.add(asset)
            await self.db.flush()

        return asset

    async def get_exchange_positions_summary(
        self,
        organization_id: Optional[UUID] = None,
        client_id: Optional[UUID] = None,
    ) -> dict:
        """
        Get aggregated exchange positions for display.

        Returns summary with all exchanges and their breakdowns.
        """
        # Build query for exchanges. Always eager-load the owning Client
        # so we can include client name/id in the response and avoid
        # N+1 queries when iterating exchanges below.
        query = select(Exchange).options(selectinload(Exchange.client))

        if organization_id:
            query = query.join(Client).where(Client.organization_id == organization_id)

        if client_id:
            query = query.where(Exchange.client_id == client_id)

        result = await self.db.execute(query)
        exchanges = result.scalars().all()

        # Aggregate data for each exchange
        exchange_data = []
        total_value = Decimal("0")
        total_spot = Decimal("0")
        total_funding = Decimal("0")
        total_margin = Decimal("0")
        total_futures = Decimal("0")
        total_earn = Decimal("0")
        total_unrealized_pnl = Decimal("0")

        for exchange in exchanges:
            # Get positions for this exchange
            positions_result = await self.db.execute(
                select(Position)
                .where(
                    Position.source_type == SourceType.EXCHANGE,
                    Position.source_id == exchange.id,
                )
                .options(selectinload(Position.asset))
            )
            positions = positions_result.scalars().all()

            # Calculate breakdowns
            spot_value = Decimal("0")
            funding_value = Decimal("0")
            margin_value = Decimal("0")
            futures_value = Decimal("0")
            earn_value = Decimal("0")
            unrealized_pnl = Decimal("0")
            top_assets = []

            for pos in positions:
                metadata = pos.position_metadata or {}
                account_type = metadata.get("account_type", "")

                if pos.position_type == PositionType.SPOT:
                    if account_type == "funding":
                        funding_value += pos.current_value_usd
                    else:
                        spot_value += pos.current_value_usd
                        top_assets.append({
                            "symbol": pos.asset.symbol if pos.asset else "???",
                            "value": pos.current_value_usd,
                            "change": pos.asset.price_change_24h if pos.asset else Decimal("0"),
                        })
                elif pos.position_type == PositionType.MARGIN:
                    margin_value += pos.current_value_usd
                elif pos.position_type == PositionType.FUTURES:
                    futures_value += pos.current_value_usd
                    unrealized_pnl += pos.unrealized_pnl or Decimal("0")
                elif pos.position_type == PositionType.STAKING:
                    if account_type == "earn":
                        earn_value += pos.current_value_usd

            # Sort and limit top assets
            top_assets.sort(key=lambda x: x["value"], reverse=True)
            top_assets = top_assets[:3]

            # Calculate totals for this exchange
            ex_total = spot_value + funding_value + margin_value + futures_value + earn_value

            # Determine status
            status = "connected"
            if exchange.sync_error:
                status = "error"
            elif exchange.last_sync_at is None:
                status = "pending"

            # Format last sync time
            last_sync = "never"
            if exchange.last_sync_at:
                delta = datetime.now(timezone.utc) - exchange.last_sync_at
                if delta < timedelta(minutes=1):
                    last_sync = "just now"
                elif delta < timedelta(hours=1):
                    last_sync = f"{int(delta.total_seconds() / 60)} min ago"
                elif delta < timedelta(days=1):
                    last_sync = f"{int(delta.total_seconds() / 3600)} hours ago"
                else:
                    last_sync = f"{delta.days} days ago"

            exchange_data.append({
                "id": str(exchange.id),
                "name": EXCHANGE_NAMES.get(exchange.exchange, exchange.exchange.title()),
                "logo": EXCHANGE_LOGOS.get(exchange.exchange, exchange.exchange[:2].upper()),
                "label": exchange.label,
                "client_id": str(exchange.client_id),
                "client_name": exchange.client.name if exchange.client else None,
                "status": status,
                "last_sync": last_sync,
                "total_value": ex_total,
                "spot_value": spot_value,
                "funding_value": funding_value,
                "margin_value": margin_value,
                "futures_value": futures_value,
                "earn_value": earn_value,
                "unrealized_pnl": unrealized_pnl,
                "pnl_24h": Decimal("0"),  # TODO: Calculate from historical data
                "positions": len(positions),
                "top_assets": top_assets,
            })

            # Add to totals
            total_value += ex_total
            total_spot += spot_value
            total_funding += funding_value
            total_margin += margin_value
            total_futures += futures_value
            total_earn += earn_value
            total_unrealized_pnl += unrealized_pnl

        # Sort exchanges by total value
        exchange_data.sort(key=lambda x: x["total_value"], reverse=True)

        return {
            "total_value": total_value,
            "spot_holdings": total_spot,
            "funding_holdings": total_funding,
            "margin_positions": total_margin,
            "futures_positions": total_futures,
            "earn_positions": total_earn,
            "unrealized_pnl": total_unrealized_pnl,
            "exchanges": exchange_data,
        }

    async def get_exchange_account_data(
        self,
        exchange_id: UUID,
        organization_id: UUID,
        include_subaccounts: bool = False,
    ) -> Optional[ExchangeAccountSummary]:
        """
        Fetch live account data from exchange.

        This bypasses the database and fetches directly from the exchange API.
        """
        result = await self.db.execute(
            select(Exchange)
            .join(Client)
            .where(
                Exchange.id == exchange_id,
                Client.organization_id == organization_id,
            )
        )
        exchange = result.scalar_one_or_none()

        if not exchange:
            return None

        adapter = self.get_adapter(exchange)
        try:
            summary = await adapter.get_account_summary(include_subaccounts=include_subaccounts)
            return summary
        finally:
            await adapter.close()

    async def get_exchange_live_data(
        self,
        exchange_id: UUID,
        organization_id: UUID,
    ) -> Optional[dict]:
        """
        Get live exchange data in a format ready for the frontend.

        Returns detailed breakdown of all account types.
        """
        summary = await self.get_exchange_account_data(
            exchange_id=exchange_id,
            organization_id=organization_id,
            include_subaccounts=True,
        )

        if not summary:
            return None

        # Get exchange info
        result = await self.db.execute(
            select(Exchange)
            .where(Exchange.id == exchange_id)
        )
        exchange = result.scalar_one_or_none()

        if not exchange:
            return None

        return {
            "id": str(exchange_id),
            "name": EXCHANGE_NAMES.get(exchange.exchange, exchange.exchange.title()),
            "logo": EXCHANGE_LOGOS.get(exchange.exchange, exchange.exchange[:2].upper()),
            "status": "connected",
            "last_sync": "live",

            # Balances
            "spot_balances": [
                {
                    "asset": b.asset,
                    "free": float(b.free),
                    "locked": float(b.locked),
                    "total": float(b.total),
                    "value_usd": float(b.value_usd),
                    "price_usd": float(b.price_usd),
                    "change_24h": float(b.change_24h),
                }
                for b in summary.spot_balances
            ],
            "funding_balances": [
                {
                    "asset": b.asset,
                    "free": float(b.free),
                    "locked": float(b.locked),
                    "total": float(b.total),
                    "transferable": float(b.transferable),
                    "value_usd": float(b.value_usd),
                    "price_usd": float(b.price_usd),
                    "change_24h": float(b.change_24h),
                }
                for b in summary.funding_balances
            ],
            "margin_balances": [
                {
                    "asset": b.asset,
                    "free": float(b.free),
                    "locked": float(b.locked),
                    "total": float(b.total),
                    "borrowed": float(b.borrowed),
                    "interest": float(b.interest),
                    "net_asset": float(b.net_asset),
                    "value_usd": float(b.value_usd),
                    "price_usd": float(b.price_usd),
                    "change_24h": float(b.change_24h),
                }
                for b in summary.margin_balances
            ],
            "futures_positions": [
                {
                    "symbol": p.symbol,
                    "side": p.side,
                    "size": float(p.size),
                    "entry_price": float(p.entry_price),
                    "mark_price": float(p.mark_price),
                    "liquidation_price": float(p.liquidation_price) if p.liquidation_price else None,
                    "unrealized_pnl": float(p.unrealized_pnl),
                    "unrealized_pnl_percent": float(p.unrealized_pnl_percent),
                    "margin": float(p.margin),
                    "leverage": p.leverage,
                    "position_value": float(p.position_value),
                    "category": p.category,
                    "settle_coin": p.settle_coin,
                }
                for p in summary.futures_positions
            ],
            "earn_positions": [
                {
                    "product_id": p.product_id,
                    "product_type": p.product_type,
                    "coin": p.coin,
                    "amount": float(p.amount),
                    "total_pnl": float(p.total_pnl),
                    "claimable_yield": float(p.claimable_yield),
                    "status": p.status,
                    "value_usd": float(p.value_usd),
                }
                for p in summary.earn_positions
            ],

            # Totals
            "total_spot_usd": float(summary.total_spot_usd),
            "total_funding_usd": float(summary.total_funding_usd),
            "total_margin_usd": float(summary.total_margin_usd),
            "total_futures_usd": float(summary.total_futures_usd),
            "total_earn_usd": float(summary.total_earn_usd),
            "total_value_usd": float(summary.total_value_usd),
            "total_unrealized_pnl": float(summary.total_unrealized_pnl),

            # Subaccounts (with full balance data)
            "subaccounts": [
                {
                    "uid": s.uid,
                    "username": s.username,
                    "total_value_usd": float(s.total_value_usd),
                    "balances_count": len(s.spot_balances),
                    "balances": [
                        {
                            "asset": b.asset,
                            "total": float(b.total),
                            "value_usd": float(b.value_usd),
                            "price_usd": float(b.price_usd),
                            "change_24h": float(getattr(b, 'change_24h', 0)),
                        }
                        for b in s.spot_balances
                    ],
                }
                for s in summary.subaccounts
            ],
            "total_subaccounts_value": float(summary.total_subaccounts_value_usd),
        }

    async def get_exchange_transactions(
        self,
        organization_id: Optional[UUID] = None,
        exchange_id: Optional[UUID] = None,
        limit: int = 50,
    ) -> list[dict]:
        """
        Get transactions from exchanges scoped to an organization.

        Fetches live transaction data from exchange APIs. When
        organization_id is provided, only exchanges owned by clients
        of that organization are queried.
        """
        # Get exchanges
        query = select(Exchange)
        if organization_id:
            query = query.join(Client).where(Client.organization_id == organization_id)
        if exchange_id:
            query = query.where(Exchange.id == exchange_id)

        result = await self.db.execute(query)
        exchanges = result.scalars().all()

        all_transactions = []

        import sys
        print(f"[TX-DEBUG] Fetching transactions for {len(exchanges)} exchange(s)", file=sys.stderr, flush=True)

        for exchange in exchanges:
            try:
                adapter = self.get_adapter(exchange)
                transactions = await adapter.get_all_transactions(limit=limit)
                await adapter.close()

                print(f"[TX-DEBUG] Exchange {exchange.exchange} ({exchange.id}): fetched {len(transactions)} transactions", file=sys.stderr, flush=True)

                exchange_name = EXCHANGE_NAMES.get(exchange.exchange, exchange.exchange.title())
                exchange_label = exchange.label or exchange_name

                for tx in transactions:
                    tx.exchange = exchange.exchange
                    tx.exchange_label = exchange_label
                    all_transactions.append({
                        "id": tx.id,
                        "exchange_id": str(exchange.id),
                        "exchange": exchange.exchange,
                        "exchange_name": exchange_name,
                        "exchange_label": exchange_label,
                        "type": tx.type,
                        "coin": tx.coin,
                        "amount": float(tx.amount),
                        "fee": float(tx.fee),
                        "value_usd": float(tx.value_usd),
                        "status": tx.status,
                        "tx_id": tx.tx_id,
                        "from_account": tx.from_account,
                        "to_account": tx.to_account,
                        "chain": tx.chain,
                        "address": tx.address,
                        "timestamp": tx.timestamp.isoformat(),
                    })

            except Exception as e:
                logger.warning(f"Failed to get transactions for exchange {exchange.id}: {e}", exc_info=True)
                continue

        # Sort by timestamp descending
        all_transactions.sort(key=lambda t: t["timestamp"], reverse=True)
        return all_transactions[:limit]
