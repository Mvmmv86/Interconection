"""Notification Pydantic schemas."""

from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID

from app.schemas.common import BaseSchema


class NotificationResponse(BaseSchema):
    """Schema for notification response."""

    id: UUID
    organization_id: UUID
    alert_id: Optional[UUID] = None
    user_id: Optional[UUID] = None
    title: str
    message: str
    severity: str  # info, warning, danger, success
    notification_type: str  # alert, system, sync
    is_read: bool
    read_at: Optional[datetime] = None
    data: Optional[Dict[str, Any]] = None
    triggered_at: datetime


class NotificationCreate(BaseSchema):
    """Schema for creating a notification (internal use)."""

    alert_id: Optional[UUID] = None
    user_id: Optional[UUID] = None
    title: str
    message: str
    severity: str = "info"
    notification_type: str = "system"
    data: Optional[Dict[str, Any]] = None
