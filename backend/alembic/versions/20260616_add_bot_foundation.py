"""add bot foundation

Revision ID: b9a7c3d2e6f4
Revises: c7e2b4f1a9d8
Create Date: 2026-06-16 00:00:00.000000
"""

from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b9a7c3d2e6f4"
down_revision: Union[str, None] = "c7e2b4f1a9d8"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    bot_template_status = postgresql.ENUM(
        "DRAFT",
        "PUBLISHED",
        "DISABLED",
        "ARCHIVED",
        name="bottemplatestatus",
        create_type=False,
    )
    bot_template_type = postgresql.ENUM(
        "DCA",
        "GRID",
        "REBALANCE",
        "SIGNAL",
        "ARBITRAGE",
        "CUSTOM",
        name="bottemplatetype",
        create_type=False,
    )
    bot_instance_mode = postgresql.ENUM(
        "PAPER",
        "LIVE",
        name="botinstancemode",
        create_type=False,
    )
    bot_instance_status = postgresql.ENUM(
        "CONFIGURED",
        "ACTIVE",
        "PAUSED",
        "ERROR",
        "DISABLED",
        name="botinstancestatus",
        create_type=False,
    )
    plan_type = postgresql.ENUM(
        "FREE",
        "PRO",
        "ENTERPRISE",
        name="plantype",
        create_type=False,
    )

    bind = op.get_bind()
    bot_template_status.create(bind, checkfirst=True)
    bot_template_type.create(bind, checkfirst=True)
    bot_instance_mode.create(bind, checkfirst=True)
    bot_instance_status.create(bind, checkfirst=True)

    op.create_table(
        "bot_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("type", bot_template_type, nullable=False, server_default=sa.text("'CUSTOM'")),
        sa.Column("status", bot_template_status, nullable=False, server_default=sa.text("'DRAFT'")),
        sa.Column("required_plan", plan_type, nullable=False, server_default=sa.text("'PRO'")),
        sa.Column("requires_trade_permission", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("supported_exchanges", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("supported_assets", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("default_parameters", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("risk_notes", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="uq_bot_templates_slug"),
    )
    op.create_index("ix_bot_templates_status", "bot_templates", ["status"])
    op.create_index("ix_bot_templates_type", "bot_templates", ["type"])
    op.create_index("ix_bot_templates_required_plan", "bot_templates", ["required_plan"])

    op.create_table(
        "bot_template_parameters",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("template_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("key", sa.String(length=80), nullable=False),
        sa.Column("label", sa.String(length=160), nullable=False),
        sa.Column("type", sa.String(length=40), nullable=False, server_default=sa.text("'string'")),
        sa.Column("required", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("default_value", postgresql.JSONB(), nullable=True),
        sa.Column("min_value", sa.String(length=80), nullable=True),
        sa.Column("max_value", sa.String(length=80), nullable=True),
        sa.Column("options", postgresql.JSONB(), nullable=True),
        sa.Column("help_text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["template_id"], ["bot_templates.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("template_id", "key", name="uq_bot_template_parameters_template_key"),
    )
    op.create_index("ix_bot_template_parameters_template_id", "bot_template_parameters", ["template_id"])

    op.create_table(
        "bot_instances",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("template_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("exchange_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("mode", bot_instance_mode, nullable=False, server_default=sa.text("'PAPER'")),
        sa.Column("status", bot_instance_status, nullable=False, server_default=sa.text("'CONFIGURED'")),
        sa.Column("parameters", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("last_heartbeat_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("paused_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("disabled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["template_id"], ["bot_templates.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["exchange_id"], ["exchanges.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_bot_instances_org_status", "bot_instances", ["organization_id", "status"])
    op.create_index("ix_bot_instances_client_id", "bot_instances", ["client_id"])
    op.create_index("ix_bot_instances_exchange_id", "bot_instances", ["exchange_id"])
    op.create_index("ix_bot_instances_template_id", "bot_instances", ["template_id"])

    op.execute(
        """
        INSERT INTO role_permissions (id, role_id, permission_key)
        SELECT gen_random_uuid(), r.id, p.permission_key
        FROM roles r
        CROSS JOIN (
            VALUES
                ('bots:view'),
                -- Reserved for a future tenant-managed bot template flow.
                ('bots:create'),
                ('bots:edit'),
                -- Reserved for a future tenant-managed bot template flow.
                ('bots:delete'),
                ('bots:activate')
        ) AS p(permission_key)
        WHERE r.is_system = true
          AND r.name IN ('owner', 'admin', 'manager')
        ON CONFLICT (role_id, permission_key) DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO role_permissions (id, role_id, permission_key)
        SELECT gen_random_uuid(), r.id, 'bots:view'
        FROM roles r
        WHERE r.is_system = true
          AND r.name = 'viewer'
        ON CONFLICT (role_id, permission_key) DO NOTHING
        """
    )

    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'connectcoin_app') THEN
                GRANT SELECT, INSERT, UPDATE, DELETE ON bot_templates TO connectcoin_app;
                GRANT SELECT, INSERT, UPDATE, DELETE ON bot_template_parameters TO connectcoin_app;
                GRANT SELECT, INSERT, UPDATE, DELETE ON bot_instances TO connectcoin_app;
                GRANT USAGE ON TYPE bottemplatestatus TO connectcoin_app;
                GRANT USAGE ON TYPE bottemplatetype TO connectcoin_app;
                GRANT USAGE ON TYPE botinstancemode TO connectcoin_app;
                GRANT USAGE ON TYPE botinstancestatus TO connectcoin_app;
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM role_permissions WHERE permission_key LIKE 'bots:%'")
    op.drop_index("ix_bot_instances_template_id", table_name="bot_instances")
    op.drop_index("ix_bot_instances_exchange_id", table_name="bot_instances")
    op.drop_index("ix_bot_instances_client_id", table_name="bot_instances")
    op.drop_index("ix_bot_instances_org_status", table_name="bot_instances")
    op.drop_table("bot_instances")
    op.drop_index("ix_bot_template_parameters_template_id", table_name="bot_template_parameters")
    op.drop_table("bot_template_parameters")
    op.drop_index("ix_bot_templates_required_plan", table_name="bot_templates")
    op.drop_index("ix_bot_templates_type", table_name="bot_templates")
    op.drop_index("ix_bot_templates_status", table_name="bot_templates")
    op.drop_table("bot_templates")
    op.execute("DROP TYPE IF EXISTS botinstancestatus")
    op.execute("DROP TYPE IF EXISTS botinstancemode")
    op.execute("DROP TYPE IF EXISTS bottemplatetype")
    op.execute("DROP TYPE IF EXISTS bottemplatestatus")
