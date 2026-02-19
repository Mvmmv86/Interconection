"""Alert model."""

from datetime import datetime
from typing import TYPE_CHECKING, Optional
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.user import User


class AlertType(str, enum.Enum):
    """Alert types."""

    PRICE = "price"
    PERCENT_CHANGE = "percent_change"
    PORTFOLIO_VALUE = "portfolio_value"
    DRAWDOWN = "drawdown"
    HEALTH_FACTOR = "health_factor"
    YIELD = "yield"
    POSITION = "position"


class Alert(Base, UUIDMixin, TimestampMixin):
    """Alert model - represents a user alert."""

    __tablename__ = "alerts"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[AlertType] = mapped_column(
        SAEnum(AlertType),
        nullable=False,
    )
    condition: Mapped[dict] = mapped_column(JSONB, nullable=False)  # {operator, threshold, asset_id, period, etc}
    channels: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)  # {in_app: true, email: true, webhook: "url"}

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    cooldown_minutes: Mapped[int] = mapped_column(Integer, default=60, nullable=False)

    triggered_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_triggered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="alerts",
    )
    user: Mapped["User"] = relationship("User")

    def __repr__(self) -> str:
        return f"<Alert(id={self.id}, name='{self.name}', type='{self.type.value}')>"
