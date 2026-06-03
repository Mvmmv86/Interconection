"""Client model."""

from datetime import datetime
from typing import TYPE_CHECKING, List, Optional
from uuid import UUID

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.wallet import Wallet
    from app.models.exchange import Exchange
    from app.models.position import Position
    from app.models.manual_asset import ManualAsset
    from app.models.staking_position import StakingPosition
    from app.models.pool_position import PoolPosition
    from app.models.membership import Membership


class Client(Base, UUIDMixin, TimestampMixin):
    """Client model - represents a client managed by the organization."""

    __tablename__ = "clients"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    color: Mapped[str] = mapped_column(String(7), default="#4ECDC4", nullable=False)

    # Relationships
    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="clients",
    )
    wallets: Mapped[List["Wallet"]] = relationship(
        "Wallet",
        back_populates="client",
        cascade="all, delete-orphan",
    )
    exchanges: Mapped[List["Exchange"]] = relationship(
        "Exchange",
        back_populates="client",
        cascade="all, delete-orphan",
    )
    memberships: Mapped[List["Membership"]] = relationship(
        "Membership",
        secondary="membership_clients",
        back_populates="clients",
    )
    positions: Mapped[List["Position"]] = relationship(
        "Position",
        back_populates="client",
        cascade="all, delete-orphan",
    )
    manual_assets: Mapped[List["ManualAsset"]] = relationship(
        "ManualAsset",
        back_populates="client",
        cascade="all, delete-orphan",
    )
    staking_positions: Mapped[List["StakingPosition"]] = relationship(
        "StakingPosition",
        back_populates="client",
        cascade="all, delete-orphan",
    )
    pool_positions: Mapped[List["PoolPosition"]] = relationship(
        "PoolPosition",
        back_populates="client",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Client(id={self.id}, name='{self.name}')>"
