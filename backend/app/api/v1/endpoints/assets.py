"""Asset endpoints."""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, status, Query
from sqlalchemy import select, or_

from app.api.deps import CurrentUser, DBSession
from app.models.asset import Asset
from app.schemas.asset import (
    AssetResponse,
    AssetSearchResult,
    AssetPriceHistory,
    AssetWithHistory,
)

router = APIRouter()


@router.get("", response_model=List[AssetResponse])
async def list_assets(
    current_user: CurrentUser,
    db: DBSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> List[AssetResponse]:
    """List all tracked assets."""
    result = await db.execute(
        select(Asset)
        .offset(skip)
        .limit(limit)
        .order_by(Asset.market_cap.desc().nullslast())
    )
    assets = result.scalars().all()

    return [AssetResponse.model_validate(a) for a in assets]


@router.get("/search", response_model=List[AssetSearchResult])
async def search_assets(
    current_user: CurrentUser,
    db: DBSession,
    q: str = Query(min_length=1, max_length=50),
    limit: int = Query(10, ge=1, le=50),
) -> List[AssetSearchResult]:
    """Search assets by symbol or name."""
    search_term = f"%{q.lower()}%"

    result = await db.execute(
        select(Asset)
        .where(
            or_(
                Asset.symbol.ilike(search_term),
                Asset.name.ilike(search_term),
            )
        )
        .limit(limit)
        .order_by(Asset.market_cap.desc().nullslast())
    )
    assets = result.scalars().all()

    return [
        AssetSearchResult(
            id=a.id,
            symbol=a.symbol,
            name=a.name,
            logo_url=a.logo_url,
            current_price_usd=a.current_price_usd,
            price_change_24h=a.price_change_24h,
        )
        for a in assets
    ]


@router.get("/{asset_id}", response_model=AssetResponse)
async def get_asset(
    asset_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> AssetResponse:
    """Get a specific asset."""
    result = await db.execute(select(Asset).where(Asset.id == asset_id))
    asset = result.scalar_one_or_none()

    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found",
        )

    return AssetResponse.model_validate(asset)


@router.get("/{asset_id}/price-history", response_model=AssetWithHistory)
async def get_asset_price_history(
    asset_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
    period: str = Query("30d", pattern=r"^(24h|7d|30d|90d|1y)$"),
) -> AssetWithHistory:
    """Get asset with price history."""
    result = await db.execute(select(Asset).where(Asset.id == asset_id))
    asset = result.scalar_one_or_none()

    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found",
        )

    # TODO: Implement price history retrieval
    # This would require a PriceHistory model or external API call

    return AssetWithHistory(
        id=asset.id,
        symbol=asset.symbol,
        name=asset.name,
        coingecko_id=asset.coingecko_id,
        logo_url=asset.logo_url,
        decimals=asset.decimals,
        chain=asset.chain,
        contract_address=asset.contract_address,
        current_price_usd=asset.current_price_usd,
        price_change_24h=asset.price_change_24h,
        market_cap=asset.market_cap,
        last_price_update=asset.last_price_update,
        created_at=asset.created_at,
        price_history=[],  # TODO: Populate with historical data
    )
