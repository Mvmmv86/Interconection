"""Authentication endpoints."""

from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DBSession, CurrentUser, invalidate_authz_cache
from app.core.security import (
    create_access_token,
    create_refresh_token,
    get_password_hash,
    verify_password,
    verify_refresh_token_payload,
)
from app.core.config import settings
from app.models.audit_log import AuditAction
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
from app.services.audit_service import record_audit_event

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    data: UserCreate,
    db: DBSession,
    request: Request,
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
    await record_audit_event(
        db,
        organization_id=organization.id,
        user_id=user.id,
        action=AuditAction.CREATE,
        resource_type="organization",
        resource_id=organization.id,
        description="Organization registered",
        metadata={"email": user.email, "organization_name": organization.name},
        request=request,
    )

    # Generate tokens
    token_data = {"token_version": int(user.token_version or 0)}
    access_token = create_access_token(subject=user.id, extra_data=token_data)
    refresh_token = create_refresh_token(subject=user.id, extra_data=token_data)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    data: UserLogin,
    db: DBSession,
    request: Request,
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
    await record_audit_event(
        db,
        organization_id=user.organization_id,
        user_id=user.id,
        action=AuditAction.LOGIN,
        resource_type="auth",
        resource_id=user.id,
        description="User logged in",
        metadata={"email": user.email},
        request=request,
    )
    await db.flush()

    # Generate tokens
    token_data = {"token_version": int(user.token_version or 0)}
    access_token = create_access_token(subject=user.id, extra_data=token_data)
    refresh_token = create_refresh_token(subject=user.id, extra_data=token_data)

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
    payload = verify_refresh_token_payload(data.refresh_token)

    if payload is None or payload.get("sub") is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    try:
        user_id = UUID(str(payload["sub"]))
        token_version = int(payload.get("token_version", 0))
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        ) from exc

    result = await db.execute(
        select(User).where(User.id == user_id, User.is_active == True)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if int(user.token_version or 0) != token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session revoked",
        )

    # Generate new tokens
    token_data = {"token_version": int(user.token_version or 0)}
    access_token = create_access_token(subject=user.id, extra_data=token_data)
    new_refresh_token = create_refresh_token(subject=user.id, extra_data=token_data)

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/logout", response_model=SuccessResponse)
async def logout(
    current_user: CurrentUser,
    db: DBSession,
    request: Request,
) -> SuccessResponse:
    """Logout and revoke the current token version."""
    current_user.token_version = int(current_user.token_version or 0) + 1
    invalidate_authz_cache(user_id=current_user.id)
    await record_audit_event(
        db,
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        action=AuditAction.LOGOUT,
        resource_type="auth",
        resource_id=current_user.id,
        description="User logged out and session token version was revoked",
        metadata={"token_version": current_user.token_version},
        request=request,
    )
    await db.flush()
    return SuccessResponse(message="Successfully logged out")


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: CurrentUser,
) -> UserResponse:
    """Get current user information."""
    return UserResponse.model_validate(current_user)
