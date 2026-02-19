"""Staking Position endpoints."""

from typing import List
from uuid import UUID

from fastapi import APIRouter, HTTPException, status, Query
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession
from app.models.staking_position import StakingPosition, StakingProtocol, StakingNetwork
from app.schemas.staking_position import (
    StakingPositionResponse,
    StakingPositionSummary,
)

router = APIRouter()


@router.get("", response_model=List[StakingPositionResponse])
async def list_staking_positions(
    current_user: CurrentUser,
    db: DBSession,
    client_id: UUID = None,
    protocol: StakingProtocol = None,
    network: StakingNetwork = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> List[StakingPositionResponse]:
    """
    List all staking positions for the organization.

    Can be filtered by client_id, protocol, or network.
    """
    query = select(StakingPosition).where(
        StakingPosition.organization_id == current_user.organization_id
    )

    if client_id:
        query = query.where(StakingPosition.client_id == client_id)
    if protocol:
        query = query.where(StakingPosition.protocol == protocol)
    if network:
        query = query.where(StakingPosition.network == network)

    query = query.offset(skip).limit(limit).order_by(StakingPosition.value_usd.desc())

    result = await db.execute(query)
    positions = result.scalars().all()

    return [StakingPositionResponse.model_validate(p) for p in positions]


@router.get("/summary", response_model=StakingPositionSummary)
async def get_staking_summary(
    current_user: CurrentUser,
    db: DBSession,
    client_id: UUID = None,
) -> StakingPositionSummary:
    """
    Get a summary of all staking positions.

    Returns totals, averages, and breakdowns by protocol/network.
    """
    query = select(StakingPosition).where(
        StakingPosition.organization_id == current_user.organization_id
    )

    if client_id:
        query = query.where(StakingPosition.client_id == client_id)

    result = await db.execute(query)
    positions = result.scalars().all()

    from decimal import Decimal

    total_value = Decimal("0")
    total_rewards_pending = Decimal("0")
    total_rewards_claimed = Decimal("0")
    weighted_apy_sum = Decimal("0")
    by_protocol: dict[str, Decimal] = {}
    by_network: dict[str, Decimal] = {}
    by_type: dict[str, Decimal] = {}

    for p in positions:
        total_value += p.value_usd
        total_rewards_pending += p.rewards_pending_usd
        total_rewards_claimed += p.rewards_claimed_usd
        weighted_apy_sum += p.apy * p.value_usd

        # Group by protocol
        protocol_key = p.protocol.value
        by_protocol[protocol_key] = by_protocol.get(protocol_key, Decimal("0")) + p.value_usd

        # Group by network
        network_key = p.network.value
        by_network[network_key] = by_network.get(network_key, Decimal("0")) + p.value_usd

        # Group by type
        type_key = p.type.value
        by_type[type_key] = by_type.get(type_key, Decimal("0")) + p.value_usd

    weighted_avg_apy = weighted_apy_sum / total_value if total_value > 0 else Decimal("0")
    estimated_yearly = total_value * weighted_avg_apy / 100

    return StakingPositionSummary(
        total_positions=len(positions),
        total_value_usd=total_value,
        total_rewards_pending_usd=total_rewards_pending,
        total_rewards_claimed_usd=total_rewards_claimed,
        weighted_average_apy=weighted_avg_apy,
        estimated_yearly_rewards=estimated_yearly,
        by_protocol=by_protocol,
        by_network=by_network,
        by_type=by_type,
    )


@router.get("/{position_id}", response_model=StakingPositionResponse)
async def get_staking_position(
    position_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> StakingPositionResponse:
    """Get a specific staking position."""
    result = await db.execute(
        select(StakingPosition).where(
            StakingPosition.id == position_id,
            StakingPosition.organization_id == current_user.organization_id,
        )
    )
    position = result.scalar_one_or_none()

    if not position:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staking position not found",
        )

    return StakingPositionResponse.model_validate(position)


@router.get("/by-protocol/{protocol}", response_model=List[StakingPositionResponse])
async def list_by_protocol(
    protocol: StakingProtocol,
    current_user: CurrentUser,
    db: DBSession,
) -> List[StakingPositionResponse]:
    """List all staking positions for a specific protocol."""
    result = await db.execute(
        select(StakingPosition).where(
            StakingPosition.organization_id == current_user.organization_id,
            StakingPosition.protocol == protocol,
        ).order_by(StakingPosition.value_usd.desc())
    )
    positions = result.scalars().all()

    return [StakingPositionResponse.model_validate(p) for p in positions]


@router.get("/by-network/{network}", response_model=List[StakingPositionResponse])
async def list_by_network(
    network: StakingNetwork,
    current_user: CurrentUser,
    db: DBSession,
) -> List[StakingPositionResponse]:
    """List all staking positions for a specific network."""
    result = await db.execute(
        select(StakingPosition).where(
            StakingPosition.organization_id == current_user.organization_id,
            StakingPosition.network == network,
        ).order_by(StakingPosition.value_usd.desc())
    )
    positions = result.scalars().all()

    return [StakingPositionResponse.model_validate(p) for p in positions]
