"""Client observation model."""

from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING, Optional
from uuid import UUID

from sqlalchemy import Date, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.client import Client
    from app.models.organization import Organization
    from app.models.user import User


class ClientObservation(Base, UUIDMixin, TimestampMixin):
    """Manual observation rows for a managed client account."""

    __tablename__ = "client_observations"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    client_id: Mapped[UUID] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by_user_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    observed_at: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    location: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    asset_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    asset_symbol: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(32, 12), nullable=True)
    value_usd: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 2), nullable=True)
    note: Mapped[str] = mapped_column(Text, nullable=False)

    client: Mapped["Client"] = relationship("Client", back_populates="observations")
    organization: Mapped["Organization"] = relationship("Organization")
    created_by_user: Mapped[Optional["User"]] = relationship("User")

    def __repr__(self) -> str:
        return f"<ClientObservation(id={self.id}, client_id={self.client_id})>"
