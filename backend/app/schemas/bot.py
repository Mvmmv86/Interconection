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


class BotInstanceAssetResponse(BaseSchema):
    """Asset monitored by a customer bot instance."""

    id: UUID
    organization_id: UUID
    instance_id: UUID
    symbol: str
    source: str
    bucket: str
    playbook: str
    status: str
    approved_for_live: bool
    origin_rank: Optional[int] = None
    origin_timeframe: Optional[str] = None
    origin_direction: Optional[str] = None
    performance_percent: Optional[float] = None
    snapshot_id: Optional[str] = None
    last_backtest_run_id: Optional[UUID] = None
    last_backtest_score: Optional[float] = None
    approved_by_user_id: Optional[UUID] = None
    approved_at: Optional[datetime] = None
    ignored_at: Optional[datetime] = None
    metadata_json: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class BotInstanceAssetUpdate(BaseSchema):
    """Patch operator curation for an instance asset."""

    status: Optional[str] = Field(default=None, max_length=40)
    playbook: Optional[str] = Field(default=None, max_length=40)
    bucket: Optional[str] = Field(default=None, max_length=40)
    approved_for_live: Optional[bool] = None


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
    assets: list[BotInstanceAssetResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class BotIndicatorResponse(BaseSchema):
    """Technical indicator available to the strategy builder."""

    id: UUID
    key: str
    name: str
    category: str
    description: Optional[str] = None
    status: str
    parameter_schema: dict[str, Any]
    output_schema: dict[str, Any]
    default_parameters: dict[str, Any]
    supported_timeframes: list[str]
    required_inputs: list[str]
    engine_handler: str
    sort_order: int
    created_at: datetime
    updated_at: datetime


class BotStrategyCreate(BaseSchema):
    """Create a reusable platform strategy."""

    name: str = Field(min_length=1, max_length=160)
    slug: str = Field(min_length=1, max_length=120)
    description: Optional[str] = None
    type: BotTemplateType = BotTemplateType.CUSTOM
    status: BotStrategyStatus = BotStrategyStatus.DRAFT
    market_config: dict[str, Any] = Field(default_factory=dict)
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
    market_config: Optional[dict[str, Any]] = None
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
    market_config: dict[str, Any]
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
    symbol: Optional[str] = Field(default=None, max_length=40)
    timeframe: Optional[str] = Field(default=None, max_length=40)


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


class BotRunBatchResponse(BaseSchema):
    """Batch paper evaluation over a bot basket."""

    instance_id: UUID
    symbol_count: int
    run_count: int
    skipped_count: int
    runs: list[BotRunResponse]
    skipped: list[dict[str, Any]] = Field(default_factory=list)
    basket: dict[str, Any] = Field(default_factory=dict)


class BotBasketRefreshResponse(BaseSchema):
    """Freshly resolved operational basket for one bot instance."""

    instance: BotInstanceResponse
    symbols: list[str]
    symbol_count: int
    basket: dict[str, Any] = Field(default_factory=dict)


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


class AdminBotMonitoringItemResponse(BaseSchema):
    """Platform admin view over one monitored bot asset and its latest cycle."""

    organization_id: UUID
    organization_name: Optional[str] = None
    client_id: UUID
    client_name: Optional[str] = None
    instance_id: UUID
    instance_name: str
    instance_status: str
    instance_mode: str
    template_name: Optional[str] = None
    strategy_name: Optional[str] = None
    exchange_id: Optional[UUID] = None
    exchange_label: Optional[str] = None
    exchange_type: Optional[str] = None
    symbol: str
    asset_status: str
    approved_for_live: bool
    bucket: str
    playbook: str
    origin_direction: Optional[str] = None
    origin_timeframe: Optional[str] = None
    performance_percent: Optional[float] = None
    approved_at: Optional[datetime] = None
    last_run_id: Optional[UUID] = None
    last_run_status: Optional[str] = None
    last_run_cycle_key: Optional[str] = None
    last_run_started_at: Optional[datetime] = None
    last_run_completed_at: Optional[datetime] = None
    last_run_error: Optional[str] = None
    last_signal_id: Optional[UUID] = None
    last_signal_action: Optional[str] = None
    last_signal_status: Optional[str] = None
    last_signal_confidence: Optional[float] = None
    last_signal_price_usd: Optional[float] = None
    last_signal_notional_usd: Optional[float] = None
    last_signal_reason: Optional[str] = None
    last_signal_generated_at: Optional[datetime] = None
    candle_source: Optional[str] = None
    entry_passed: Optional[bool] = None
    exit_passed: Optional[bool] = None
    risk_blocks: list[str] = Field(default_factory=list)
    data_warnings: list[str] = Field(default_factory=list)
    active_stop_price: Optional[float] = None
    atr_stop: Optional[float] = None
    take_profit_price: Optional[float] = None
    trailing_stop_price: Optional[float] = None
    breakeven_price: Optional[float] = None


class AdminBotMonitoringSummaryResponse(BaseSchema):
    """Aggregate counters for the admin bot monitoring screen."""

    total_assets: int = 0
    approved_assets: int = 0
    candidate_assets: int = 0
    ignored_assets: int = 0
    disabled_assets: int = 0
    latest_buy_count: int = 0
    latest_sell_count: int = 0
    latest_hold_count: int = 0
    latest_failed_runs: int = 0
    data_warning_assets: int = 0
    risk_blocked_assets: int = 0


class AdminBotMonitoringResponse(BaseSchema):
    """Admin bot monitoring payload."""

    summary: AdminBotMonitoringSummaryResponse
    items: list[AdminBotMonitoringItemResponse]


class AdminBotMonitoringHistoryItemResponse(BaseSchema):
    """One historical paper/live cycle for a monitored bot asset."""

    run_id: Optional[UUID] = None
    run_status: Optional[str] = None
    cycle_key: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    run_error: Optional[str] = None
    signal_id: Optional[UUID] = None
    signal_action: Optional[str] = None
    signal_status: Optional[str] = None
    confidence: Optional[float] = None
    price_usd: Optional[float] = None
    notional_usd: Optional[float] = None
    reason: Optional[str] = None
    generated_at: Optional[datetime] = None
    candle_source: Optional[str] = None
    entry_passed: Optional[bool] = None
    exit_passed: Optional[bool] = None
    risk_blocks: list[str] = Field(default_factory=list)
    data_warnings: list[str] = Field(default_factory=list)


class BotBacktestCreate(BaseSchema):
    """Run a backtest over available price history."""

    name: Optional[str] = Field(default=None, max_length=160)
    symbol: str = Field(min_length=1, max_length=40)
    timeframe: str = Field(default="1d", max_length=40)
    initial_capital_usd: float = Field(default=10000, gt=0)
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    risk_overrides: dict[str, Any] = Field(default_factory=dict)


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


class BotInstanceBacktestCreate(BaseSchema):
    """Queue a heavy backtest for one activated bot instance and symbol."""

    symbol: str = Field(min_length=1, max_length=40)
    timeframe: str = Field(default="1h", max_length=16)
    initial_capital_usd: float = Field(default=10000, gt=0)
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    fee_percent: float = Field(default=0.1, ge=0, le=10)
    slippage_percent: float = Field(default=0.05, ge=0, le=20)
    risk_overrides: dict[str, Any] = Field(default_factory=dict)


class BotBacktestRunResponse(BaseSchema):
    """Instance-scoped heavy backtest run."""

    id: UUID
    organization_id: UUID
    user_id: Optional[UUID] = None
    instance_id: UUID
    strategy_id: UUID
    strategy_version: int
    client_id: UUID
    exchange_id: Optional[UUID] = None
    symbol: str
    exchange: str
    market_type: str
    timeframe: str
    period_start: datetime
    period_end: datetime
    status: str
    progress: float
    initial_capital_usd: float
    config_hash: str
    config_snapshot: dict[str, Any]
    strategy_snapshot: dict[str, Any]
    risk_snapshot: dict[str, Any]
    cost_snapshot: dict[str, Any]
    data_quality: dict[str, Any]
    result_summary: dict[str, Any]
    metrics: dict[str, Any]
    equity_curve: list[Any]
    drawdown_curve: list[Any]
    diagnostics: dict[str, Any]
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class BotBacktestTradeResponse(BaseSchema):
    """One normalized simulated trade in a heavy backtest."""

    id: UUID
    run_id: UUID
    organization_id: UUID
    instance_id: UUID
    symbol: str
    side: str
    entry_time: datetime
    exit_time: Optional[datetime] = None
    entry_price: float
    exit_price: Optional[float] = None
    quantity: float
    gross_pnl: float
    fee_paid: float
    slippage_paid: float
    net_pnl: float
    return_percent: float
    mae_percent: float
    mfe_percent: float
    entry_reason: Optional[str] = None
    exit_reason: Optional[str] = None
    bars_held: int
    raw_payload: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class BotBacktestCandleResponse(BaseSchema):
    """One OHLCV candle returned for backtest chart visualization."""

    open_time: datetime
    close_time: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    quote_volume: float


class BotBacktestChartResponse(BaseSchema):
    """Candles and trades needed to render an execution chart."""

    run_id: UUID
    symbol: str
    exchange: str
    market_type: str
    timeframe: str
    period_start: datetime
    period_end: datetime
    candle_count_full: int
    candle_count_loaded: int
    candle_count_returned: int
    trade_count_returned: int
    trade_limit: int
    candles: list[BotBacktestCandleResponse]
    trades: list[BotBacktestTradeResponse]
    indicators: dict[str, Any] = Field(default_factory=dict)


class BotLiveEnableRequest(BaseSchema):
    """Explicit request to enable future live mode."""

    confirm_risk: bool = False
    reason: Optional[str] = None


class BotMarketCandleSyncRequest(BaseSchema):
    """Admin request to ingest exchange OHLCV candles."""

    exchange_id: UUID
    symbols: list[str] = Field(min_length=1)
    timeframes: list[str] = Field(default_factory=lambda: ["1h"])
    limit: int = Field(default=300, ge=1, le=250000)
    market_type: str = Field(default="spot", max_length=32)
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None


class BotMarketCandleSyncResponse(BaseSchema):
    """Result of an OHLCV ingestion run."""

    exchange_id: str
    exchange: str
    requested: int
    stored: int
    errors: list[str] = Field(default_factory=list)


class BotSchedulerRunRequest(BaseSchema):
    """Admin request to run due paper bot cycles."""

    organization_id: Optional[UUID] = None
    limit: int = Field(default=50, ge=1, le=200)
    candle_limit: int = Field(default=300, ge=50, le=1000)


class BotSchedulerRunResponse(BaseSchema):
    """Summary of a scheduler batch."""

    processed: int
    cycle_attempt_count: int = 0
    run_count: int
    skipped_count: int
    error_count: int
    runs: list[dict[str, Any]] = Field(default_factory=list)
    skipped: list[dict[str, Any]] = Field(default_factory=list)
    errors: list[dict[str, Any]] = Field(default_factory=list)


class BotMarketRankingGenerateRequest(BaseSchema):
    """Admin request to build a market scanner snapshot from stored candles."""

    exchange: str = Field(default="bingx", max_length=32)
    market_type: str = Field(default="spot", max_length=24)
    timeframe: str = Field(default="24h", max_length=16)
    direction: str = Field(default="gainers", max_length=16)
    top_n: int = Field(default=10, ge=1, le=100)
    source_timeframe: Optional[str] = Field(default=None, max_length=16)
    min_quote_volume: float = Field(default=0, ge=0)
    min_price: Optional[float] = Field(default=None, ge=0)
    max_price: Optional[float] = Field(default=None, ge=0)
    quote_asset: Optional[str] = Field(default="USDT", max_length=24)
    include_symbols: list[str] = Field(default_factory=list)
    exclude_symbols: list[str] = Field(default_factory=list)
    only_tradeable: bool = True


class BotMarketScannerBootstrapRequest(BaseSchema):
    """Admin request to refresh public market scanner data end-to-end."""

    exchange: str = Field(default="bingx", max_length=32)
    market_type: str = Field(default="futures", max_length=24)
    quote_asset: str = Field(default="USDT", max_length=24)
    universe_limit: int = Field(default=120, ge=1, le=500)
    candle_symbol_limit: int = Field(default=50, ge=1, le=200)
    candle_timeframes: list[str] = Field(default_factory=lambda: ["1h", "1d"])
    ranking_timeframes: list[str] = Field(default_factory=lambda: ["1h", "24h", "7d", "30d"])
    directions: list[str] = Field(default_factory=lambda: ["gainers", "losers"])
    top_n: int = Field(default=50, ge=1, le=100)
    min_quote_volume: float = Field(default=0, ge=0)
    min_price: Optional[float] = Field(default=None, ge=0)
    max_price: Optional[float] = Field(default=None, ge=0)


class BotMarketScannerBootstrapResponse(BaseSchema):
    """End-to-end public scanner refresh result."""

    exchange: str
    market_type: str
    status: str
    universe_count: int = 0
    candle_symbol_count: int = 0
    candles_stored: int = 0
    snapshots_generated: int = 0
    snapshot_item_count: int = 0
    reason: Optional[str] = None
    errors: list[str] = Field(default_factory=list)


class BotMarketRankingItemResponse(BaseSchema):
    """One ranked market asset."""

    id: UUID
    rank: int
    symbol: str
    base_asset: str
    quote_asset: str
    price: float
    change_percent: float
    volume: float
    quote_volume: float
    market_cap: Optional[float] = None
    candle_close_time: Optional[datetime] = None
    raw_payload: dict[str, Any] = Field(default_factory=dict)


class BotMarketRankingResponse(BaseSchema):
    """Latest scanner snapshot for a market/time window."""

    snapshot_id: Optional[UUID] = None
    source: str = "market_candles"
    exchange: str
    market_type: str
    timeframe: str
    source_timeframe: Optional[str] = None
    direction: str
    metric: str = "price_change_percent"
    top_n: int = 10
    generated_at: Optional[datetime] = None
    candle_time: Optional[datetime] = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    items: list[BotMarketRankingItemResponse] = Field(default_factory=list)


class BotMarketUniverseAssetResponse(BaseSchema):
    """One tradable asset in the scanner universe."""

    id: UUID
    exchange: str
    market_type: str
    symbol: str
    base_asset: str
    quote_asset: str
    display_name: Optional[str] = None
    is_tradeable: bool
    status: str
    last_price: Optional[float] = None
    quote_volume_24h: float
    change_1h_percent: Optional[float] = None
    change_24h_percent: Optional[float] = None
    change_7d_percent: Optional[float] = None
    change_30d_percent: Optional[float] = None
    last_seen_at: Optional[datetime] = None
    raw_payload: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime
