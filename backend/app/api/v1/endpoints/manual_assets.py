"""Manual Asset endpoints."""

from decimal import Decimal
from typing import List
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, status, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DBSession
from app.models.client import Client
from app.models.manual_asset import ManualAsset
from app.schemas.manual_asset import (
    ManualAssetCreate,
    ManualAssetUpdate,
    ManualAssetResponse,
)
from app.schemas.common import SuccessResponse

router = APIRouter()


async def get_client_or_404(
    client_id: UUID,
    organization_id: UUID,
    db: DBSession,
) -> Client:
    """Get client or raise 404."""
    result = await db.execute(
        select(Client).where(
            Client.id == client_id,
            Client.organization_id == organization_id,
        )
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    return client


def build_manual_asset_response(asset: ManualAsset) -> ManualAssetResponse:
    """Build manual asset response with computed fields."""
    current_value = asset.quantity * (asset.current_price or asset.purchase_price)
    cost_basis = asset.quantity * asset.purchase_price
    pnl = current_value - cost_basis
    pnl_percent = (pnl / cost_basis * 100) if cost_basis > 0 else Decimal("0")

    return ManualAssetResponse(
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


@router.get("", response_model=List[ManualAssetResponse])
async def list_manual_assets(
    client_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> List[ManualAssetResponse]:
    """List all manual assets for a client."""
    await get_client_or_404(client_id, current_user.organization_id, db)

    result = await db.execute(
        select(ManualAsset)
        .where(ManualAsset.client_id == client_id)
        .offset(skip)
        .limit(limit)
        .order_by(ManualAsset.created_at.desc())
    )
    assets = result.scalars().all()

    return [build_manual_asset_response(asset) for asset in assets]


@router.post("", response_model=ManualAssetResponse, status_code=status.HTTP_201_CREATED)
async def create_manual_asset(
    client_id: UUID,
    data: ManualAssetCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> ManualAssetResponse:
    """Create a new manual asset for a client."""
    await get_client_or_404(client_id, current_user.organization_id, db)

    asset = ManualAsset(
        id=uuid4(),
        client_id=client_id,
        **data.model_dump(),
    )
    db.add(asset)
    await db.flush()
    await db.refresh(asset)

    return build_manual_asset_response(asset)


@router.get("/{asset_id}", response_model=ManualAssetResponse)
async def get_manual_asset(
    client_id: UUID,
    asset_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> ManualAssetResponse:
    """Get a specific manual asset."""
    await get_client_or_404(client_id, current_user.organization_id, db)

    result = await db.execute(
        select(ManualAsset).where(
            ManualAsset.id == asset_id,
            ManualAsset.client_id == client_id,
        )
    )
    asset = result.scalar_one_or_none()

    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Manual asset not found",
        )

    return build_manual_asset_response(asset)


@router.patch("/{asset_id}", response_model=ManualAssetResponse)
async def update_manual_asset(
    client_id: UUID,
    asset_id: UUID,
    data: ManualAssetUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> ManualAssetResponse:
    """Update a manual asset."""
    await get_client_or_404(client_id, current_user.organization_id, db)

    result = await db.execute(
        select(ManualAsset).where(
            ManualAsset.id == asset_id,
            ManualAsset.client_id == client_id,
        )
    )
    asset = result.scalar_one_or_none()

    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Manual asset not found",
        )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(asset, field, value)

    await db.flush()
    await db.refresh(asset)

    return build_manual_asset_response(asset)


@router.delete("/{asset_id}", response_model=SuccessResponse)
async def delete_manual_asset(
    client_id: UUID,
    asset_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> SuccessResponse:
    """Delete a manual asset."""
    await get_client_or_404(client_id, current_user.organization_id, db)

    result = await db.execute(
        select(ManualAsset).where(
            ManualAsset.id == asset_id,
            ManualAsset.client_id == client_id,
        )
    )
    asset = result.scalar_one_or_none()

    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Manual asset not found",
        )

    await db.delete(asset)
    await db.flush()

    return SuccessResponse(message="Manual asset deleted successfully")
