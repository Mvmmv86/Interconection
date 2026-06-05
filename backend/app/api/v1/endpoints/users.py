"""User endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import (
    DBSession,
    MembershipAuthContext,
    get_current_user,
    require_permission,
    rbac_route_guard,
)
from app.core.security import get_password_hash, verify_password
from app.models.membership import (
    Membership,
    MembershipPermissionEffect,
    MembershipStatus,
    Role,
)
from app.models.user import User
from app.schemas.user import (
    UserMembershipOrganization,
    UserMembershipResponse,
    UserResponse,
    UserUpdate,
    UserPasswordUpdate,
)
from app.schemas.common import SuccessResponse

router = APIRouter(dependencies=[Depends(rbac_route_guard("settings"))])


def _resolve_membership_permissions(membership: Membership) -> list[str]:
    permissions = {
        permission.permission_key
        for permission in (membership.role.permissions if membership.role else [])
    }
    for override in membership.permission_overrides:
        if override.effect == MembershipPermissionEffect.DENY:
            permissions.discard(override.permission_key)
        elif override.effect == MembershipPermissionEffect.GRANT:
            permissions.add(override.permission_key)
    return sorted(permissions)


@router.get("/me/memberships", response_model=list[UserMembershipResponse])
async def list_my_memberships(
    current_user: Annotated[User, Depends(get_current_user)],
    db: DBSession,
) -> list[UserMembershipResponse]:
    """List active account memberships available to the current user."""
    result = await db.execute(
        select(Membership)
        .options(
            selectinload(Membership.organization),
            selectinload(Membership.role),
            selectinload(Membership.role).selectinload(Role.permissions),
            selectinload(Membership.permission_overrides),
            selectinload(Membership.clients),
        )
        .where(
            Membership.user_id == current_user.id,
            Membership.status == MembershipStatus.ACTIVE,
        )
        .order_by(Membership.created_at.asc())
    )
    memberships = result.scalars().all()
    return [
        UserMembershipResponse(
            id=membership.id,
            organization_id=membership.organization_id,
            organization=UserMembershipOrganization(
                id=membership.organization.id,
                name=membership.organization.name,
                slug=membership.organization.slug,
            ),
            role_id=membership.role_id,
            role_name=membership.role.name if membership.role else "",
            status=membership.status.value,
            client_access_mode=membership.client_access_mode.value,
            client_ids=[client.id for client in membership.clients],
            permissions=_resolve_membership_permissions(membership),
        )
        for membership in memberships
    ]


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserResponse:
    """Get current user profile."""
    return UserResponse.model_validate(current_user)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    data: UserUpdate,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("dashboard:view", route_key="settings")),
    ],
    db: DBSession,
) -> UserResponse:
    """Update current user profile."""
    update_data = data.model_dump(exclude_unset=True)
    current_user = permission_ctx.user

    for field, value in update_data.items():
        setattr(current_user, field, value)

    await db.flush()
    await db.refresh(current_user)

    return UserResponse.model_validate(current_user)


@router.put("/me/password", response_model=SuccessResponse)
async def update_password(
    data: UserPasswordUpdate,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("dashboard:view", route_key="settings")),
    ],
    db: DBSession,
) -> SuccessResponse:
    """Update current user password."""
    current_user = permission_ctx.user
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    current_user.password_hash = get_password_hash(data.new_password)
    await db.flush()

    return SuccessResponse(message="Password updated successfully")
