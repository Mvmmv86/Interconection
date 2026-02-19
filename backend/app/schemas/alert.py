"""Alert schemas."""

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import Field

from app.schemas.common import BaseSchema
from app.models.alert import AlertType


class AlertCondition(BaseSchema):
    """Alert condition schema."""

    operator: str = Field(..., pattern=r"^(gt|gte|lt|lte|eq)$")  # greater than, less than, etc
    threshold: Decimal
    asset_id: Optional[UUID] = None
    asset_symbol: Optional[str] = None
    period: Optional[str] = None  # 1h, 24h, 7d
    client_id: Optional[UUID] = None


class AlertChannels(BaseSchema):
    """Alert notification channels."""

    in_app: bool = True
    email: bool = False
    webhook: Optional[str] = None


class AlertBase(BaseSchema):
    """Base alert schema."""

    name: str = Field(min_length=1, max_length=100)
    type: AlertType
    condition: AlertCondition
    channels: AlertChannels = Field(default_factory=AlertChannels)
    is_recurring: bool = False
    cooldown_minutes: int = Field(default=60, ge=1, le=10080)  # max 1 week


class AlertCreate(AlertBase):
    """Schema for creating an alert."""

    pass


class AlertUpdate(BaseSchema):
    """Schema for updating an alert."""

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    condition: Optional[AlertCondition] = None
    channels: Optional[AlertChannels] = None
    is_active: Optional[bool] = None
    is_recurring: Optional[bool] = None
    cooldown_minutes: Optional[int] = Field(None, ge=1, le=10080)


class AlertResponse(AlertBase):
    """Alert response schema."""

    id: UUID
    organization_id: UUID
    user_id: UUID
    is_active: bool
    triggered_count: int
    last_triggered_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class AlertTriggeredEvent(BaseSchema):
    """Alert triggered event."""

    alert_id: UUID
    alert_name: str
    alert_type: AlertType
    trigger_value: Decimal
    threshold: Decimal
    message: str
    triggered_at: datetime


class AlertHistory(BaseSchema):
    """Alert history entry."""

    id: UUID
    alert_id: UUID
    alert_name: str
    alert_type: AlertType
    trigger_value: Decimal
    threshold: Decimal
    triggered_at: datetime
    notified_channels: List[str]


class AlertTestResult(BaseSchema):
    """Result of alert test."""

    alert_id: UUID
    would_trigger: bool
    current_value: Decimal
    threshold: Decimal
    condition_met: bool
    message: str
