"""Risk threshold settings model."""

from typing import Optional
from uuid import UUID

from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class RiskThreshold(Base, UUIDMixin, TimestampMixin):
    """Risk thresholds per organization - customizable risk limits.

    Each metric has a warning and danger threshold.
    When a metric crosses warning → yellow alert.
    When a metric crosses danger → red alert.
    """

    __tablename__ = "risk_thresholds"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    # VaR 95% (daily) - percentage loss threshold
    var95_warning: Mapped[Optional[float]] = mapped_column(Numeric(10, 4), nullable=True, default=5.0)
    var95_danger: Mapped[Optional[float]] = mapped_column(Numeric(10, 4), nullable=True, default=10.0)

    # CVaR 95% (Expected Shortfall)
    cvar95_warning: Mapped[Optional[float]] = mapped_column(Numeric(10, 4), nullable=True, default=8.0)
    cvar95_danger: Mapped[Optional[float]] = mapped_column(Numeric(10, 4), nullable=True, default=15.0)

    # Max Drawdown
    max_drawdown_warning: Mapped[Optional[float]] = mapped_column(Numeric(10, 4), nullable=True, default=15.0)
    max_drawdown_danger: Mapped[Optional[float]] = mapped_column(Numeric(10, 4), nullable=True, default=30.0)

    # Volatility 30d (annualized)
    volatility_warning: Mapped[Optional[float]] = mapped_column(Numeric(10, 4), nullable=True, default=60.0)
    volatility_danger: Mapped[Optional[float]] = mapped_column(Numeric(10, 4), nullable=True, default=100.0)

    # Sharpe Ratio (lower is worse)
    sharpe_warning: Mapped[Optional[float]] = mapped_column(Numeric(10, 4), nullable=True, default=0.5)
    sharpe_danger: Mapped[Optional[float]] = mapped_column(Numeric(10, 4), nullable=True, default=0.0)

    # Leverage Ratio (gross)
    leverage_warning: Mapped[Optional[float]] = mapped_column(Numeric(10, 4), nullable=True, default=2.0)
    leverage_danger: Mapped[Optional[float]] = mapped_column(Numeric(10, 4), nullable=True, default=5.0)

    # Concentration Risk (top asset %)
    concentration_warning: Mapped[Optional[float]] = mapped_column(Numeric(10, 4), nullable=True, default=40.0)
    concentration_danger: Mapped[Optional[float]] = mapped_column(Numeric(10, 4), nullable=True, default=60.0)

    def __repr__(self) -> str:
        return f"<RiskThreshold(id={self.id}, org={self.organization_id})>"
