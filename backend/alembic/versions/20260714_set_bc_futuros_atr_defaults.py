"""set BC Futuros ATR stop defaults

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
Create Date: 2026-07-14 11:40:00.000000
"""

from __future__ import annotations

from alembic import op


revision = "e1f2a3b4c5d6"
down_revision = "d0e1f2a3b4c5"
branch_labels = None
depends_on = None


ATR_DEFAULTS_SQL = """
jsonb_build_object(
    'stop_model', 'atr',
    'atr_stop_length', 14,
    'atr_stop_multiplier', 2,
    'atr_stop_buffer_percent', 0.10
)
"""


def upgrade() -> None:
    op.execute(
        f"""
        UPDATE bot_strategies
        SET
            risk_defaults = COALESCE(risk_defaults, '{{}}'::jsonb) || {ATR_DEFAULTS_SQL},
            updated_at = now()
        WHERE slug = 'bc-futuros-trend'
        """
    )

    op.execute(
        f"""
        UPDATE bot_templates
        SET
            default_parameters = COALESCE(default_parameters, '{{}}'::jsonb) || {ATR_DEFAULTS_SQL},
            risk_notes = 'Paper-only long-only. Stop principal padrao: ATR 14 x 2 com buffer de 0.10% abaixo do stop. Position sizing futures, entradas short, leverage e reconciliation serao liberados em fases posteriores.',
            updated_at = now()
        WHERE slug = 'bc-futuros-paper-bot'
        """
    )

    op.execute(
        f"""
        UPDATE bot_instances bi
        SET
            risk_config = COALESCE(bi.risk_config, '{{}}'::jsonb) || {ATR_DEFAULTS_SQL},
            updated_at = now()
        FROM bot_templates bt
        WHERE bi.template_id = bt.id
          AND bt.slug = 'bc-futuros-paper-bot'
          AND (
              bi.strategy_id IS NULL
              OR bi.strategy_id IN (
                  SELECT id FROM bot_strategies WHERE slug = 'bc-futuros-trend'
              )
          )
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE bot_strategies
        SET
            risk_defaults = COALESCE(risk_defaults, '{}'::jsonb)
                || jsonb_build_object('stop_model', 'alpha_trend')
                - 'atr_stop_buffer_percent',
            updated_at = now()
        WHERE slug = 'bc-futuros-trend'
        """
    )

    op.execute(
        """
        UPDATE bot_templates
        SET
            default_parameters = COALESCE(default_parameters, '{}'::jsonb)
                || jsonb_build_object('stop_model', 'alpha_trend')
                - 'atr_stop_buffer_percent',
            risk_notes = 'Paper-only long-only. Position sizing futures, entradas short, leverage e reconciliation serao liberados em fases posteriores.',
            updated_at = now()
        WHERE slug = 'bc-futuros-paper-bot'
        """
    )
