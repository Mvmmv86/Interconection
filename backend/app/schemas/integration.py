"""Integration schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import Field

from app.schemas.common import BaseSchema
from app.models.integration import IntegrationType, IntegrationStatus


class IntegrationBase(BaseSchema):
    """Base integration schema."""

    type: IntegrationType
    provider: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=100)
    config: Optional[dict] = None


class IntegrationCreate(IntegrationBase):
    """Schema for creating an integration."""

    is_enabled: bool = True


class IntegrationUpdate(BaseSchema):
    """Schema for updating an integration."""

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    config: Optional[dict] = None
    is_enabled: Optional[bool] = None


class IntegrationResponse(IntegrationBase):
    """Integration response schema."""

    id: UUID
    organization_id: UUID

    # Status
    status: IntegrationStatus
    is_enabled: bool

    # Sync tracking
    last_sync_at: Optional[datetime] = None
    last_sync_success: bool
    last_error: Optional[str] = None
    error_count: int
    consecutive_errors: int

    # Rate limiting
    requests_today: int
    rate_limit_reset_at: Optional[datetime] = None

    # Metrics
    total_syncs: int
    avg_sync_time_ms: int

    # Timestamps
    created_at: datetime
    updated_at: datetime


class IntegrationSyncRequest(BaseSchema):
    """Request to trigger a sync."""

    force: bool = False


class IntegrationSyncResponse(BaseSchema):
    """Response after triggering a sync."""

    integration_id: UUID
    sync_id: UUID
    status: str
    message: str


class SyncLogResponse(BaseSchema):
    """Sync log response schema."""

    id: UUID
    integration_id: UUID
    started_at: datetime
    completed_at: Optional[datetime] = None
    duration_ms: Optional[int] = None
    success: bool
    items_synced: int
    items_created: int
    items_updated: int
    items_deleted: int
    error_message: Optional[str] = None
    error_details: Optional[dict] = None


class IntegrationStatusSummary(BaseSchema):
    """Summary of integration statuses."""

    total_integrations: int
    active: int
    syncing: int
    error: int
    disabled: int
    rate_limited: int
    last_sync_at: Optional[datetime] = None
    total_syncs_today: int
    total_errors_today: int
