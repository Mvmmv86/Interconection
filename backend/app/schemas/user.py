"""User schemas."""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import EmailStr, Field

from app.schemas.common import BaseSchema
from app.models.user import UserRole


class UserBase(BaseSchema):
    """Base user schema."""

    email: EmailStr
    name: str = Field(min_length=2, max_length=255)


class UserCreate(UserBase):
    """Schema for creating a user."""

    password: str = Field(min_length=8, max_length=100)
    organization_name: str = Field(min_length=2, max_length=255)


class UserUpdate(BaseSchema):
    """Schema for updating a user."""

    name: Optional[str] = Field(None, min_length=2, max_length=255)
    avatar_url: Optional[str] = None
    timezone: Optional[str] = None
    currency: Optional[str] = Field(None, min_length=3, max_length=3)


class UserPasswordUpdate(BaseSchema):
    """Schema for updating user password."""

    current_password: str
    new_password: str = Field(min_length=8, max_length=100)


class UserResponse(UserBase):
    """User response schema."""

    id: UUID
    organization_id: Optional[UUID] = None
    avatar_url: Optional[str] = None
    role: UserRole
    is_superuser: bool = False
    token_version: int = 0
    timezone: str
    currency: str
    is_active: bool
    email_verified: bool
    two_factor_enabled: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None


class UserMembershipOrganization(BaseSchema):
    """Organization summary for an account available to the current user."""

    id: UUID
    name: str
    slug: str


class UserMembershipResponse(BaseSchema):
    """Membership/account context used by the frontend account switcher."""

    id: UUID
    organization_id: UUID
    organization: UserMembershipOrganization
    role_id: UUID
    role_name: str
    status: str
    client_access_mode: str
    client_ids: List[UUID] = []
    permissions: List[str] = []


class UserLogin(BaseSchema):
    """User login schema."""

    email: EmailStr
    password: str


class TokenResponse(BaseSchema):
    """Token response schema."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class RefreshTokenRequest(BaseSchema):
    """Refresh token request schema."""

    refresh_token: str


class ForgotPasswordRequest(BaseSchema):
    """Forgot password request schema."""

    email: EmailStr


class ResetPasswordRequest(BaseSchema):
    """Reset password request schema."""

    token: str
    new_password: str = Field(min_length=8, max_length=100)
