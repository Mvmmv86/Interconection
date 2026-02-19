"""User schemas."""

from datetime import datetime
from typing import Optional
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
    organization_id: UUID
    avatar_url: Optional[str] = None
    role: UserRole
    timezone: str
    currency: str
    is_active: bool
    email_verified: bool
    two_factor_enabled: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None


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
