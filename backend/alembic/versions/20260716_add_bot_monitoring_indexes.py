"""Add indexes for bot monitoring queries.

Revision ID: b8c9d0e1f2a3
Revises: a9b8c7d6e5f4
Create Date: 2026-07-16 18:00:00.000000
"""

from __future__ import annotations

from alembic import op


revision = "b8c9d0e1f2a3"
down_revision = "a9b8c7d6e5f4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_bot_signals_org_instance_symbol_generated",
        "bot_signals",
        ["organization_id", "instance_id", "symbol", "generated_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_bot_signals_org_instance_symbol_generated", table_name="bot_signals")
