"""Endpoints for pool position baselines (LP IL/HODL fallback).

Frontend calls these from useUniswapV3/V4Positions hooks when subgraph
data is missing, to persist a snapshot of the position's value so IL
can be computed on subsequent loads.
"""

from typing import Optional

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DBSession
from app.schemas.pool_baseline import (
    PoolBaselineListResponse,
    PoolBaselineResponse,
    PoolBaselineUpsert,
)
from app.services.pool_baseline_service import PoolBaselineService

router = APIRouter()


@router.get("", response_model=PoolBaselineListResponse)
async def list_baselines(
    current_user: CurrentUser,
    db: DBSession,
    wallet_address: Optional[str] = Query(None, description="Filter by wallet"),
) -> PoolBaselineListResponse:
    """Return all baselines for the caller's organization (optionally one wallet)."""
    service = PoolBaselineService(db)
    rows = await service.list_for_wallet(
        organization_id=current_user.organization_id,
        wallet_address=wallet_address,
    )
    items = [PoolBaselineResponse.model_validate(r, from_attributes=True) for r in rows]
    return PoolBaselineListResponse(items=items, count=len(items))


@router.post("", response_model=PoolBaselineResponse)
async def upsert_baseline(
    payload: PoolBaselineUpsert,
    current_user: CurrentUser,
    db: DBSession,
) -> PoolBaselineResponse:
    """Idempotent upsert. Returns the stored baseline (new or existing)."""
    service = PoolBaselineService(db)
    row, _action = await service.upsert(
        organization_id=current_user.organization_id,
        payload=payload,
    )
    await db.commit()
    return PoolBaselineResponse.model_validate(row, from_attributes=True)
