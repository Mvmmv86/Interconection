"""Team administration schemas."""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import EmailStr, Field

from app.models.membership import (
    InvitationStatus,
    MembershipClientAccessMode,
    MembershipStatus,
    TeamStatus,
)
from app.schemas.common import BaseSchema


class TeamUserSummary(BaseSchema):
    """Minimal user data shown in team administration."""

    id: UUID
    email: EmailStr
    name: str
    avatar_url: Optional[str] = None
    is_active: bool


class TeamRoleResponse(BaseSchema):
    """Role available to assign inside a tenant."""

    id: UUID
    name: str
    is_system: bool
    description: Optional[str] = None
    permissions: List[str] = []


class TeamMemberResponse(BaseSchema):
    """Team member with role and client scope."""

    id: UUID
    user_id: UUID
    organization_id: UUID
    role_id: UUID
    role_name: str
    status: MembershipStatus
    client_access_mode: MembershipClientAccessMode
    client_ids: List[UUID] = []
    invited_by_user_id: Optional[UUID] = None
    accepted_at: Optional[datetime] = None
    invited_at: datetime
    created_at: datetime
    updated_at: datetime
    user: TeamUserSummary


class TeamInvitationCreate(BaseSchema):
    """Create an invitation for an email address."""

    email: EmailStr
    role_id: UUID
    team_id: Optional[UUID] = None
    notes: Optional[str] = Field(default=None, max_length=2000)
    expires_in_days: int = Field(default=7, ge=1, le=30)


class TeamInvitationResponse(BaseSchema):
    """Invitation response. Token is returned so email delivery can be added later."""

    id: UUID
    organization_id: UUID
    email: EmailStr
    role_id: UUID
    role_name: str
    team_id: Optional[UUID] = None
    team_name: Optional[str] = None
    token: str
    status: InvitationStatus
    expires_at: datetime
    invited_by_user_id: Optional[UUID] = None
    accepted_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class TeamInvitationAccept(BaseSchema):
    """Accept an invitation. New users must provide name and password."""

    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    password: Optional[str] = Field(default=None, min_length=8, max_length=100)


class TeamInvitationAcceptResponse(BaseSchema):
    """Result of accepting an invitation."""

    user_id: UUID
    membership_id: UUID
    organization_id: UUID
    status: MembershipStatus
    created_user: bool
    requires_login: bool = True


class TeamMemberUpdate(BaseSchema):
    """Update a member role or status."""

    role_id: Optional[UUID] = None
    status: Optional[MembershipStatus] = None


class TeamMemberScopeUpdate(BaseSchema):
    """Update client scope for a member."""

    client_access_mode: MembershipClientAccessMode
    client_ids: List[UUID] = []


class AccountTeamCreate(BaseSchema):
    """Create a named team inside the active account."""

    name: str = Field(min_length=2, max_length=120)
    description: Optional[str] = Field(default=None, max_length=2000)
    color: str = Field(default="#3b82f6", pattern=r"^#[0-9A-Fa-f]{6}$")
    role_id: Optional[UUID] = None
    client_access_mode: MembershipClientAccessMode = MembershipClientAccessMode.ALL
    client_ids: List[UUID] = []


class AccountTeamUpdate(BaseSchema):
    """Update mutable fields for a named account team."""

    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    description: Optional[str] = Field(default=None, max_length=2000)
    color: Optional[str] = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    status: Optional[TeamStatus] = None
    role_id: Optional[UUID] = None
    client_access_mode: Optional[MembershipClientAccessMode] = None
    client_ids: Optional[List[UUID]] = None


class AccountTeamMemberCreate(BaseSchema):
    """Add a membership to a named team."""

    membership_id: UUID


class AccountTeamResponse(BaseSchema):
    """Named team with access policy summary."""

    id: UUID
    organization_id: UUID
    name: str
    slug: str
    description: Optional[str] = None
    color: str
    status: TeamStatus
    role_id: Optional[UUID] = None
    role_name: Optional[str] = None
    client_access_mode: MembershipClientAccessMode
    client_ids: List[UUID] = []
    member_count: int = 0
    created_by_user_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
