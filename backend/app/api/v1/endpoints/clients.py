"""Client endpoints."""

from decimal import Decimal
from typing import List
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, status, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DBSession
from app.models.client import Client
from app.schemas.client import (
    ClientCreate,
    ClientUpdate,
    ClientResponse,
)
from app.schemas.common import SuccessResponse
from app.schemas.client_portfolio import (
    ClientPortfolio,
    ClientPortfolioListItem,
)
from app.services.client_service import ClientService

router = APIRouter()


@router.get("", response_model=List[ClientPortfolioListItem])
async def list_clients(
    current_user: CurrentUser,
    db: DBSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> List[ClientPortfolioListItem]:
    """
    List all clients for current organization with real portfolio summaries.

    Returns total_value_usd, pnl, wallet/exchange counts, APY, rewards
    all calculated from real positions in the database.
    """
    service = ClientService(db)
    return await service.get_clients_with_summaries(
        organization_id=current_user.organization_id,
    )


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
async def create_client(
    data: ClientCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> ClientResponse:
    """Create a new client."""
    client = Client(
        id=uuid4(),
        organization_id=current_user.organization_id,
        **data.model_dump(),
    )
    db.add(client)
    await db.flush()
    await db.refresh(client)

    return ClientResponse.model_validate(client)


@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(
    client_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> ClientResponse:
    """Get a specific client."""
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

    return ClientResponse.model_validate(client)


@router.patch("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: UUID,
    data: ClientUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> ClientResponse:
    """Update a client."""
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

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(client, field, value)

    await db.flush()
    await db.refresh(client)

    return ClientResponse.model_validate(client)


@router.delete("/{client_id}", response_model=SuccessResponse)
async def delete_client(
    client_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> SuccessResponse:
    """Delete a client."""
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

    await db.delete(client)
    await db.flush()

    return SuccessResponse(message="Client deleted successfully")


@router.get("/{client_id}/portfolio", response_model=ClientPortfolio)
async def get_client_portfolio(
    client_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> ClientPortfolio:
    """
    Get complete client portfolio data with real values.

    Returns the client with all wallets (with token balances from positions),
    exchanges (with balances from positions), manual assets, staking positions,
    pool positions, and a summary with real metrics.
    """
    service = ClientService(db)
    portfolio = await service.get_client_portfolio(
        client_id=client_id,
        organization_id=current_user.organization_id,
    )

    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )

    return portfolio
