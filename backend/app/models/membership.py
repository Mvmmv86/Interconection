"""Team membership and RBAC models."""

from datetime import datetime
from typing import TYPE_CHECKING, List, Optional
from uuid import UUID
import enum

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.organization import Organization
    from app.models.client import Client


class MembershipStatus(str, enum.Enum):
    """Membership lifecycle states."""

    ACTIVE = "active"
    INVITED = "invited"
    SUSPENDED = "suspended"


class MembershipClientAccessMode(str, enum.Enum):
    """Access mode per role membership."""

    ALL = "all"
    SPECIFIC = "specific"


class MembershipPermissionEffect(str, enum.Enum):
    """Permission override effect."""

    GRANT = "grant"
    DENY = "deny"


class InvitationStatus(str, enum.Enum):
    """Invite lifecycle states."""

    PENDING = "pending"
    ACCEPTED = "accepted"
    REVOKED = "revoked"
    EXPIRED = "expired"


class Role(Base, UUIDMixin, TimestampMixin):
    """Authorization role, global or organization scoped."""

    __tablename__ = "roles"

    organization_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    organization: Mapped[Optional["Organization"]] = relationship(
        "Organization",
        back_populates="roles",
    )
    memberships: Mapped[List["Membership"]] = relationship(
        "Membership",
        back_populates="role",
        cascade="all, delete-orphan",
    )
    permissions: Mapped[List["RolePermission"]] = relationship(
        "RolePermission",
        back_populates="role",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_roles_org_name"),
    )


class RolePermission(Base, UUIDMixin):
    """Permission assignments for roles."""

    __tablename__ = "role_permissions"

    role_id: Mapped[UUID] = mapped_column(
        ForeignKey("roles.id", ondelete="CASCADE"),
        nullable=False,
    )
    permission_key: Mapped[str] = mapped_column(String(64), nullable=False)

    role: Mapped["Role"] = relationship(
        "Role",
        back_populates="permissions",
    )

    __table_args__ = (
        UniqueConstraint("role_id", "permission_key", name="uq_role_permissions"),
    )


class Membership(Base, UUIDMixin, TimestampMixin):
    """User membership in an organization with role and scope."""

    __tablename__ = "memberships"

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    role_id: Mapped[UUID] = mapped_column(
        ForeignKey("roles.id", ondelete="RESTRICT"),
        nullable=False,
    )
    status: Mapped[MembershipStatus] = mapped_column(
        SAEnum(MembershipStatus),
        default=MembershipStatus.INVITED,
        nullable=False,
    )
    client_access_mode: Mapped[MembershipClientAccessMode] = mapped_column(
        SAEnum(MembershipClientAccessMode),
        default=MembershipClientAccessMode.ALL,
        nullable=False,
    )

    invited_by_user_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    accepted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    invited_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )

    user: Mapped["User"] = relationship(
        "User",
        back_populates="memberships",
        foreign_keys=[user_id],
    )
    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="memberships",
    )
    role: Mapped["Role"] = relationship(
        "Role",
        back_populates="memberships",
    )
    invited_by: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[invited_by_user_id],
        back_populates="invited_memberships",
    )
    permission_overrides: Mapped[List["MembershipPermissionOverride"]] = relationship(
        "MembershipPermissionOverride",
        back_populates="membership",
        cascade="all, delete-orphan",
    )
    clients: Mapped[List["Client"]] = relationship(
        "Client",
        secondary="membership_clients",
        back_populates="memberships",
    )

    __table_args__ = (
        UniqueConstraint("user_id", "organization_id", name="uq_memberships_user_org"),
    )


class MembershipPermissionOverride(Base, UUIDMixin):
    """Per-membership permission override (grant/deny)."""

    __tablename__ = "membership_permission_overrides"

    membership_id: Mapped[UUID] = mapped_column(
        ForeignKey("memberships.id", ondelete="CASCADE"),
        nullable=False,
    )
    permission_key: Mapped[str] = mapped_column(String(64), nullable=False)
    effect: Mapped[MembershipPermissionEffect] = mapped_column(
        SAEnum(MembershipPermissionEffect),
        default=MembershipPermissionEffect.GRANT,
        nullable=False,
    )

    membership: Mapped["Membership"] = relationship(
        "Membership",
        back_populates="permission_overrides",
    )

    __table_args__ = (
        UniqueConstraint(
            "membership_id",
            "permission_key",
            name="uq_membership_permission_overrides",
        ),
    )


class MembershipClient(Base):
    """Scoped clients for memberships that are not "all"."""

    __tablename__ = "membership_clients"

    membership_id: Mapped[UUID] = mapped_column(
        ForeignKey("memberships.id", ondelete="CASCADE"),
        nullable=False,
        primary_key=True,
    )
    client_id: Mapped[UUID] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        primary_key=True,
    )


class Invitation(Base, UUIDMixin, TimestampMixin):
    """Pending invitations used by team administration flow."""

    __tablename__ = "invitations"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    role_id: Mapped[UUID] = mapped_column(
        ForeignKey("roles.id", ondelete="RESTRICT"),
        nullable=False,
    )
    token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    status: Mapped[InvitationStatus] = mapped_column(
        SAEnum(InvitationStatus),
        default=InvitationStatus.PENDING,
        nullable=False,
    )
    invited_by_user_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    accepted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="invitations",
    )
    role: Mapped["Role"] = relationship("Role")
    invited_by: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[invited_by_user_id],
    )

    __table_args__ = (
        Index(
            "uq_invitations_org_email_active",
            "organization_id",
            "email",
            unique=True,
            postgresql_where=text("status = 'PENDING'"),
            sqlite_where=text("status = 'PENDING'"),
        ),
    )
