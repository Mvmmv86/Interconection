"""Pool Position endpoints."""

from typing import Annotated, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select

from app.api.deps import (
    DBSession,
    MembershipAuthContext,
    apply_client_scope_filter,
    rbac_route_guard,
    require_permission,
)
from app.models.pool_position import PoolPosition, PoolProtocol, PoolChain, PoolStatus
from app.schemas.pool_position import (
    PoolPositionResponse,
    PoolPositionSummary,
)

router = APIRouter(dependencies=[Depends(rbac_route_guard("positions"))])


@router.get("", response_model=List[PoolPositionResponse])
async def list_pool_positions(
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("positions:view", route_key="positions")),
    ],
    db: DBSession,
    client_id: UUID = None,
    protocol: PoolProtocol = None,
    chain: PoolChain = None,
    status_filter: PoolStatus = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> List[PoolPositionResponse]:
    """
    List all LP pool positions for the organization.

    Can be filtered by client_id, protocol, chain, or status.
    """
    query = select(PoolPosition).where(
        PoolPosition.organization_id == permission_ctx.organization_id
    )
    query = apply_client_scope_filter(
        permission_ctx, query, PoolPosition.client_id, "positions", client_id
    )
    if protocol:
        query = query.where(PoolPosition.protocol == protocol)
    if chain:
        query = query.where(PoolPosition.chain == chain)
    if status_filter:
        query = query.where(PoolPosition.status == status_filter)

    query = query.offset(skip).limit(limit).order_by(PoolPosition.total_value_usd.desc())

    result = await db.execute(query)
    positions = result.scalars().all()

    return [PoolPositionResponse.model_validate(p) for p in positions]


@router.get("/summary", response_model=PoolPositionSummary)
async def get_pool_summary(
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("positions:view", route_key="positions")),
    ],
    db: DBSession,
    client_id: UUID = None,
) -> PoolPositionSummary:
    """
    Get a summary of all LP pool positions.

    Returns totals, fees, IL, and breakdowns by protocol/chain.
    """
    query = select(PoolPosition).where(
        PoolPosition.organization_id == permission_ctx.organization_id
    )
    query = apply_client_scope_filter(
        permission_ctx, query, PoolPosition.client_id, "positions", client_id
    )

    result = await db.execute(query)
    positions = result.scalars().all()

    from decimal import Decimal

    total_value = Decimal("0")
    total_fees_earned = Decimal("0")
    total_fees_unclaimed = Decimal("0")
    total_il = Decimal("0")
    weighted_apr_sum = Decimal("0")
    positions_in_range = 0
    positions_out_of_range = 0
    by_protocol: dict[str, Decimal] = {}
    by_chain: dict[str, Decimal] = {}

    for p in positions:
        total_value += p.total_value_usd
        total_fees_earned += p.fees_earned_usd
        total_fees_unclaimed += p.fees_unclaimed_usd
        total_il += p.impermanent_loss_usd
        weighted_apr_sum += p.total_apr * p.total_value_usd

        if p.status == PoolStatus.IN_RANGE:
            positions_in_range += 1
        elif p.status == PoolStatus.OUT_OF_RANGE:
            positions_out_of_range += 1

        # Group by protocol
        protocol_key = p.protocol.value
        by_protocol[protocol_key] = by_protocol.get(protocol_key, Decimal("0")) + p.total_value_usd

        # Group by chain
        chain_key = p.chain.value
        by_chain[chain_key] = by_chain.get(chain_key, Decimal("0")) + p.total_value_usd

    average_apr = weighted_apr_sum / total_value if total_value > 0 else Decimal("0")

    return PoolPositionSummary(
        total_positions=len(positions),
        total_value_usd=total_value,
        total_fees_earned_usd=total_fees_earned,
        total_fees_unclaimed_usd=total_fees_unclaimed,
        total_il_usd=total_il,
        average_apr=average_apr,
        positions_in_range=positions_in_range,
        positions_out_of_range=positions_out_of_range,
        by_protocol=by_protocol,
        by_chain=by_chain,
    )


@router.get("/{position_id}", response_model=PoolPositionResponse)
async def get_pool_position(
    position_id: UUID,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("positions:view", route_key="positions")),
    ],
    db: DBSession,
) -> PoolPositionResponse:
    """Get a specific pool position."""
    query = select(PoolPosition).where(
        PoolPosition.id == position_id,
        PoolPosition.organization_id == permission_ctx.organization_id,
    )
    query = apply_client_scope_filter(
        permission_ctx, query, PoolPosition.client_id, "positions"
    )
    result = await db.execute(query)
    position = result.scalar_one_or_none()

    if not position:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pool position not found",
        )

    return PoolPositionResponse.model_validate(position)


@router.get("/by-protocol/{protocol}", response_model=List[PoolPositionResponse])
async def list_by_protocol(
    protocol: PoolProtocol,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("positions:view", route_key="positions")),
    ],
    db: DBSession,
) -> List[PoolPositionResponse]:
    """List all pool positions for a specific protocol."""
    query = (
        select(PoolPosition).where(
            PoolPosition.organization_id == permission_ctx.organization_id,
            PoolPosition.protocol == protocol,
        ).order_by(PoolPosition.total_value_usd.desc())
    )
    query = apply_client_scope_filter(
        permission_ctx, query, PoolPosition.client_id, "positions"
    )
    result = await db.execute(query)
    positions = result.scalars().all()

    return [PoolPositionResponse.model_validate(p) for p in positions]


@router.get("/by-chain/{chain}", response_model=List[PoolPositionResponse])
async def list_by_chain(
    chain: PoolChain,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("positions:view", route_key="positions")),
    ],
    db: DBSession,
) -> List[PoolPositionResponse]:
    """List all pool positions for a specific chain."""
    query = (
        select(PoolPosition).where(
            PoolPosition.organization_id == permission_ctx.organization_id,
            PoolPosition.chain == chain,
        ).order_by(PoolPosition.total_value_usd.desc())
    )
    query = apply_client_scope_filter(
        permission_ctx, query, PoolPosition.client_id, "positions"
    )
    result = await db.execute(query)
    positions = result.scalars().all()

    return [PoolPositionResponse.model_validate(p) for p in positions]


@router.get("/in-range", response_model=List[PoolPositionResponse])
async def list_in_range_positions(
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("positions:view", route_key="positions")),
    ],
    db: DBSession,
) -> List[PoolPositionResponse]:
    """List all positions that are currently in range."""
    query = (
        select(PoolPosition).where(
            PoolPosition.organization_id == permission_ctx.organization_id,
            PoolPosition.status == PoolStatus.IN_RANGE,
        ).order_by(PoolPosition.total_value_usd.desc())
    )
    query = apply_client_scope_filter(
        permission_ctx, query, PoolPosition.client_id, "positions"
    )
    result = await db.execute(query)
    positions = result.scalars().all()

    return [PoolPositionResponse.model_validate(p) for p in positions]


@router.get("/out-of-range", response_model=List[PoolPositionResponse])
async def list_out_of_range_positions(
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("positions:view", route_key="positions")),
    ],
    db: DBSession,
) -> List[PoolPositionResponse]:
    """List all positions that are currently out of range."""
    query = (
        select(PoolPosition).where(
            PoolPosition.organization_id == permission_ctx.organization_id,
            PoolPosition.status == PoolStatus.OUT_OF_RANGE,
        ).order_by(PoolPosition.total_value_usd.desc())
    )
    query = apply_client_scope_filter(
        permission_ctx, query, PoolPosition.client_id, "positions"
    )
    result = await db.execute(query)
    positions = result.scalars().all()

    return [PoolPositionResponse.model_validate(p) for p in positions]
