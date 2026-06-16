"""Platform super-admin schemas."""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from app.models.organization import PlanType
from app.models.billing import (
    BillingInvoiceStatus,
    BillingPaymentStatus,
    BillingProvider,
    BillingSubscriptionStatus,
)
from app.models.user import UserRole
from app.schemas.common import BaseSchema


class AdminOrganizationResponse(BaseSchema):
    """Organization row shown in platform administration."""

    id: UUID
    name: str
    slug: str
    plan: PlanType
    is_active: bool
    user_count: int = 0
    client_count: int = 0
    team_count: int = 0
    created_at: datetime
    updated_at: datetime


class AdminOrganizationUpdate(BaseSchema):
    """Mutable organization fields for platform operators."""

    plan: Optional[PlanType] = None
    is_active: Optional[bool] = None


class AdminOverviewResponse(BaseSchema):
    """Platform-level operational overview."""

    organization_count: int = 0
    active_organization_count: int = 0
    user_count: int = 0
    active_user_count: int = 0
    client_count: int = 0
    audit_event_count: int = 0
    bot_count: int = 0
    strategy_count: int = 0
    plan_count: int = 3


class AdminPlanDefinitionResponse(BaseSchema):
    """Static plan definition shown in platform administration."""

    plan: PlanType
    label: str
    limits: dict[str, int | None]
    features: list[str] = []


class AdminPlanUsageResponse(BaseSchema):
    """Current usage versus plan limits for one platform customer."""

    organization_id: UUID
    organization_name: str
    plan: PlanType
    usage: dict[str, int]
    limits: dict[str, int | None]
    remaining: dict[str, int | None]
    over_limit: dict[str, bool]


class AdminUserMembershipResponse(BaseSchema):
    """Membership summary for a user in the platform admin."""

    id: UUID
    organization_id: UUID
    organization_name: str
    role_name: str
    status: str
    client_access_mode: str
    team_count: int = 0
    team_names: list[str] = []


class AdminUserResponse(BaseSchema):
    """User row shown in platform administration."""

    id: UUID
    organization_id: Optional[UUID] = None
    email: str
    name: str
    role: UserRole
    is_active: bool
    is_superuser: bool
    token_version: int
    created_at: datetime
    updated_at: datetime
    last_login_at: Optional[datetime] = None
    memberships: list[AdminUserMembershipResponse] = []


class AdminUserUpdate(BaseSchema):
    """Mutable user fields for platform operators."""

    is_active: Optional[bool] = None
    is_superuser: Optional[bool] = None


class AdminClientResponse(BaseSchema):
    """Global client/carteira row shown in platform administration."""

    id: UUID
    organization_id: UUID
    organization_name: str
    name: str
    email: Optional[str] = None
    color: str
    wallet_count: int = 0
    active_wallet_count: int = 0
    exchange_count: int = 0
    active_exchange_count: int = 0
    sync_error_count: int = 0
    team_scope_count: int = 0
    membership_scope_count: int = 0
    last_wallet_scan_at: Optional[datetime] = None
    last_exchange_sync_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class AdminAuditLogResponse(BaseSchema):
    """Global audit log row for platform administration."""

    id: UUID
    organization_id: UUID
    organization_name: Optional[str] = None
    user_id: Optional[UUID] = None
    user_email: Optional[str] = None
    action: str
    resource_type: str
    resource_id: Optional[UUID] = None
    description: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    timestamp: datetime


class AdminFinanceSummaryResponse(BaseSchema):
    """Platform finance summary for super-admins."""

    subscription_count: int = 0
    active_subscription_count: int = 0
    past_due_subscription_count: int = 0
    open_invoice_count: int = 0
    overdue_invoice_count: int = 0
    mrr_cents: int = 0
    open_amount_cents: int = 0
    overdue_amount_cents: int = 0
    paid_amount_30d_cents: int = 0
    currency: str = "BRL"


class AdminBillingSubscriptionResponse(BaseSchema):
    """Billing subscription row for platform finance."""

    id: UUID
    organization_id: UUID
    organization_name: str
    plan: PlanType
    status: str
    provider: str
    billing_email: Optional[str] = None
    currency: str
    monthly_amount_cents: int
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    trial_ends_at: Optional[datetime] = None
    cancel_at_period_end: bool
    provider_customer_id: Optional[str] = None
    provider_subscription_id: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class AdminBillingSubscriptionUpdate(BaseSchema):
    """Mutable billing subscription fields for platform finance."""

    plan: Optional[PlanType] = None
    status: Optional[BillingSubscriptionStatus] = None
    provider: Optional[BillingProvider] = None
    billing_email: Optional[str] = None
    currency: Optional[str] = None
    monthly_amount_cents: Optional[int] = None
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    trial_ends_at: Optional[datetime] = None
    cancel_at_period_end: Optional[bool] = None
    provider_customer_id: Optional[str] = None
    provider_subscription_id: Optional[str] = None
    notes: Optional[str] = None


class AdminBillingInvoiceCreate(BaseSchema):
    """Create a manual invoice for a platform customer."""

    organization_id: UUID
    amount_due_cents: int
    due_date: Optional[datetime] = None
    issued_at: Optional[datetime] = None
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    number: Optional[str] = None
    notes: Optional[str] = None


class AdminBillingInvoiceUpdate(BaseSchema):
    """Mutable invoice fields for platform finance."""

    status: Optional[BillingInvoiceStatus] = None
    number: Optional[str] = None
    amount_due_cents: Optional[int] = None
    issued_at: Optional[datetime] = None
    due_date: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    provider_invoice_id: Optional[str] = None
    hosted_invoice_url: Optional[str] = None
    notes: Optional[str] = None


class AdminBillingInvoiceResponse(BaseSchema):
    """Billing invoice row for platform finance."""

    id: UUID
    organization_id: UUID
    organization_name: str
    subscription_id: Optional[UUID] = None
    status: str
    provider: str
    number: Optional[str] = None
    currency: str
    amount_due_cents: int
    amount_paid_cents: int
    issued_at: Optional[datetime] = None
    due_date: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    provider_invoice_id: Optional[str] = None
    hosted_invoice_url: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class AdminBillingPaymentCreate(BaseSchema):
    """Register a manual payment for an invoice or organization."""

    organization_id: Optional[UUID] = None
    invoice_id: Optional[UUID] = None
    amount_cents: int
    paid_at: Optional[datetime] = None
    provider_payment_id: Optional[str] = None
    external_reference: Optional[str] = None
    notes: Optional[str] = None


class AdminBillingPaymentUpdate(BaseSchema):
    """Mutable payment fields for platform finance."""

    status: Optional[BillingPaymentStatus] = None
    amount_cents: Optional[int] = None
    paid_at: Optional[datetime] = None
    provider_payment_id: Optional[str] = None
    external_reference: Optional[str] = None
    notes: Optional[str] = None


class AdminBillingPaymentResponse(BaseSchema):
    """Billing payment row for platform finance."""

    id: UUID
    organization_id: UUID
    organization_name: str
    invoice_id: Optional[UUID] = None
    provider: str
    status: str
    amount_cents: int
    currency: str
    paid_at: Optional[datetime] = None
    provider_payment_id: Optional[str] = None
    external_reference: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
