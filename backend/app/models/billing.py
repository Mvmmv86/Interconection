"""Billing models for platform finance operations."""

from datetime import datetime
from typing import TYPE_CHECKING, Optional
from uuid import UUID
import enum

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin
from app.models.organization import PlanType

if TYPE_CHECKING:
    from app.models.organization import Organization


class BillingProvider(str, enum.Enum):
    """Billing provider used by a subscription, invoice or payment."""

    MANUAL = "manual"
    STRIPE = "stripe"
    MERCADO_PAGO = "mercado_pago"
    ASAAS = "asaas"


class BillingSubscriptionStatus(str, enum.Enum):
    """Commercial subscription lifecycle."""

    TRIALING = "trialing"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELED = "canceled"
    UNPAID = "unpaid"


class BillingInvoiceStatus(str, enum.Enum):
    """Invoice lifecycle status."""

    DRAFT = "draft"
    OPEN = "open"
    PAID = "paid"
    VOID = "void"
    UNCOLLECTIBLE = "uncollectible"
    OVERDUE = "overdue"


class BillingPaymentStatus(str, enum.Enum):
    """Payment lifecycle status."""

    PENDING = "pending"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    REFUNDED = "refunded"


class BillingSubscription(Base, UUIDMixin, TimestampMixin):
    """Current commercial subscription for a platform customer."""

    __tablename__ = "billing_subscriptions"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    plan: Mapped[PlanType] = mapped_column(
        SAEnum(PlanType),
        default=PlanType.FREE,
        nullable=False,
    )
    status: Mapped[BillingSubscriptionStatus] = mapped_column(
        SAEnum(BillingSubscriptionStatus),
        default=BillingSubscriptionStatus.ACTIVE,
        nullable=False,
    )
    provider: Mapped[BillingProvider] = mapped_column(
        SAEnum(BillingProvider),
        default=BillingProvider.MANUAL,
        nullable=False,
    )
    billing_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="BRL", nullable=False)
    monthly_amount_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    current_period_start: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    current_period_end: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    trial_ends_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    provider_customer_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    provider_subscription_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="billing_subscription",
    )
    invoices: Mapped[list["BillingInvoice"]] = relationship(
        "BillingInvoice",
        back_populates="subscription",
    )

    __table_args__ = (
        UniqueConstraint("organization_id", name="uq_billing_subscriptions_org"),
        Index("ix_billing_subscriptions_status", "status"),
        Index("ix_billing_subscriptions_plan", "plan"),
    )


class BillingInvoice(Base, UUIDMixin, TimestampMixin):
    """Invoice issued to a platform customer."""

    __tablename__ = "billing_invoices"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    subscription_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("billing_subscriptions.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[BillingInvoiceStatus] = mapped_column(
        SAEnum(BillingInvoiceStatus),
        default=BillingInvoiceStatus.OPEN,
        nullable=False,
    )
    provider: Mapped[BillingProvider] = mapped_column(
        SAEnum(BillingProvider),
        default=BillingProvider.MANUAL,
        nullable=False,
    )
    number: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="BRL", nullable=False)
    amount_due_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    amount_paid_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    issued_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    period_start: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    period_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    provider_invoice_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    hosted_invoice_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="billing_invoices",
    )
    subscription: Mapped[Optional["BillingSubscription"]] = relationship(
        "BillingSubscription",
        back_populates="invoices",
    )
    payments: Mapped[list["BillingPayment"]] = relationship(
        "BillingPayment",
        back_populates="invoice",
    )

    __table_args__ = (
        UniqueConstraint("number", name="uq_billing_invoices_number"),
        Index("ix_billing_invoices_org_status", "organization_id", "status"),
        Index("ix_billing_invoices_due_date", "due_date"),
    )


class BillingPayment(Base, UUIDMixin, TimestampMixin):
    """Payment attempt or settlement for an invoice."""

    __tablename__ = "billing_payments"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    invoice_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("billing_invoices.id", ondelete="SET NULL"),
        nullable=True,
    )
    provider: Mapped[BillingProvider] = mapped_column(
        SAEnum(BillingProvider),
        default=BillingProvider.MANUAL,
        nullable=False,
    )
    status: Mapped[BillingPaymentStatus] = mapped_column(
        SAEnum(BillingPaymentStatus),
        default=BillingPaymentStatus.PENDING,
        nullable=False,
    )
    amount_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="BRL", nullable=False)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    provider_payment_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    external_reference: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="billing_payments",
    )
    invoice: Mapped[Optional["BillingInvoice"]] = relationship(
        "BillingInvoice",
        back_populates="payments",
    )

    __table_args__ = (
        Index("ix_billing_payments_org_status", "organization_id", "status"),
        Index("ix_billing_payments_paid_at", "paid_at"),
    )
