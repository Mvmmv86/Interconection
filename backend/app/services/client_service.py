"""Client Service - Business logic for client portfolio operations."""

import logging
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.client import Client
from app.models.wallet import Wallet
from app.models.exchange import Exchange
from app.models.position import Position, SourceType, PositionType
from app.models.asset import Asset
from app.models.manual_asset import ManualAsset
from app.models.staking_position import StakingPosition
from app.models.pool_position import PoolPosition
from app.schemas.client import ClientListResponse
from app.schemas.client_portfolio import (
    ClientPortfolio,
    ClientPortfolioSummary,
    ClientPortfolioListItem,
    ClientWallet,
    ClientExchange,
)
from app.schemas.manual_asset import ManualAssetResponse
from app.schemas.staking_position import StakingPositionResponse
from app.schemas.pool_position import PoolPositionResponse
from app.schemas.wallet import WalletTokenBalance
from app.schemas.exchange import ExchangeBalance

logger = logging.getLogger(__name__)


class ClientService:
    """Service for client portfolio operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_clients_with_summaries(
        self,
        organization_id: UUID,
    ) -> List[ClientPortfolioListItem]:
        """
        Get all clients with real portfolio summaries.

        For each client, calculates:
        - total_value_usd from positions + manual_assets + staking + pools
        - pnl_24h_percent from positions
        - wallet_count, exchange_count
        - position_count
        - pending_rewards_usd
        - average_apy (weighted by value)
        """
        # Fetch clients with wallets and exchanges counts
        result = await self.db.execute(
            select(Client)
            .where(Client.organization_id == organization_id)
            .options(
                selectinload(Client.wallets),
                selectinload(Client.exchanges),
                selectinload(Client.manual_assets),
                selectinload(Client.staking_positions),
                selectinload(Client.pool_positions),
            )
            .order_by(Client.name)
        )
        clients = result.scalars().all()

        items: List[ClientPortfolioListItem] = []

        for client in clients:
            # Get positions total value and PnL for this client
            pos_result = await self.db.execute(
                select(
                    func.coalesce(func.sum(Position.current_value_usd), 0).label("total_value"),
                    func.coalesce(func.sum(Position.unrealized_pnl), 0).label("total_pnl"),
                    func.count(Position.id).label("position_count"),
                ).where(Position.client_id == client.id)
            )
            pos_row = pos_result.one()
            positions_value = Decimal(str(pos_row.total_value))
            positions_pnl = Decimal(str(pos_row.total_pnl))
            position_count = pos_row.position_count

            # Manual assets value
            manual_value = Decimal("0")
            manual_pnl = Decimal("0")
            for asset in client.manual_assets:
                cv = asset.quantity * (asset.current_price or asset.purchase_price)
                cb = asset.quantity * asset.purchase_price
                manual_value += cv
                manual_pnl += cv - cb

            # Staking value + rewards
            staking_value = Decimal("0")
            pending_rewards = Decimal("0")
            weighted_apy_sum = Decimal("0")
            for sp in client.staking_positions:
                staking_value += sp.value_usd
                pending_rewards += sp.rewards_pending_usd
                weighted_apy_sum += sp.apy * sp.value_usd

            # Pool value
            pool_value = Decimal("0")
            for pp in client.pool_positions:
                pool_value += pp.total_value_usd
                pending_rewards += pp.fees_unclaimed_usd
                weighted_apy_sum += pp.total_apr * pp.total_value_usd

            # Totals
            total_value = positions_value + manual_value + staking_value + pool_value
            total_pnl = positions_pnl + manual_pnl

            # PnL percent
            cost_basis = total_value - total_pnl
            pnl_percent = (total_pnl / cost_basis * 100) if cost_basis > 0 else Decimal("0")

            # Weighted average APY
            yield_base = staking_value + pool_value
            average_apy = (weighted_apy_sum / yield_base) if yield_base > 0 else Decimal("0")

            items.append(
                ClientPortfolioListItem(
                    id=client.id,
                    name=client.name,
                    email=client.email,
                    color=client.color,
                    total_value_usd=total_value,
                    pnl_24h_percent=pnl_percent,
                    wallet_count=len(client.wallets),
                    exchange_count=len(client.exchanges),
                    position_count=position_count + len(client.manual_assets) + len(client.staking_positions) + len(client.pool_positions),
                    pending_rewards_usd=pending_rewards,
                    average_apy=average_apy,
                )
            )

        return items

    async def get_client_portfolio(
        self,
        client_id: UUID,
        organization_id: UUID,
    ) -> ClientPortfolio:
        """
        Get complete client portfolio with real data from positions table.

        Builds:
        - Wallets with real token balances from positions (source_type=WALLET)
        - Exchanges with real balances from positions (source_type=EXCHANGE)
        - Manual assets with computed P&L
        - Staking positions
        - Pool positions
        - Summary with all real metrics
        """
        # Fetch client with all relations
        result = await self.db.execute(
            select(Client)
            .where(
                Client.id == client_id,
                Client.organization_id == organization_id,
            )
            .options(
                selectinload(Client.wallets),
                selectinload(Client.exchanges),
                selectinload(Client.manual_assets),
                selectinload(Client.staking_positions),
                selectinload(Client.pool_positions),
            )
        )
        client = result.scalar_one_or_none()

        if not client:
            return None

        # Fetch all positions for this client with asset data
        positions_result = await self.db.execute(
            select(Position)
            .where(Position.client_id == client_id)
            .options(selectinload(Position.asset))
        )
        all_positions = positions_result.scalars().all()

        # Group positions by source
        wallet_positions: dict[UUID, list[Position]] = {}
        exchange_positions: dict[UUID, list[Position]] = {}
        for pos in all_positions:
            if pos.source_type == SourceType.WALLET and pos.source_id:
                wallet_positions.setdefault(pos.source_id, []).append(pos)
            elif pos.source_type == SourceType.EXCHANGE and pos.source_id:
                exchange_positions.setdefault(pos.source_id, []).append(pos)

        # Build wallet data with real balances
        wallets_data: List[ClientWallet] = []
        total_wallet_value = Decimal("0")
        for wallet in client.wallets:
            positions = wallet_positions.get(wallet.id, [])
            wallet_value = sum(p.current_value_usd for p in positions)
            total_wallet_value += wallet_value

            tokens = []
            for pos in positions:
                tokens.append(
                    WalletTokenBalance(
                        symbol=pos.asset.symbol if pos.asset else "???",
                        name=pos.asset.name if pos.asset else "Unknown",
                        contract_address=pos.asset.contract_address if pos.asset else None,
                        balance=pos.quantity,
                        balance_usd=pos.current_value_usd,
                        price_usd=pos.current_price,
                        price_change_24h=pos.asset.price_change_24h if pos.asset else Decimal("0"),
                        logo_url=pos.asset.logo_url if pos.asset else None,
                    )
                )
            # Sort tokens by value desc
            tokens.sort(key=lambda t: t.balance_usd, reverse=True)

            wallets_data.append(
                ClientWallet(
                    id=wallet.id,
                    client_id=wallet.client_id,
                    address=wallet.address,
                    network=wallet.network,
                    chain=wallet.chain,
                    label=wallet.label,
                    is_active=wallet.is_active,
                    added_at=wallet.added_at,
                    last_scan_at=wallet.last_scan_at,
                    total_value_usd=wallet_value,
                    token_count=len(tokens),
                    tokens=tokens,
                )
            )

        # Build exchange data with real balances
        exchanges_data: List[ClientExchange] = []
        total_exchange_value = Decimal("0")
        for exchange in client.exchanges:
            positions = exchange_positions.get(exchange.id, [])
            exchange_value = sum(p.current_value_usd for p in positions)
            total_exchange_value += exchange_value

            balances = []
            for pos in positions:
                balances.append(
                    ExchangeBalance(
                        asset=pos.asset.symbol if pos.asset else "???",
                        free=pos.quantity,
                        locked=Decimal("0"),
                        total=pos.quantity,
                        value_usd=pos.current_value_usd,
                        price_usd=pos.current_price,
                        change_24h=pos.asset.price_change_24h if pos.asset else Decimal("0"),
                        entry_price=pos.entry_price,
                        cost_basis=pos.cost_basis,
                        unrealized_pnl=pos.unrealized_pnl or Decimal("0"),
                        unrealized_pnl_percent=pos.unrealized_pnl_percent or Decimal("0"),
                        apy=pos.apy,
                        position_type=pos.position_type.value if pos.position_type else "spot",
                    )
                )
            # Sort by value desc
            balances.sort(key=lambda b: b.value_usd, reverse=True)

            exchanges_data.append(
                ClientExchange(
                    id=exchange.id,
                    client_id=exchange.client_id,
                    exchange=exchange.exchange,
                    label=exchange.label,
                    api_key_masked=exchange.api_key_masked,
                    is_active=exchange.is_active,
                    added_at=exchange.added_at,
                    last_sync_at=exchange.last_sync_at,
                    sync_error=exchange.sync_error,
                    total_value_usd=exchange_value,
                    asset_count=len(balances),
                    balances=balances,
                )
            )

        # Build manual assets
        manual_assets_data: List[ManualAssetResponse] = []
        total_manual_value = Decimal("0")
        total_manual_pnl = Decimal("0")
        for asset in client.manual_assets:
            current_value = asset.quantity * (asset.current_price or asset.purchase_price)
            cost_basis = asset.quantity * asset.purchase_price
            pnl = current_value - cost_basis
            pnl_percent = (pnl / cost_basis * 100) if cost_basis > 0 else Decimal("0")

            manual_assets_data.append(
                ManualAssetResponse(
                    id=asset.id,
                    client_id=asset.client_id,
                    token=asset.token,
                    token_name=asset.token_name,
                    network=asset.network,
                    quantity=asset.quantity,
                    purchase_price=asset.purchase_price,
                    purchase_date=asset.purchase_date,
                    current_price=asset.current_price,
                    type=asset.type,
                    staking_provider=asset.staking_provider,
                    apy=asset.apy,
                    notes=asset.notes,
                    current_value_usd=current_value,
                    cost_basis=cost_basis,
                    unrealized_pnl=pnl,
                    unrealized_pnl_percent=pnl_percent,
                    created_at=asset.created_at,
                    updated_at=asset.updated_at,
                )
            )
            total_manual_value += current_value
            total_manual_pnl += pnl

        # Staking positions
        staking_data: List[StakingPositionResponse] = []
        total_staking_value = Decimal("0")
        total_rewards_pending = Decimal("0")
        total_rewards_claimed = Decimal("0")
        weighted_apy_sum = Decimal("0")
        for sp in client.staking_positions:
            staking_data.append(StakingPositionResponse.model_validate(sp))
            total_staking_value += sp.value_usd
            total_rewards_pending += sp.rewards_pending_usd
            total_rewards_claimed += sp.rewards_claimed_usd
            weighted_apy_sum += sp.apy * sp.value_usd

        # Pool positions
        pool_data: List[PoolPositionResponse] = []
        total_lp_value = Decimal("0")
        total_fees_earned = Decimal("0")
        total_il = Decimal("0")
        for pp in client.pool_positions:
            pool_data.append(PoolPositionResponse.model_validate(pp))
            total_lp_value += pp.total_value_usd
            total_fees_earned += pp.fees_earned_usd
            total_il += pp.impermanent_loss_usd
            total_rewards_pending += pp.fees_unclaimed_usd
            weighted_apy_sum += pp.total_apr * pp.total_value_usd

        # Total PnL from positions (handle None values)
        positions_pnl = sum((p.unrealized_pnl or Decimal("0")) for p in all_positions)
        total_pnl = positions_pnl + total_manual_pnl

        # Total value
        total_value = (
            total_wallet_value
            + total_exchange_value
            + total_manual_value
            + total_staking_value
            + total_lp_value
        )

        # Weighted average APY
        yield_base = total_staking_value + total_lp_value
        average_apy = (weighted_apy_sum / yield_base) if yield_base > 0 else Decimal("0")

        # PnL percent
        cost_basis_total = total_value - total_pnl
        pnl_percent = (total_pnl / cost_basis_total * 100) if cost_basis_total > 0 else Decimal("0")

        # Allocation by type
        holding_value = total_wallet_value + total_exchange_value + total_manual_value
        allocation_by_type = {}
        if total_value > 0:
            allocation_by_type = {
                "holding": float(holding_value / total_value * 100),
                "staking": float(total_staking_value / total_value * 100),
                "lp": float(total_lp_value / total_value * 100),
            }

        # Allocation by chain from positions
        allocation_by_chain: dict[str, float] = {}
        for pos in all_positions:
            chain = pos.asset.chain if pos.asset and pos.asset.chain else "unknown"
            allocation_by_chain[chain] = allocation_by_chain.get(chain, 0) + float(pos.current_value_usd)
        # Convert to percentages
        if total_value > 0:
            for chain in allocation_by_chain:
                allocation_by_chain[chain] = allocation_by_chain[chain] / float(total_value) * 100

        # Allocation by asset (top 10)
        asset_values: dict[str, float] = {}
        for pos in all_positions:
            symbol = pos.asset.symbol if pos.asset else "???"
            asset_values[symbol] = asset_values.get(symbol, 0) + float(pos.current_value_usd)
        for asset in client.manual_assets:
            cv = float(asset.quantity * (asset.current_price or asset.purchase_price))
            asset_values[asset.token] = asset_values.get(asset.token, 0) + cv
        # Sort and take top 10, convert to percentages
        allocation_by_asset: dict[str, float] = {}
        if total_value > 0:
            sorted_assets = sorted(asset_values.items(), key=lambda x: x[1], reverse=True)[:10]
            for symbol, val in sorted_assets:
                allocation_by_asset[symbol] = val / float(total_value) * 100

        # Build summary
        summary = ClientPortfolioSummary(
            total_value_usd=total_value,
            total_holding_usd=holding_value,
            total_staking_usd=total_staking_value,
            total_lending_usd=Decimal("0"),
            total_lp_usd=total_lp_value,
            total_pnl_usd=total_pnl,
            total_pnl_percent=pnl_percent,
            pnl_24h_usd=Decimal("0"),  # TODO: requires historical data
            pnl_24h_percent=Decimal("0"),
            pnl_7d_usd=Decimal("0"),
            pnl_7d_percent=Decimal("0"),
            pnl_30d_usd=Decimal("0"),
            pnl_30d_percent=Decimal("0"),
            pending_rewards_usd=total_rewards_pending,
            claimed_rewards_usd=total_rewards_claimed,
            average_apy=average_apy,
            estimated_yearly_yield=yield_base * average_apy / 100,
            total_fees_earned_usd=total_fees_earned,
            total_il_usd=total_il,
            asset_count=len(all_positions) + len(manual_assets_data) + len(staking_data) + len(pool_data),
            wallet_count=len(wallets_data),
            exchange_count=len(exchanges_data),
            staking_position_count=len(staking_data),
            lp_position_count=len(pool_data),
            manual_asset_count=len(manual_assets_data),
            allocation_by_type=allocation_by_type,
            allocation_by_chain=allocation_by_chain,
            allocation_by_asset=allocation_by_asset,
        )

        return ClientPortfolio(
            client=ClientResponse.model_validate(client),
            wallets=wallets_data,
            exchanges=exchanges_data,
            manual_assets=manual_assets_data,
            staking_positions=staking_data,
            pool_positions=pool_data,
            summary=summary,
        )


# Need ClientResponse import at module level for model_validate
from app.schemas.client import ClientResponse  # noqa: E402
