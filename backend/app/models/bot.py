"""Bot catalog and customer bot instances."""

from __future__ import annotations

import enum
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any, List, Optional
from uuid import UUID

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin
from app.models.organization import PlanType

if TYPE_CHECKING:
    from app.models.client import Client
    from app.models.exchange import Exchange
    from app.models.organization import Organization
    from app.models.user import User


class BotTemplateStatus(str, enum.Enum):
    """Lifecycle for platform-created bot products."""

    DRAFT = "draft"
    PUBLISHED = "published"
    DISABLED = "disabled"
    ARCHIVED = "archived"


class BotTemplateType(str, enum.Enum):
    """High-level bot product family."""

    DCA = "dca"
    GRID = "grid"
    REBALANCE = "rebalance"
    SIGNAL = "signal"
    ARBITRAGE = "arbitrage"
    CUSTOM = "custom"


class BotInstanceMode(str, enum.Enum):
    """Execution mode for a customer bot instance."""

    PAPER = "paper"
    LIVE = "live"


class BotInstanceAssetSource(str, enum.Enum):
    """Where a monitored bot asset came from."""

    SCANNER = "scanner"
    MANUAL = "manual"
    STATIC = "static"


class BotInstanceAssetBucket(str, enum.Enum):
    """Market bucket used by the bot playbook."""

    GAINER = "gainer"
    LOSER = "loser"
    NEUTRAL = "neutral"


class BotInstanceAssetPlaybook(str, enum.Enum):
    """Decision playbook applied to the asset."""

    REVERSAL = "reversal"
    PULLBACK = "pullback"
    CONTINUATION = "continuation"
    NEUTRAL = "neutral"


class BotInstanceAssetStatus(str, enum.Enum):
    """Operator lifecycle for a monitored asset."""

    CANDIDATE = "candidate"
    APPROVED = "approved"
    IGNORED = "ignored"
    DISABLED = "disabled"


class BotInstanceStatus(str, enum.Enum):
    """Operational lifecycle for a customer bot instance."""

    CONFIGURED = "configured"
    ACTIVE = "active"
    PAUSED = "paused"
    ERROR = "error"
    DISABLED = "disabled"


class BotStrategyStatus(str, enum.Enum):
    """Lifecycle for reusable bot strategies."""

    DRAFT = "draft"
    PUBLISHED = "published"
    DISABLED = "disabled"


class BotRunStatus(str, enum.Enum):
    """Execution status for a bot evaluation cycle."""

    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    SKIPPED = "skipped"


class BotSignalAction(str, enum.Enum):
    """Decision emitted by the paper/live engine."""

    HOLD = "hold"
    BUY = "buy"
    SELL = "sell"
    REBALANCE = "rebalance"
    PAUSE = "pause"


class BotSignalStatus(str, enum.Enum):
    """Lifecycle for a generated signal."""

    GENERATED = "generated"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXECUTED = "executed"
    SKIPPED = "skipped"


class BotLiveOrderStatus(str, enum.Enum):
    """Lifecycle for future testnet/live bot orders."""

    PENDING_OPEN = "pending_open"
    OPEN = "open"
    PENDING_CLOSE = "pending_close"
    CLOSED = "closed"
    CANCELLED = "cancelled"
    REJECTED = "rejected"
    FAILED = "failed"


class BotBacktestStatus(str, enum.Enum):
    """Backtest lifecycle."""

    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class BotIndicator(Base, UUIDMixin, TimestampMixin):
    """Reusable technical indicator available to strategy builders."""

    __tablename__ = "bot_indicators"
    __table_args__ = (
        UniqueConstraint("key", name="uq_bot_indicators_key"),
    )

    key: Mapped[str] = mapped_column(String(80), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="active", nullable=False)
    parameter_schema: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    output_schema: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    default_parameters: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    supported_timeframes: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    required_inputs: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    # References the deterministic technical-analysis handler used by the
    # strategy_rules_v2 backtest/evaluation engine.
    engine_handler: Mapped[str] = mapped_column(String(120), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class BotStrategy(Base, UUIDMixin, TimestampMixin):
    """Reusable strategy definition used by bot templates and instances."""

    __tablename__ = "bot_strategies"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_bot_strategies_slug"),
    )

    name: Mapped[str] = mapped_column(String(160), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    type: Mapped[BotTemplateType] = mapped_column(
        SAEnum(BotTemplateType),
        default=BotTemplateType.CUSTOM,
        nullable=False,
    )
    status: Mapped[BotStrategyStatus] = mapped_column(
        SAEnum(BotStrategyStatus),
        default=BotStrategyStatus.DRAFT,
        nullable=False,
    )
    version: Mapped[int] = mapped_column(default=1, nullable=False)
    market_config: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    indicator_config: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    rule_config: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    risk_defaults: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    created_by_user_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    templates: Mapped[List["BotTemplate"]] = relationship("BotTemplate", back_populates="strategy")
    instances: Mapped[List["BotInstance"]] = relationship("BotInstance", back_populates="strategy")
    backtests: Mapped[List["BotBacktest"]] = relationship("BotBacktest", back_populates="strategy")
    backtest_runs: Mapped[List["BotBacktestRun"]] = relationship("BotBacktestRun", back_populates="strategy")
    created_by: Mapped[Optional["User"]] = relationship("User")


class BotTemplate(Base, UUIDMixin, TimestampMixin):
    """Platform bot product created by super-admins and activated by customers."""

    __tablename__ = "bot_templates"

    name: Mapped[str] = mapped_column(String(160), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    type: Mapped[BotTemplateType] = mapped_column(
        SAEnum(BotTemplateType),
        default=BotTemplateType.CUSTOM,
        nullable=False,
    )
    status: Mapped[BotTemplateStatus] = mapped_column(
        SAEnum(BotTemplateStatus),
        default=BotTemplateStatus.DRAFT,
        nullable=False,
    )
    required_plan: Mapped[PlanType] = mapped_column(
        SAEnum(PlanType),
        default=PlanType.PRO,
        nullable=False,
    )
    requires_trade_permission: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    supported_exchanges: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    supported_assets: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    default_parameters: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    risk_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    strategy_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("bot_strategies.id", ondelete="SET NULL"),
        nullable=True,
    )

    parameters: Mapped[List["BotTemplateParameter"]] = relationship(
        "BotTemplateParameter",
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="BotTemplateParameter.created_at",
    )
    instances: Mapped[List["BotInstance"]] = relationship(
        "BotInstance",
        back_populates="template",
    )
    strategy: Mapped[Optional["BotStrategy"]] = relationship("BotStrategy", back_populates="templates")
    created_by: Mapped[Optional["User"]] = relationship("User")


class BotTemplateParameter(Base, UUIDMixin, TimestampMixin):
    """Configurable parameter exposed by a bot template."""

    __tablename__ = "bot_template_parameters"
    __table_args__ = (
        UniqueConstraint("template_id", "key", name="uq_bot_template_parameters_template_key"),
    )

    template_id: Mapped[UUID] = mapped_column(
        ForeignKey("bot_templates.id", ondelete="CASCADE"),
        nullable=False,
    )
    key: Mapped[str] = mapped_column(String(80), nullable=False)
    label: Mapped[str] = mapped_column(String(160), nullable=False)
    type: Mapped[str] = mapped_column(String(40), nullable=False, default="string")
    required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    default_value: Mapped[Optional[Any]] = mapped_column(JSONB, nullable=True)
    min_value: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    max_value: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    options: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    help_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    template: Mapped["BotTemplate"] = relationship("BotTemplate", back_populates="parameters")


class BotInstance(Base, UUIDMixin, TimestampMixin):
    """Customer activation of a platform bot product."""

    __tablename__ = "bot_instances"
    __table_args__ = (
        Index(
            "uq_bot_instances_active_identity",
            "organization_id",
            "client_id",
            "template_id",
            "exchange_id",
            "strategy_id",
            "mode",
            "live_enabled",
            unique=True,
            postgresql_where=text("status <> 'DISABLED' AND live_enabled = false"),
            postgresql_nulls_not_distinct=True,
        ),
    )

    template_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("bot_templates.id", ondelete="SET NULL"),
        nullable=True,
    )
    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    client_id: Mapped[UUID] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
    )
    exchange_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("exchanges.id", ondelete="SET NULL"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    mode: Mapped[BotInstanceMode] = mapped_column(
        SAEnum(BotInstanceMode),
        default=BotInstanceMode.PAPER,
        nullable=False,
    )
    status: Mapped[BotInstanceStatus] = mapped_column(
        SAEnum(BotInstanceStatus),
        default=BotInstanceStatus.CONFIGURED,
        nullable=False,
    )
    parameters: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_heartbeat_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    paused_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    disabled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by_user_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    strategy_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("bot_strategies.id", ondelete="SET NULL"),
        nullable=True,
    )
    live_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    risk_config: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    last_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    template: Mapped[Optional["BotTemplate"]] = relationship("BotTemplate", back_populates="instances")
    strategy: Mapped[Optional["BotStrategy"]] = relationship("BotStrategy", back_populates="instances")
    organization: Mapped["Organization"] = relationship("Organization", back_populates="bot_instances")
    client: Mapped["Client"] = relationship("Client", back_populates="bot_instances")
    exchange: Mapped[Optional["Exchange"]] = relationship("Exchange", back_populates="bot_instances")
    created_by: Mapped[Optional["User"]] = relationship("User")
    runs: Mapped[List["BotRun"]] = relationship("BotRun", back_populates="instance")
    signals: Mapped[List["BotSignal"]] = relationship("BotSignal", back_populates="instance")
    backtest_runs: Mapped[List["BotBacktestRun"]] = relationship("BotBacktestRun", back_populates="instance")
    assets: Mapped[List["BotInstanceAsset"]] = relationship(
        "BotInstanceAsset",
        back_populates="instance",
        cascade="all, delete-orphan",
        order_by="BotInstanceAsset.symbol",
    )


class BotInstanceAsset(Base, UUIDMixin, TimestampMixin):
    """Per-instance asset selected by scanner/manual curation."""

    __tablename__ = "bot_instance_assets"
    __table_args__ = (
        UniqueConstraint("instance_id", "symbol", name="uq_bot_instance_assets_instance_symbol"),
        Index("ix_bot_instance_assets_org_instance", "organization_id", "instance_id"),
        Index("ix_bot_instance_assets_instance_status", "instance_id", "status"),
        Index("ix_bot_instance_assets_org_status", "organization_id", "status"),
    )

    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    instance_id: Mapped[UUID] = mapped_column(ForeignKey("bot_instances.id", ondelete="CASCADE"), nullable=False)
    symbol: Mapped[str] = mapped_column(String(40), nullable=False)
    source: Mapped[BotInstanceAssetSource] = mapped_column(
        SAEnum(BotInstanceAssetSource),
        default=BotInstanceAssetSource.SCANNER,
        nullable=False,
    )
    bucket: Mapped[BotInstanceAssetBucket] = mapped_column(
        SAEnum(BotInstanceAssetBucket),
        default=BotInstanceAssetBucket.NEUTRAL,
        nullable=False,
    )
    playbook: Mapped[BotInstanceAssetPlaybook] = mapped_column(
        SAEnum(BotInstanceAssetPlaybook),
        default=BotInstanceAssetPlaybook.NEUTRAL,
        nullable=False,
    )
    status: Mapped[BotInstanceAssetStatus] = mapped_column(
        SAEnum(BotInstanceAssetStatus),
        default=BotInstanceAssetStatus.CANDIDATE,
        nullable=False,
    )
    approved_for_live: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    origin_rank: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    origin_timeframe: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    origin_direction: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    performance_percent: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 8), nullable=True)
    snapshot_id: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    last_backtest_run_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("bot_backtest_runs.id", ondelete="SET NULL"),
        nullable=True,
    )
    last_backtest_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 4), nullable=True)
    approved_by_user_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ignored_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)

    organization: Mapped["Organization"] = relationship("Organization")
    instance: Mapped["BotInstance"] = relationship("BotInstance", back_populates="assets")
    approved_by: Mapped[Optional["User"]] = relationship("User")
    last_backtest_run: Mapped[Optional["BotBacktestRun"]] = relationship("BotBacktestRun")


class BotRun(Base, UUIDMixin, TimestampMixin):
    """One idempotent bot evaluation cycle."""

    __tablename__ = "bot_runs"
    __table_args__ = (
        UniqueConstraint("instance_id", "cycle_key", name="uq_bot_runs_instance_cycle"),
    )

    instance_id: Mapped[UUID] = mapped_column(ForeignKey("bot_instances.id", ondelete="CASCADE"), nullable=False)
    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    client_id: Mapped[UUID] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    exchange_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("exchanges.id", ondelete="SET NULL"), nullable=True)
    strategy_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("bot_strategies.id", ondelete="SET NULL"), nullable=True)
    mode: Mapped[BotInstanceMode] = mapped_column(SAEnum(BotInstanceMode), nullable=False)
    status: Mapped[BotRunStatus] = mapped_column(SAEnum(BotRunStatus), default=BotRunStatus.RUNNING, nullable=False)
    cycle_key: Mapped[str] = mapped_column(String(120), nullable=False)
    input_snapshot: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    decision_snapshot: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    risk_snapshot: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    instance: Mapped["BotInstance"] = relationship("BotInstance", back_populates="runs")
    signals: Mapped[List["BotSignal"]] = relationship("BotSignal", back_populates="run")


class BotSignal(Base, UUIDMixin, TimestampMixin):
    """A generated bot decision ready for paper review or future execution."""

    __tablename__ = "bot_signals"

    instance_id: Mapped[UUID] = mapped_column(ForeignKey("bot_instances.id", ondelete="CASCADE"), nullable=False)
    run_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("bot_runs.id", ondelete="SET NULL"), nullable=True)
    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    client_id: Mapped[UUID] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    exchange_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("exchanges.id", ondelete="SET NULL"), nullable=True)
    strategy_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("bot_strategies.id", ondelete="SET NULL"), nullable=True)
    action: Mapped[BotSignalAction] = mapped_column(SAEnum(BotSignalAction), nullable=False)
    status: Mapped[BotSignalStatus] = mapped_column(
        SAEnum(BotSignalStatus),
        default=BotSignalStatus.GENERATED,
        nullable=False,
    )
    symbol: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    confidence: Mapped[Optional[float]] = mapped_column(Numeric(8, 4), nullable=True)
    price_usd: Mapped[Optional[float]] = mapped_column(Numeric(24, 12), nullable=True)
    quantity: Mapped[Optional[float]] = mapped_column(Numeric(32, 18), nullable=True)
    notional_usd: Mapped[Optional[float]] = mapped_column(Numeric(24, 2), nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    input_snapshot: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    risk_snapshot: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    instance: Mapped["BotInstance"] = relationship("BotInstance", back_populates="signals")
    run: Mapped[Optional["BotRun"]] = relationship("BotRun", back_populates="signals")


class BotBacktestRun(Base, UUIDMixin, TimestampMixin):
    """Institutional backtest execution for one customer bot instance and symbol."""

    __tablename__ = "bot_backtest_runs"
    __table_args__ = (
        UniqueConstraint("config_hash", name="uq_bot_backtest_runs_config_hash"),
        Index("ix_bot_backtest_runs_org_created", "organization_id", "created_at"),
        Index("ix_bot_backtest_runs_instance_symbol_created", "instance_id", "symbol", "created_at"),
        Index("ix_bot_backtest_runs_status", "status"),
    )

    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    instance_id: Mapped[UUID] = mapped_column(ForeignKey("bot_instances.id", ondelete="CASCADE"), nullable=False)
    strategy_id: Mapped[UUID] = mapped_column(ForeignKey("bot_strategies.id", ondelete="CASCADE"), nullable=False)
    strategy_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    client_id: Mapped[UUID] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    exchange_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("exchanges.id", ondelete="SET NULL"), nullable=True)
    symbol: Mapped[str] = mapped_column(String(40), nullable=False)
    exchange: Mapped[str] = mapped_column(String(32), nullable=False)
    market_type: Mapped[str] = mapped_column(String(24), default="futures", nullable=False)
    timeframe: Mapped[str] = mapped_column(String(16), nullable=False)
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[BotBacktestStatus] = mapped_column(
        SAEnum(BotBacktestStatus),
        default=BotBacktestStatus.RUNNING,
        nullable=False,
    )
    progress: Mapped[float] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    initial_capital_usd: Mapped[float] = mapped_column(Numeric(24, 2), nullable=False)
    config_hash: Mapped[str] = mapped_column(String(96), nullable=False)
    config_snapshot: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    strategy_snapshot: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    risk_snapshot: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    cost_snapshot: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    data_quality: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    result_summary: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    metrics: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    equity_curve: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    drawdown_curve: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    diagnostics: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    instance: Mapped["BotInstance"] = relationship("BotInstance", back_populates="backtest_runs")
    strategy: Mapped["BotStrategy"] = relationship("BotStrategy", back_populates="backtest_runs")
    trades: Mapped[List["BotBacktestTrade"]] = relationship(
        "BotBacktestTrade",
        back_populates="run",
        cascade="all, delete-orphan",
        order_by="BotBacktestTrade.entry_time",
    )
    user: Mapped[Optional["User"]] = relationship("User")


class BotBacktestTrade(Base, UUIDMixin, TimestampMixin):
    """One normalized simulated trade generated by a bot backtest run."""

    __tablename__ = "bot_backtest_trades"
    __table_args__ = (
        Index("ix_bot_backtest_trades_run_entry", "run_id", "entry_time"),
        Index("ix_bot_backtest_trades_org_symbol_entry", "organization_id", "symbol", "entry_time"),
    )

    run_id: Mapped[UUID] = mapped_column(ForeignKey("bot_backtest_runs.id", ondelete="CASCADE"), nullable=False)
    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    instance_id: Mapped[UUID] = mapped_column(ForeignKey("bot_instances.id", ondelete="CASCADE"), nullable=False)
    symbol: Mapped[str] = mapped_column(String(40), nullable=False)
    side: Mapped[str] = mapped_column(String(16), default="long", nullable=False)
    entry_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    exit_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    entry_price: Mapped[float] = mapped_column(Numeric(28, 12), nullable=False)
    exit_price: Mapped[Optional[float]] = mapped_column(Numeric(28, 12), nullable=True)
    quantity: Mapped[float] = mapped_column(Numeric(32, 18), nullable=False)
    gross_pnl: Mapped[float] = mapped_column(Numeric(24, 8), default=0, nullable=False)
    fee_paid: Mapped[float] = mapped_column(Numeric(24, 8), default=0, nullable=False)
    slippage_paid: Mapped[float] = mapped_column(Numeric(24, 8), default=0, nullable=False)
    net_pnl: Mapped[float] = mapped_column(Numeric(24, 8), default=0, nullable=False)
    return_percent: Mapped[float] = mapped_column(Numeric(12, 6), default=0, nullable=False)
    mae_percent: Mapped[float] = mapped_column(Numeric(12, 6), default=0, nullable=False)
    mfe_percent: Mapped[float] = mapped_column(Numeric(12, 6), default=0, nullable=False)
    entry_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    exit_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    bars_held: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    raw_payload: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    run: Mapped["BotBacktestRun"] = relationship("BotBacktestRun", back_populates="trades")


class BotLiveOrder(Base, UUIDMixin, TimestampMixin):
    """Auditable testnet/live order ledger for future bot execution."""

    __tablename__ = "bot_live_orders"
    __table_args__ = (
        Index("ix_bot_live_orders_org_status_opened", "organization_id", "status", "opened_at"),
        Index("ix_bot_live_orders_instance_symbol_status", "instance_id", "symbol", "status"),
        Index("ix_bot_live_orders_signal", "entry_signal_id"),
        Index(
            "uq_bot_live_orders_entry_signal",
            "entry_signal_id",
            unique=True,
            postgresql_where=text("entry_signal_id IS NOT NULL"),
        ),
        Index(
            "uq_bot_live_orders_client_order",
            "organization_id",
            "client_order_id",
            unique=True,
            postgresql_where=text("client_order_id IS NOT NULL"),
        ),
        Index(
            "uq_bot_live_orders_exchange_order",
            "exchange_id",
            "exchange_order_id",
            unique=True,
            postgresql_where=text("exchange_order_id IS NOT NULL"),
        ),
    )

    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    client_id: Mapped[UUID] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    instance_id: Mapped[UUID] = mapped_column(ForeignKey("bot_instances.id", ondelete="CASCADE"), nullable=False)
    strategy_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("bot_strategies.id", ondelete="SET NULL"), nullable=True)
    exchange_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("exchanges.id", ondelete="SET NULL"), nullable=True)
    entry_signal_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("bot_signals.id", ondelete="SET NULL"), nullable=True)
    exit_signal_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("bot_signals.id", ondelete="SET NULL"), nullable=True)
    entry_run_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("bot_runs.id", ondelete="SET NULL"), nullable=True)
    exit_run_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("bot_runs.id", ondelete="SET NULL"), nullable=True)
    symbol: Mapped[str] = mapped_column(String(40), nullable=False)
    side: Mapped[str] = mapped_column(String(16), default="long", nullable=False)
    execution_mode: Mapped[str] = mapped_column(String(24), default="testnet", nullable=False)
    status: Mapped[BotLiveOrderStatus] = mapped_column(
        SAEnum(BotLiveOrderStatus),
        default=BotLiveOrderStatus.PENDING_OPEN,
        nullable=False,
    )
    market_type: Mapped[str] = mapped_column(String(24), default="futures", nullable=False)
    exchange_order_id: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    client_order_id: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    quantity: Mapped[Optional[float]] = mapped_column(Numeric(32, 18), nullable=True)
    entry_price: Mapped[Optional[float]] = mapped_column(Numeric(28, 12), nullable=True)
    exit_price: Mapped[Optional[float]] = mapped_column(Numeric(28, 12), nullable=True)
    notional_usd: Mapped[Optional[float]] = mapped_column(Numeric(24, 2), nullable=True)
    gross_pnl_usd: Mapped[Optional[float]] = mapped_column(Numeric(24, 8), nullable=True)
    fee_usd: Mapped[Optional[float]] = mapped_column(Numeric(24, 8), nullable=True)
    slippage_usd: Mapped[Optional[float]] = mapped_column(Numeric(24, 8), nullable=True)
    net_pnl_usd: Mapped[Optional[float]] = mapped_column(Numeric(24, 8), nullable=True)
    pnl_percent: Mapped[Optional[float]] = mapped_column(Numeric(12, 6), nullable=True)
    stop_price: Mapped[Optional[float]] = mapped_column(Numeric(28, 12), nullable=True)
    take_profit_price: Mapped[Optional[float]] = mapped_column(Numeric(28, 12), nullable=True)
    trailing_stop_price: Mapped[Optional[float]] = mapped_column(Numeric(28, 12), nullable=True)
    breakeven_price: Mapped[Optional[float]] = mapped_column(Numeric(28, 12), nullable=True)
    opened_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_reconciled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    close_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    risk_snapshot: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    order_snapshot: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    exchange_payload: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    instance: Mapped["BotInstance"] = relationship("BotInstance")
    organization: Mapped["Organization"] = relationship("Organization")
    client: Mapped["Client"] = relationship("Client")
    exchange: Mapped[Optional["Exchange"]] = relationship("Exchange")
    strategy: Mapped[Optional["BotStrategy"]] = relationship("BotStrategy")


class BotBacktest(Base, UUIDMixin, TimestampMixin):
    """Stored result of a strategy backtest over available price history."""

    __tablename__ = "bot_backtests"

    strategy_id: Mapped[UUID] = mapped_column(ForeignKey("bot_strategies.id", ondelete="CASCADE"), nullable=False)
    template_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("bot_templates.id", ondelete="SET NULL"), nullable=True)
    organization_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    symbol: Mapped[str] = mapped_column(String(40), nullable=False)
    timeframe: Mapped[str] = mapped_column(String(40), default="1d", nullable=False)
    status: Mapped[BotBacktestStatus] = mapped_column(
        SAEnum(BotBacktestStatus),
        default=BotBacktestStatus.RUNNING,
        nullable=False,
    )
    period_start: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    period_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    initial_capital_usd: Mapped[float] = mapped_column(Numeric(24, 2), nullable=False)
    result_summary: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    metrics: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    logs: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    strategy: Mapped["BotStrategy"] = relationship("BotStrategy", back_populates="backtests")
