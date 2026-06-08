"""Platform super-admin schemas."""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import EmailStr

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


class AdminUserResponse(BaseSchema):
    """User row shown in platform administration."""

    id: UUID
    organization_id: Optional[UUID] = None
    email: EmailStr
    name: str
    role: UserRole
    is_active: bool
    is_superuser: bool
    token_version: int
    created_at: datetime
    updated_at: datetime
    last_login_at: Optional[datetime] = None


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
    email: Optional[EmailStr] = None
    color: str
    wallet_count: int = 0
    exchange_count: int = 0
    created_at: datetime
    updated_at: datetime


class AdminAuditLogResponse(BaseSchema):
    """Global audit log row for platform administration."""

    id: UUID
    organization_id: UUID
    organization_name: Optional[str] = None
    user_id: Optional[UUID] = None
    user_email: Optional[EmailStr] = None
    action: str
    resource_type: str
    resource_id: Optional[UUID] = None
    description: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    timestamp: datetime
