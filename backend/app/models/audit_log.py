"""Audit Log model."""

from datetime import datetime
from typing import TYPE_CHECKING, Optional
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.db.base import Base, UUIDMixin

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.user import User


class AuditAction(str, enum.Enum):
    """Audit action types."""

    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    LOGIN = "login"
    LOGOUT = "logout"
    SYNC = "sync"
    EXPORT = "export"
    ALERT_TRIGGERED = "alert_triggered"


class AuditLog(Base, UUIDMixin):
    """Audit Log model - tracks user actions."""

    __tablename__ = "audit_logs"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    action: Mapped[AuditAction] = mapped_column(
        SAEnum(AuditAction),
        nullable=False,
    )
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)  # client, wallet, exchange, etc
    resource_id: Mapped[Optional[UUID]] = mapped_column(nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    log_metadata: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)  # old_values, new_values, etc
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="audit_logs",
    )
    user: Mapped[Optional["User"]] = relationship("User")

    def __repr__(self) -> str:
        return f"<AuditLog(id={self.id}, action='{self.action.value}', resource='{self.resource_type}')>"
