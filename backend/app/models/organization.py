"""Organization model."""

from datetime import datetime
from typing import TYPE_CHECKING, List, Optional
from uuid import UUID

from sqlalchemy import Boolean, String, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.client import Client
    from app.models.alert import Alert
    from app.models.membership import Role, Membership, Invitation
    from app.models.portfolio_snapshot import PortfolioSnapshot
    from app.models.audit_log import AuditLog


class PlanType(str, enum.Enum):
    """Organization plan types."""

    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class Organization(Base, UUIDMixin, TimestampMixin):
    """Organization model - represents a company/team."""

    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    logo_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    settings: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    plan: Mapped[PlanType] = mapped_column(
        SAEnum(PlanType),
        default=PlanType.FREE,
        nullable=False,
    )

    # Relationships
    users: Mapped[List["User"]] = relationship(
        "User",
        back_populates="organization",
    )
    roles: Mapped[List["Role"]] = relationship(
        "Role",
        back_populates="organization",
        cascade="all, delete-orphan",
    )
    memberships: Mapped[List["Membership"]] = relationship(
        "Membership",
        back_populates="organization",
        cascade="all, delete-orphan",
    )
    invitations: Mapped[List["Invitation"]] = relationship(
        "Invitation",
        back_populates="organization",
        cascade="all, delete-orphan",
    )
    clients: Mapped[List["Client"]] = relationship(
        "Client",
        back_populates="organization",
        cascade="all, delete-orphan",
    )
    alerts: Mapped[List["Alert"]] = relationship(
        "Alert",
        back_populates="organization",
        cascade="all, delete-orphan",
    )
    snapshots: Mapped[List["PortfolioSnapshot"]] = relationship(
        "PortfolioSnapshot",
        back_populates="organization",
        cascade="all, delete-orphan",
    )
    audit_logs: Mapped[List["AuditLog"]] = relationship(
        "AuditLog",
        back_populates="organization",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Organization(id={self.id}, name='{self.name}', slug='{self.slug}')>"
