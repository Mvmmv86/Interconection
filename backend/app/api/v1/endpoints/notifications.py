"""Notification endpoints."""

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, status, Query
from sqlalchemy import select, update, func

from app.api.deps import CurrentUser, DBSession
from app.models.defi_cache import NotificationHistory
from app.schemas.notification import NotificationResponse
from app.schemas.common import SuccessResponse

router = APIRouter()


@router.get("", response_model=List[NotificationResponse])
async def list_notifications(
    current_user: CurrentUser,
    db: DBSession,
    is_read: Optional[bool] = None,
    severity: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> List[NotificationResponse]:
    """List notifications for current organization."""
    query = select(NotificationHistory).where(
        NotificationHistory.organization_id == current_user.organization_id,
    )

    if is_read is not None:
        query = query.where(NotificationHistory.is_read == is_read)
    if severity:
        query = query.where(NotificationHistory.severity == severity)

    query = query.offset(skip).limit(limit).order_by(NotificationHistory.triggered_at.desc())

    result = await db.execute(query)
    notifications = result.scalars().all()

    return [NotificationResponse.model_validate(n) for n in notifications]


@router.get("/unread-count")
async def get_unread_count(
    current_user: CurrentUser,
    db: DBSession,
) -> dict:
    """Get count of unread notifications."""
    result = await db.execute(
        select(func.count(NotificationHistory.id)).where(
            NotificationHistory.organization_id == current_user.organization_id,
            NotificationHistory.is_read == False,
        )
    )
    count = result.scalar()

    return {"unread_count": count or 0}


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_as_read(
    notification_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> NotificationResponse:
    """Mark a notification as read."""
    result = await db.execute(
        select(NotificationHistory).where(
            NotificationHistory.id == notification_id,
            NotificationHistory.organization_id == current_user.organization_id,
        )
    )
    notification = result.scalar_one_or_none()

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    notification.is_read = True
    notification.read_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(notification)

    return NotificationResponse.model_validate(notification)


@router.post("/read-all", response_model=SuccessResponse)
async def mark_all_as_read(
    current_user: CurrentUser,
    db: DBSession,
) -> SuccessResponse:
    """Mark all notifications as read."""
    await db.execute(
        update(NotificationHistory)
        .where(
            NotificationHistory.organization_id == current_user.organization_id,
            NotificationHistory.is_read == False,
        )
        .values(is_read=True, read_at=datetime.now(timezone.utc))
    )
    await db.flush()

    return SuccessResponse(message="All notifications marked as read")


@router.delete("/{notification_id}", response_model=SuccessResponse)
async def delete_notification(
    notification_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> SuccessResponse:
    """Delete a notification."""
    result = await db.execute(
        select(NotificationHistory).where(
            NotificationHistory.id == notification_id,
            NotificationHistory.organization_id == current_user.organization_id,
        )
    )
    notification = result.scalar_one_or_none()

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    await db.delete(notification)
    await db.flush()

    return SuccessResponse(message="Notification deleted successfully")
