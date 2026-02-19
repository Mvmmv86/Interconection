"""Manual Asset model - for manually tracked assets."""

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional
from uuid import UUID

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    Enum as SAEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.client import Client


class ManualAssetType(str, enum.Enum):
    """Manual asset types."""

    HOLDING = "holding"
    STAKING = "staking"
    LENDING = "lending"
    LP = "lp"


class ManualAssetNetwork(str, enum.Enum):
    """Supported networks for manual assets."""

    EVM = "evm"
    SOLANA = "solana"
    BITCOIN = "bitcoin"
    OTHER = "other"


class ManualAsset(Base, UUIDMixin, TimestampMixin):
    """Manual Asset model - assets manually tracked by user."""

    __tablename__ = "manual_assets"

    client_id: Mapped[UUID] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Token info
    token: Mapped[str] = mapped_column(String(20), nullable=False)  # Symbol: ETH, SOL, BTC
    token_name: Mapped[str] = mapped_column(String(100), nullable=False)
    network: Mapped[ManualAssetNetwork] = mapped_column(
        SAEnum(ManualAssetNetwork),
        nullable=False,
    )
    contract_address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Amounts
    quantity: Mapped[Decimal] = mapped_column(Numeric(32, 18), nullable=False)
    purchase_price: Mapped[Decimal] = mapped_column(Numeric(24, 12), nullable=False)  # Price per unit at purchase
    purchase_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    current_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(24, 12), nullable=True)

    # Type and yield info
    type: Mapped[ManualAssetType] = mapped_column(
        SAEnum(ManualAssetType),
        default=ManualAssetType.HOLDING,
        nullable=False,
    )
    staking_provider: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # Lido, Marinade, etc
    apy: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)

    # Notes
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    client: Mapped["Client"] = relationship("Client", back_populates="manual_assets")

    @property
    def current_value_usd(self) -> Decimal:
        """Calculate current value in USD."""
        if self.current_price:
            return self.quantity * self.current_price
        return self.quantity * self.purchase_price

    @property
    def cost_basis(self) -> Decimal:
        """Calculate cost basis."""
        return self.quantity * self.purchase_price

    @property
    def unrealized_pnl(self) -> Decimal:
        """Calculate unrealized P&L."""
        return self.current_value_usd - self.cost_basis

    @property
    def unrealized_pnl_percent(self) -> Decimal:
        """Calculate unrealized P&L percentage."""
        if self.cost_basis > 0:
            return (self.unrealized_pnl / self.cost_basis) * 100
        return Decimal("0")

    def __repr__(self) -> str:
        return f"<ManualAsset(id={self.id}, token='{self.token}', qty={self.quantity})>"
