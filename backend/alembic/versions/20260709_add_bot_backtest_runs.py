"""add instance scoped bot backtest runs

Revision ID: c9d0e1f2a3b4
Revises: b7c8d9e0f1a2
Create Date: 2026-07-09 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "c9d0e1f2a3b4"
down_revision = "b7c8d9e0f1a2"
branch_labels = None
depends_on = None


bot_backtest_status = postgresql.ENUM(
    "RUNNING",
    "SUCCEEDED",
    "FAILED",
    name="botbackteststatus",
    create_type=False,
)


def upgrade() -> None:
    op.create_table(
        "bot_backtest_runs",
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("instance_id", sa.UUID(), nullable=False),
        sa.Column("strategy_id", sa.UUID(), nullable=False),
        sa.Column("strategy_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("client_id", sa.UUID(), nullable=False),
        sa.Column("exchange_id", sa.UUID(), nullable=True),
        sa.Column("symbol", sa.String(length=40), nullable=False),
        sa.Column("exchange", sa.String(length=32), nullable=False),
        sa.Column("market_type", sa.String(length=24), server_default="futures", nullable=False),
        sa.Column("timeframe", sa.String(length=16), nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", bot_backtest_status, server_default="RUNNING", nullable=False),
        sa.Column("progress", sa.Numeric(5, 2), server_default="0", nullable=False),
        sa.Column("initial_capital_usd", sa.Numeric(24, 2), nullable=False),
        sa.Column("config_hash", sa.String(length=96), nullable=False),
        sa.Column("config_snapshot", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("strategy_snapshot", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("risk_snapshot", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("cost_snapshot", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("data_quality", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("result_summary", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("metrics", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("equity_curve", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("drawdown_curve", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("diagnostics", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["exchange_id"], ["exchanges.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["instance_id"], ["bot_instances.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["strategy_id"], ["bot_strategies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("config_hash", name="uq_bot_backtest_runs_config_hash"),
    )
    op.create_index("ix_bot_backtest_runs_instance_symbol_created", "bot_backtest_runs", ["instance_id", "symbol", "created_at"])
    op.create_index("ix_bot_backtest_runs_org_created", "bot_backtest_runs", ["organization_id", "created_at"])
    op.create_index("ix_bot_backtest_runs_status", "bot_backtest_runs", ["status"])

    op.create_table(
        "bot_backtest_trades",
        sa.Column("run_id", sa.UUID(), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("instance_id", sa.UUID(), nullable=False),
        sa.Column("symbol", sa.String(length=40), nullable=False),
        sa.Column("side", sa.String(length=16), server_default="long", nullable=False),
        sa.Column("entry_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("exit_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("entry_price", sa.Numeric(28, 12), nullable=False),
        sa.Column("exit_price", sa.Numeric(28, 12), nullable=True),
        sa.Column("quantity", sa.Numeric(32, 18), nullable=False),
        sa.Column("gross_pnl", sa.Numeric(24, 8), server_default="0", nullable=False),
        sa.Column("fee_paid", sa.Numeric(24, 8), server_default="0", nullable=False),
        sa.Column("slippage_paid", sa.Numeric(24, 8), server_default="0", nullable=False),
        sa.Column("net_pnl", sa.Numeric(24, 8), server_default="0", nullable=False),
        sa.Column("return_percent", sa.Numeric(12, 6), server_default="0", nullable=False),
        sa.Column("mae_percent", sa.Numeric(12, 6), server_default="0", nullable=False),
        sa.Column("mfe_percent", sa.Numeric(12, 6), server_default="0", nullable=False),
        sa.Column("entry_reason", sa.Text(), nullable=True),
        sa.Column("exit_reason", sa.Text(), nullable=True),
        sa.Column("bars_held", sa.Integer(), server_default="0", nullable=False),
        sa.Column("raw_payload", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["instance_id"], ["bot_instances.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["run_id"], ["bot_backtest_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_bot_backtest_trades_org_symbol_entry", "bot_backtest_trades", ["organization_id", "symbol", "entry_time"])
    op.create_index("ix_bot_backtest_trades_run_entry", "bot_backtest_trades", ["run_id", "entry_time"])

    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'connectcoin_app') THEN
                    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE bot_backtest_runs, bot_backtest_trades TO connectcoin_app;
                END IF;
            END $$;
            """
        )
    )
    op.execute(
        sa.text(
            """
            INSERT INTO role_permissions (id, role_id, permission_key)
            SELECT gen_random_uuid(), r.id, permission_key
            FROM roles r
            CROSS JOIN (
                VALUES
                    ('bots:backtest'),
                    ('bots:backtest_deep'),
                    ('market_data:ingest'),
                    ('market_data:view')
            ) AS permissions(permission_key)
            WHERE r.is_system = true
              AND r.organization_id IS NULL
              AND r.name IN ('owner', 'admin')
            ON CONFLICT (role_id, permission_key) DO NOTHING
            """
        )
    )
    op.execute(
        sa.text(
            """
            INSERT INTO role_permissions (id, role_id, permission_key)
            SELECT gen_random_uuid(), r.id, permission_key
            FROM roles r
            CROSS JOIN (
                VALUES
                    ('bots:backtest'),
                    ('market_data:view')
            ) AS permissions(permission_key)
            WHERE r.is_system = true
              AND r.organization_id IS NULL
              AND r.name = 'manager'
            ON CONFLICT (role_id, permission_key) DO NOTHING
            """
        )
    )
    op.execute(
        sa.text(
            """
            INSERT INTO role_permissions (id, role_id, permission_key)
            SELECT gen_random_uuid(), r.id, 'market_data:view'
            FROM roles r
            WHERE r.is_system = true
              AND r.organization_id IS NULL
              AND r.name = 'viewer'
            ON CONFLICT (role_id, permission_key) DO NOTHING
            """
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            DELETE FROM role_permissions
            WHERE permission_key IN ('bots:backtest', 'bots:backtest_deep', 'market_data:ingest', 'market_data:view')
            """
        )
    )
    op.drop_index("ix_bot_backtest_trades_run_entry", table_name="bot_backtest_trades")
    op.drop_index("ix_bot_backtest_trades_org_symbol_entry", table_name="bot_backtest_trades")
    op.drop_table("bot_backtest_trades")
    op.drop_index("ix_bot_backtest_runs_status", table_name="bot_backtest_runs")
    op.drop_index("ix_bot_backtest_runs_org_created", table_name="bot_backtest_runs")
    op.drop_index("ix_bot_backtest_runs_instance_symbol_created", table_name="bot_backtest_runs")
    op.drop_table("bot_backtest_runs")
