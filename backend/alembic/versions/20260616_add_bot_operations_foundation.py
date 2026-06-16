"""add bot operations foundation

Revision ID: f2c6d9a4b8e1
Revises: b9a7c3d2e6f4
Create Date: 2026-06-16 00:00:00.000000
"""

from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "f2c6d9a4b8e1"
down_revision: Union[str, None] = "b9a7c3d2e6f4"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    bot_template_type = postgresql.ENUM(
        "DCA",
        "GRID",
        "REBALANCE",
        "SIGNAL",
        "ARBITRAGE",
        "CUSTOM",
        name="bottemplatetype",
        create_type=False,
    )
    bot_instance_mode = postgresql.ENUM("PAPER", "LIVE", name="botinstancemode", create_type=False)
    bot_instance_status = postgresql.ENUM(
        "CONFIGURED",
        "ACTIVE",
        "PAUSED",
        "ERROR",
        "DISABLED",
        name="botinstancestatus",
        create_type=False,
    )
    bot_strategy_status = postgresql.ENUM(
        "DRAFT",
        "PUBLISHED",
        "DISABLED",
        name="botstrategystatus",
        create_type=False,
    )
    bot_run_status = postgresql.ENUM(
        "RUNNING",
        "SUCCEEDED",
        "FAILED",
        "SKIPPED",
        name="botrunstatus",
        create_type=False,
    )
    bot_signal_action = postgresql.ENUM(
        "HOLD",
        "BUY",
        "SELL",
        "REBALANCE",
        "PAUSE",
        name="botsignalaction",
        create_type=False,
    )
    bot_signal_status = postgresql.ENUM(
        "GENERATED",
        "APPROVED",
        "REJECTED",
        "EXECUTED",
        "SKIPPED",
        name="botsignalstatus",
        create_type=False,
    )
    bot_backtest_status = postgresql.ENUM(
        "RUNNING",
        "SUCCEEDED",
        "FAILED",
        name="botbackteststatus",
        create_type=False,
    )

    bind = op.get_bind()
    bot_strategy_status.create(bind, checkfirst=True)
    bot_run_status.create(bind, checkfirst=True)
    bot_signal_action.create(bind, checkfirst=True)
    bot_signal_status.create(bind, checkfirst=True)
    bot_backtest_status.create(bind, checkfirst=True)

    op.create_table(
        "bot_strategies",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("type", bot_template_type, nullable=False, server_default=sa.text("'CUSTOM'")),
        sa.Column("status", bot_strategy_status, nullable=False, server_default=sa.text("'DRAFT'")),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("indicator_config", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("rule_config", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("risk_defaults", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="uq_bot_strategies_slug"),
    )
    op.create_index("ix_bot_strategies_status", "bot_strategies", ["status"])
    op.create_index("ix_bot_strategies_type", "bot_strategies", ["type"])

    op.add_column("bot_templates", sa.Column("strategy_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_bot_templates_strategy_id",
        "bot_templates",
        "bot_strategies",
        ["strategy_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_bot_templates_strategy_id", "bot_templates", ["strategy_id"])

    op.add_column("bot_instances", sa.Column("strategy_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("bot_instances", sa.Column("live_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("bot_instances", sa.Column("risk_config", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")))
    op.add_column("bot_instances", sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        "fk_bot_instances_strategy_id",
        "bot_instances",
        "bot_strategies",
        ["strategy_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_bot_instances_strategy_id", "bot_instances", ["strategy_id"])

    op.create_table(
        "bot_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("instance_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("exchange_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("strategy_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("mode", bot_instance_mode, nullable=False),
        sa.Column("status", bot_run_status, nullable=False, server_default=sa.text("'RUNNING'")),
        sa.Column("cycle_key", sa.String(length=120), nullable=False),
        sa.Column("input_snapshot", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("decision_snapshot", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("risk_snapshot", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["instance_id"], ["bot_instances.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["exchange_id"], ["exchanges.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["strategy_id"], ["bot_strategies.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("instance_id", "cycle_key", name="uq_bot_runs_instance_cycle"),
    )
    op.create_index("ix_bot_runs_instance_status", "bot_runs", ["instance_id", "status"])
    op.create_index("ix_bot_runs_org_created", "bot_runs", ["organization_id", "created_at"])

    op.create_table(
        "bot_signals",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("instance_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("exchange_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("strategy_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", bot_signal_action, nullable=False),
        sa.Column("status", bot_signal_status, nullable=False, server_default=sa.text("'GENERATED'")),
        sa.Column("symbol", sa.String(length=40), nullable=True),
        sa.Column("confidence", sa.Numeric(8, 4), nullable=True),
        sa.Column("price_usd", sa.Numeric(24, 12), nullable=True),
        sa.Column("quantity", sa.Numeric(32, 18), nullable=True),
        sa.Column("notional_usd", sa.Numeric(24, 2), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("input_snapshot", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("risk_snapshot", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["instance_id"], ["bot_instances.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["run_id"], ["bot_runs.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["exchange_id"], ["exchanges.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["strategy_id"], ["bot_strategies.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_bot_signals_instance_created", "bot_signals", ["instance_id", "created_at"])
    op.create_index("ix_bot_signals_org_status", "bot_signals", ["organization_id", "status"])

    op.create_table(
        "bot_backtests",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("strategy_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("template_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("symbol", sa.String(length=40), nullable=False),
        sa.Column("timeframe", sa.String(length=40), nullable=False, server_default=sa.text("'1d'")),
        sa.Column("status", bot_backtest_status, nullable=False, server_default=sa.text("'RUNNING'")),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("initial_capital_usd", sa.Numeric(24, 2), nullable=False),
        sa.Column("result_summary", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("metrics", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("logs", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["strategy_id"], ["bot_strategies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["template_id"], ["bot_templates.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_bot_backtests_strategy_created", "bot_backtests", ["strategy_id", "created_at"])

    op.execute(
        """
        INSERT INTO role_permissions (id, role_id, permission_key)
        SELECT gen_random_uuid(), r.id, p.permission_key
        FROM roles r
        CROSS JOIN (
            VALUES
                ('strategies:view'),
                ('strategies:create'),
                ('strategies:edit'),
                ('strategies:backtest'),
                ('bots:run')
        ) AS p(permission_key)
        WHERE r.is_system = true
          AND r.name IN ('owner', 'admin', 'manager')
        ON CONFLICT (role_id, permission_key) DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO role_permissions (id, role_id, permission_key)
        SELECT gen_random_uuid(), r.id, p.permission_key
        FROM roles r
        CROSS JOIN (
            VALUES
                ('strategies:view')
        ) AS p(permission_key)
        WHERE r.is_system = true
          AND r.name = 'viewer'
        ON CONFLICT (role_id, permission_key) DO NOTHING
        """
    )

    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'connectcoin_app') THEN
                GRANT SELECT, INSERT, UPDATE, DELETE ON bot_strategies TO connectcoin_app;
                GRANT SELECT, INSERT, UPDATE, DELETE ON bot_runs TO connectcoin_app;
                GRANT SELECT, INSERT, UPDATE, DELETE ON bot_signals TO connectcoin_app;
                GRANT SELECT, INSERT, UPDATE, DELETE ON bot_backtests TO connectcoin_app;
                GRANT USAGE ON TYPE botstrategystatus TO connectcoin_app;
                GRANT USAGE ON TYPE botrunstatus TO connectcoin_app;
                GRANT USAGE ON TYPE botsignalaction TO connectcoin_app;
                GRANT USAGE ON TYPE botsignalstatus TO connectcoin_app;
                GRANT USAGE ON TYPE botbackteststatus TO connectcoin_app;
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM role_permissions
        WHERE permission_key IN (
            'strategies:view',
            'strategies:create',
            'strategies:edit',
            'strategies:backtest',
            'bots:run'
        )
        """
    )
    op.drop_index("ix_bot_backtests_strategy_created", table_name="bot_backtests")
    op.drop_table("bot_backtests")
    op.drop_index("ix_bot_signals_org_status", table_name="bot_signals")
    op.drop_index("ix_bot_signals_instance_created", table_name="bot_signals")
    op.drop_table("bot_signals")
    op.drop_index("ix_bot_runs_org_created", table_name="bot_runs")
    op.drop_index("ix_bot_runs_instance_status", table_name="bot_runs")
    op.drop_table("bot_runs")
    op.drop_index("ix_bot_instances_strategy_id", table_name="bot_instances")
    op.drop_constraint("fk_bot_instances_strategy_id", "bot_instances", type_="foreignkey")
    op.drop_column("bot_instances", "last_run_at")
    op.drop_column("bot_instances", "risk_config")
    op.drop_column("bot_instances", "live_enabled")
    op.drop_column("bot_instances", "strategy_id")
    op.drop_index("ix_bot_templates_strategy_id", table_name="bot_templates")
    op.drop_constraint("fk_bot_templates_strategy_id", "bot_templates", type_="foreignkey")
    op.drop_column("bot_templates", "strategy_id")
    op.drop_index("ix_bot_strategies_type", table_name="bot_strategies")
    op.drop_index("ix_bot_strategies_status", table_name="bot_strategies")
    op.drop_table("bot_strategies")
    op.execute("DROP TYPE IF EXISTS botbackteststatus")
    op.execute("DROP TYPE IF EXISTS botsignalstatus")
    op.execute("DROP TYPE IF EXISTS botsignalaction")
    op.execute("DROP TYPE IF EXISTS botrunstatus")
    op.execute("DROP TYPE IF EXISTS botstrategystatus")
