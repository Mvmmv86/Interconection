"""API Dependencies - authentication, database session, etc."""

from typing import Annotated, Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import verify_access_token
from app.db.session import get_db
from app.models.user import User
from app.models.organization import Organization

# Security scheme
security = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Get current authenticated user from JWT token."""
    token = credentials.credentials
    user_id = verify_access_token(token)

    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    result = await db.execute(
        select(User).where(User.id == UUID(user_id), User.is_active == True)
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Get current active user."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user",
        )
    return current_user


async def get_current_organization(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Organization:
    """Get organization of current user."""
    result = await db.execute(
        select(Organization).where(Organization.id == current_user.organization_id)
    )
    org = result.scalar_one_or_none()

    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    return org


def require_role(allowed_roles: list[str]):
    """Dependency factory for role-based access control."""

    async def role_checker(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if current_user.role.value not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role.value}' not allowed. Required: {allowed_roles}",
            )
        return current_user

    return role_checker


def is_rbac_enforcement_enabled(route_key: str | None = None) -> bool:
    """Check if RBAC enforcement v1 is enabled globally and for a route key.

    When no route key is provided, this checks only the global switch.
    When keys are configured via RBAC_ENFORCEMENT_V1_ENDPOINTS, only those
    keys are allowed to run under v1 enforcement.
    """
    if not settings.rbac_enforcement_v1:
        return False

    if route_key is None:
        return True

    normalized = route_key.strip().lower()
    allowed = settings.rbac_enforcement_v1_routes
    return not allowed or normalized in allowed


def is_scope_specific_enforcement_enabled(route_key: str | None = None) -> bool:
    """Check if RBAC scope-specific enforcement is enabled for a route."""
    if not settings.rbac_scope_specific:
        return False

    if route_key is None:
        return True

    normalized = route_key.strip().lower()
    allowed = settings.rbac_scope_specific_routes
    return not allowed or normalized in allowed


def rbac_route_guard(route_key: str, *, require_scope_check: bool = False):
    """Return a no-op dependency that marks a route as RBAC rollout controlled.

    This keeps endpoint signatures stable while enabling rollout-safe toggles:
    - when `RBAC_ENFORCEMENT_V1` is OFF, behavior is fully legacy.
    - when ON, route is marked as enforced and can be switched to strict checks.
    """

    async def _guard(
        current_user: User = Depends(get_current_user),
    ) -> User:
        if not is_rbac_enforcement_enabled(route_key):
            return current_user

        # Future: replace with require_membership/permission checks.
        if require_scope_check and not is_scope_specific_enforcement_enabled(route_key):
            return current_user

        if not current_user.organization_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Missing organization context for RBAC rollout",
            )

        return current_user

    return _guard


# Type aliases for cleaner endpoint signatures
CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentActiveUser = Annotated[User, Depends(get_current_active_user)]
CurrentOrganization = Annotated[Organization, Depends(get_current_organization)]
DBSession = Annotated[AsyncSession, Depends(get_db)]
AdminUser = Annotated[User, Depends(require_role(["admin"]))]
ManagerUser = Annotated[User, Depends(require_role(["admin", "manager"]))]
