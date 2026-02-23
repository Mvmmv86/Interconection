"""Wallet tokens and transactions endpoints."""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, status, Query
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession
from app.models.wallet import Wallet
from app.models.wallet_data import WalletToken, WalletTransaction
from app.schemas.common import BaseSchema

router = APIRouter()


# --- Response Schemas ---

class WalletTokenResponse(BaseSchema):
    """Wallet token response."""

    id: UUID
    wallet_id: UUID
    symbol: str
    name: str
    contract_address: Optional[str] = None
    balance: float
    balance_usd: float
    price_usd: float
    price_change_24h: Optional[float] = None
    decimals: Optional[int] = None
    logo_url: Optional[str] = None
    scanned_at: str


class WalletTransactionResponse(BaseSchema):
    """Wallet transaction response."""

    id: UUID
    wallet_id: UUID
    type: str
    tx_hash: str
    block_number: Optional[int] = None
    from_address: str
    to_address: Optional[str] = None
    token_symbol: Optional[str] = None
    token_address: Optional[str] = None
    amount: Optional[float] = None
    value_usd: Optional[float] = None
    gas_fee: Optional[float] = None
    gas_fee_usd: Optional[float] = None
    chain: str
    timestamp: str
    indexed_at: str


# --- Helper ---

async def _verify_wallet_access(wallet_id: UUID, current_user, db) -> Wallet:
    """Verify the user has access to this wallet via their clients."""
    from app.models.client import Client
    result = await db.execute(
        select(Wallet)
        .join(Client, Wallet.client_id == Client.id)
        .where(
            Wallet.id == wallet_id,
            Client.organization_id == current_user.organization_id,
        )
    )
    wallet = result.scalar_one_or_none()
    if not wallet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wallet not found",
        )
    return wallet


# --- Endpoints ---

@router.get("/{wallet_id}/tokens", response_model=List[WalletTokenResponse])
async def list_wallet_tokens(
    wallet_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> List[WalletTokenResponse]:
    """List cached token balances for a wallet."""
    await _verify_wallet_access(wallet_id, current_user, db)

    result = await db.execute(
        select(WalletToken)
        .where(WalletToken.wallet_id == wallet_id)
        .order_by(WalletToken.balance_usd.desc())
    )
    tokens = result.scalars().all()

    return [WalletTokenResponse.model_validate(t) for t in tokens]


@router.get("/{wallet_id}/transactions", response_model=List[WalletTransactionResponse])
async def list_wallet_transactions(
    wallet_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
    tx_type: Optional[str] = None,
    chain: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> List[WalletTransactionResponse]:
    """List on-chain transactions for a wallet."""
    await _verify_wallet_access(wallet_id, current_user, db)

    query = select(WalletTransaction).where(WalletTransaction.wallet_id == wallet_id)

    if tx_type:
        query = query.where(WalletTransaction.type == tx_type)
    if chain:
        query = query.where(WalletTransaction.chain == chain)

    query = query.offset(skip).limit(limit).order_by(WalletTransaction.timestamp.desc())

    result = await db.execute(query)
    transactions = result.scalars().all()

    return [WalletTransactionResponse.model_validate(t) for t in transactions]
