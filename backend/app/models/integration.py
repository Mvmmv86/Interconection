"""Integration model - for tracking external integrations and sync status."""

from datetime import datetime
from typing import TYPE_CHECKING, Optional
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.organization import Organization


class IntegrationType(str, enum.Enum):
    """Integration types."""

    EXCHANGE = "exchange"
    WALLET_EVM = "wallet_evm"
    WALLET_SOLANA = "wallet_solana"
    WALLET_BITCOIN = "wallet_bitcoin"
    DEFI_PROTOCOL = "defi_protocol"
    PRICE_FEED = "price_feed"
    BLOCKCHAIN_RPC = "blockchain_rpc"


class IntegrationStatus(str, enum.Enum):
    """Integration status."""

    ACTIVE = "active"
    SYNCING = "syncing"
    ERROR = "error"
    DISABLED = "disabled"
    RATE_LIMITED = "rate_limited"


class Integration(Base, UUIDMixin, TimestampMixin):
    """Integration model - tracks external service integrations."""

    __tablename__ = "integrations"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Integration info
    type: Mapped[IntegrationType] = mapped_column(SAEnum(IntegrationType), nullable=False)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)  # binance, infura, helius
    name: Mapped[str] = mapped_column(String(100), nullable=False)  # Display name

    # Configuration (encrypted sensitive data stored separately)
    config: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)  # Non-sensitive config

    # Status
    status: Mapped[IntegrationStatus] = mapped_column(
        SAEnum(IntegrationStatus),
        default=IntegrationStatus.ACTIVE,
        nullable=False,
    )
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Sync tracking
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_sync_success: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    consecutive_errors: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Rate limiting
    requests_today: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rate_limit_reset_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Metrics
    total_syncs: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    avg_sync_time_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization")

    def __repr__(self) -> str:
        return f"<Integration(id={self.id}, type='{self.type.value}', provider='{self.provider}')>"


class SyncLog(Base, UUIDMixin):
    """Sync Log model - tracks individual sync operations."""

    __tablename__ = "sync_logs"

    integration_id: Mapped[UUID] = mapped_column(
        ForeignKey("integrations.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Sync details
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Results
    success: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    items_synced: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    items_created: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    items_updated: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    items_deleted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Error info
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error_details: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Relationships
    integration: Mapped["Integration"] = relationship("Integration")

    def __repr__(self) -> str:
        return f"<SyncLog(id={self.id}, integration={self.integration_id}, success={self.success})>"
