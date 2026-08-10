"""add exchange initial balance

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-08-10 15:55:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "d2e3f4a5b6c7"
down_revision = "c1d2e3f4a5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "exchanges",
        sa.Column("initial_balance_usd", sa.Numeric(20, 2), nullable=True),
    )
    op.add_column(
        "exchanges",
        sa.Column("initial_balance_set_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("exchanges", "initial_balance_set_at")
    op.drop_column("exchanges", "initial_balance_usd")
