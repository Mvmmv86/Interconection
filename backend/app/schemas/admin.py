"""Platform super-admin schemas."""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from app.models.organization import PlanType
from app.models.user import UserRole
from app.schemas.common import BaseSchema


class AdminOrganizationResponse(BaseSchema):
    """Organization row shown in platform administration."""

    id: UUID
    name: str
    slug: str
    plan: PlanType
    is_active: bool
    user_count: int = 0
    client_count: int = 0
    team_count: int = 0
    created_at: datetime
    updated_at: datetime


class AdminOrganizationUpdate(BaseSchema):
    """Mutable organization fields for platform operators."""

    plan: Optional[PlanType] = None
    is_active: Optional[bool] = None


class AdminOverviewResponse(BaseSchema):
    """Platform-level operational overview."""

    organization_count: int = 0
    active_organization_count: int = 0
    user_count: int = 0
    active_user_count: int = 0
    client_count: int = 0
    audit_event_count: int = 0
    bot_count: int = 0
    strategy_count: int = 0
    plan_count: int = 3


class AdminUserMembershipResponse(BaseSchema):
    """Membership summary for a user in the platform admin."""

    id: UUID
    organization_id: UUID
    organization_name: str
    role_name: str
    status: str
    client_access_mode: str
    team_count: int = 0
    team_names: list[str] = []


class AdminUserResponse(BaseSchema):
    """User row shown in platform administration."""

    id: UUID
    organization_id: Optional[UUID] = None
    email: str
    name: str
    role: UserRole
    is_active: bool
    is_superuser: bool
    token_version: int
    created_at: datetime
    updated_at: datetime
    last_login_at: Optional[datetime] = None
    memberships: list[AdminUserMembershipResponse] = []


class AdminUserUpdate(BaseSchema):
    """Mutable user fields for platform operators."""

    is_active: Optional[bool] = None
    is_superuser: Optional[bool] = None


class AdminClientResponse(BaseSchema):
    """Global client/carteira row shown in platform administration."""

    id: UUID
    organization_id: UUID
    organization_name: str
    name: str
    email: Optional[str] = None
    color: str
    wallet_count: int = 0
    active_wallet_count: int = 0
    exchange_count: int = 0
    active_exchange_count: int = 0
    sync_error_count: int = 0
    team_scope_count: int = 0
    membership_scope_count: int = 0
    last_wallet_scan_at: Optional[datetime] = None
    last_exchange_sync_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class AdminAuditLogResponse(BaseSchema):
    """Global audit log row for platform administration."""

    id: UUID
    organization_id: UUID
    organization_name: Optional[str] = None
    user_id: Optional[UUID] = None
    user_email: Optional[str] = None
    action: str
    resource_type: str
    resource_id: Optional[UUID] = None
    description: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    timestamp: datetime
