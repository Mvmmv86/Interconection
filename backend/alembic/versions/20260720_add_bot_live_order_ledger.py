"""add bot live order ledger

Revision ID: c1d2e3f4a5b6
Revises: b8c9d0e1f2a3
Create Date: 2026-07-20 12:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "c1d2e3f4a5b6"
down_revision = "b8c9d0e1f2a3"
branch_labels = None
depends_on = None


bot_live_order_status = postgresql.ENUM(
    "PENDING_OPEN",
    "OPEN",
    "PENDING_CLOSE",
    "CLOSED",
    "CANCELLED",
    "REJECTED",
    "FAILED",
    name="botliveorderstatus",
    create_type=False,
)


def upgrade() -> None:
    bot_live_order_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "bot_live_orders",
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("client_id", sa.UUID(), nullable=False),
        sa.Column("instance_id", sa.UUID(), nullable=False),
        sa.Column("strategy_id", sa.UUID(), nullable=True),
        sa.Column("exchange_id", sa.UUID(), nullable=True),
        sa.Column("entry_signal_id", sa.UUID(), nullable=True),
        sa.Column("exit_signal_id", sa.UUID(), nullable=True),
        sa.Column("entry_run_id", sa.UUID(), nullable=True),
        sa.Column("exit_run_id", sa.UUID(), nullable=True),
        sa.Column("symbol", sa.String(length=40), nullable=False),
        sa.Column("side", sa.String(length=16), server_default="long", nullable=False),
        sa.Column("execution_mode", sa.String(length=24), server_default="testnet", nullable=False),
        sa.Column("status", bot_live_order_status, server_default="PENDING_OPEN", nullable=False),
        sa.Column("market_type", sa.String(length=24), server_default="futures", nullable=False),
        sa.Column("exchange_order_id", sa.String(length=160), nullable=True),
        sa.Column("client_order_id", sa.String(length=160), nullable=True),
        sa.Column("quantity", sa.Numeric(32, 18), nullable=True),
        sa.Column("entry_price", sa.Numeric(28, 12), nullable=True),
        sa.Column("exit_price", sa.Numeric(28, 12), nullable=True),
        sa.Column("notional_usd", sa.Numeric(24, 2), nullable=True),
        sa.Column("gross_pnl_usd", sa.Numeric(24, 8), nullable=True),
        sa.Column("fee_usd", sa.Numeric(24, 8), nullable=True),
        sa.Column("slippage_usd", sa.Numeric(24, 8), nullable=True),
        sa.Column("net_pnl_usd", sa.Numeric(24, 8), nullable=True),
        sa.Column("pnl_percent", sa.Numeric(12, 6), nullable=True),
        sa.Column("stop_price", sa.Numeric(28, 12), nullable=True),
        sa.Column("take_profit_price", sa.Numeric(28, 12), nullable=True),
        sa.Column("trailing_stop_price", sa.Numeric(28, 12), nullable=True),
        sa.Column("breakeven_price", sa.Numeric(28, 12), nullable=True),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_reconciled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("close_reason", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("risk_snapshot", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("order_snapshot", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("exchange_payload", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["entry_run_id"], ["bot_runs.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["entry_signal_id"], ["bot_signals.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["exchange_id"], ["exchanges.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["exit_run_id"], ["bot_runs.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["exit_signal_id"], ["bot_signals.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["instance_id"], ["bot_instances.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["strategy_id"], ["bot_strategies.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_bot_live_orders_instance_symbol_status", "bot_live_orders", ["instance_id", "symbol", "status"])
    op.create_index("ix_bot_live_orders_org_status_opened", "bot_live_orders", ["organization_id", "status", "opened_at"])
    op.create_index("ix_bot_live_orders_signal", "bot_live_orders", ["entry_signal_id"])
    op.create_index(
        "uq_bot_live_orders_entry_signal",
        "bot_live_orders",
        ["entry_signal_id"],
        unique=True,
        postgresql_where=sa.text("entry_signal_id IS NOT NULL"),
    )
    op.create_index(
        "uq_bot_live_orders_client_order",
        "bot_live_orders",
        ["organization_id", "client_order_id"],
        unique=True,
        postgresql_where=sa.text("client_order_id IS NOT NULL"),
    )
    op.create_index(
        "uq_bot_live_orders_exchange_order",
        "bot_live_orders",
        ["exchange_id", "exchange_order_id"],
        unique=True,
        postgresql_where=sa.text("exchange_order_id IS NOT NULL"),
    )

    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'connectcoin_app') THEN
                    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE bot_live_orders TO connectcoin_app;
                END IF;
            END $$;
            """
        )
    )


def downgrade() -> None:
    op.drop_index("uq_bot_live_orders_exchange_order", table_name="bot_live_orders")
    op.drop_index("uq_bot_live_orders_client_order", table_name="bot_live_orders")
    op.drop_index("uq_bot_live_orders_entry_signal", table_name="bot_live_orders")
    op.drop_index("ix_bot_live_orders_signal", table_name="bot_live_orders")
    op.drop_index("ix_bot_live_orders_org_status_opened", table_name="bot_live_orders")
    op.drop_index("ix_bot_live_orders_instance_symbol_status", table_name="bot_live_orders")
    op.drop_table("bot_live_orders")
    bot_live_order_status.drop(op.get_bind(), checkfirst=True)
