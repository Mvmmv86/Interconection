"""add market candles for bot scheduler

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d9
Create Date: 2026-07-02 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "f5a6b7c8d9e0"
down_revision = "e4f5a6b7c8d9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "market_candles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("exchange", sa.String(length=32), nullable=False),
        sa.Column("symbol", sa.String(length=40), nullable=False),
        sa.Column("timeframe", sa.String(length=16), nullable=False),
        sa.Column("open_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("close_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("open", sa.Numeric(28, 12), nullable=False),
        sa.Column("high", sa.Numeric(28, 12), nullable=False),
        sa.Column("low", sa.Numeric(28, 12), nullable=False),
        sa.Column("close", sa.Numeric(28, 12), nullable=False),
        sa.Column("volume", sa.Numeric(32, 12), nullable=False, server_default=sa.text("0")),
        sa.Column("quote_volume", sa.Numeric(32, 12), nullable=False, server_default=sa.text("0")),
        sa.Column("trade_count", sa.Integer(), nullable=True),
        sa.Column("is_closed", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("source", sa.String(length=32), nullable=False, server_default=sa.text("'exchange'")),
        sa.Column("raw_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "exchange",
            "symbol",
            "timeframe",
            "open_time",
            name="uq_market_candles_exchange_symbol_timeframe_open",
        ),
    )
    op.create_index(
        "ix_market_candles_symbol_timeframe_close",
        "market_candles",
        ["symbol", "timeframe", "close_time"],
    )
    op.create_index(
        "ix_market_candles_exchange_timeframe_close",
        "market_candles",
        ["exchange", "timeframe", "close_time"],
    )

    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'connectcoin_app') THEN
                GRANT SELECT, INSERT, UPDATE, DELETE ON market_candles TO connectcoin_app;
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.drop_index("ix_market_candles_exchange_timeframe_close", table_name="market_candles")
    op.drop_index("ix_market_candles_symbol_timeframe_close", table_name="market_candles")
    op.drop_table("market_candles")
