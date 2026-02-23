"""Exchange transaction model."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
import enum

from app.db.base import Base, UUIDMixin


class ExchangeTxType(str, enum.Enum):
    """Exchange transaction types."""

    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"
    INTERNAL_TRANSFER = "internal_transfer"
    TRADE = "trade"
    FEE = "fee"
    REBATE = "rebate"
    INTEREST = "interest"
    FUNDING_FEE = "funding_fee"


class ExchangeTxStatus(str, enum.Enum):
    """Transaction status."""

    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ExchangeTransaction(Base, UUIDMixin):
    """Exchange deposit/withdrawal/transfer transactions."""

    __tablename__ = "exchange_transactions"

    exchange_id: Mapped[UUID] = mapped_column(
        ForeignKey("exchanges.id", ondelete="CASCADE"),
        nullable=False,
    )

    type: Mapped[ExchangeTxType] = mapped_column(SAEnum(ExchangeTxType), nullable=False)
    status: Mapped[ExchangeTxStatus] = mapped_column(
        SAEnum(ExchangeTxStatus),
        nullable=False,
        default=ExchangeTxStatus.COMPLETED,
    )

    coin: Mapped[str] = mapped_column(String(20), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(28, 12), nullable=False)
    fee: Mapped[Optional[float]] = mapped_column(Numeric(28, 12), nullable=True)
    value_usd: Mapped[Optional[float]] = mapped_column(Numeric(20, 2), nullable=True)

    # For trades
    trade_pair: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)  # BTCUSDT
    trade_side: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # buy, sell
    trade_price: Mapped[Optional[float]] = mapped_column(Numeric(20, 8), nullable=True)

    # Blockchain info
    tx_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)  # Exchange internal tx id
    tx_hash: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)  # Blockchain hash
    chain: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    from_address: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    to_address: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    # Account info
    from_account: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # spot, futures
    to_account: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<ExchangeTx({self.type.value} {self.amount} {self.coin})>"
