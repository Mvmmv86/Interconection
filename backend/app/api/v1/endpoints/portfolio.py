"""Portfolio endpoints."""

from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Query
from sqlalchemy import select, func

from app.api.deps import CurrentUser, DBSession
from app.models.position import Position, PositionType
from app.models.client import Client
from app.models.wallet import Wallet
from app.models.exchange import Exchange
from app.models.portfolio_snapshot import PortfolioSnapshot as PortfolioSnapshotModel
from app.schemas.portfolio import (
    PortfolioSummary,
    PortfolioAllocation,
    PortfolioHistory,
    PortfolioHistoryPoint,
    AllocationItem,
    PortfolioSnapshot,
)

router = APIRouter()


@router.get("/summary", response_model=PortfolioSummary)
async def get_portfolio_summary(
    current_user: CurrentUser,
    db: DBSession,
    client_id: Optional[UUID] = None,
) -> PortfolioSummary:
    """Get portfolio summary."""
    org_id = current_user.organization_id

    # Get positions
    query = select(Position).where(Position.organization_id == org_id)
    if client_id:
        query = query.where(Position.client_id == client_id)

    result = await db.execute(query)
    positions = result.scalars().all()

    # Calculate totals
    total_value = Decimal("0")
    total_holding = Decimal("0")
    total_staking = Decimal("0")
    total_lending = Decimal("0")
    total_lp = Decimal("0")
    pending_rewards = Decimal("0")
    total_pnl = Decimal("0")
    weighted_apy_sum = Decimal("0")
    yield_value = Decimal("0")

    for pos in positions:
        total_value += pos.current_value_usd
        total_pnl += pos.unrealized_pnl

        if pos.position_type == PositionType.SPOT:
            total_holding += pos.current_value_usd
        elif pos.position_type == PositionType.STAKING:
            total_staking += pos.current_value_usd
            yield_value += pos.current_value_usd
            if pos.apy:
                weighted_apy_sum += pos.apy * pos.current_value_usd
        elif pos.position_type == PositionType.LENDING:
            total_lending += pos.current_value_usd
            yield_value += pos.current_value_usd
            if pos.apy:
                weighted_apy_sum += pos.apy * pos.current_value_usd
        elif pos.position_type == PositionType.LP:
            total_lp += pos.current_value_usd
            yield_value += pos.current_value_usd
            if pos.apy:
                weighted_apy_sum += pos.apy * pos.current_value_usd

        if pos.pending_rewards_usd:
            pending_rewards += pos.pending_rewards_usd

    avg_apy = (weighted_apy_sum / yield_value) if yield_value > 0 else Decimal("0")
    projected_yearly = yield_value * avg_apy / 100 if avg_apy > 0 else Decimal("0")
    projected_monthly = projected_yearly / 12

    # Count clients, wallets, exchanges
    client_count = await db.scalar(
        select(func.count(Client.id)).where(Client.organization_id == org_id)
    )
    wallet_count = await db.scalar(
        select(func.count(Wallet.id))
        .join(Client)
        .where(Client.organization_id == org_id)
    )
    exchange_count = await db.scalar(
        select(func.count(Exchange.id))
        .join(Client)
        .where(Client.organization_id == org_id)
    )

    return PortfolioSummary(
        total_value_usd=total_value,
        total_holding_usd=total_holding,
        total_staking_usd=total_staking,
        total_lending_usd=total_lending,
        total_lp_usd=total_lp,
        pnl_24h=Decimal("0"),  # TODO: Calculate from snapshots
        pnl_24h_percent=Decimal("0"),
        pnl_7d=Decimal("0"),
        pnl_7d_percent=Decimal("0"),
        pnl_30d=Decimal("0"),
        pnl_30d_percent=Decimal("0"),
        pnl_total=total_pnl,
        pnl_total_percent=(total_pnl / total_value * 100) if total_value > 0 else Decimal("0"),
        pending_rewards_usd=pending_rewards,
        average_apy=avg_apy,
        projected_yearly_yield=projected_yearly,
        projected_monthly_yield=projected_monthly,
        client_count=client_count or 0,
        position_count=len(positions),
        wallet_count=wallet_count or 0,
        exchange_count=exchange_count or 0,
        last_updated=datetime.now(timezone.utc),
    )


@router.get("/allocation", response_model=PortfolioAllocation)
async def get_portfolio_allocation(
    current_user: CurrentUser,
    db: DBSession,
    client_id: Optional[UUID] = None,
) -> PortfolioAllocation:
    """Get portfolio allocation breakdown."""
    org_id = current_user.organization_id

    query = select(Position).where(Position.organization_id == org_id)
    if client_id:
        query = query.where(Position.client_id == client_id)

    result = await db.execute(query)
    positions = result.scalars().all()

    # Calculate allocations
    total_value = sum(pos.current_value_usd for pos in positions)

    # By type
    type_totals = {}
    for pos in positions:
        key = pos.position_type.value
        type_totals[key] = type_totals.get(key, Decimal("0")) + pos.current_value_usd

    by_type = [
        AllocationItem(
            name=k,
            value_usd=v,
            percentage=(v / total_value * 100) if total_value > 0 else Decimal("0"),
        )
        for k, v in type_totals.items()
    ]

    # By protocol (for DeFi positions)
    protocol_totals = {}
    for pos in positions:
        if pos.protocol:
            protocol_totals[pos.protocol] = protocol_totals.get(pos.protocol, Decimal("0")) + pos.current_value_usd

    by_protocol = [
        AllocationItem(
            name=k,
            value_usd=v,
            percentage=(v / total_value * 100) if total_value > 0 else Decimal("0"),
        )
        for k, v in protocol_totals.items()
    ]

    return PortfolioAllocation(
        by_type=by_type,
        by_chain=[],  # TODO: Group by chain from asset
        by_asset=[],  # TODO: Group by asset
        by_protocol=by_protocol,
        by_client=[],  # TODO: Group by client
    )


@router.get("/history", response_model=PortfolioHistory)
async def get_portfolio_history(
    current_user: CurrentUser,
    db: DBSession,
    period: str = Query("30d", pattern=r"^(24h|7d|30d|90d|1y|all)$"),
    client_id: Optional[UUID] = None,
) -> PortfolioHistory:
    """Get portfolio historical data."""
    org_id = current_user.organization_id

    # Get snapshots from database
    query = select(PortfolioSnapshotModel).where(
        PortfolioSnapshotModel.organization_id == org_id
    )
    if client_id:
        query = query.where(PortfolioSnapshotModel.client_id == client_id)

    query = query.order_by(PortfolioSnapshotModel.timestamp.desc()).limit(365)

    result = await db.execute(query)
    snapshots = result.scalars().all()

    data_points = [
        PortfolioHistoryPoint(
            timestamp=s.timestamp,
            total_value_usd=s.total_value_usd,
            pnl_usd=s.pnl_24h,
            pnl_percent=Decimal("0"),
        )
        for s in snapshots
    ]

    start_value = data_points[-1].total_value_usd if data_points else Decimal("0")
    end_value = data_points[0].total_value_usd if data_points else Decimal("0")
    high_value = max((p.total_value_usd for p in data_points), default=Decimal("0"))
    low_value = min((p.total_value_usd for p in data_points), default=Decimal("0"))
    change_usd = end_value - start_value
    change_percent = (change_usd / start_value * 100) if start_value > 0 else Decimal("0")

    return PortfolioHistory(
        period=period,
        data_points=data_points,
        start_value=start_value,
        end_value=end_value,
        high_value=high_value,
        low_value=low_value,
        change_usd=change_usd,
        change_percent=change_percent,
    )


@router.get("/snapshots", response_model=List[PortfolioSnapshot])
async def get_portfolio_snapshots(
    current_user: CurrentUser,
    db: DBSession,
    client_id: Optional[UUID] = None,
    limit: int = Query(30, ge=1, le=365),
) -> List[PortfolioSnapshot]:
    """Get daily portfolio snapshots."""
    org_id = current_user.organization_id

    query = select(PortfolioSnapshotModel).where(
        PortfolioSnapshotModel.organization_id == org_id
    )
    if client_id:
        query = query.where(PortfolioSnapshotModel.client_id == client_id)

    query = query.order_by(PortfolioSnapshotModel.timestamp.desc()).limit(limit)

    result = await db.execute(query)
    snapshots = result.scalars().all()

    return [PortfolioSnapshot.model_validate(s) for s in snapshots]
