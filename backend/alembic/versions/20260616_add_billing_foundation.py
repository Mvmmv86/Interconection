"""Add billing foundation tables.

Revision ID: c7e2b4f1a9d8
Revises: f7c2a1b8d9e0
Create Date: 2026-06-16 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "c7e2b4f1a9d8"
down_revision: Union[str, None] = "f7c2a1b8d9e0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


billing_provider = postgresql.ENUM(
    "MANUAL",
    "STRIPE",
    "MERCADO_PAGO",
    "ASAAS",
    name="billingprovider",
    create_type=False,
)
billing_subscription_status = postgresql.ENUM(
    "TRIALING",
    "ACTIVE",
    "PAST_DUE",
    "CANCELED",
    "UNPAID",
    name="billingsubscriptionstatus",
    create_type=False,
)
billing_invoice_status = postgresql.ENUM(
    "DRAFT",
    "OPEN",
    "PAID",
    "VOID",
    "UNCOLLECTIBLE",
    "OVERDUE",
    name="billinginvoicestatus",
    create_type=False,
)
billing_payment_status = postgresql.ENUM(
    "PENDING",
    "SUCCEEDED",
    "FAILED",
    "REFUNDED",
    name="billingpaymentstatus",
    create_type=False,
)
plan_type = postgresql.ENUM(
    "FREE",
    "PRO",
    "ENTERPRISE",
    name="plantype",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    billing_provider.create(bind, checkfirst=True)
    billing_subscription_status.create(bind, checkfirst=True)
    billing_invoice_status.create(bind, checkfirst=True)
    billing_payment_status.create(bind, checkfirst=True)

    op.create_table(
        "billing_subscriptions",
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("plan", plan_type, nullable=False),
        sa.Column("status", billing_subscription_status, nullable=False),
        sa.Column("provider", billing_provider, nullable=False),
        sa.Column("billing_email", sa.String(length=255), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("monthly_amount_cents", sa.Integer(), nullable=False),
        sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("trial_ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancel_at_period_end", sa.Boolean(), nullable=False),
        sa.Column("provider_customer_id", sa.String(length=255), nullable=True),
        sa.Column("provider_subscription_id", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", name="uq_billing_subscriptions_org"),
    )
    op.create_index("ix_billing_subscriptions_plan", "billing_subscriptions", ["plan"])
    op.create_index("ix_billing_subscriptions_status", "billing_subscriptions", ["status"])

    op.create_table(
        "billing_invoices",
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("subscription_id", sa.UUID(), nullable=True),
        sa.Column("status", billing_invoice_status, nullable=False),
        sa.Column("provider", billing_provider, nullable=False),
        sa.Column("number", sa.String(length=64), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("amount_due_cents", sa.Integer(), nullable=False),
        sa.Column("amount_paid_cents", sa.Integer(), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("provider_invoice_id", sa.String(length=255), nullable=True),
        sa.Column("hosted_invoice_url", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["subscription_id"], ["billing_subscriptions.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("number", name="uq_billing_invoices_number"),
    )
    op.create_index("ix_billing_invoices_due_date", "billing_invoices", ["due_date"])
    op.create_index("ix_billing_invoices_org_status", "billing_invoices", ["organization_id", "status"])

    op.create_table(
        "billing_payments",
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("invoice_id", sa.UUID(), nullable=True),
        sa.Column("provider", billing_provider, nullable=False),
        sa.Column("status", billing_payment_status, nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("provider_payment_id", sa.String(length=255), nullable=True),
        sa.Column("external_reference", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["invoice_id"], ["billing_invoices.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_billing_payments_org_status", "billing_payments", ["organization_id", "status"])
    op.create_index("ix_billing_payments_paid_at", "billing_payments", ["paid_at"])

    op.execute(
        sa.text(
            """
            INSERT INTO billing_subscriptions (
                id,
                organization_id,
                plan,
                status,
                provider,
                billing_email,
                currency,
                monthly_amount_cents,
                cancel_at_period_end,
                created_at,
                updated_at
            )
            SELECT
                gen_random_uuid(),
                o.id,
                o.plan,
                'ACTIVE',
                'MANUAL',
                owner_user.email,
                'BRL',
                CASE
                    WHEN o.plan = 'PRO' THEN 9900
                    ELSE 0
                END,
                false,
                now(),
                now()
            FROM organizations o
            LEFT JOIN LATERAL (
                SELECT u.email
                FROM memberships m
                JOIN users u ON u.id = m.user_id
                JOIN roles r ON r.id = m.role_id
                WHERE m.organization_id = o.id
                  AND m.status = 'ACTIVE'
                  AND r.name IN ('owner', 'admin')
                ORDER BY r.name = 'owner' DESC, m.created_at ASC
                LIMIT 1
            ) owner_user ON true
            ON CONFLICT (organization_id) DO NOTHING
            """
        )
    )

    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'connectcoin_app') THEN
                GRANT SELECT, INSERT, UPDATE, DELETE ON billing_subscriptions TO connectcoin_app;
                GRANT SELECT, INSERT, UPDATE, DELETE ON billing_invoices TO connectcoin_app;
                GRANT SELECT, INSERT, UPDATE, DELETE ON billing_payments TO connectcoin_app;
                GRANT USAGE ON TYPE billingprovider TO connectcoin_app;
                GRANT USAGE ON TYPE billingsubscriptionstatus TO connectcoin_app;
                GRANT USAGE ON TYPE billinginvoicestatus TO connectcoin_app;
                GRANT USAGE ON TYPE billingpaymentstatus TO connectcoin_app;
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.drop_index("ix_billing_payments_paid_at", table_name="billing_payments")
    op.drop_index("ix_billing_payments_org_status", table_name="billing_payments")
    op.drop_table("billing_payments")
    op.drop_index("ix_billing_invoices_org_status", table_name="billing_invoices")
    op.drop_index("ix_billing_invoices_due_date", table_name="billing_invoices")
    op.drop_table("billing_invoices")
    op.drop_index("ix_billing_subscriptions_status", table_name="billing_subscriptions")
    op.drop_index("ix_billing_subscriptions_plan", table_name="billing_subscriptions")
    op.drop_table("billing_subscriptions")

    bind = op.get_bind()
    billing_payment_status.drop(bind, checkfirst=True)
    billing_invoice_status.drop(bind, checkfirst=True)
    billing_subscription_status.drop(bind, checkfirst=True)
    billing_provider.drop(bind, checkfirst=True)
