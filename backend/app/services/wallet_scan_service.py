"""Wallet Scan Service - Fetch wallet positions via Zerion API (server-side)."""

import logging
import time
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from uuid import UUID, uuid4

import httpx
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.asset import Asset
from app.models.position import Position, SourceType, PositionType
from app.models.wallet import Wallet

logger = logging.getLogger(__name__)

# Zerion API v1 base URL
ZERION_API_BASE = "https://api.zerion.io/v1"


class WalletScanError(Exception):
    """Error during wallet scan."""
    pass


class WalletScanService:
    """Service for scanning wallets via Zerion API."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.api_key = settings.zerion_api_key

    def _get_auth_header(self) -> dict:
        """Build Basic auth header for Zerion API."""
        import base64
        credentials = base64.b64encode(f"{self.api_key}:".encode()).decode()
        return {
            "Authorization": f"Basic {credentials}",
            "Accept": "application/json",
        }

    async def scan_wallet(
        self,
        wallet_id: UUID,
        organization_id: UUID,
    ) -> dict:
        """
        Scan a wallet for all positions via Zerion API.

        1. Fetches all positions (tokens + DeFi) from Zerion
        2. Upserts assets in the assets table
        3. Replaces positions in the positions table for this wallet
        4. Updates wallet.last_scan_at

        Returns: {tokens_found, total_value_usd, new_positions_detected, scan_time_ms}
        """
        start_time = time.time()

        # Get wallet
        result = await self.db.execute(
            select(Wallet).where(Wallet.id == wallet_id)
        )
        wallet = result.scalar_one_or_none()
        if not wallet:
            raise WalletScanError(f"Wallet {wallet_id} not found")

        if not self.api_key:
            raise WalletScanError("Zerion API key not configured")

        # Fetch positions from Zerion
        zerion_positions = await self._fetch_zerion_positions(wallet.address)

        # Delete old positions for this wallet
        await self.db.execute(
            delete(Position).where(
                Position.source_type == SourceType.WALLET,
                Position.source_id == wallet_id,
            )
        )

        # Process each position
        total_value = Decimal("0")
        positions_created = 0

        for zpos in zerion_positions:
            try:
                position = await self._process_zerion_position(
                    zpos=zpos,
                    wallet=wallet,
                    organization_id=organization_id,
                )
                if position:
                    self.db.add(position)
                    total_value += position.current_value_usd
                    positions_created += 1
            except Exception as e:
                logger.warning(f"Failed to process position: {e}")
                continue

        # Update wallet scan timestamp
        wallet.last_scan_at = datetime.now(timezone.utc)
        await self.db.flush()

        scan_time_ms = int((time.time() - start_time) * 1000)

        return {
            "tokens_found": positions_created,
            "total_value_usd": total_value,
            "new_positions_detected": positions_created,
            "scan_time_ms": scan_time_ms,
        }

    async def _fetch_zerion_positions(self, address: str) -> list:
        """Fetch all positions from Zerion API for an address."""
        all_positions = []
        url = f"{ZERION_API_BASE}/wallets/{address}/positions/"
        params = {
            "filter[positions]": "no_filter",
            "filter[trash]": "only_non_trash",
            "currency": "usd",
            "sort": "value",
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            while url:
                response = await client.get(
                    url,
                    headers=self._get_auth_header(),
                    params=params if not all_positions else None,  # params only on first request
                )

                if response.status_code != 200:
                    logger.error(f"Zerion API error: {response.status_code} - {response.text[:200]}")
                    raise WalletScanError(f"Zerion API error: {response.status_code}")

                data = response.json()
                positions = data.get("data", [])
                all_positions.extend(positions)

                # Handle pagination
                next_url = data.get("links", {}).get("next")
                if next_url:
                    url = next_url
                    params = None  # next URL already includes params
                else:
                    url = None

        logger.info(f"Fetched {len(all_positions)} positions from Zerion for {address[:10]}...")
        return all_positions

    async def _process_zerion_position(
        self,
        zpos: dict,
        wallet: Wallet,
        organization_id: UUID,
    ) -> Optional[Position]:
        """Process a single Zerion position and create a Position model."""
        attrs = zpos.get("attributes", {})
        if not attrs:
            return None

        # Get value — skip dust positions
        value = attrs.get("value")
        if value is None or abs(value) < 0.01:
            return None

        # Extract fungible info
        fungible = attrs.get("fungible_info", {})
        symbol = fungible.get("symbol", "???").upper()
        name = fungible.get("name", symbol)
        icon_url = (fungible.get("icon") or {}).get("url")

        # Get implementation address
        implementations = fungible.get("implementations", [])
        contract_address = None
        decimals = 18
        if implementations:
            contract_address = implementations[0].get("address")
            decimals = implementations[0].get("decimals", 18)

        # Determine position type from Zerion's position_type
        position_type_str = attrs.get("position_type", "wallet")
        position_type = self._map_position_type(position_type_str)

        # Get or create asset
        asset = await self._get_or_create_asset(
            symbol=symbol,
            name=name,
            price=Decimal(str(attrs.get("price", 0) or 0)),
            logo_url=icon_url,
            contract_address=contract_address,
            chain=wallet.chain,
            decimals=decimals,
        )

        # Get quantity
        quantity_data = attrs.get("quantity", {})
        quantity = Decimal(str(quantity_data.get("float", 0) or 0))
        price = Decimal(str(attrs.get("price", 0) or 0))
        value_usd = Decimal(str(value))

        # Get changes
        changes = attrs.get("changes") or {}
        pnl_1d = Decimal(str(changes.get("absolute_1d", 0) or 0))

        # Determine protocol
        protocol = attrs.get("protocol")

        # APY from Zerion (if available in position)
        apy = None

        # Build position
        position = Position(
            id=uuid4(),
            organization_id=organization_id,
            client_id=wallet.client_id,
            asset_id=asset.id,
            source_type=SourceType.WALLET,
            source_id=wallet.id,
            position_type=position_type,
            quantity=quantity,
            entry_price=None,
            current_price=price,
            current_value_usd=value_usd,
            cost_basis=None,
            unrealized_pnl=pnl_1d,
            unrealized_pnl_percent=Decimal("0"),
            apy=apy,
            pending_rewards=None,
            pending_rewards_usd=None,
            protocol=protocol,
            pool_address=None,
        )

        return position

    def _map_position_type(self, zerion_type: str) -> PositionType:
        """Map Zerion position_type to our PositionType enum."""
        mapping = {
            "wallet": PositionType.SPOT,
            "deposit": PositionType.LENDING,
            "staked": PositionType.STAKING,
            "reward": PositionType.STAKING,
            "locked": PositionType.STAKING,
            "loan": PositionType.LENDING,
            "liquidity": PositionType.LP,
            "claimable": PositionType.STAKING,
        }
        return mapping.get(zerion_type, PositionType.SPOT)

    async def _get_or_create_asset(
        self,
        symbol: str,
        name: str,
        price: Decimal,
        logo_url: Optional[str] = None,
        contract_address: Optional[str] = None,
        chain: Optional[str] = None,
        decimals: int = 18,
    ) -> Asset:
        """Get existing asset or create new one. Also updates price."""
        # Try to find by symbol
        result = await self.db.execute(
            select(Asset).where(Asset.symbol == symbol)
        )
        asset = result.scalar_one_or_none()

        if asset:
            # Update price if we have a newer one
            if price > 0:
                asset.current_price_usd = price
                asset.last_price_update = datetime.now(timezone.utc)
            if logo_url and not asset.logo_url:
                asset.logo_url = logo_url
            return asset

        # Create new asset
        asset = Asset(
            id=uuid4(),
            symbol=symbol,
            name=name,
            decimals=decimals,
            chain=chain,
            contract_address=contract_address,
            current_price_usd=price,
            logo_url=logo_url,
            last_price_update=datetime.now(timezone.utc),
        )
        self.db.add(asset)
        await self.db.flush()

        return asset
