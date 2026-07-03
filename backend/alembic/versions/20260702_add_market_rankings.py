"""add market rankings for bot scanner

Revision ID: a6b7c8d9e0f1
Revises: f5a6b7c8d9e0
Create Date: 2026-07-02 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "a6b7c8d9e0f1"
down_revision = "f5a6b7c8d9e0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "market_candles",
        sa.Column("market_type", sa.String(length=24), nullable=False, server_default=sa.text("'spot'")),
    )
    op.drop_constraint(
        "uq_market_candles_exchange_symbol_timeframe_open",
        "market_candles",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_market_candles_exchange_symbol_market_timeframe_open",
        "market_candles",
        ["exchange", "symbol", "market_type", "timeframe", "open_time"],
    )
    op.create_index(
        "ix_market_candles_exchange_market_timeframe_close",
        "market_candles",
        ["exchange", "market_type", "timeframe", "close_time"],
    )

    op.create_table(
        "market_ranking_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False, server_default=sa.text("'market_candles'")),
        sa.Column("exchange", sa.String(length=32), nullable=False),
        sa.Column("market_type", sa.String(length=24), nullable=False, server_default=sa.text("'spot'")),
        sa.Column("timeframe", sa.String(length=16), nullable=False),
        sa.Column("source_timeframe", sa.String(length=16), nullable=False, server_default=sa.text("'1h'")),
        sa.Column("direction", sa.String(length=16), nullable=False),
        sa.Column("metric", sa.String(length=40), nullable=False, server_default=sa.text("'price_change_percent'")),
        sa.Column("top_n", sa.Integer(), nullable=False, server_default=sa.text("10")),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("candle_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_market_ranking_snapshots_lookup",
        "market_ranking_snapshots",
        ["exchange", "market_type", "timeframe", "direction", "generated_at"],
    )

    op.create_table(
        "market_ranking_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("snapshot_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.Column("symbol", sa.String(length=40), nullable=False),
        sa.Column("base_asset", sa.String(length=24), nullable=False),
        sa.Column("quote_asset", sa.String(length=24), nullable=False, server_default=sa.text("'USDT'")),
        sa.Column("price", sa.Numeric(28, 12), nullable=False),
        sa.Column("change_percent", sa.Numeric(18, 8), nullable=False),
        sa.Column("volume", sa.Numeric(32, 12), nullable=False, server_default=sa.text("0")),
        sa.Column("quote_volume", sa.Numeric(32, 12), nullable=False, server_default=sa.text("0")),
        sa.Column("market_cap", sa.Numeric(32, 2), nullable=True),
        sa.Column("candle_close_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("raw_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["snapshot_id"], ["market_ranking_snapshots.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("snapshot_id", "rank", name="uq_market_ranking_items_snapshot_rank"),
        sa.UniqueConstraint("snapshot_id", "symbol", name="uq_market_ranking_items_snapshot_symbol"),
    )
    op.create_index(
        "ix_market_ranking_items_snapshot_rank",
        "market_ranking_items",
        ["snapshot_id", "rank"],
    )
    op.create_index("ix_market_ranking_items_symbol", "market_ranking_items", ["symbol"])

    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'connectcoin_app') THEN
                GRANT SELECT, INSERT, UPDATE, DELETE ON market_candles TO connectcoin_app;
                GRANT SELECT, INSERT, UPDATE, DELETE ON market_ranking_snapshots TO connectcoin_app;
                GRANT SELECT, INSERT, UPDATE, DELETE ON market_ranking_items TO connectcoin_app;
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM market_candles
                GROUP BY exchange, symbol, timeframe, open_time
                HAVING COUNT(*) > 1
            ) THEN
                RAISE EXCEPTION 'Downgrade blocked: market_candles has spot/futures rows that collide without market_type';
            END IF;
        END $$;
        """
    )

    op.drop_index("ix_market_ranking_items_symbol", table_name="market_ranking_items")
    op.drop_index("ix_market_ranking_items_snapshot_rank", table_name="market_ranking_items")
    op.drop_table("market_ranking_items")
    op.drop_index("ix_market_ranking_snapshots_lookup", table_name="market_ranking_snapshots")
    op.drop_table("market_ranking_snapshots")

    op.drop_index("ix_market_candles_exchange_market_timeframe_close", table_name="market_candles")
    op.drop_constraint(
        "uq_market_candles_exchange_symbol_market_timeframe_open",
        "market_candles",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_market_candles_exchange_symbol_timeframe_open",
        "market_candles",
        ["exchange", "symbol", "timeframe", "open_time"],
    )
    op.drop_column("market_candles", "market_type")
