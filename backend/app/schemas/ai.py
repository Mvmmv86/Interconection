"""AI-related Pydantic schemas."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import Field

from app.schemas.common import BaseSchema


# --- AI Reports ---

class AIReportCreate(BaseSchema):
    """Schema for creating an AI report."""

    report_type: str = "risk_analysis"
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)
    summary: Optional[str] = None
    client_id: Optional[UUID] = None
    portfolio_context: Optional[Dict[str, Any]] = None
    risk_metrics: Optional[Dict[str, Any]] = None
    model_used: Optional[str] = None
    tokens_used: Optional[int] = None
    generation_time_ms: Optional[int] = None


class AIReportResponse(BaseSchema):
    """Schema for AI report response."""

    id: UUID
    organization_id: UUID
    client_id: Optional[UUID] = None
    user_id: UUID
    report_type: str
    title: str
    content: str
    summary: Optional[str] = None
    portfolio_context: Optional[Dict[str, Any]] = None
    risk_metrics: Optional[Dict[str, Any]] = None
    model_used: Optional[str] = None
    tokens_used: Optional[int] = None
    generation_time_ms: Optional[int] = None
    generated_at: datetime
    created_at: datetime


class AIReportListItem(BaseSchema):
    """Lightweight schema for report listing (without full content)."""

    id: UUID
    report_type: str
    title: str
    summary: Optional[str] = None
    model_used: Optional[str] = None
    generated_at: datetime
    created_at: datetime


# --- AI Settings ---

class AISettingsUpdate(BaseSchema):
    """Schema for updating AI settings."""

    provider: Optional[str] = None  # anthropic, openai
    api_key: Optional[str] = None  # Plain text key, will be encrypted
    use_platform_key: Optional[bool] = None


class AISettingsResponse(BaseSchema):
    """Schema for AI settings response."""

    id: UUID
    organization_id: UUID
    provider: str
    api_key_masked: Optional[str] = None
    is_configured: bool
    use_platform_key: bool
    total_requests: int
    total_tokens: int
    last_used_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
