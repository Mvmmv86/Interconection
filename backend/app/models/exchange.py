"""Exchange model."""

from datetime import datetime
from typing import TYPE_CHECKING, List, Optional
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin

if TYPE_CHECKING:
    from app.models.client import Client
    from app.models.bot import BotInstance


class Exchange(Base, UUIDMixin):
    """Exchange model - represents an exchange connection."""

    __tablename__ = "exchanges"

    client_id: Mapped[UUID] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
    )
    exchange: Mapped[str] = mapped_column(String(50), nullable=False)  # binance, coinbase, etc
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    api_key_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    api_secret_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    api_key_masked: Mapped[str] = mapped_column(String(20), nullable=False)  # last 4 chars
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    sync_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    client: Mapped["Client"] = relationship(
        "Client",
        back_populates="exchanges",
    )
    bot_instances: Mapped[List["BotInstance"]] = relationship(
        "BotInstance",
        back_populates="exchange",
    )

    def __repr__(self) -> str:
        return f"<Exchange(id={self.id}, exchange='{self.exchange}', label='{self.label}')>"
