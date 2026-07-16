"""Add per-instance bot asset curation.

Revision ID: a9b8c7d6e5f4
Revises: f2a3b4c5d6e7
Create Date: 2026-07-16 10:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "a9b8c7d6e5f4"
down_revision = "f2a3b4c5d6e7"
branch_labels = None
depends_on = None


SOURCE_ENUM = "botinstanceassetsource"
BUCKET_ENUM = "botinstanceassetbucket"
PLAYBOOK_ENUM = "botinstanceassetplaybook"
STATUS_ENUM = "botinstanceassetstatus"


def upgrade() -> None:
    bind = op.get_bind()

    source_enum = postgresql.ENUM("SCANNER", "MANUAL", "STATIC", name=SOURCE_ENUM)
    bucket_enum = postgresql.ENUM("GAINER", "LOSER", "NEUTRAL", name=BUCKET_ENUM)
    playbook_enum = postgresql.ENUM("REVERSAL", "PULLBACK", "CONTINUATION", "NEUTRAL", name=PLAYBOOK_ENUM)
    status_enum = postgresql.ENUM("CANDIDATE", "APPROVED", "IGNORED", "DISABLED", name=STATUS_ENUM)

    source_enum.create(bind, checkfirst=True)
    bucket_enum.create(bind, checkfirst=True)
    playbook_enum.create(bind, checkfirst=True)
    status_enum.create(bind, checkfirst=True)

    op.create_table(
        "bot_instance_assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("instance_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("symbol", sa.String(length=40), nullable=False),
        sa.Column("source", sa.Enum("SCANNER", "MANUAL", "STATIC", name=SOURCE_ENUM), server_default="SCANNER", nullable=False),
        sa.Column("bucket", sa.Enum("GAINER", "LOSER", "NEUTRAL", name=BUCKET_ENUM), server_default="NEUTRAL", nullable=False),
        sa.Column(
            "playbook",
            sa.Enum("REVERSAL", "PULLBACK", "CONTINUATION", "NEUTRAL", name=PLAYBOOK_ENUM),
            server_default="NEUTRAL",
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum("CANDIDATE", "APPROVED", "IGNORED", "DISABLED", name=STATUS_ENUM),
            server_default="CANDIDATE",
            nullable=False,
        ),
        sa.Column("approved_for_live", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("origin_rank", sa.Integer(), nullable=True),
        sa.Column("origin_timeframe", sa.String(length=20), nullable=True),
        sa.Column("origin_direction", sa.String(length=20), nullable=True),
        sa.Column("performance_percent", sa.Numeric(18, 8), nullable=True),
        sa.Column("snapshot_id", sa.String(length=80), nullable=True),
        sa.Column("last_backtest_run_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("last_backtest_score", sa.Numeric(12, 4), nullable=True),
        sa.Column("approved_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ignored_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["approved_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["instance_id"], ["bot_instances.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["last_backtest_run_id"], ["bot_backtest_runs.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("instance_id", "symbol", name="uq_bot_instance_assets_instance_symbol"),
    )
    op.create_index("ix_bot_instance_assets_org_instance", "bot_instance_assets", ["organization_id", "instance_id"])
    op.create_index("ix_bot_instance_assets_instance_status", "bot_instance_assets", ["instance_id", "status"])
    op.create_index("ix_bot_instance_assets_org_status", "bot_instance_assets", ["organization_id", "status"])

    op.execute(
        """
        INSERT INTO bot_instance_assets (
            id,
            organization_id,
            instance_id,
            symbol,
            source,
            bucket,
            playbook,
            status,
            approved_for_live,
            metadata_json,
            created_at,
            updated_at
        )
        SELECT
            gen_random_uuid(),
            bi.organization_id,
            bi.id,
            upper(trim(symbol_value)),
            'MANUAL',
            'NEUTRAL',
            'NEUTRAL',
            'CANDIDATE',
            false,
            jsonb_build_object('backfilled_from', 'risk_config.allowed_symbols'),
            now(),
            now()
        FROM bot_instances bi
        CROSS JOIN LATERAL jsonb_array_elements_text(
            CASE
                WHEN jsonb_typeof(bi.risk_config -> 'allowed_symbols') = 'array'
                THEN bi.risk_config -> 'allowed_symbols'
                ELSE '[]'::jsonb
            END
        ) AS symbol_value
        WHERE trim(symbol_value) <> ''
        ON CONFLICT (instance_id, symbol) DO NOTHING
        """
    )

    op.execute(
        """
        INSERT INTO bot_instance_assets (
            id,
            organization_id,
            instance_id,
            symbol,
            source,
            bucket,
            playbook,
            status,
            approved_for_live,
            origin_rank,
            origin_timeframe,
            origin_direction,
            metadata_json,
            created_at,
            updated_at
        )
        SELECT
            gen_random_uuid(),
            bi.organization_id,
            bi.id,
            upper(trim(symbol_value)),
            CASE
                WHEN coalesce(bi.risk_config #>> '{active_basket,source}', '') = 'manual'
                THEN 'MANUAL'
                ELSE 'SCANNER'
            END,
            'NEUTRAL',
            'NEUTRAL',
            'CANDIDATE',
            false,
            row_number() OVER (PARTITION BY bi.id ORDER BY symbol_value),
            nullif(bi.risk_config #>> '{active_basket,timeframe}', ''),
            null,
            jsonb_build_object('backfilled_from', 'risk_config.active_basket.symbols'),
            now(),
            now()
        FROM bot_instances bi
        CROSS JOIN LATERAL jsonb_array_elements_text(
            CASE
                WHEN jsonb_typeof(bi.risk_config #> '{active_basket,symbols}') = 'array'
                THEN bi.risk_config #> '{active_basket,symbols}'
                ELSE '[]'::jsonb
            END
        ) AS symbol_value
        WHERE trim(symbol_value) <> ''
        ON CONFLICT (instance_id, symbol) DO NOTHING
        """
    )

    op.execute(
        """
        WITH leg_symbols AS (
            SELECT
                bi.organization_id,
                bi.id AS instance_id,
                upper(trim(symbol_value)) AS symbol,
                lower(coalesce(leg ->> 'direction', '')) AS direction,
                row_number() OVER (
                    PARTITION BY bi.id, lower(coalesce(leg ->> 'direction', ''))
                    ORDER BY symbol_value
                ) AS rank_in_leg
            FROM bot_instances bi
            CROSS JOIN LATERAL jsonb_array_elements(
                CASE
                    WHEN jsonb_typeof(bi.risk_config #> '{active_basket,legs}') = 'array'
                    THEN bi.risk_config #> '{active_basket,legs}'
                    ELSE '[]'::jsonb
                END
            ) AS leg
            CROSS JOIN LATERAL jsonb_array_elements_text(
                CASE
                    WHEN jsonb_typeof(leg -> 'symbols') = 'array'
                    THEN leg -> 'symbols'
                    ELSE '[]'::jsonb
                END
            ) AS symbol_value
            WHERE trim(symbol_value) <> ''
        )
        INSERT INTO bot_instance_assets (
            id,
            organization_id,
            instance_id,
            symbol,
            source,
            bucket,
            playbook,
            status,
            approved_for_live,
            origin_rank,
            origin_direction,
            metadata_json,
            created_at,
            updated_at
        )
        SELECT
            gen_random_uuid(),
            organization_id,
            instance_id,
            symbol,
            'SCANNER',
            CASE WHEN direction = 'losers' THEN 'LOSER' WHEN direction = 'gainers' THEN 'GAINER' ELSE 'NEUTRAL' END,
            CASE WHEN direction = 'losers' THEN 'REVERSAL' WHEN direction = 'gainers' THEN 'PULLBACK' ELSE 'NEUTRAL' END,
            'CANDIDATE',
            false,
            rank_in_leg,
            nullif(direction, ''),
            jsonb_build_object('backfilled_from', 'risk_config.active_basket.legs'),
            now(),
            now()
        FROM leg_symbols
        ON CONFLICT (instance_id, symbol) DO UPDATE SET
            source = EXCLUDED.source,
            bucket = EXCLUDED.bucket,
            playbook = CASE
                WHEN bot_instance_assets.status = 'CANDIDATE' THEN EXCLUDED.playbook
                ELSE bot_instance_assets.playbook
            END,
            origin_rank = EXCLUDED.origin_rank,
            origin_direction = EXCLUDED.origin_direction,
            metadata_json = bot_instance_assets.metadata_json || EXCLUDED.metadata_json,
            updated_at = now()
        """
    )

    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'connectcoin_app') THEN
                GRANT SELECT, INSERT, UPDATE, DELETE ON bot_instance_assets TO connectcoin_app;
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.drop_index("ix_bot_instance_assets_org_status", table_name="bot_instance_assets")
    op.drop_index("ix_bot_instance_assets_instance_status", table_name="bot_instance_assets")
    op.drop_index("ix_bot_instance_assets_org_instance", table_name="bot_instance_assets")
    op.drop_table("bot_instance_assets")

    bind = op.get_bind()
    postgresql.ENUM(name=STATUS_ENUM).drop(bind, checkfirst=True)
    postgresql.ENUM(name=PLAYBOOK_ENUM).drop(bind, checkfirst=True)
    postgresql.ENUM(name=BUCKET_ENUM).drop(bind, checkfirst=True)
    postgresql.ENUM(name=SOURCE_ENUM).drop(bind, checkfirst=True)
