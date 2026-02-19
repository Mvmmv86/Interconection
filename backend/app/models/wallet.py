"""Wallet model."""

from datetime import datetime
from typing import TYPE_CHECKING, Optional
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.db.base import Base, UUIDMixin

if TYPE_CHECKING:
    from app.models.client import Client


class NetworkType(str, enum.Enum):
    """Blockchain network types."""

    EVM = "evm"
    SOLANA = "solana"
    BITCOIN = "bitcoin"


class Wallet(Base, UUIDMixin):
    """Wallet model - represents a blockchain wallet."""

    __tablename__ = "wallets"
    __table_args__ = (
        UniqueConstraint("client_id", "address", "chain", name="uq_wallet_client_address_chain"),
    )

    client_id: Mapped[UUID] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
    )
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    network: Mapped[NetworkType] = mapped_column(
        SAEnum(NetworkType),
        nullable=False,
    )
    chain: Mapped[str] = mapped_column(String(50), nullable=False)  # ethereum, arbitrum, solana, etc
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )
    last_scan_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    client: Mapped["Client"] = relationship(
        "Client",
        back_populates="wallets",
    )

    def __repr__(self) -> str:
        return f"<Wallet(id={self.id}, address='{self.address[:10]}...', chain='{self.chain}')>"
