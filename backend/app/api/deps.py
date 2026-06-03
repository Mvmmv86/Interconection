"""API Dependencies - authentication, database session, etc."""

from dataclasses import dataclass, field
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.security import verify_access_token
from app.db.session import get_db
from app.models.membership import (
    Membership,
    MembershipClientAccessMode,
    MembershipPermissionEffect,
    MembershipStatus,
    RolePermission,
)
from app.models.organization import Organization
from app.models.user import User

# Security scheme
security = HTTPBearer()


def _normalize_route_key(route_key: str | None) -> str | None:
    if route_key is None:
        return None
    return route_key.strip().lower()


@dataclass
class MembershipAuthContext:
    """Authorization context built from active membership."""

    user: User
    organization_id: UUID
    membership: Membership | None
    role_name: str | None
    permissions: set[str] = field(default_factory=set)
    client_access_mode: MembershipClientAccessMode | None = None
    scope_client_ids: set[UUID] = field(default_factory=set)
    is_legacy: bool = False

    def has_permission(self, permission_key: str) -> bool:
        if self.is_legacy or self.client_access_mode is None:
            return True

        normalized = permission_key.strip().lower()
        return "*" in self.permissions or normalized in self.permissions

    def can_access_client(self, client_id: UUID) -> bool:
        if self.is_legacy or self.client_access_mode == MembershipClientAccessMode.ALL:
            return True

        return client_id in self.scope_client_ids


def _collect_membership_permissions(
    role_permissions: list[str],
    overrides: dict[str, MembershipPermissionEffect] | None = None,
) -> set[str]:
    """Apply deny/grant overrides to role permissions."""

    permissions = {permission.strip().lower() for permission in role_permissions}
    if not overrides:
        return permissions

    for key, effect in overrides.items():
        normalized = key.strip().lower()
        if effect == MembershipPermissionEffect.DENY:
            permissions.discard(normalized)
        else:
            permissions.add(normalized)

    return permissions


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
        select(User).where(User.id == UUID(user_id), User.is_active.is_(True))
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


def require_membership(route_key: str | None = None):
    """Dependency factory that resolves membership context by tenant."""

    async def _membership_dependency(
        account_id_header: Annotated[str | None, Header(default=None, alias="X-Account-Id")],
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> MembershipAuthContext:
        normalized_route = _normalize_route_key(route_key)
        if not is_rbac_enforcement_enabled(normalized_route):
            organization_id = current_user.organization_id
            if organization_id is None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Missing organization context for RBAC rollout",
                )

            return MembershipAuthContext(
                user=current_user,
                organization_id=organization_id,
                membership=None,
                role_name=current_user.role.value,
                is_legacy=True,
            )

        if current_user.is_superuser:
            organization_id = current_user.organization_id
            if account_id_header:
                try:
                    organization_id = UUID(account_id_header)
                except ValueError as exc:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invalid X-Account-Id header",
                    ) from exc

            if organization_id is None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Missing organization context for RBAC rollout",
                )

            return MembershipAuthContext(
                user=current_user,
                organization_id=organization_id,
                membership=None,
                role_name="superuser",
                permissions={"*"},
                client_access_mode=MembershipClientAccessMode.ALL,
            )

        if account_id_header:
            try:
                organization_id = UUID(account_id_header)
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid X-Account-Id header",
                ) from exc
        else:
            if current_user.organization_id is None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Missing organization context for RBAC rollout",
                )
            organization_id = current_user.organization_id

        membership_result = await db.execute(
            select(Membership)
            .options(
                selectinload(Membership.role),
                selectinload(Membership.permission_overrides),
                selectinload(Membership.clients),
            )
            .where(
                and_(
                    Membership.user_id == current_user.id,
                    Membership.organization_id == organization_id,
                    Membership.status == MembershipStatus.ACTIVE,
                )
            )
        )
        membership = membership_result.scalar_one_or_none()

        if membership is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No active membership found for tenant",
            )

        role_permissions_result = await db.execute(
            select(RolePermission.permission_key).where(
                RolePermission.role_id == membership.role_id
            )
        )
        role_permissions = [row[0] for row in role_permissions_result.all()]

        overrides = {
            override.permission_key: override.effect
            for override in membership.permission_overrides
        }

        permissions = _collect_membership_permissions(role_permissions, overrides)
        scope_client_ids = (
            {client.id for client in membership.clients}
            if membership.client_access_mode == MembershipClientAccessMode.SPECIFIC
            else set()
        )

        return MembershipAuthContext(
            user=current_user,
            organization_id=organization_id,
            membership=membership,
            role_name=membership.role.name if membership.role is not None else None,
            permissions=permissions,
            client_access_mode=membership.client_access_mode,
            scope_client_ids=scope_client_ids,
        )

    return _membership_dependency


def require_permission(permission_key: str, *, route_key: str | None = None):
    """Dependency factory for explicit permission enforcement."""

    async def _permission_dependency(
        membership_ctx: Annotated[
            MembershipAuthContext, Depends(require_membership(route_key))
        ],
    ) -> MembershipAuthContext:
        normalized_route = _normalize_route_key(route_key)
        if not is_rbac_enforcement_enabled(normalized_route) or membership_ctx.is_legacy:
            return membership_ctx

        normalized = permission_key.strip().lower()
        if not membership_ctx.has_permission(normalized):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{normalized}' required",
            )

        return membership_ctx

    return _permission_dependency


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
CurrentMembership = Annotated[MembershipAuthContext, Depends(require_membership())]
AdminUser = Annotated[User, Depends(require_role(["admin"]))]
ManagerUser = Annotated[User, Depends(require_role(["admin", "manager"]))]
