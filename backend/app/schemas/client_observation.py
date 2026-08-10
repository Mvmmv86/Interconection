"""Client observation schemas."""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import Field

from app.schemas.common import BaseSchema


class ClientObservationCreate(BaseSchema):
    """Payload for creating a manual observation row."""

    observed_at: date
    location: Optional[str] = Field(default=None, max_length=120)
    asset_type: Optional[str] = Field(default=None, max_length=50)
    asset_symbol: Optional[str] = Field(default=None, max_length=30)
    amount: Optional[Decimal] = Field(default=None, ge=Decimal("0"))
    value_usd: Optional[Decimal] = Field(default=None, ge=Decimal("0"))
    note: str = Field(min_length=1, max_length=5000)


class ClientObservationResponse(ClientObservationCreate):
    """Manual observation row returned by the API."""

    id: UUID
    organization_id: UUID
    client_id: UUID
    created_by_user_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
