"""Exchange endpoints."""

import time
from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated, List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.api.deps import (
    DBSession,
    MembershipAuthContext,
    is_scope_specific_enforcement_enabled,
    require_permission,
    rbac_route_guard,
)
from app.core.security import encrypt_api_key, mask_api_key
from app.models.audit_log import AuditAction
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
from app.services.audit_service import record_audit_event, record_audit_event_immediate
from app.services.exchange_service import ExchangeService
from app.services.plan_limits import enforce_plan_limit
from app.integrations.exchanges import ExchangeAdapterError

router = APIRouter(dependencies=[Depends(rbac_route_guard("exchange"))])


# Supported exchanges info
EXCHANGE_INFO = {
    "bybit": SupportedExchangeInfo(
        id="bybit",
        name="Bybit",
        logo_url="https://cryptologos.cc/logos/bybit-bit-logo.png",
        supports_futures=True,
    ),
    "bingx": SupportedExchangeInfo(
        id="bingx",
        name="BingX",
        logo_url="https://bingx.com/favicon.ico",
        supports_futures=True,
    ),
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
    permission_ctx: MembershipAuthContext,
    db,
) -> Client:
    """Verify user has access to client."""
    if (
        is_scope_specific_enforcement_enabled("exchange")
        and permission_ctx.client_access_mode is not None
        and not permission_ctx.can_access_client(client_id)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden by membership client scope",
        )

    result = await db.execute(
        select(Client).where(
            Client.id == client_id,
            Client.organization_id == permission_ctx.organization_id,
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
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("exchanges:view", route_key="exchange")),
    ],
    db: DBSession,
) -> List[ExchangeResponse]:
    """List all exchanges for a client."""
    await verify_client_access(client_id, permission_ctx, db)

    result = await db.execute(
        select(Exchange).where(Exchange.client_id == client_id).order_by(Exchange.label)
    )
    exchanges = result.scalars().all()

    return [ExchangeResponse.model_validate(e) for e in exchanges]


@router.post("", response_model=ExchangeResponse, status_code=status.HTTP_201_CREATED)
async def create_exchange(
    client_id: UUID,
    data: ExchangeCreate,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("exchanges:create", route_key="exchange")),
    ],
    db: DBSession,
    request: Request,
) -> ExchangeResponse:
    """Add an exchange connection to a client."""
    await verify_client_access(client_id, permission_ctx, db)

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

    await enforce_plan_limit(db, permission_ctx.organization_id, "exchanges")

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
    await record_audit_event(
        db,
        organization_id=client.organization_id,
        user_id=permission_ctx.user.id,
        action=AuditAction.CREATE,
        resource_type="exchange",
        resource_id=exchange.id,
        description="Exchange connection created",
        metadata={
            "client_id": client_id,
            "exchange": exchange.exchange,
            "label": exchange.label,
        },
        request=request,
    )

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
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("exchanges:view", route_key="exchange")),
    ],
    db: DBSession,
) -> ExchangeResponse:
    """Get a specific exchange."""
    await verify_client_access(client_id, permission_ctx, db)

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
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("exchanges:delete", route_key="exchange")),
    ],
    db: DBSession,
    request: Request,
) -> SuccessResponse:
    """Delete an exchange connection."""
    await verify_client_access(client_id, permission_ctx, db)

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

    await record_audit_event(
        db,
        organization_id=permission_ctx.organization_id,
        user_id=permission_ctx.user.id,
        action=AuditAction.DELETE,
        resource_type="exchange",
        resource_id=exchange.id,
        description="Exchange connection deleted",
        metadata={
            "client_id": client_id,
            "exchange": exchange.exchange,
            "label": exchange.label,
        },
        request=request,
    )
    try:
        await db.delete(exchange)
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Não foi possível excluir esta exchange porque ainda existem "
                "dados vinculados a ela."
            ),
        ) from exc

    return SuccessResponse(message="Exchange deleted successfully")


@router.post("/{exchange_id}/sync", response_model=ExchangeSyncResult)
async def sync_exchange(
    client_id: UUID,
    exchange_id: UUID,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("exchanges:sync", route_key="exchange")),
    ],
    db: DBSession,
    request: Request,
) -> ExchangeSyncResult:
    """Force sync an exchange for balances and positions."""
    await verify_client_access(client_id, permission_ctx, db)

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
    await record_audit_event_immediate(
        organization_id=exchange.client.organization_id,
        user_id=permission_ctx.user.id,
        action=AuditAction.SYNC,
        resource_type="exchange",
        resource_id=exchange.id,
        description="Exchange sync started",
        metadata={
            "client_id": client_id,
            "exchange": exchange.exchange,
            "label": exchange.label,
        },
        request=request,
    )

    try:
        sync_result = await service.sync_exchange(
            exchange_id=exchange_id,
            organization_id=exchange.client.organization_id,
        )
        sync_time_ms = int((time.time() - start_time) * 1000)
        await record_audit_event(
            db,
            organization_id=exchange.client.organization_id,
            user_id=permission_ctx.user.id,
            action=AuditAction.SYNC,
            resource_type="exchange",
            resource_id=exchange.id,
            description="Exchange sync completed",
            metadata={
                "client_id": client_id,
                "exchange": exchange.exchange,
                "positions_synced": sync_result["positions_synced"],
                "total_value_usd": sync_result["total_value_usd"],
                "sync_time_ms": sync_time_ms,
            },
            request=request,
        )

        return ExchangeSyncResult(
            exchange_id=exchange_id,
            assets_synced=sync_result["positions_synced"],
            total_value_usd=Decimal(str(sync_result["total_value_usd"])),
            sync_time_ms=sync_time_ms,
        )

    except ExchangeAdapterError as e:
        await record_audit_event_immediate(
            organization_id=exchange.client.organization_id,
            user_id=permission_ctx.user.id,
            action=AuditAction.SYNC,
            resource_type="exchange",
            resource_id=exchange.id,
            description="Exchange sync failed",
            metadata={
                "client_id": client_id,
                "exchange": exchange.exchange,
                "error_type": type(e).__name__,
                "error": str(e),
            },
            request=request,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e),
        )
    except ValueError as e:
        await record_audit_event_immediate(
            organization_id=exchange.client.organization_id,
            user_id=permission_ctx.user.id,
            action=AuditAction.SYNC,
            resource_type="exchange",
            resource_id=exchange.id,
            description="Exchange sync failed",
            metadata={
                "client_id": client_id,
                "exchange": exchange.exchange,
                "error_type": type(e).__name__,
                "error": str(e),
            },
            request=request,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# ============================================
# Exchange Positions Endpoints (Global)
# These endpoints are NOT nested under /clients/{client_id}
# ============================================

# Create a separate router for global exchange endpoints
exchange_positions_router = APIRouter(
    dependencies=[Depends(rbac_route_guard("exchange"))]
)


@exchange_positions_router.get("/supported", response_model=List[SupportedExchangeInfo])
async def list_supported_exchanges(
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("exchanges:view", route_key="exchange")),
    ],
) -> List[SupportedExchangeInfo]:
    _ = permission_ctx
    """List all supported exchanges."""
    return [EXCHANGE_INFO[exchange_id] for exchange_id in SUPPORTED_EXCHANGES if exchange_id in EXCHANGE_INFO]


@exchange_positions_router.get("/positions", response_model=ExchangePositionsSummary)
async def get_exchange_positions(
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("exchanges:view", route_key="exchange")),
    ],
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

    Scoped to the caller's organization. Can be filtered by client_id
    to show only one client's exchanges.
    """
    service = ExchangeService(db)
    if (
        is_scope_specific_enforcement_enabled("exchange")
        and client_id is not None
        and permission_ctx.client_access_mode is not None
        and not permission_ctx.can_access_client(client_id)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden by membership client scope",
        )

    result = await service.get_exchange_positions_summary(
        organization_id=permission_ctx.organization_id,
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
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("exchanges:view", route_key="exchange")),
    ],
    db: DBSession,
    exchange_id: Optional[UUID] = Query(None, description="Filter by specific exchange"),
    limit: int = Query(50, ge=1, le=200, description="Max transactions to return"),
):
    """
    Get recent transactions from connected exchanges.

    Scoped to the caller's organization. Returns deposits, withdrawals,
    and internal transfers.
    """
    service = ExchangeService(db)

    if (
        exchange_id is not None
        and is_scope_specific_enforcement_enabled("exchange")
        and permission_ctx.client_access_mode is not None
    ):
        result = await db.execute(
            select(Exchange)
            .where(Exchange.id == exchange_id)
            .options(selectinload(Exchange.client))
        )
        exchange = result.scalar_one_or_none()
        if (
            exchange is None
            or exchange.client is None
            or exchange.client.organization_id != permission_ctx.organization_id
            or not permission_ctx.can_access_client(exchange.client_id)
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden by membership client scope",
            )

    try:
        transactions = await service.get_exchange_transactions(
            organization_id=permission_ctx.organization_id,
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
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("exchanges:view", route_key="exchange")),
    ],
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

    Scoped to the caller's organization. This endpoint fetches data
    directly from the exchange API.
    """
    # Find the exchange with its client to verify organization access
    result = await db.execute(
        select(Exchange)
        .where(Exchange.id == exchange_id)
        .options(selectinload(Exchange.client))
    )
    exchange = result.scalar_one_or_none()

    # Return 404 (not 403) when the exchange belongs to another org so we
    # don't leak existence of UUIDs that don't belong to the caller.
    if (
        not exchange
        or not exchange.client
        or exchange.client.organization_id != permission_ctx.organization_id
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exchange not found",
        )
    if (
        is_scope_specific_enforcement_enabled("exchange")
        and permission_ctx.client_access_mode is not None
        and not permission_ctx.can_access_client(exchange.client_id)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden by membership client scope",
        )

    service = ExchangeService(db)

    try:
        live_data = await service.get_exchange_live_data(
            exchange_id=exchange_id,
            organization_id=permission_ctx.organization_id,
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
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("exchanges:view", route_key="exchange")),
    ],
    db: DBSession,
    limit: int = Query(50, ge=1, le=200, description="Max transactions to return"),
):
    """
    Get recent transactions from a specific exchange.

    Returns deposits, withdrawals, and internal transfers.
    """
    if (
        is_scope_specific_enforcement_enabled("exchange")
        and permission_ctx.client_access_mode is not None
    ):
        exchange_lookup = await db.execute(
            select(Exchange)
            .where(Exchange.id == exchange_id)
            .options(selectinload(Exchange.client))
        )
        exchange = exchange_lookup.scalar_one_or_none()
        if (
            exchange is None
            or exchange.client is None
            or exchange.client.organization_id != permission_ctx.organization_id
            or not permission_ctx.can_access_client(exchange.client_id)
        ):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Exchange not found",
            )

    service = ExchangeService(db)

    try:
        transactions = await service.get_exchange_transactions(
            organization_id=permission_ctx.organization_id,
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
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("exchanges:create", route_key="exchange")),
    ],
) -> ExchangeTestConnectionResponse:
    _ = permission_ctx
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

    service = ExchangeService(db)

    try:
        success, error, summary = await service.test_connection_with_credentials(
            exchange=data.exchange,
            api_key=data.api_key,
            api_secret=data.api_secret,
        )

        if success and summary:
            return ExchangeTestConnectionResponse(
                success=True,
                message="Connection successful!",
                assets_found=summary.position_count,
                total_value_usd=summary.total_value_usd,
            )

        return ExchangeTestConnectionResponse(
            success=False,
            message=error or "Connection failed. Please check your API credentials.",
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
