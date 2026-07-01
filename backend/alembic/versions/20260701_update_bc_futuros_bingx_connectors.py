"""update BC Futuros bot connectors to BingX

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Create Date: 2026-07-01 00:00:00.000000
"""

from __future__ import annotations

from alembic import op


revision = "e4f5a6b7c8d9"
down_revision = "d3e4f5a6b7c8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE bot_strategies
        SET
            market_config = jsonb_set(
                COALESCE(market_config, '{}'::jsonb),
                '{supported_exchanges}',
                '["bybit", "bingx"]'::jsonb,
                true
            ),
            updated_at = now()
        WHERE slug = 'bc-futuros-trend'
        """
    )
    op.execute(
        """
        UPDATE bot_templates
        SET
            supported_exchanges = '["bybit", "bingx"]'::jsonb,
            risk_notes = 'Paper-only long-only. Use conexoes Bybit ou BingX; position sizing futures, entradas short, leverage e reconciliation serao liberados em fases posteriores.',
            updated_at = now()
        WHERE slug = 'bc-futuros-paper-bot'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE bot_strategies
        SET
            market_config = jsonb_set(
                COALESCE(market_config, '{}'::jsonb),
                '{supported_exchanges}',
                '["bybit", "binance"]'::jsonb,
                true
            ),
            updated_at = now()
        WHERE slug = 'bc-futuros-trend'
        """
    )
    op.execute(
        """
        UPDATE bot_templates
        SET
            supported_exchanges = '["bybit", "binance"]'::jsonb,
            risk_notes = 'Paper-only long-only. Position sizing futures, entradas short, leverage e reconciliation serao liberados em fases posteriores.',
            updated_at = now()
        WHERE slug = 'bc-futuros-paper-bot'
        """
    )
