"""Bot catalog and activation schemas."""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import Field

from app.models.bot import (
    BotInstanceMode,
    BotInstanceStatus,
    BotStrategyStatus,
    BotTemplateStatus,
    BotTemplateType,
)
from app.models.organization import PlanType
from app.schemas.common import BaseSchema


class BotTemplateParameterBase(BaseSchema):
    """Configurable parameter definition for a bot template."""

    key: str = Field(min_length=1, max_length=80)
    label: str = Field(min_length=1, max_length=160)
    type: str = Field(default="string", max_length=40)
    required: bool = False
    default_value: Optional[Any] = None
    min_value: Optional[str] = Field(default=None, max_length=80)
    max_value: Optional[str] = Field(default=None, max_length=80)
    options: Optional[list[Any]] = None
    help_text: Optional[str] = None


class BotTemplateParameterCreate(BotTemplateParameterBase):
    """Create a bot template parameter."""


class BotTemplateParameterUpdate(BaseSchema):
    """Patch a bot template parameter."""

    label: Optional[str] = Field(default=None, min_length=1, max_length=160)
    type: Optional[str] = Field(default=None, max_length=40)
    required: Optional[bool] = None
    default_value: Optional[Any] = None
    min_value: Optional[str] = Field(default=None, max_length=80)
    max_value: Optional[str] = Field(default=None, max_length=80)
    options: Optional[list[Any]] = None
    help_text: Optional[str] = None


class BotTemplateParameterResponse(BotTemplateParameterBase):
    """Parameter definition returned by the API."""

    id: UUID
    template_id: UUID
    created_at: datetime
    updated_at: datetime


class AdminBotTemplateCreate(BaseSchema):
    """Create a platform bot product."""

    name: str = Field(min_length=1, max_length=160)
    slug: str = Field(min_length=1, max_length=120)
    description: Optional[str] = None
    type: BotTemplateType = BotTemplateType.CUSTOM
    status: BotTemplateStatus = BotTemplateStatus.DRAFT
    required_plan: PlanType = PlanType.PRO
    requires_trade_permission: bool = False
    strategy_id: Optional[UUID] = None
    supported_exchanges: list[str] = Field(default_factory=list)
    supported_assets: list[str] = Field(default_factory=list)
    default_parameters: dict[str, Any] = Field(default_factory=dict)
    risk_notes: Optional[str] = None
    parameters: list[BotTemplateParameterCreate] = Field(default_factory=list)


class AdminBotTemplateUpdate(BaseSchema):
    """Patch a platform bot product."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=160)
    slug: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = None
    type: Optional[BotTemplateType] = None
    status: Optional[BotTemplateStatus] = None
    required_plan: Optional[PlanType] = None
    requires_trade_permission: Optional[bool] = None
    strategy_id: Optional[UUID] = None
    supported_exchanges: Optional[list[str]] = None
    supported_assets: Optional[list[str]] = None
    default_parameters: Optional[dict[str, Any]] = None
    risk_notes: Optional[str] = None
    parameters: Optional[list[BotTemplateParameterCreate]] = None


class BotTemplateResponse(BaseSchema):
    """Bot product visible to admin and eligible customers."""

    id: UUID
    name: str
    slug: str
    description: Optional[str] = None
    type: str
    status: str
    required_plan: str
    requires_trade_permission: bool
    supported_exchanges: list[str]
    supported_assets: list[str]
    default_parameters: dict[str, Any]
    risk_notes: Optional[str] = None
    strategy_id: Optional[UUID] = None
    strategy_name: Optional[str] = None
    parameter_count: int = 0
    active_instance_count: int = 0
    total_instance_count: int = 0
    parameters: list[BotTemplateParameterResponse] = Field(default_factory=list)
    created_by_user_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


class BotInstanceCreate(BaseSchema):
    """Activate a bot template inside a tenant account."""

    template_id: UUID
    client_id: UUID
    exchange_id: Optional[UUID] = None
    strategy_id: Optional[UUID] = None
    name: Optional[str] = Field(default=None, max_length=160)
    mode: BotInstanceMode = BotInstanceMode.PAPER
    parameters: dict[str, Any] = Field(default_factory=dict)
    risk_config: dict[str, Any] = Field(default_factory=dict)


class BotInstanceUpdate(BaseSchema):
    """Patch a customer bot instance."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=160)
    client_id: Optional[UUID] = None
    exchange_id: Optional[UUID] = None
    strategy_id: Optional[UUID] = None
    mode: Optional[BotInstanceMode] = None
    status: Optional[BotInstanceStatus] = None
    parameters: Optional[dict[str, Any]] = None
    risk_config: Optional[dict[str, Any]] = None


class AdminBotInstanceUpdate(BaseSchema):
    """Platform-level operational override for a bot instance."""

    status: Optional[BotInstanceStatus] = None
    last_error: Optional[str] = None


class BotInstanceResponse(BaseSchema):
    """Customer bot instance row."""

    id: UUID
    template_id: Optional[UUID] = None
    template_name: Optional[str] = None
    template_type: Optional[str] = None
    organization_id: UUID
    organization_name: Optional[str] = None
    client_id: UUID
    client_name: str
    exchange_id: Optional[UUID] = None
    exchange_name: Optional[str] = None
    strategy_id: Optional[UUID] = None
    strategy_name: Optional[str] = None
    name: str
    mode: str
    status: str
    live_enabled: bool
    parameters: dict[str, Any]
    risk_config: dict[str, Any]
    last_error: Optional[str] = None
    last_heartbeat_at: Optional[datetime] = None
    last_run_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    paused_at: Optional[datetime] = None
    disabled_at: Optional[datetime] = None
    created_by_user_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


class BotStrategyCreate(BaseSchema):
    """Create a reusable platform strategy."""

    name: str = Field(min_length=1, max_length=160)
    slug: str = Field(min_length=1, max_length=120)
    description: Optional[str] = None
    type: BotTemplateType = BotTemplateType.CUSTOM
    status: BotStrategyStatus = BotStrategyStatus.DRAFT
    indicator_config: dict[str, Any] = Field(default_factory=dict)
    rule_config: dict[str, Any] = Field(default_factory=dict)
    risk_defaults: dict[str, Any] = Field(default_factory=dict)


class BotStrategyUpdate(BaseSchema):
    """Patch a reusable platform strategy."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=160)
    slug: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = None
    type: Optional[BotTemplateType] = None
    status: Optional[BotStrategyStatus] = None
    indicator_config: Optional[dict[str, Any]] = None
    rule_config: Optional[dict[str, Any]] = None
    risk_defaults: Optional[dict[str, Any]] = None


class BotStrategyResponse(BaseSchema):
    """Reusable bot strategy returned by admin/customer APIs."""

    id: UUID
    name: str
    slug: str
    description: Optional[str] = None
    type: str
    status: str
    version: int
    indicator_config: dict[str, Any]
    rule_config: dict[str, Any]
    risk_defaults: dict[str, Any]
    template_count: int = 0
    instance_count: int = 0
    backtest_count: int = 0
    created_by_user_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


class BotRunRequest(BaseSchema):
    """Request a deterministic paper evaluation cycle."""

    cycle_key: Optional[str] = Field(default=None, max_length=120)


class BotRunResponse(BaseSchema):
    """Bot evaluation cycle."""

    id: UUID
    instance_id: UUID
    organization_id: UUID
    client_id: UUID
    exchange_id: Optional[UUID] = None
    strategy_id: Optional[UUID] = None
    mode: str
    status: str
    cycle_key: str
    input_snapshot: dict[str, Any]
    decision_snapshot: dict[str, Any]
    risk_snapshot: dict[str, Any]
    error: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class BotSignalResponse(BaseSchema):
    """Generated bot signal."""

    id: UUID
    instance_id: UUID
    run_id: Optional[UUID] = None
    organization_id: UUID
    client_id: UUID
    exchange_id: Optional[UUID] = None
    strategy_id: Optional[UUID] = None
    action: str
    status: str
    symbol: Optional[str] = None
    confidence: Optional[float] = None
    price_usd: Optional[float] = None
    quantity: Optional[float] = None
    notional_usd: Optional[float] = None
    reason: Optional[str] = None
    input_snapshot: dict[str, Any]
    risk_snapshot: dict[str, Any]
    generated_at: datetime
    created_at: datetime
    updated_at: datetime


class BotBacktestCreate(BaseSchema):
    """Run a backtest over available price history."""

    name: Optional[str] = Field(default=None, max_length=160)
    symbol: str = Field(min_length=1, max_length=40)
    timeframe: str = Field(default="1d", max_length=40)
    initial_capital_usd: float = Field(default=10000, gt=0)
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None


class BotBacktestResponse(BaseSchema):
    """Stored backtest result."""

    id: UUID
    strategy_id: UUID
    template_id: Optional[UUID] = None
    organization_id: Optional[UUID] = None
    name: str
    symbol: str
    timeframe: str
    status: str
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    initial_capital_usd: float
    result_summary: dict[str, Any]
    metrics: dict[str, Any]
    logs: list[Any]
    error: Optional[str] = None
    created_by_user_id: Optional[UUID] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class BotLiveEnableRequest(BaseSchema):
    """Explicit request to enable future live mode."""

    confirm_risk: bool = False
    reason: Optional[str] = None
