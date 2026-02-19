"""Authentication endpoints."""

from datetime import datetime, timezone
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DBSession, CurrentUser
from app.core.security import (
    create_access_token,
    create_refresh_token,
    get_password_hash,
    verify_password,
    verify_refresh_token,
)
from app.core.config import settings
from app.models.user import User
from app.models.organization import Organization
from app.schemas.user import (
    UserCreate,
    UserLogin,
    UserResponse,
    TokenResponse,
    RefreshTokenRequest,
)
from app.schemas.common import SuccessResponse

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    data: UserCreate,
    db: DBSession,
) -> TokenResponse:
    """Register a new user and organization."""
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Create organization
    org_slug = data.organization_name.lower().replace(" ", "-")
    # Ensure unique slug
    base_slug = org_slug
    counter = 1
    while True:
        result = await db.execute(select(Organization).where(Organization.slug == org_slug))
        if not result.scalar_one_or_none():
            break
        org_slug = f"{base_slug}-{counter}"
        counter += 1

    organization = Organization(
        id=uuid4(),
        name=data.organization_name,
        slug=org_slug,
    )
    db.add(organization)

    # Create user
    user = User(
        id=uuid4(),
        organization_id=organization.id,
        email=data.email,
        password_hash=get_password_hash(data.password),
        name=data.name,
        role="admin",  # First user is admin
    )
    db.add(user)
    await db.flush()

    # Generate tokens
    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    data: UserLogin,
    db: DBSession,
) -> TokenResponse:
    """Login and get access token."""
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )

    # Update last login
    user.last_login_at = datetime.now(timezone.utc)
    await db.flush()

    # Generate tokens
    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    data: RefreshTokenRequest,
    db: DBSession,
) -> TokenResponse:
    """Refresh access token."""
    user_id = verify_refresh_token(data.refresh_token)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    result = await db.execute(
        select(User).where(User.id == user_id, User.is_active == True)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # Generate new tokens
    access_token = create_access_token(subject=user.id)
    new_refresh_token = create_refresh_token(subject=user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/logout", response_model=SuccessResponse)
async def logout(
    current_user: CurrentUser,
) -> SuccessResponse:
    """Logout (client should discard tokens)."""
    # In a more complete implementation, you would:
    # - Add the token to a blacklist
    # - Invalidate refresh tokens in database
    return SuccessResponse(message="Successfully logged out")


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: CurrentUser,
) -> UserResponse:
    """Get current user information."""
    return UserResponse.model_validate(current_user)
