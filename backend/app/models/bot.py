"""Bot catalog and customer bot instances."""

from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Any, List, Optional
from uuid import UUID

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
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
