"""Add active status to organizations

Revision ID: a8f2d6c4b9e1
Revises: d4e8f7a9c2b1
Create Date: 2026-06-05 00:00:00.000000+00:00
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "a8f2d6c4b9e1"
down_revision: Union[str, None] = "d4e8f7a9c2b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )


def downgrade() -> None:
    op.drop_column("organizations", "is_active")
