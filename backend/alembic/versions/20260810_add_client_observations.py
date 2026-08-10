"""add client observations

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-08-10 16:25:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "e3f4a5b6c7d8"
down_revision = "d2e3f4a5b6c7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "client_observations",
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("client_id", sa.UUID(), nullable=False),
        sa.Column("created_by_user_id", sa.UUID(), nullable=True),
        sa.Column("observed_at", sa.Date(), nullable=False),
        sa.Column("location", sa.String(length=120), nullable=True),
        sa.Column("asset_type", sa.String(length=50), nullable=True),
        sa.Column("asset_symbol", sa.String(length=30), nullable=True),
        sa.Column("amount", sa.Numeric(32, 12), nullable=True),
        sa.Column("value_usd", sa.Numeric(20, 2), nullable=True),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_client_observations_client_date", "client_observations", ["client_id", "observed_at"])
    op.create_index("ix_client_observations_client_id", "client_observations", ["client_id"])
    op.create_index("ix_client_observations_observed_at", "client_observations", ["observed_at"])
    op.create_index("ix_client_observations_organization_id", "client_observations", ["organization_id"])

    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'connectcoin_app') THEN
                    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE client_observations TO connectcoin_app;
                END IF;
            END $$;
            """
        )
    )


def downgrade() -> None:
    op.drop_index("ix_client_observations_organization_id", table_name="client_observations")
    op.drop_index("ix_client_observations_observed_at", table_name="client_observations")
    op.drop_index("ix_client_observations_client_id", table_name="client_observations")
    op.drop_index("ix_client_observations_client_date", table_name="client_observations")
    op.drop_table("client_observations")
