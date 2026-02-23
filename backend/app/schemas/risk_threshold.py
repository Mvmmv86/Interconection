"""Risk threshold Pydantic schemas."""

from typing import Optional
from uuid import UUID

from app.schemas.common import BaseSchema


class RiskThresholdUpdate(BaseSchema):
    """Schema for updating risk thresholds."""

    var95_warning: Optional[float] = None
    var95_danger: Optional[float] = None
    cvar95_warning: Optional[float] = None
    cvar95_danger: Optional[float] = None
    max_drawdown_warning: Optional[float] = None
    max_drawdown_danger: Optional[float] = None
    volatility_warning: Optional[float] = None
    volatility_danger: Optional[float] = None
    sharpe_warning: Optional[float] = None
    sharpe_danger: Optional[float] = None
    leverage_warning: Optional[float] = None
    leverage_danger: Optional[float] = None
    concentration_warning: Optional[float] = None
    concentration_danger: Optional[float] = None


class RiskThresholdResponse(BaseSchema):
    """Schema for risk threshold response."""

    id: UUID
    organization_id: UUID
    var95_warning: Optional[float] = 5.0
    var95_danger: Optional[float] = 10.0
    cvar95_warning: Optional[float] = 8.0
    cvar95_danger: Optional[float] = 15.0
    max_drawdown_warning: Optional[float] = 15.0
    max_drawdown_danger: Optional[float] = 30.0
    volatility_warning: Optional[float] = 60.0
    volatility_danger: Optional[float] = 100.0
    sharpe_warning: Optional[float] = 0.5
    sharpe_danger: Optional[float] = 0.0
    leverage_warning: Optional[float] = 2.0
    leverage_danger: Optional[float] = 5.0
    concentration_warning: Optional[float] = 40.0
    concentration_danger: Optional[float] = 60.0
