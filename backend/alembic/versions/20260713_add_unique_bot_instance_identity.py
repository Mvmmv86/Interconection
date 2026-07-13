"""add unique active bot instance identity

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-07-13 00:00:00.000000
"""

from __future__ import annotations

from alembic import op


revision = "d0e1f2a3b4c5"
down_revision = "c9d0e1f2a3b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Preserve the most recently touched active paper instance for each
    # operational identity and soft-disable older duplicates. This keeps
    # historical runs/signals/backtests available while allowing the unique
    # index to protect future concurrent activations.
    op.execute(
        """
        WITH ranked AS (
            SELECT
                id,
                row_number() OVER (
                    PARTITION BY
                        organization_id,
                        client_id,
                        template_id,
                        exchange_id,
                        strategy_id,
                        mode,
                        live_enabled
                    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
                ) AS rn
            FROM bot_instances
            WHERE status <> 'DISABLED'
              AND live_enabled = false
        )
        UPDATE bot_instances bi
        SET
            status = 'DISABLED',
            disabled_at = COALESCE(bi.disabled_at, now()),
            last_error = COALESCE(
                bi.last_error,
                'Disabled by migration d0e1f2a3b4c5: duplicate active bot instance identity'
            )
        FROM ranked
        WHERE bi.id = ranked.id
          AND ranked.rn > 1
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_bot_instances_active_identity
        ON bot_instances (
            organization_id,
            client_id,
            template_id,
            exchange_id,
            strategy_id,
            mode,
            live_enabled
        ) NULLS NOT DISTINCT
        WHERE status <> 'DISABLED'
          AND live_enabled = false
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_bot_instances_active_identity")
