"""User endpoints."""

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, DBSession
from app.core.security import get_password_hash, verify_password
from app.schemas.user import (
    UserResponse,
    UserUpdate,
    UserPasswordUpdate,
)
from app.schemas.common import SuccessResponse

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: CurrentUser,
) -> UserResponse:
    """Get current user profile."""
    return UserResponse.model_validate(current_user)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    data: UserUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> UserResponse:
    """Update current user profile."""
    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(current_user, field, value)

    await db.flush()
    await db.refresh(current_user)

    return UserResponse.model_validate(current_user)


@router.put("/me/password", response_model=SuccessResponse)
async def update_password(
    data: UserPasswordUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> SuccessResponse:
    """Update current user password."""
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    current_user.password_hash = get_password_hash(data.new_password)
    await db.flush()

    return SuccessResponse(message="Password updated successfully")
