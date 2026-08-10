"""Client endpoints."""

from typing import Annotated, List
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError

from app.api.deps import (
    DBSession,
    MembershipAuthContext,
    rbac_route_guard,
    require_permission,
    is_scope_specific_enforcement_enabled,
)
from app.models.client import Client
from app.models.ai import AIReport
from app.models.bot import (
    BotBacktestRun,
    BotBacktestTrade,
    BotInstance,
    BotInstanceAsset,
    BotLiveOrder,
    BotRun,
    BotSignal,
)
from app.models.defi_cache import DefiPositionCache
from app.models.exchange import Exchange
from app.models.exchange_balance import (
    ExchangeBalance,
    ExchangeEarnPosition,
    ExchangeFuturesPosition,
    ExchangeSubaccount,
)
from app.models.exchange_transaction import ExchangeTransaction
from app.models.manual_asset import ManualAsset
from app.models.membership import MembershipClient, TeamClient
from app.models.pool_position import PoolPosition
from app.models.portfolio_snapshot import PortfolioSnapshot
from app.models.position import Position
from app.models.staking_position import StakingPosition
from app.models.transaction import Transaction
from app.models.wallet import Wallet
from app.models.wallet_data import WalletToken, WalletTransaction
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
from app.services.plan_limits import enforce_plan_limit

router = APIRouter(dependencies=[Depends(rbac_route_guard("clients"))])


@router.get("", response_model=List[ClientPortfolioListItem])
async def list_clients(
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("clients:list", route_key="clients")),
    ],
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
    clients = await service.get_clients_with_summaries(
        organization_id=permission_ctx.organization_id,
    )

    filtered_clients = clients
    if (
        is_scope_specific_enforcement_enabled("clients")
        and permission_ctx.client_access_mode is not None
        and permission_ctx.client_access_mode.name.lower() == "specific"
    ):
        filtered_clients = [
            client
            for client in clients
            if client.id in permission_ctx.scope_client_ids
        ]

    return filtered_clients[skip : skip + limit]


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
async def create_client(
    data: ClientCreate,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("clients:create", route_key="clients")),
    ],
    db: DBSession,
) -> ClientResponse:
    """Create a new client."""
    await enforce_plan_limit(db, permission_ctx.organization_id, "portfolios")
    client = Client(
        id=uuid4(),
        organization_id=permission_ctx.organization_id,
        **data.model_dump(),
    )
    db.add(client)
    await db.flush()
    await db.refresh(client)

    return ClientResponse.model_validate(client)


@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(
    client_id: UUID,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("clients:list", route_key="clients")),
    ],
    db: DBSession,
) -> ClientResponse:
    """Get a specific client."""
    if (
        is_scope_specific_enforcement_enabled("clients")
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

    return ClientResponse.model_validate(client)


@router.patch("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: UUID,
    data: ClientUpdate,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("clients:edit", route_key="clients")),
    ],
    db: DBSession,
) -> ClientResponse:
    """Update a client."""
    if (
        is_scope_specific_enforcement_enabled("clients")
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

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(client, field, value)

    await db.flush()
    await db.refresh(client)

    return ClientResponse.model_validate(client)


@router.delete("/{client_id}", response_model=SuccessResponse)
async def delete_client(
    client_id: UUID,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("clients:delete", route_key="clients")),
    ],
    db: DBSession,
) -> SuccessResponse:
    """Delete a client."""
    if (
        is_scope_specific_enforcement_enabled("clients")
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

    wallet_ids = select(Wallet.id).where(Wallet.client_id == client_id)
    exchange_ids = select(Exchange.id).where(Exchange.client_id == client_id)
    bot_instance_ids = select(BotInstance.id).where(BotInstance.client_id == client_id)
    bot_backtest_run_ids = select(BotBacktestRun.id).where(
        BotBacktestRun.instance_id.in_(bot_instance_ids)
    )

    try:
        bulk_deletes = [
            delete(MembershipClient).where(MembershipClient.client_id == client_id),
            delete(TeamClient).where(TeamClient.client_id == client_id),
            delete(ExchangeTransaction).where(ExchangeTransaction.exchange_id.in_(exchange_ids)),
            delete(ExchangeSubaccount).where(ExchangeSubaccount.exchange_id.in_(exchange_ids)),
            delete(ExchangeEarnPosition).where(ExchangeEarnPosition.exchange_id.in_(exchange_ids)),
            delete(ExchangeFuturesPosition).where(ExchangeFuturesPosition.exchange_id.in_(exchange_ids)),
            delete(ExchangeBalance).where(ExchangeBalance.exchange_id.in_(exchange_ids)),
            delete(DefiPositionCache).where(DefiPositionCache.wallet_id.in_(wallet_ids)),
            delete(WalletToken).where(WalletToken.wallet_id.in_(wallet_ids)),
            delete(WalletTransaction).where(WalletTransaction.wallet_id.in_(wallet_ids)),
            delete(BotLiveOrder).where(BotLiveOrder.instance_id.in_(bot_instance_ids)),
            delete(BotBacktestTrade).where(BotBacktestTrade.run_id.in_(bot_backtest_run_ids)),
            delete(BotInstanceAsset).where(BotInstanceAsset.instance_id.in_(bot_instance_ids)),
            delete(BotSignal).where(BotSignal.instance_id.in_(bot_instance_ids)),
            delete(BotRun).where(BotRun.instance_id.in_(bot_instance_ids)),
            delete(BotBacktestRun).where(BotBacktestRun.instance_id.in_(bot_instance_ids)),
            delete(BotInstance).where(BotInstance.client_id == client_id),
            delete(Transaction).where(Transaction.client_id == client_id),
            delete(Position).where(Position.client_id == client_id),
            delete(ManualAsset).where(ManualAsset.client_id == client_id),
            delete(StakingPosition).where(StakingPosition.client_id == client_id),
            delete(PoolPosition).where(PoolPosition.client_id == client_id),
            delete(PortfolioSnapshot).where(PortfolioSnapshot.client_id == client_id),
            delete(AIReport).where(AIReport.client_id == client_id),
            delete(Exchange).where(Exchange.client_id == client_id),
            delete(Wallet).where(Wallet.client_id == client_id),
            delete(Client).where(
                Client.id == client_id,
                Client.organization_id == permission_ctx.organization_id,
            ),
        ]
        for statement in bulk_deletes:
            await db.execute(statement.execution_options(synchronize_session=False))
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Não foi possível excluir esta conta porque ainda existem dados "
                "vinculados a ela. Remova conexões, carteiras ou bots ligados à "
                "conta e tente novamente."
            ),
        ) from exc

    return SuccessResponse(message="Client deleted successfully")


@router.get("/{client_id}/portfolio", response_model=ClientPortfolio)
async def get_client_portfolio(
    client_id: UUID,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("clients:list", route_key="clients")),
    ],
    db: DBSession,
) -> ClientPortfolio:
    """
    Get complete client portfolio data with real values.

    Returns the client with all wallets (with token balances from positions),
    exchanges (with balances from positions), manual assets, staking positions,
    pool positions, and a summary with real metrics.
    """
    if (
        is_scope_specific_enforcement_enabled("clients")
        and not permission_ctx.can_access_client(client_id)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden by membership client scope",
        )

    service = ClientService(db)
    portfolio = await service.get_client_portfolio(
        client_id=client_id,
        organization_id=permission_ctx.organization_id,
    )

    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )

    return portfolio
