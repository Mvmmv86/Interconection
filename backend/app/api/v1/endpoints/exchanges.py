"""Exchange endpoints."""

import time
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, status, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DBSession
from app.core.security import encrypt_api_key, mask_api_key
from app.models.client import Client
from app.models.exchange import Exchange
from app.schemas.exchange import (
    ExchangeCreate,
    ExchangeResponse,
    ExchangeSyncResult,
    SupportedExchangeInfo,
    ExchangePositionsSummary,
    ExchangeTestConnectionRequest,
    ExchangeTestConnectionResponse,
    SUPPORTED_EXCHANGES,
)
from app.schemas.common import SuccessResponse
from app.services.exchange_service import ExchangeService
from app.integrations.exchanges import ExchangeAdapterError

router = APIRouter()


# Supported exchanges info
EXCHANGE_INFO = {
    "binance": SupportedExchangeInfo(
        id="binance",
        name="Binance",
        logo_url="https://cryptologos.cc/logos/binance-coin-bnb-logo.png",
        supports_futures=True,
        supports_margin=True,
    ),
    "coinbase": SupportedExchangeInfo(
        id="coinbase",
        name="Coinbase",
        logo_url="https://cryptologos.cc/logos/usd-coin-usdc-logo.png",
    ),
    "kraken": SupportedExchangeInfo(
        id="kraken",
        name="Kraken",
        logo_url="https://cryptologos.cc/logos/kraken-krak-logo.png",
        supports_margin=True,
    ),
    "bybit": SupportedExchangeInfo(
        id="bybit",
        name="Bybit",
        logo_url="https://cryptologos.cc/logos/bybit-bit-logo.png",
        supports_futures=True,
    ),
    "okx": SupportedExchangeInfo(
        id="okx",
        name="OKX",
        logo_url="https://cryptologos.cc/logos/okb-okb-logo.png",
        supports_futures=True,
        supports_margin=True,
        requires_passphrase=True,
    ),
    "kucoin": SupportedExchangeInfo(
        id="kucoin",
        name="KuCoin",
        logo_url="https://cryptologos.cc/logos/kucoin-kcs-logo.png",
        requires_passphrase=True,
    ),
    "gateio": SupportedExchangeInfo(
        id="gateio",
        name="Gate.io",
        logo_url="https://cryptologos.cc/logos/gate-gt-logo.png",
    ),
    "mexc": SupportedExchangeInfo(
        id="mexc",
        name="MEXC",
        logo_url="https://cryptologos.cc/logos/mexc-global-mexc-logo.png",
    ),
}


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


@router.get("", response_model=List[ExchangeResponse])
async def list_exchanges(
    client_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> List[ExchangeResponse]:
    """List all exchanges for a client."""
    await verify_client_access(client_id, current_user, db)

    result = await db.execute(
        select(Exchange).where(Exchange.client_id == client_id).order_by(Exchange.label)
    )
    exchanges = result.scalars().all()

    return [ExchangeResponse.model_validate(e) for e in exchanges]


@router.post("", response_model=ExchangeResponse, status_code=status.HTTP_201_CREATED)
async def create_exchange(
    client_id: UUID,
    data: ExchangeCreate,
    db: DBSession,
) -> ExchangeResponse:
    """Add an exchange connection to a client."""
    # TODO: Re-enable auth when implemented
    # await verify_client_access(client_id, current_user, db)

    # Get the client to access organization_id
    client_result = await db.execute(select(Client).where(Client.id == client_id))
    client = client_result.scalar_one_or_none()

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )

    # Validate exchange is supported
    if data.exchange not in SUPPORTED_EXCHANGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Exchange '{data.exchange}' is not supported",
        )

    exchange = Exchange(
        id=uuid4(),
        client_id=client_id,
        exchange=data.exchange,
        label=data.label,
        api_key_encrypted=encrypt_api_key(data.api_key),
        api_secret_encrypted=encrypt_api_key(data.api_secret),
        api_key_masked=mask_api_key(data.api_key),
        added_at=datetime.now(timezone.utc),
    )
    db.add(exchange)
    await db.flush()
    await db.refresh(exchange)

    # Auto-sync: fetch positions from exchange right after creating
    try:
        service = ExchangeService(db)
        await service.sync_exchange(
            exchange_id=exchange.id,
            organization_id=client.organization_id,
        )
    except Exception as e:
        # Don't fail the create if sync fails — just log it
        import logging
        logging.getLogger(__name__).warning(f"Auto-sync failed for new exchange {exchange.id}: {e}")

    return ExchangeResponse.model_validate(exchange)


@router.get("/{exchange_id}", response_model=ExchangeResponse)
async def get_exchange(
    client_id: UUID,
    exchange_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> ExchangeResponse:
    """Get a specific exchange."""
    await verify_client_access(client_id, current_user, db)

    result = await db.execute(
        select(Exchange).where(
            Exchange.id == exchange_id,
            Exchange.client_id == client_id,
        )
    )
    exchange = result.scalar_one_or_none()

    if not exchange:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exchange not found",
        )

    return ExchangeResponse.model_validate(exchange)


@router.delete("/{exchange_id}", response_model=SuccessResponse)
async def delete_exchange(
    client_id: UUID,
    exchange_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> SuccessResponse:
    """Delete an exchange connection."""
    await verify_client_access(client_id, current_user, db)

    result = await db.execute(
        select(Exchange).where(
            Exchange.id == exchange_id,
            Exchange.client_id == client_id,
        )
    )
    exchange = result.scalar_one_or_none()

    if not exchange:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exchange not found",
        )

    await db.delete(exchange)
    await db.flush()

    return SuccessResponse(message="Exchange deleted successfully")


@router.post("/{exchange_id}/sync", response_model=ExchangeSyncResult)
async def sync_exchange(
    client_id: UUID,
    exchange_id: UUID,
    db: DBSession,
) -> ExchangeSyncResult:
    """Force sync an exchange for balances and positions."""
    # TODO: Re-enable auth
    # await verify_client_access(client_id, current_user, db)

    # Get exchange with client to access organization_id
    result = await db.execute(
        select(Exchange)
        .join(Client)
        .where(
            Exchange.id == exchange_id,
            Exchange.client_id == client_id,
        )
        .options(selectinload(Exchange.client))
    )
    exchange = result.scalar_one_or_none()

    if not exchange:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exchange not found",
        )

    # Sync using exchange service with client's organization_id
    start_time = time.time()
    service = ExchangeService(db)

    try:
        sync_result = await service.sync_exchange(
            exchange_id=exchange_id,
            organization_id=exchange.client.organization_id,
        )
        sync_time_ms = int((time.time() - start_time) * 1000)

        return ExchangeSyncResult(
            exchange_id=exchange_id,
            assets_synced=sync_result["positions_synced"],
            total_value_usd=Decimal(str(sync_result["total_value_usd"])),
            sync_time_ms=sync_time_ms,
        )

    except ExchangeAdapterError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# ============================================
# Exchange Positions Endpoints (Global)
# These endpoints are NOT nested under /clients/{client_id}
# ============================================

# Create a separate router for global exchange endpoints
exchange_positions_router = APIRouter()


@exchange_positions_router.get("/supported", response_model=List[SupportedExchangeInfo])
async def list_supported_exchanges() -> List[SupportedExchangeInfo]:
    """List all supported exchanges."""
    return list(EXCHANGE_INFO.values())


@exchange_positions_router.get("/positions", response_model=ExchangePositionsSummary)
async def get_exchange_positions(
    db: DBSession,
    client_id: Optional[UUID] = Query(None, description="Filter by specific client"),
) -> ExchangePositionsSummary:
    """
    Get aggregated exchange positions for display.

    Returns summary stats + list of exchanges with breakdown by:
    - Spot holdings
    - Margin positions
    - Futures positions
    - Top 3 assets per exchange

    Can be filtered by client_id to show only one client's exchanges.
    """
    service = ExchangeService(db)
    # TODO: Re-enable auth and use current_user.organization_id
    result = await service.get_exchange_positions_summary(
        organization_id=None,  # Temporarily disabled auth
        client_id=client_id,
    )

    return ExchangePositionsSummary(
        total_value=result["total_value"],
        spot_holdings=result["spot_holdings"],
        margin_positions=result["margin_positions"],
        futures_positions=result["futures_positions"],
        exchanges=result["exchanges"],
    )


@exchange_positions_router.get("/transactions")
async def get_exchange_transactions(
    db: DBSession,
    exchange_id: Optional[UUID] = Query(None, description="Filter by specific exchange"),
    limit: int = Query(50, ge=1, le=200, description="Max transactions to return"),
):
    """
    Get recent transactions from all connected exchanges.

    Returns deposits, withdrawals, and internal transfers.
    """
    service = ExchangeService(db)

    try:
        transactions = await service.get_exchange_transactions(
            exchange_id=exchange_id,
            limit=limit,
        )
        return {"transactions": transactions, "count": len(transactions)}

    except ExchangeAdapterError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e),
        )


@exchange_positions_router.get("/{exchange_id}/live")
async def get_exchange_live_data(
    exchange_id: UUID,
    db: DBSession,
):
    """
    Get live detailed data for a specific exchange.

    Returns all position data including:
    - Futures positions with entry/mark price, PnL, leverage
    - Spot balances with free/locked amounts
    - Margin balances with borrowed/interest
    - Earn/staking positions
    - Funding balances

    This endpoint fetches data directly from the exchange API.
    """
    # Find the exchange with its client to get the real organization_id
    result = await db.execute(
        select(Exchange)
        .where(Exchange.id == exchange_id)
        .options(selectinload(Exchange.client))
    )
    exchange = result.scalar_one_or_none()

    if not exchange:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exchange not found",
        )

    if not exchange.client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exchange client not found",
        )

    service = ExchangeService(db)

    try:
        live_data = await service.get_exchange_live_data(
            exchange_id=exchange_id,
            organization_id=exchange.client.organization_id,
        )
        return live_data

    except ExchangeAdapterError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@exchange_positions_router.get("/{exchange_id}/transactions")
async def get_single_exchange_transactions(
    exchange_id: UUID,
    db: DBSession,
    limit: int = Query(50, ge=1, le=200, description="Max transactions to return"),
):
    """
    Get recent transactions from a specific exchange.

    Returns deposits, withdrawals, and internal transfers.
    """
    service = ExchangeService(db)

    try:
        transactions = await service.get_exchange_transactions(
            exchange_id=exchange_id,
            limit=limit,
        )
        return {"transactions": transactions, "count": len(transactions)}

    except ExchangeAdapterError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e),
        )


@exchange_positions_router.post("/test-connection", response_model=ExchangeTestConnectionResponse)
async def test_exchange_connection(
    data: ExchangeTestConnectionRequest,
    db: DBSession,
) -> ExchangeTestConnectionResponse:
    """
    Test exchange API credentials before saving.

    This allows users to verify their API key/secret work
    before creating the exchange connection.
    """
    # Validate exchange is supported
    if data.exchange not in SUPPORTED_EXCHANGES:
        return ExchangeTestConnectionResponse(
            success=False,
            message=f"Exchange '{data.exchange}' is not supported",
        )

    # Create a temporary exchange object for testing
    temp_exchange = Exchange(
        id=uuid4(),
        client_id=uuid4(),  # Dummy
        exchange=data.exchange,
        label="test",
        api_key_encrypted=encrypt_api_key(data.api_key),
        api_secret_encrypted=encrypt_api_key(data.api_secret),
        api_key_masked=mask_api_key(data.api_key),
    )

    service = ExchangeService(db)

    try:
        # Get adapter and test connection
        adapter = service.get_adapter(temp_exchange)
        success = await adapter.test_connection()

        if success:
            # Also fetch account summary to get asset count
            summary = await adapter.get_account_summary()
            await adapter.close()

            return ExchangeTestConnectionResponse(
                success=True,
                message="Connection successful!",
                assets_found=summary.position_count,
                total_value_usd=summary.total_value_usd,
            )
        else:
            await adapter.close()
            return ExchangeTestConnectionResponse(
                success=False,
                message="Connection failed. Please check your API credentials.",
            )

    except ExchangeAdapterError as e:
        return ExchangeTestConnectionResponse(
            success=False,
            message=str(e),
        )
    except ValueError as e:
        return ExchangeTestConnectionResponse(
            success=False,
            message=str(e),
        )
