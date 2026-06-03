"""Wallet endpoints."""

from datetime import datetime, timezone
from typing import List
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession, rbac_route_guard
from app.models.client import Client
from app.models.wallet import Wallet
from app.schemas.wallet import (
    WalletCreate,
    WalletResponse,
    WalletScanResult,
)
from app.schemas.common import SuccessResponse

router = APIRouter(dependencies=[Depends(rbac_route_guard("wallets"))])


async def verify_client_access(
    client_id: UUID,
    current_user,
    db,
) -> Client:
    """Verify user has access to client."""
    result = await db.execute(
        select(Client).where(
            Client.id == client_id,
            Client.organization_id == current_user.organization_id,
        )
    )
    client = result.scalar_one_or_none()

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    return client


@router.get("", response_model=List[WalletResponse])
async def list_wallets(
    client_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> List[WalletResponse]:
    """List all wallets for a client."""
    await verify_client_access(client_id, current_user, db)

    result = await db.execute(
        select(Wallet).where(Wallet.client_id == client_id).order_by(Wallet.label)
    )
    wallets = result.scalars().all()

    return [WalletResponse.model_validate(w) for w in wallets]


@router.post("", response_model=WalletResponse, status_code=status.HTTP_201_CREATED)
async def create_wallet(
    client_id: UUID,
    data: WalletCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> WalletResponse:
    """Add a wallet to a client."""
    await verify_client_access(client_id, current_user, db)

    # Check if wallet already exists for this client
    result = await db.execute(
        select(Wallet).where(
            Wallet.client_id == client_id,
            Wallet.address == data.address,
            Wallet.chain == data.chain,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Wallet already exists for this client",
        )

    wallet = Wallet(
        id=uuid4(),
        client_id=client_id,
        added_at=datetime.now(timezone.utc),
        **data.model_dump(),
    )
    db.add(wallet)
    await db.flush()
    await db.refresh(wallet)

    return WalletResponse.model_validate(wallet)


@router.get("/{wallet_id}", response_model=WalletResponse)
async def get_wallet(
    client_id: UUID,
    wallet_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> WalletResponse:
    """Get a specific wallet."""
    await verify_client_access(client_id, current_user, db)

    result = await db.execute(
        select(Wallet).where(
            Wallet.id == wallet_id,
            Wallet.client_id == client_id,
        )
    )
    wallet = result.scalar_one_or_none()

    if not wallet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wallet not found",
        )

    return WalletResponse.model_validate(wallet)


@router.delete("/{wallet_id}", response_model=SuccessResponse)
async def delete_wallet(
    client_id: UUID,
    wallet_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> SuccessResponse:
    """Delete a wallet."""
    await verify_client_access(client_id, current_user, db)

    result = await db.execute(
        select(Wallet).where(
            Wallet.id == wallet_id,
            Wallet.client_id == client_id,
        )
    )
    wallet = result.scalar_one_or_none()

    if not wallet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wallet not found",
        )

    await db.delete(wallet)
    await db.flush()

    return SuccessResponse(message="Wallet deleted successfully")


@router.post("/{wallet_id}/scan", response_model=WalletScanResult)
async def scan_wallet(
    client_id: UUID,
    wallet_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> WalletScanResult:
    """Force scan a wallet for tokens and positions."""
    await verify_client_access(client_id, current_user, db)

    result = await db.execute(
        select(Wallet).where(
            Wallet.id == wallet_id,
            Wallet.client_id == client_id,
        )
    )
    wallet = result.scalar_one_or_none()

    if not wallet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wallet not found",
        )

    from app.services.wallet_scan_service import WalletScanService, WalletScanError

    service = WalletScanService(db)

    try:
        result_data = await service.scan_wallet(
            wallet_id=wallet_id,
            organization_id=current_user.organization_id,
        )

        return WalletScanResult(
            wallet_id=wallet_id,
            tokens_found=result_data["tokens_found"],
            total_value_usd=result_data["total_value_usd"],
            new_positions_detected=result_data["new_positions_detected"],
            scan_time_ms=result_data["scan_time_ms"],
        )

    except WalletScanError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e),
        )
