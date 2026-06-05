"""Platform super-admin schemas."""

from datetime import datetime
from typing import Optional
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
