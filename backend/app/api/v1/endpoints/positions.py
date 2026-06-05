"""Position endpoints."""

from decimal import Decimal
from typing import Annotated, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import false, select
from sqlalchemy.orm import selectinload

from app.api.deps import (
    DBSession,
    MembershipAuthContext,
    is_scope_specific_enforcement_enabled,
    require_permission,
    rbac_route_guard,
)
from app.models.position import Position, PositionType
from app.models.asset import Asset
from app.schemas.position import (
    PositionResponse,
    PositionSummary,
)

router = APIRouter(dependencies=[Depends(rbac_route_guard("positions"))])


def _apply_position_scope_filter(
    permission_ctx: MembershipAuthContext,
    query,
    client_id: UUID | None = None,
):
    if not is_scope_specific_enforcement_enabled("positions"):
        return query

    if permission_ctx.client_access_mode is None or permission_ctx.client_access_mode.name.lower() != "specific":
        return query

    if client_id is not None:
        if not permission_ctx.can_access_client(client_id):
            raise HTTPException(
                status_code=403,
                detail="Forbidden by membership client scope",
            )
        return query.where(Position.client_id == client_id)

    scope_client_ids = list(permission_ctx.scope_client_ids)
    if not scope_client_ids:
        return query.where(false())
    return query.where(Position.client_id.in_(scope_client_ids))


@router.get("", response_model=List[PositionResponse])
async def list_positions(
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("positions:view", route_key="positions")),
    ],
    db: DBSession,
    client_id: Optional[UUID] = None,
    position_type: Optional[PositionType] = None,
    chain: Optional[str] = None,
    protocol: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> List[PositionResponse]:
    """List all positions with optional filters."""
    query = (
        select(Position)
        .where(Position.organization_id == permission_ctx.organization_id)
        .options(selectinload(Position.asset))
    )
    query = _apply_position_scope_filter(permission_ctx, query, client_id)

    if position_type:
        query = query.where(Position.position_type == position_type)
    if chain:
        query = query.join(Asset).where(Asset.chain == chain)
    if protocol:
        query = query.where(Position.protocol == protocol)

    query = query.offset(skip).limit(limit).order_by(Position.current_value_usd.desc())

    result = await db.execute(query)
    positions = result.scalars().all()

    response = []
    for pos in positions:
        response.append(
            PositionResponse(
                id=pos.id,
                organization_id=pos.organization_id,
                client_id=pos.client_id,
                asset_id=pos.asset_id,
                source_type=pos.source_type,
                source_id=pos.source_id,
                position_type=pos.position_type,
                quantity=pos.quantity,
                current_price=pos.current_price,
                current_value_usd=pos.current_value_usd,
                asset_symbol=pos.asset.symbol,
                asset_name=pos.asset.name,
                asset_logo_url=pos.asset.logo_url,
                entry_price=pos.entry_price,
                cost_basis=pos.cost_basis,
                unrealized_pnl=pos.unrealized_pnl,
                unrealized_pnl_percent=pos.unrealized_pnl_percent,
                apy=pos.apy,
                pending_rewards=pos.pending_rewards,
                pending_rewards_usd=pos.pending_rewards_usd,
                protocol=pos.protocol,
                pool_address=pos.pool_address,
                token0_amount=pos.token0_amount,
                token1_amount=pos.token1_amount,
                price_lower=pos.price_lower,
                price_upper=pos.price_upper,
                in_range=pos.in_range,
                impermanent_loss=pos.impermanent_loss,
                created_at=pos.created_at,
                updated_at=pos.updated_at,
            )
        )

    return response


@router.get("/summary", response_model=PositionSummary)
async def get_positions_summary(
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("positions:view", route_key="positions")),
    ],
    db: DBSession,
    client_id: Optional[UUID] = None,
) -> PositionSummary:
    """Get summary of all positions."""
    query = select(Position).where(
        Position.organization_id == permission_ctx.organization_id
    )
    query = _apply_position_scope_filter(permission_ctx, query, client_id)

    result = await db.execute(query)
    positions = result.scalars().all()

    total_value = Decimal("0")
    total_pnl = Decimal("0")
    spot_value = Decimal("0")
    staking_value = Decimal("0")
    lending_value = Decimal("0")
    lp_value = Decimal("0")
    pending_rewards = Decimal("0")
    weighted_apy_sum = Decimal("0")
    yield_value = Decimal("0")

    for pos in positions:
        total_value += pos.current_value_usd
        total_pnl += pos.unrealized_pnl

        if pos.position_type == PositionType.SPOT:
            spot_value += pos.current_value_usd
        elif pos.position_type == PositionType.STAKING:
            staking_value += pos.current_value_usd
            yield_value += pos.current_value_usd
            if pos.apy:
                weighted_apy_sum += pos.apy * pos.current_value_usd
        elif pos.position_type == PositionType.LENDING:
            lending_value += pos.current_value_usd
            yield_value += pos.current_value_usd
            if pos.apy:
                weighted_apy_sum += pos.apy * pos.current_value_usd
        elif pos.position_type == PositionType.LP:
            lp_value += pos.current_value_usd
            yield_value += pos.current_value_usd
            if pos.apy:
                weighted_apy_sum += pos.apy * pos.current_value_usd

        if pos.pending_rewards_usd:
            pending_rewards += pos.pending_rewards_usd

    total_pnl_percent = (total_pnl / total_value * 100) if total_value > 0 else Decimal("0")
    weighted_average_apy = (weighted_apy_sum / yield_value) if yield_value > 0 else Decimal("0")

    return PositionSummary(
        total_positions=len(positions),
        total_value_usd=total_value,
        total_pnl_usd=total_pnl,
        total_pnl_percent=total_pnl_percent,
        spot_value=spot_value,
        staking_value=staking_value,
        lending_value=lending_value,
        lp_value=lp_value,
        total_pending_rewards_usd=pending_rewards,
        weighted_average_apy=weighted_average_apy,
    )


@router.get("/staking", response_model=List[PositionResponse])
async def list_staking_positions(
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("positions:view", route_key="positions")),
    ],
    db: DBSession,
    client_id: Optional[UUID] = None,
) -> List[PositionResponse]:
    """List all staking positions."""
    query = (
        select(Position)
        .where(
            Position.organization_id == permission_ctx.organization_id,
            Position.position_type == PositionType.STAKING,
        )
        .options(selectinload(Position.asset))
        .order_by(Position.current_value_usd.desc())
    )
    query = _apply_position_scope_filter(permission_ctx, query, client_id)

    result = await db.execute(query)
    positions = result.scalars().all()

    # Map to response (simplified)
    return [
        PositionResponse(
            id=pos.id,
            organization_id=pos.organization_id,
            client_id=pos.client_id,
            asset_id=pos.asset_id,
            source_type=pos.source_type,
            source_id=pos.source_id,
            position_type=pos.position_type,
            quantity=pos.quantity,
            current_price=pos.current_price,
            current_value_usd=pos.current_value_usd,
            asset_symbol=pos.asset.symbol,
            asset_name=pos.asset.name,
            asset_logo_url=pos.asset.logo_url,
            unrealized_pnl=pos.unrealized_pnl,
            unrealized_pnl_percent=pos.unrealized_pnl_percent,
            apy=pos.apy,
            pending_rewards=pos.pending_rewards,
            pending_rewards_usd=pos.pending_rewards_usd,
            protocol=pos.protocol,
            created_at=pos.created_at,
            updated_at=pos.updated_at,
        )
        for pos in positions
    ]


@router.get("/lp", response_model=List[PositionResponse])
async def list_lp_positions(
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("positions:view", route_key="positions")),
    ],
    db: DBSession,
    client_id: Optional[UUID] = None,
) -> List[PositionResponse]:
    """List all LP positions."""
    query = (
        select(Position)
        .where(
            Position.organization_id == permission_ctx.organization_id,
            Position.position_type == PositionType.LP,
        )
        .options(selectinload(Position.asset))
        .order_by(Position.current_value_usd.desc())
    )
    query = _apply_position_scope_filter(permission_ctx, query, client_id)

    result = await db.execute(query)
    positions = result.scalars().all()

    return [
        PositionResponse(
            id=pos.id,
            organization_id=pos.organization_id,
            client_id=pos.client_id,
            asset_id=pos.asset_id,
            source_type=pos.source_type,
            source_id=pos.source_id,
            position_type=pos.position_type,
            quantity=pos.quantity,
            current_price=pos.current_price,
            current_value_usd=pos.current_value_usd,
            asset_symbol=pos.asset.symbol,
            asset_name=pos.asset.name,
            unrealized_pnl=pos.unrealized_pnl,
            unrealized_pnl_percent=pos.unrealized_pnl_percent,
            apy=pos.apy,
            protocol=pos.protocol,
            pool_address=pos.pool_address,
            token0_amount=pos.token0_amount,
            token1_amount=pos.token1_amount,
            price_lower=pos.price_lower,
            price_upper=pos.price_upper,
            in_range=pos.in_range,
            impermanent_loss=pos.impermanent_loss,
            created_at=pos.created_at,
            updated_at=pos.updated_at,
        )
        for pos in positions
    ]
