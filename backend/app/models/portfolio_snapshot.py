"""Portfolio Snapshot model (for TimescaleDB)."""

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.client import Client


class PortfolioSnapshot(Base, UUIDMixin, TimestampMixin):
    """Portfolio Snapshot model - time-series data for portfolio history."""

    __tablename__ = "portfolio_snapshots"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    client_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=True,  # null = org-level snapshot
    )

    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Values
    total_value_usd: Mapped[Decimal] = mapped_column(Numeric(24, 2), nullable=False)
    total_holding_usd: Mapped[Decimal] = mapped_column(Numeric(24, 2), default=Decimal("0"), nullable=False)
    total_staking_usd: Mapped[Decimal] = mapped_column(Numeric(24, 2), default=Decimal("0"), nullable=False)
    total_lending_usd: Mapped[Decimal] = mapped_column(Numeric(24, 2), default=Decimal("0"), nullable=False)
    total_lp_usd: Mapped[Decimal] = mapped_column(Numeric(24, 2), default=Decimal("0"), nullable=False)

    # P&L
    pnl_24h: Mapped[Decimal] = mapped_column(Numeric(24, 2), default=Decimal("0"), nullable=False)
    pnl_7d: Mapped[Decimal] = mapped_column(Numeric(24, 2), default=Decimal("0"), nullable=False)
    pnl_30d: Mapped[Decimal] = mapped_column(Numeric(24, 2), default=Decimal("0"), nullable=False)
    pnl_total: Mapped[Decimal] = mapped_column(Numeric(24, 2), default=Decimal("0"), nullable=False)

    # Yield
    pending_rewards_usd: Mapped[Decimal] = mapped_column(Numeric(24, 2), default=Decimal("0"), nullable=False)
    average_apy: Mapped[Decimal] = mapped_column(Numeric(10, 4), default=Decimal("0"), nullable=False)

    # Detailed data
    allocations: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)  # by type, by chain, by asset
    positions_snapshot: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)  # detailed positions at time
    risk_metrics: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)  # VaR, volatility, sharpe, etc

    # Relationships
    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="snapshots",
    )
    client: Mapped[Optional["Client"]] = relationship("Client")

    def __repr__(self) -> str:
        return f"<PortfolioSnapshot(id={self.id}, timestamp={self.timestamp}, value=${self.total_value_usd})>"
