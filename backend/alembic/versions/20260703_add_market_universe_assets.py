"""add market universe assets for bot scanner

Revision ID: b7c8d9e0f1a2
Revises: a6b7c8d9e0f1
Create Date: 2026-07-03 00:00:00.000000
"""

from __future__ import annotations

from alembic import op


revision = "b7c8d9e0f1a2"
down_revision = "a6b7c8d9e0f1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS market_universe_assets (
            id UUID PRIMARY KEY,
            exchange VARCHAR(32) NOT NULL,
            market_type VARCHAR(24) NOT NULL DEFAULT 'spot',
            symbol VARCHAR(40) NOT NULL,
            base_asset VARCHAR(24) NOT NULL,
            quote_asset VARCHAR(24) NOT NULL DEFAULT 'USDT',
            display_name VARCHAR(120),
            is_tradeable BOOLEAN NOT NULL DEFAULT true,
            status VARCHAR(32) NOT NULL DEFAULT 'active',
            last_price NUMERIC(28, 12),
            quote_volume_24h NUMERIC(32, 12) NOT NULL DEFAULT 0,
            change_1h_percent NUMERIC(18, 8),
            change_24h_percent NUMERIC(18, 8),
            change_7d_percent NUMERIC(18, 8),
            change_30d_percent NUMERIC(18, 8),
            last_seen_at TIMESTAMPTZ,
            raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_market_universe_exchange_market_symbol
                UNIQUE (exchange, market_type, symbol)
        );
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_market_universe_lookup
            ON market_universe_assets (exchange, market_type, quote_asset, is_tradeable);
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_market_universe_symbol
            ON market_universe_assets (symbol);
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'connectcoin_app') THEN
                GRANT SELECT, INSERT, UPDATE, DELETE ON market_universe_assets TO connectcoin_app;
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_market_universe_symbol;")
    op.execute("DROP INDEX IF EXISTS ix_market_universe_lookup;")
    op.execute("DROP TABLE IF EXISTS market_universe_assets;")
