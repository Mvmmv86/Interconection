"""API Dependencies - authentication, database session, etc."""

from dataclasses import dataclass, field
import time
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import and_, false, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.security import verify_access_token_payload
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

_AUTHZ_CACHE_TTL_SECONDS = 30
_AUTHZ_CACHE: dict[tuple[UUID, UUID], tuple[float, dict]] = {}


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


def invalidate_authz_cache(
    *,
    user_id: UUID | None = None,
    organization_id: UUID | None = None,
) -> None:
    """Invalidate in-memory authorization cache entries.

    The cache is deliberately process-local and short-lived. It is a
    fast-path, never the source of truth. Mutations that can change access
    call this helper explicitly; token_version still provides hard session
    revocation across processes.
    """
    if user_id is None and organization_id is None:
        _AUTHZ_CACHE.clear()
        return

    for key in list(_AUTHZ_CACHE):
        cached_user_id, cached_organization_id = key
        if user_id is not None and cached_user_id != user_id:
            continue
        if organization_id is not None and cached_organization_id != organization_id:
            continue
        _AUTHZ_CACHE.pop(key, None)


def _cache_membership_context(context: MembershipAuthContext) -> None:
    if context.is_legacy or context.client_access_mode is None:
        return

    _AUTHZ_CACHE[(context.user.id, context.organization_id)] = (
        time.monotonic() + _AUTHZ_CACHE_TTL_SECONDS,
        {
            "role_name": context.role_name,
            "permissions": set(context.permissions),
            "client_access_mode": context.client_access_mode,
            "scope_client_ids": set(context.scope_client_ids),
        },
    )


def _get_cached_membership_context(
    user: User,
    organization_id: UUID,
) -> MembershipAuthContext | None:
    cached = _AUTHZ_CACHE.get((user.id, organization_id))
    if cached is None:
        return None

    expires_at, payload = cached
    if expires_at <= time.monotonic():
        _AUTHZ_CACHE.pop((user.id, organization_id), None)
        return None

    return MembershipAuthContext(
        user=user,
        organization_id=organization_id,
        membership=None,
        role_name=payload["role_name"],
        permissions=set(payload["permissions"]),
        client_access_mode=payload["client_access_mode"],
        scope_client_ids=set(payload["scope_client_ids"]),
    )


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
    payload = verify_access_token_payload(token)

    if payload is None or payload.get("sub") is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = UUID(str(payload["sub"]))
        token_version = int(payload.get("token_version", 0))
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    result = await db.execute(
        select(User).where(User.id == user_id, User.is_active.is_(True))
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if int(user.token_version or 0) != token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session revoked",
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


def require_membership(route_key: str | None = None, *, force: bool = False):
    """Dependency factory that resolves membership context by tenant."""

    async def _membership_dependency(
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)],
        account_id_header: Annotated[str | None, Header(alias="X-Account-Id")] = None,
    ) -> MembershipAuthContext:
        normalized_route = _normalize_route_key(route_key)
        if not force and not is_rbac_enforcement_enabled(normalized_route):
            organization_id = current_user.organization_id
            if organization_id is None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Missing organization context for RBAC rollout",
                )
            org_result = await db.execute(
                select(Organization).where(Organization.id == organization_id)
            )
            org = org_result.scalar_one_or_none()
            if org is not None and hasattr(org, "is_active") and not org.is_active:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Organization is suspended",
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
            org_result = await db.execute(
                select(Organization).where(Organization.id == organization_id)
            )
            org = org_result.scalar_one_or_none()
            if org is not None and hasattr(org, "is_active") and not org.is_active:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Organization is suspended",
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

        org_result = await db.execute(
            select(Organization).where(Organization.id == organization_id)
        )
        org = org_result.scalar_one_or_none()
        if org is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found",
            )
        if hasattr(org, "is_active") and not org.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Organization is suspended",
            )

        cached_context = _get_cached_membership_context(current_user, organization_id)
        if cached_context is not None:
            return cached_context

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

        context = MembershipAuthContext(
            user=current_user,
            organization_id=organization_id,
            membership=membership,
            role_name=membership.role.name if membership.role is not None else None,
            permissions=permissions,
            client_access_mode=membership.client_access_mode,
            scope_client_ids=scope_client_ids,
        )
        _cache_membership_context(context)
        return context

    return _membership_dependency


def require_permission(
    permission_key: str,
    *,
    route_key: str | None = None,
    force: bool = False,
):
    """Dependency factory for explicit permission enforcement."""

    async def _permission_dependency(
        membership_ctx: Annotated[
            MembershipAuthContext, Depends(require_membership(route_key, force=force))
        ],
    ) -> MembershipAuthContext:
        normalized_route = _normalize_route_key(route_key)
        if (
            not force
            and (not is_rbac_enforcement_enabled(normalized_route) or membership_ctx.is_legacy)
        ):
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


async def require_superuser(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Require platform superuser privileges."""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform superuser privileges required",
        )
    return current_user


def ensure_client_scope(
    membership_ctx: MembershipAuthContext,
    client_id: UUID,
    route_key: str,
) -> None:
    """Raise 403 when client-specific scope blocks the requested client."""
    if not is_scope_specific_enforcement_enabled(route_key):
        return
    if membership_ctx.client_access_mode is None:
        return
    if not membership_ctx.can_access_client(client_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden by membership client scope",
        )


def apply_client_scope_filter(
    membership_ctx: MembershipAuthContext,
    query,
    client_column,
    route_key: str,
    client_id: UUID | None = None,
):
    """Apply membership client scope to a SQLAlchemy query."""
    if not is_scope_specific_enforcement_enabled(route_key):
        if client_id is not None:
            return query.where(client_column == client_id)
        return query

    if membership_ctx.client_access_mode is None:
        if client_id is not None:
            return query.where(client_column == client_id)
        return query

    if client_id is not None:
        ensure_client_scope(membership_ctx, client_id, route_key)
        return query.where(client_column == client_id)

    if membership_ctx.client_access_mode == MembershipClientAccessMode.ALL:
        return query

    if not membership_ctx.scope_client_ids:
        return query.where(false())

    return query.where(client_column.in_(list(membership_ctx.scope_client_ids)))


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
        _ = (route_key, require_scope_check)
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
SuperUser = Annotated[User, Depends(require_superuser)]
