"""Transaction model."""

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.client import Client
    from app.models.asset import Asset
    from app.models.position import Position


class TransactionType(str, enum.Enum):
    """Transaction types."""

    BUY = "buy"
    SELL = "sell"
    TRANSFER = "transfer"
    DEPOSIT = "deposit"
    WITHDRAW = "withdraw"
    SWAP = "swap"
    STAKE = "stake"
    UNSTAKE = "unstake"
    CLAIM = "claim"
    FEE = "fee"


class Transaction(Base, UUIDMixin, TimestampMixin):
    """Transaction model - represents a crypto transaction."""

    __tablename__ = "transactions"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    client_id: Mapped[UUID] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
    )
    asset_id: Mapped[UUID] = mapped_column(
        ForeignKey("assets.id", ondelete="RESTRICT"),
        nullable=False,
    )
    position_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("positions.id", ondelete="SET NULL"),
        nullable=True,
    )

    type: Mapped[TransactionType] = mapped_column(
        SAEnum(TransactionType),
        nullable=False,
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(32, 18), nullable=False)
    price_usd: Mapped[Decimal] = mapped_column(Numeric(24, 12), nullable=False)
    total_usd: Mapped[Decimal] = mapped_column(Numeric(24, 2), nullable=False)
    fee_usd: Mapped[Optional[Decimal]] = mapped_column(Numeric(24, 2), nullable=True)

    tx_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    chain: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    tx_metadata: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True, default=dict)

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization")
    client: Mapped["Client"] = relationship("Client")
    asset: Mapped["Asset"] = relationship("Asset")
    position: Mapped[Optional["Position"]] = relationship("Position")

    def __repr__(self) -> str:
        return f"<Transaction(id={self.id}, type='{self.type.value}', total=${self.total_usd})>"
