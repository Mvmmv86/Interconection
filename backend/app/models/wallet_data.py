"""Wallet token balances and transaction models."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
import enum

from app.db.base import Base, UUIDMixin


class WalletTxType(str, enum.Enum):
    """Wallet transaction types."""

    SEND = "send"
    RECEIVE = "receive"
    SWAP = "swap"
    APPROVE = "approve"
    CONTRACT_CALL = "contract_call"
    STAKE = "stake"
    UNSTAKE = "unstake"
    CLAIM = "claim"
    MINT = "mint"
    BURN = "burn"


class WalletToken(Base, UUIDMixin):
    """Cached token balances for a wallet scan.

    Updated each time a wallet is scanned (Helius for Solana, Zerion for EVM).
    """

    __tablename__ = "wallet_tokens"

    wallet_id: Mapped[UUID] = mapped_column(
        ForeignKey("wallets.id", ondelete="CASCADE"),
        nullable=False,
    )

    symbol: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    contract_address: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)  # null for native tokens

    balance: Mapped[float] = mapped_column(Numeric(28, 12), nullable=False, default=0)
    balance_usd: Mapped[float] = mapped_column(Numeric(20, 2), nullable=False, default=0)
    price_usd: Mapped[float] = mapped_column(Numeric(20, 8), nullable=False, default=0)
    price_change_24h: Mapped[Optional[float]] = mapped_column(Numeric(10, 4), nullable=True)

    decimals: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    scanned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<WalletToken({self.symbol}: {self.balance} = ${self.balance_usd})>"


class WalletTransaction(Base, UUIDMixin):
    """On-chain wallet transactions."""

    __tablename__ = "wallet_transactions"

    wallet_id: Mapped[UUID] = mapped_column(
        ForeignKey("wallets.id", ondelete="CASCADE"),
        nullable=False,
    )

    type: Mapped[WalletTxType] = mapped_column(SAEnum(WalletTxType), nullable=False)

    tx_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    block_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    from_address: Mapped[str] = mapped_column(String(128), nullable=False)
    to_address: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    token_symbol: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    token_address: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    amount: Mapped[Optional[float]] = mapped_column(Numeric(28, 12), nullable=True)
    value_usd: Mapped[Optional[float]] = mapped_column(Numeric(20, 2), nullable=True)

    gas_fee: Mapped[Optional[float]] = mapped_column(Numeric(28, 12), nullable=True)
    gas_fee_usd: Mapped[Optional[float]] = mapped_column(Numeric(20, 2), nullable=True)

    chain: Mapped[str] = mapped_column(String(30), nullable=False)

    # Extra data for complex transactions (swaps, multi-token)
    extra_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    indexed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<WalletTx({self.type.value} {self.amount} {self.token_symbol} on {self.chain})>"
