"""User endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import (
    DBSession,
    MembershipAuthContext,
    require_permission,
    rbac_route_guard,
)
from app.core.security import get_password_hash, verify_password
from app.schemas.user import (
    UserResponse,
    UserUpdate,
    UserPasswordUpdate,
)
from app.schemas.common import SuccessResponse

router = APIRouter(dependencies=[Depends(rbac_route_guard("settings"))])


@router.get("/me", response_model=UserResponse)
async def get_me(
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("dashboard:view", route_key="settings")),
    ],
) -> UserResponse:
    """Get current user profile."""
    return UserResponse.model_validate(permission_ctx.user)


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
