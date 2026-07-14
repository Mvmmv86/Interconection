"""set BC Futuros exit protection defaults

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-07-14 12:15:00.000000
"""

from __future__ import annotations

from alembic import op


revision = "f2a3b4c5d6e7"
down_revision = "e1f2a3b4c5d6"
branch_labels = None
depends_on = None


EXIT_DEFAULTS_SQL = """
jsonb_build_object(
    'stop_loss_percent', 3,
    'take_profit_percent', 8,
    'breakeven_activation_percent', 4,
    'trailing_stop_percent', 2
)
"""


def upgrade() -> None:
    op.execute(
        f"""
        UPDATE bot_strategies
        SET
            risk_defaults = COALESCE(risk_defaults, '{{}}'::jsonb) || {EXIT_DEFAULTS_SQL},
            updated_at = now()
        WHERE slug = 'bc-futuros-trend'
        """
    )

    op.execute(
        f"""
        UPDATE bot_templates
        SET
            default_parameters = COALESCE(default_parameters, '{{}}'::jsonb) || {EXIT_DEFAULTS_SQL},
            risk_notes = 'Paper-only long-only. Stop principal padrao: ATR 14 x 2 com buffer de 0.10%, stop loss 3%, take profit 8%, breakeven apos 4% e trailing 2%. Position sizing futures, entradas short, leverage e reconciliation serao liberados em fases posteriores.',
            updated_at = now()
        WHERE slug = 'bc-futuros-paper-bot'
        """
    )

    op.execute(
        """
        UPDATE bot_instances bi
        SET
            risk_config =
                COALESCE(bi.risk_config, '{}'::jsonb)
                || CASE
                    WHEN COALESCE(bi.risk_config, '{}'::jsonb) ? 'stop_loss_percent'
                    THEN '{}'::jsonb
                    ELSE jsonb_build_object('stop_loss_percent', 3)
                END
                || CASE
                    WHEN COALESCE(bi.risk_config, '{}'::jsonb) ? 'take_profit_percent'
                    THEN '{}'::jsonb
                    ELSE jsonb_build_object('take_profit_percent', 8)
                END
                || CASE
                    WHEN COALESCE(bi.risk_config, '{}'::jsonb) ? 'breakeven_activation_percent'
                    THEN '{}'::jsonb
                    ELSE jsonb_build_object('breakeven_activation_percent', 4)
                END
                || CASE
                    WHEN COALESCE(bi.risk_config, '{}'::jsonb) ? 'trailing_stop_percent'
                    THEN '{}'::jsonb
                    ELSE jsonb_build_object('trailing_stop_percent', 2)
                END,
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
                - 'stop_loss_percent'
                - 'take_profit_percent'
                - 'breakeven_activation_percent'
                - 'trailing_stop_percent',
            updated_at = now()
        WHERE slug = 'bc-futuros-trend'
        """
    )

    op.execute(
        """
        UPDATE bot_templates
        SET
            default_parameters = COALESCE(default_parameters, '{}'::jsonb)
                - 'stop_loss_percent'
                - 'take_profit_percent'
                - 'breakeven_activation_percent'
                - 'trailing_stop_percent',
            risk_notes = 'Paper-only long-only. Stop principal padrao: ATR 14 x 2 com buffer de 0.10% abaixo do stop. Position sizing futures, entradas short, leverage e reconciliation serao liberados em fases posteriores.',
            updated_at = now()
        WHERE slug = 'bc-futuros-paper-bot'
        """
    )

    op.execute(
        """
        UPDATE bot_instances bi
        SET
            risk_config = COALESCE(bi.risk_config, '{}'::jsonb)
                - 'stop_loss_percent'
                - 'take_profit_percent'
                - 'breakeven_activation_percent'
                - 'trailing_stop_percent',
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
