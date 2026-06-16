"""Platform super-admin endpoints."""

import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated, List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import distinct, func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, SuperUser, invalidate_authz_cache, require_superuser
from app.models.audit_log import AuditAction, AuditLog
from app.models.billing import (
    BillingInvoice,
    BillingInvoiceStatus,
    BillingPayment,
    BillingPaymentStatus,
    BillingProvider,
    BillingSubscription,
    BillingSubscriptionStatus,
)
from app.models.bot import BotInstance, BotStrategy
from app.models.client import Client
from app.models.exchange import Exchange
from app.models.membership import (
    Membership,
    MembershipClient,
    MembershipStatus,
    Team,
    TeamClient,
)
from app.models.organization import Organization
from app.models.user import User
from app.models.wallet import Wallet
from app.schemas.admin import (
    AdminAuditLogResponse,
    AdminBillingInvoiceResponse,
    AdminBillingInvoiceCreate,
    AdminBillingInvoiceUpdate,
    AdminBillingPaymentResponse,
    AdminBillingPaymentCreate,
    AdminBillingPaymentUpdate,
    AdminBillingSubscriptionResponse,
    AdminBillingSubscriptionUpdate,
    AdminClientResponse,
    AdminFinanceSummaryResponse,
    AdminPlanDefinitionResponse,
    AdminPlanUsageResponse,
    AdminUserMembershipResponse,
    AdminOverviewResponse,
    AdminOrganizationResponse,
    AdminOrganizationUpdate,
    AdminUserResponse,
    AdminUserUpdate,
)
from app.services.audit_service import record_audit_event
from app.services.plan_limits import (
    calculate_over_limit,
    calculate_remaining,
    get_plan_definition,
    get_plan_usage_many,
    list_plan_definitions,
)

router = APIRouter(dependencies=[Depends(require_superuser)])
logger = logging.getLogger(__name__)


def _enum_value(value: object) -> str:
    """Return API-friendly enum values."""
    return value.value if hasattr(value, "value") else str(value)


def _metadata_value(value: object) -> object:
    """Return JSON-safe metadata values for audit logs."""
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    if hasattr(value, "value"):
        return value.value
    return value


def _subscription_response(
    subscription: BillingSubscription,
    organization_name: str,
) -> AdminBillingSubscriptionResponse:
    return AdminBillingSubscriptionResponse(
        id=subscription.id,
        organization_id=subscription.organization_id,
        organization_name=organization_name,
        plan=subscription.plan,
        status=_enum_value(subscription.status),
        provider=_enum_value(subscription.provider),
        billing_email=subscription.billing_email,
        currency=subscription.currency,
        monthly_amount_cents=subscription.monthly_amount_cents,
        current_period_start=subscription.current_period_start,
        current_period_end=subscription.current_period_end,
        trial_ends_at=subscription.trial_ends_at,
        cancel_at_period_end=subscription.cancel_at_period_end,
        provider_customer_id=subscription.provider_customer_id,
        provider_subscription_id=subscription.provider_subscription_id,
        notes=subscription.notes,
        created_at=subscription.created_at,
        updated_at=subscription.updated_at,
    )


def _invoice_response(
    invoice: BillingInvoice,
    organization_name: str,
) -> AdminBillingInvoiceResponse:
    return AdminBillingInvoiceResponse(
        id=invoice.id,
        organization_id=invoice.organization_id,
        organization_name=organization_name,
        subscription_id=invoice.subscription_id,
        status=_enum_value(invoice.status),
        provider=_enum_value(invoice.provider),
        number=invoice.number,
        currency=invoice.currency,
        amount_due_cents=invoice.amount_due_cents,
        amount_paid_cents=invoice.amount_paid_cents,
        issued_at=invoice.issued_at,
        due_date=invoice.due_date,
        paid_at=invoice.paid_at,
        period_start=invoice.period_start,
        period_end=invoice.period_end,
        provider_invoice_id=invoice.provider_invoice_id,
        hosted_invoice_url=invoice.hosted_invoice_url,
        notes=invoice.notes,
        created_at=invoice.created_at,
        updated_at=invoice.updated_at,
    )


def _payment_response(
    payment: BillingPayment,
    organization_name: str,
) -> AdminBillingPaymentResponse:
    return AdminBillingPaymentResponse(
        id=payment.id,
        organization_id=payment.organization_id,
        organization_name=organization_name,
        invoice_id=payment.invoice_id,
        provider=_enum_value(payment.provider),
        status=_enum_value(payment.status),
        amount_cents=payment.amount_cents,
        currency=payment.currency,
        paid_at=payment.paid_at,
        provider_payment_id=payment.provider_payment_id,
        external_reference=payment.external_reference,
        notes=payment.notes,
        created_at=payment.created_at,
        updated_at=payment.updated_at,
    )


def _enforce_brl(currency: str | None) -> str:
    """Finance MVP is BRL-only until multi-currency accounting is implemented."""
    normalized = (currency or "BRL").upper()[:3]
    if normalized != "BRL":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only BRL is supported in the finance MVP",
        )
    return normalized


def _validate_non_negative(value: int | None, field_name: str) -> None:
    if value is not None and value < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} must be non-negative",
        )


async def _reconcile_invoice_payment_totals(db, invoice_id: UUID) -> None:
    """Recalculate invoice paid amount from succeeded payments."""
    invoice_result = await db.execute(
        select(BillingInvoice).where(BillingInvoice.id == invoice_id).with_for_update()
    )
    invoice = invoice_result.scalar_one_or_none()
    if invoice is None:
        return
    paid_total = await db.scalar(
        select(func.coalesce(func.sum(BillingPayment.amount_cents), 0)).where(
            BillingPayment.invoice_id == invoice_id,
            BillingPayment.status == BillingPaymentStatus.SUCCEEDED,
        )
    )
    last_paid_at = await db.scalar(
        select(func.max(BillingPayment.paid_at)).where(
            BillingPayment.invoice_id == invoice_id,
            BillingPayment.status == BillingPaymentStatus.SUCCEEDED,
        )
    )
    raw_paid_total = int(paid_total or 0)
    if raw_paid_total > invoice.amount_due_cents:
        logger.warning(
            "Billing payment total %s exceeds due %s for invoice %s; truncating cached paid amount",
            raw_paid_total,
            invoice.amount_due_cents,
            invoice.id,
        )
    invoice.amount_paid_cents = min(raw_paid_total, invoice.amount_due_cents)
    if invoice.amount_due_cents > 0 and invoice.amount_paid_cents >= invoice.amount_due_cents:
        invoice.status = BillingInvoiceStatus.PAID
        invoice.paid_at = last_paid_at or invoice.paid_at or datetime.now(timezone.utc)
    elif invoice.status == BillingInvoiceStatus.PAID:
        invoice.status = BillingInvoiceStatus.OPEN
        invoice.paid_at = None


async def _ensure_invoice_payment_total_within_due(
    db,
    invoice: BillingInvoice,
    amount_cents: int,
    exclude_payment_id: UUID | None = None,
) -> None:
    """Prevent successful manual payments from exceeding the invoice balance."""
    query = select(func.coalesce(func.sum(BillingPayment.amount_cents), 0)).where(
        BillingPayment.invoice_id == invoice.id,
        BillingPayment.status == BillingPaymentStatus.SUCCEEDED,
    )
    if exclude_payment_id is not None:
        query = query.where(BillingPayment.id != exclude_payment_id)
    paid_total = int((await db.scalar(query)) or 0)
    if paid_total + amount_cents > invoice.amount_due_cents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment exceeds invoice open balance",
        )


def _parse_subscription_status(value: str) -> BillingSubscriptionStatus:
    try:
        return BillingSubscriptionStatus(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid subscription status",
        ) from exc


def _parse_invoice_status(value: str) -> BillingInvoiceStatus:
    try:
        return BillingInvoiceStatus(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid invoice status",
        ) from exc


def _parse_payment_status(value: str) -> BillingPaymentStatus:
    try:
        return BillingPaymentStatus(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payment status",
        ) from exc


def _parse_billing_provider(value: str) -> BillingProvider:
    try:
        return BillingProvider(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid billing provider",
        ) from exc


def _admin_user_response(user: User) -> AdminUserResponse:
    """Build a platform user response with multi-account membership context."""
    memberships = [
        AdminUserMembershipResponse(
            id=membership.id,
            organization_id=membership.organization_id,
            organization_name=membership.organization.name if membership.organization else "",
            role_name=membership.role.name if membership.role else "",
            status=membership.status.value if hasattr(membership.status, "value") else str(membership.status),
            client_access_mode=(
                membership.client_access_mode.value
                if hasattr(membership.client_access_mode, "value")
                else str(membership.client_access_mode)
            ),
            team_count=len(membership.teams),
            team_names=[team.name for team in membership.teams],
        )
        for membership in sorted(
            user.memberships,
            key=lambda item: (
                item.organization.name if item.organization else "",
                item.created_at,
            ),
        )
    ]
    return AdminUserResponse(
        id=user.id,
        organization_id=user.organization_id,
        email=user.email,
        name=user.name,
        role=user.role,
        is_active=user.is_active,
        is_superuser=user.is_superuser,
        token_version=user.token_version,
        created_at=user.created_at,
        updated_at=user.updated_at,
        last_login_at=user.last_login_at,
        memberships=memberships,
    )


@router.get("/overview", response_model=AdminOverviewResponse)
async def get_admin_overview(
    _superuser: SuperUser,
    db: DBSession,
) -> AdminOverviewResponse:
    """Return platform-level counters for the admin console."""
    organization_count = await db.scalar(select(func.count(Organization.id)))
    active_organization_count = await db.scalar(
        select(func.count(Organization.id)).where(Organization.is_active.is_(True))
    )
    user_count = await db.scalar(select(func.count(User.id)))
    active_user_count = await db.scalar(
        select(func.count(User.id)).where(User.is_active.is_(True))
    )
    client_count = await db.scalar(select(func.count(Client.id)))
    audit_event_count = await db.scalar(select(func.count(AuditLog.id)))
    bot_count = await db.scalar(select(func.count(BotInstance.id)))
    strategy_count = await db.scalar(select(func.count(BotStrategy.id)))
    return AdminOverviewResponse(
        organization_count=int(organization_count or 0),
        active_organization_count=int(active_organization_count or 0),
        user_count=int(user_count or 0),
        active_user_count=int(active_user_count or 0),
        client_count=int(client_count or 0),
        audit_event_count=int(audit_event_count or 0),
        bot_count=int(bot_count or 0),
        strategy_count=int(strategy_count or 0),
        plan_count=len(list_plan_definitions()),
    )


@router.get("/plans", response_model=List[AdminPlanDefinitionResponse])
async def list_admin_plans(
    _superuser: SuperUser,
) -> List[AdminPlanDefinitionResponse]:
    """List commercial plan definitions and their platform limits."""
    return [
        AdminPlanDefinitionResponse(
            plan=definition.plan,
            label=definition.label,
            limits={key: value for key, value in definition.limits.items()},
            features=list(definition.features),
        )
        for definition in list_plan_definitions()
    ]


@router.get("/plan-usage", response_model=List[AdminPlanUsageResponse])
async def list_admin_plan_usage(
    _superuser: SuperUser,
    db: DBSession,
    organization_id: Optional[UUID] = None,
) -> List[AdminPlanUsageResponse]:
    """Return plan usage for all customers or a selected customer."""
    query = select(Organization).order_by(Organization.created_at.desc())
    if organization_id is not None:
        query = query.where(Organization.id == organization_id)
    result = await db.execute(query)
    organizations = result.scalars().all()
    usage_by_org = await get_plan_usage_many(
        db,
        [organization.id for organization in organizations],
    )

    response: list[AdminPlanUsageResponse] = []
    for organization in organizations:
        definition = get_plan_definition(organization.plan)
        usage = usage_by_org[organization.id]
        limits = {key: value for key, value in definition.limits.items()}
        response.append(
            AdminPlanUsageResponse(
                organization_id=organization.id,
                organization_name=organization.name,
                plan=organization.plan,
                usage=usage,
                limits=limits,
                remaining=calculate_remaining(definition.limits, usage),
                over_limit=calculate_over_limit(definition.limits, usage),
            )
        )
    return response


@router.get("/finance/summary", response_model=AdminFinanceSummaryResponse)
async def get_admin_finance_summary(
    _superuser: SuperUser,
    db: DBSession,
    organization_id: Optional[UUID] = None,
) -> AdminFinanceSummaryResponse:
    """Return platform finance counters for the admin console."""
    now = datetime.now(timezone.utc)
    last_30_days = now - timedelta(days=30)

    subscription_filter = []
    invoice_filter = []
    payment_filter = []
    if organization_id is not None:
        subscription_filter.append(BillingSubscription.organization_id == organization_id)
        invoice_filter.append(BillingInvoice.organization_id == organization_id)
        payment_filter.append(BillingPayment.organization_id == organization_id)

    subscription_count = await db.scalar(
        select(func.count(BillingSubscription.id)).where(*subscription_filter)
    )
    active_subscription_count = await db.scalar(
        select(func.count(BillingSubscription.id)).where(
            *subscription_filter,
            BillingSubscription.status.in_(
                [BillingSubscriptionStatus.ACTIVE, BillingSubscriptionStatus.TRIALING]
            ),
        )
    )
    past_due_subscription_count = await db.scalar(
        select(func.count(BillingSubscription.id)).where(
            *subscription_filter,
            BillingSubscription.status.in_(
                [BillingSubscriptionStatus.PAST_DUE, BillingSubscriptionStatus.UNPAID]
            ),
        )
    )
    open_invoice_count = await db.scalar(
        select(func.count(BillingInvoice.id)).where(
            *invoice_filter,
            BillingInvoice.status.in_(
                [
                    BillingInvoiceStatus.OPEN,
                    BillingInvoiceStatus.OVERDUE,
                    BillingInvoiceStatus.UNCOLLECTIBLE,
                ]
            ),
        )
    )
    overdue_invoice_count = await db.scalar(
        select(func.count(BillingInvoice.id)).where(
            *invoice_filter,
            or_(
                BillingInvoice.status == BillingInvoiceStatus.OVERDUE,
                (
                    (BillingInvoice.status == BillingInvoiceStatus.OPEN)
                    & (BillingInvoice.due_date.is_not(None))
                    & (BillingInvoice.due_date < now)
                ),
            ),
        )
    )
    mrr_cents = await db.scalar(
        select(func.coalesce(func.sum(BillingSubscription.monthly_amount_cents), 0)).where(
            *subscription_filter,
            BillingSubscription.status.in_(
                [BillingSubscriptionStatus.ACTIVE, BillingSubscriptionStatus.TRIALING]
            ),
        )
    )
    open_amount_cents = await db.scalar(
        select(
            func.coalesce(
                func.sum(BillingInvoice.amount_due_cents - BillingInvoice.amount_paid_cents),
                0,
            )
        ).where(
            *invoice_filter,
            BillingInvoice.status.in_(
                [
                    BillingInvoiceStatus.OPEN,
                    BillingInvoiceStatus.OVERDUE,
                    BillingInvoiceStatus.UNCOLLECTIBLE,
                ]
            ),
        )
    )
    overdue_amount_cents = await db.scalar(
        select(
            func.coalesce(
                func.sum(BillingInvoice.amount_due_cents - BillingInvoice.amount_paid_cents),
                0,
            )
        ).where(
            *invoice_filter,
            or_(
                BillingInvoice.status == BillingInvoiceStatus.OVERDUE,
                (
                    (BillingInvoice.status == BillingInvoiceStatus.OPEN)
                    & (BillingInvoice.due_date.is_not(None))
                    & (BillingInvoice.due_date < now)
                ),
            ),
        )
    )
    paid_amount_30d_cents = await db.scalar(
        select(func.coalesce(func.sum(BillingPayment.amount_cents), 0)).where(
            *payment_filter,
            BillingPayment.status == BillingPaymentStatus.SUCCEEDED,
            BillingPayment.paid_at.is_not(None),
            BillingPayment.paid_at >= last_30_days,
        )
    )

    return AdminFinanceSummaryResponse(
        subscription_count=int(subscription_count or 0),
        active_subscription_count=int(active_subscription_count or 0),
        past_due_subscription_count=int(past_due_subscription_count or 0),
        open_invoice_count=int(open_invoice_count or 0),
        overdue_invoice_count=int(overdue_invoice_count or 0),
        mrr_cents=int(mrr_cents or 0),
        open_amount_cents=int(open_amount_cents or 0),
        overdue_amount_cents=int(overdue_amount_cents or 0),
        paid_amount_30d_cents=int(paid_amount_30d_cents or 0),
    )


@router.get("/finance/subscriptions", response_model=List[AdminBillingSubscriptionResponse])
async def list_admin_billing_subscriptions(
    _superuser: SuperUser,
    db: DBSession,
    organization_id: Optional[UUID] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
) -> List[AdminBillingSubscriptionResponse]:
    """List customer subscriptions for platform finance."""
    query = (
        select(BillingSubscription, Organization.name.label("organization_name"))
        .join(Organization, Organization.id == BillingSubscription.organization_id)
        .order_by(BillingSubscription.updated_at.desc())
        .offset(skip)
        .limit(limit)
    )
    if organization_id is not None:
        query = query.where(BillingSubscription.organization_id == organization_id)
    if status_filter:
        query = query.where(BillingSubscription.status == _parse_subscription_status(status_filter))

    result = await db.execute(query)
    return [
        _subscription_response(subscription, organization_name)
        for subscription, organization_name in result.all()
    ]


@router.patch(
    "/finance/subscriptions/{organization_id}",
    response_model=AdminBillingSubscriptionResponse,
)
async def update_admin_billing_subscription(
    organization_id: UUID,
    data: AdminBillingSubscriptionUpdate,
    superuser: Annotated[User, Depends(require_superuser)],
    db: DBSession,
    request: Request,
) -> AdminBillingSubscriptionResponse:
    """Upsert and update the customer subscription controlled by platform finance."""
    organization_result = await db.execute(
        select(Organization).where(Organization.id == organization_id).with_for_update()
    )
    organization = organization_result.scalar_one_or_none()
    if organization is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    subscription_result = await db.execute(
        select(BillingSubscription)
        .where(BillingSubscription.organization_id == organization_id)
        .with_for_update()
    )
    subscription = subscription_result.scalar_one_or_none()
    if subscription is None:
        subscription = BillingSubscription(
            organization_id=organization.id,
            plan=organization.plan,
            status=BillingSubscriptionStatus.ACTIVE,
            provider=BillingProvider.MANUAL,
            currency="BRL",
            monthly_amount_cents=0,
            cancel_at_period_end=False,
        )
        db.add(subscription)
        await db.flush()

    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data and update_data["status"] is not None:
        update_data["status"] = _parse_subscription_status(_enum_value(update_data["status"]))
    if "provider" in update_data and update_data["provider"] is not None:
        update_data["provider"] = _parse_billing_provider(_enum_value(update_data["provider"]))
    if "currency" in update_data and update_data["currency"] is not None:
        update_data["currency"] = _enforce_brl(update_data["currency"])
    _validate_non_negative(update_data.get("monthly_amount_cents"), "monthly_amount_cents")

    for field, value in update_data.items():
        setattr(subscription, field, value)

    if "plan" in update_data and update_data["plan"] is not None:
        organization.plan = update_data["plan"]

    await db.flush()
    await db.refresh(subscription)
    await record_audit_event(
        db,
        organization_id=organization.id,
        user_id=superuser.id,
        action=AuditAction.UPDATE,
        resource_type="billing_subscription",
        resource_id=subscription.id,
        description="Platform admin updated billing subscription",
        metadata={"updated_fields": {key: _metadata_value(value) for key, value in update_data.items()}},
        request=request,
    )
    return _subscription_response(subscription, organization.name)


@router.get("/finance/invoices", response_model=List[AdminBillingInvoiceResponse])
async def list_admin_billing_invoices(
    _superuser: SuperUser,
    db: DBSession,
    organization_id: Optional[UUID] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
) -> List[AdminBillingInvoiceResponse]:
    """List invoices for platform finance."""
    query = (
        select(BillingInvoice, Organization.name.label("organization_name"))
        .join(Organization, Organization.id == BillingInvoice.organization_id)
        .order_by(BillingInvoice.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    if organization_id is not None:
        query = query.where(BillingInvoice.organization_id == organization_id)
    if status_filter:
        query = query.where(BillingInvoice.status == _parse_invoice_status(status_filter))

    result = await db.execute(query)
    return [_invoice_response(invoice, organization_name) for invoice, organization_name in result.all()]


@router.post(
    "/finance/invoices",
    response_model=AdminBillingInvoiceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_admin_billing_invoice(
    data: AdminBillingInvoiceCreate,
    superuser: Annotated[User, Depends(require_superuser)],
    db: DBSession,
    request: Request,
) -> AdminBillingInvoiceResponse:
    """Create a manual BRL invoice for a platform customer."""
    _validate_non_negative(data.amount_due_cents, "amount_due_cents")
    organization_result = await db.execute(
        select(Organization).where(Organization.id == data.organization_id)
    )
    organization = organization_result.scalar_one_or_none()
    if organization is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    subscription = await db.scalar(
        select(BillingSubscription.id).where(
            BillingSubscription.organization_id == organization.id
        )
    )
    invoice = BillingInvoice(
        id=uuid4(),
        organization_id=organization.id,
        subscription_id=subscription,
        status=BillingInvoiceStatus.OPEN,
        provider=BillingProvider.MANUAL,
        number=data.number,
        currency="BRL",
        amount_due_cents=data.amount_due_cents,
        amount_paid_cents=0,
        issued_at=data.issued_at or datetime.now(timezone.utc),
        due_date=data.due_date,
        period_start=data.period_start,
        period_end=data.period_end,
        notes=data.notes,
    )
    db.add(invoice)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Invoice number already exists",
        ) from exc
    await record_audit_event(
        db,
        organization_id=organization.id,
        user_id=superuser.id,
        action=AuditAction.CREATE,
        resource_type="billing_invoice",
        resource_id=invoice.id,
        description="Platform admin created manual invoice",
        metadata={
            "amount_due_cents": invoice.amount_due_cents,
            "due_date": _metadata_value(invoice.due_date) if invoice.due_date else None,
            "number": invoice.number,
        },
        request=request,
    )
    return _invoice_response(invoice, organization.name)


@router.patch("/finance/invoices/{invoice_id}", response_model=AdminBillingInvoiceResponse)
async def update_admin_billing_invoice(
    invoice_id: UUID,
    data: AdminBillingInvoiceUpdate,
    superuser: Annotated[User, Depends(require_superuser)],
    db: DBSession,
    request: Request,
) -> AdminBillingInvoiceResponse:
    """Update manual invoice status or metadata.

    Payments are immutable accounting history for this MVP. Voiding an invoice
    does not auto-refund existing payments; refunds must be registered by a
    future dedicated refund flow.
    """
    result = await db.execute(
        select(BillingInvoice, Organization.name.label("organization_name"))
        .join(Organization, Organization.id == BillingInvoice.organization_id)
        .where(BillingInvoice.id == invoice_id)
        .with_for_update()
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    invoice, organization_name = row
    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data and update_data["status"] is not None:
        update_data["status"] = _parse_invoice_status(_enum_value(update_data["status"]))
    _validate_non_negative(update_data.get("amount_due_cents"), "amount_due_cents")
    for field, value in update_data.items():
        setattr(invoice, field, value)
    if invoice.amount_paid_cents > invoice.amount_due_cents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="amount_paid_cents cannot exceed amount_due_cents",
        )
    if (
        invoice.status != BillingInvoiceStatus.VOID
        and invoice.amount_paid_cents >= invoice.amount_due_cents
        and invoice.amount_due_cents > 0
    ):
        invoice.status = BillingInvoiceStatus.PAID
        invoice.paid_at = invoice.paid_at or datetime.now(timezone.utc)

    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Invoice number already exists",
        ) from exc
    await record_audit_event(
        db,
        organization_id=invoice.organization_id,
        user_id=superuser.id,
        action=AuditAction.UPDATE,
        resource_type="billing_invoice",
        resource_id=invoice.id,
        description="Platform admin updated invoice",
        metadata={"updated_fields": {key: _metadata_value(value) for key, value in update_data.items()}},
        request=request,
    )
    return _invoice_response(invoice, organization_name)


@router.get("/finance/payments", response_model=List[AdminBillingPaymentResponse])
async def list_admin_billing_payments(
    _superuser: SuperUser,
    db: DBSession,
    organization_id: Optional[UUID] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
) -> List[AdminBillingPaymentResponse]:
    """List payments for platform finance."""
    query = (
        select(BillingPayment, Organization.name.label("organization_name"))
        .join(Organization, Organization.id == BillingPayment.organization_id)
        .order_by(BillingPayment.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    if organization_id is not None:
        query = query.where(BillingPayment.organization_id == organization_id)

    result = await db.execute(query)
    return [_payment_response(payment, organization_name) for payment, organization_name in result.all()]


@router.post(
    "/finance/payments",
    response_model=AdminBillingPaymentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_admin_billing_payment(
    data: AdminBillingPaymentCreate,
    superuser: Annotated[User, Depends(require_superuser)],
    db: DBSession,
    request: Request,
) -> AdminBillingPaymentResponse:
    """Register a manual BRL payment and reconcile the invoice when provided."""
    _validate_non_negative(data.amount_cents, "amount_cents")
    if data.invoice_id is None and data.organization_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invoice_id or organization_id is required",
        )

    invoice = None
    organization_id = data.organization_id
    organization_name = ""
    if data.invoice_id is not None:
        invoice_result = await db.execute(
            select(BillingInvoice, Organization.name.label("organization_name"))
            .join(Organization, Organization.id == BillingInvoice.organization_id)
            .where(BillingInvoice.id == data.invoice_id)
            .with_for_update()
        )
        row = invoice_result.one_or_none()
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invoice not found",
            )
        invoice, organization_name = row
        if invoice.status == BillingInvoiceStatus.VOID:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot register payment for void invoice",
            )
        if invoice.status == BillingInvoiceStatus.PAID or invoice.amount_paid_cents >= invoice.amount_due_cents:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invoice is already paid",
            )
        await _ensure_invoice_payment_total_within_due(db, invoice, data.amount_cents)
        organization_id = invoice.organization_id
    else:
        organization_result = await db.execute(
            select(Organization).where(Organization.id == organization_id)
        )
        organization = organization_result.scalar_one_or_none()
        if organization is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found",
            )
        organization_name = organization.name

    payment = BillingPayment(
        id=uuid4(),
        organization_id=organization_id,
        invoice_id=data.invoice_id,
        provider=BillingProvider.MANUAL,
        status=BillingPaymentStatus.SUCCEEDED,
        amount_cents=data.amount_cents,
        currency="BRL",
        paid_at=data.paid_at or datetime.now(timezone.utc),
        provider_payment_id=data.provider_payment_id,
        external_reference=data.external_reference,
        notes=data.notes,
    )
    db.add(payment)
    await db.flush()
    if invoice is not None:
        await _reconcile_invoice_payment_totals(db, invoice.id)
    await record_audit_event(
        db,
        organization_id=organization_id,
        user_id=superuser.id,
        action=AuditAction.CREATE,
        resource_type="billing_payment",
        resource_id=payment.id,
        description="Platform admin registered manual payment",
        metadata={
            "invoice_id": _metadata_value(data.invoice_id) if data.invoice_id else None,
            "amount_cents": payment.amount_cents,
            "paid_at": _metadata_value(payment.paid_at) if payment.paid_at else None,
        },
        request=request,
    )
    return _payment_response(payment, organization_name)


@router.patch("/finance/payments/{payment_id}", response_model=AdminBillingPaymentResponse)
async def update_admin_billing_payment(
    payment_id: UUID,
    data: AdminBillingPaymentUpdate,
    superuser: Annotated[User, Depends(require_superuser)],
    db: DBSession,
    request: Request,
) -> AdminBillingPaymentResponse:
    """Update manual payment metadata/status."""
    result = await db.execute(
        select(BillingPayment, Organization.name.label("organization_name"))
        .join(Organization, Organization.id == BillingPayment.organization_id)
        .where(BillingPayment.id == payment_id)
        .with_for_update()
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )
    payment, organization_name = row
    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data and update_data["status"] is not None:
        update_data["status"] = _parse_payment_status(_enum_value(update_data["status"]))
    _validate_non_negative(update_data.get("amount_cents"), "amount_cents")
    if payment.invoice_id is not None:
        invoice = await db.scalar(
            select(BillingInvoice)
            .where(BillingInvoice.id == payment.invoice_id)
            .with_for_update()
        )
        next_status = update_data.get("status", payment.status)
        next_amount_cents = update_data.get("amount_cents", payment.amount_cents)
        if invoice is not None and next_status == BillingPaymentStatus.SUCCEEDED:
            if invoice.status == BillingInvoiceStatus.VOID:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot register payment for void invoice",
                )
            await _ensure_invoice_payment_total_within_due(
                db,
                invoice,
                next_amount_cents,
                exclude_payment_id=payment.id,
            )
    for field, value in update_data.items():
        setattr(payment, field, value)
    await db.flush()
    if payment.invoice_id is not None:
        await _reconcile_invoice_payment_totals(db, payment.invoice_id)
    await record_audit_event(
        db,
        organization_id=payment.organization_id,
        user_id=superuser.id,
        action=AuditAction.UPDATE,
        resource_type="billing_payment",
        resource_id=payment.id,
        description="Platform admin updated payment",
        metadata={"updated_fields": {key: _metadata_value(value) for key, value in update_data.items()}},
        request=request,
    )
    return _payment_response(payment, organization_name)


@router.get("/organizations", response_model=List[AdminOrganizationResponse])
async def list_admin_organizations(
    _superuser: SuperUser,
    db: DBSession,
    is_active: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> List[AdminOrganizationResponse]:
    """List organizations with aggregate counts for platform governance."""
    member_counts = (
        select(
            Membership.organization_id,
            func.count(distinct(Membership.user_id)).label("user_count"),
        )
        .where(Membership.status == MembershipStatus.ACTIVE)
        .group_by(Membership.organization_id)
        .subquery()
    )
    client_counts = (
        select(Client.organization_id, func.count(Client.id).label("client_count"))
        .group_by(Client.organization_id)
        .subquery()
    )
    team_counts = (
        select(Team.organization_id, func.count(Team.id).label("team_count"))
        .group_by(Team.organization_id)
        .subquery()
    )
    query = (
        select(
            Organization,
            func.coalesce(member_counts.c.user_count, 0).label("user_count"),
            func.coalesce(client_counts.c.client_count, 0).label("client_count"),
            func.coalesce(team_counts.c.team_count, 0).label("team_count"),
        )
        .outerjoin(member_counts, member_counts.c.organization_id == Organization.id)
        .outerjoin(client_counts, client_counts.c.organization_id == Organization.id)
        .outerjoin(team_counts, team_counts.c.organization_id == Organization.id)
        .order_by(Organization.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    if is_active is not None:
        query = query.where(Organization.is_active == is_active)

    result = await db.execute(query)
    return [
        AdminOrganizationResponse(
            id=organization.id,
            name=organization.name,
            slug=organization.slug,
            plan=organization.plan,
            is_active=organization.is_active,
            user_count=int(user_count or 0),
            client_count=int(client_count or 0),
            team_count=int(team_count or 0),
            created_at=organization.created_at,
            updated_at=organization.updated_at,
        )
        for organization, user_count, client_count, team_count in result.all()
    ]


@router.patch("/organizations/{organization_id}", response_model=AdminOrganizationResponse)
async def update_admin_organization(
    organization_id: UUID,
    data: AdminOrganizationUpdate,
    _superuser: SuperUser,
    db: DBSession,
    request: Request,
) -> AdminOrganizationResponse:
    """Update platform-owned organization flags such as plan/status."""
    result = await db.execute(
        select(Organization).where(Organization.id == organization_id).with_for_update()
    )
    organization = result.scalar_one_or_none()
    if organization is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    update_data = data.model_dump(exclude_unset=True)
    previous_active = organization.is_active
    for field, value in update_data.items():
        setattr(organization, field, value)

    if "is_active" in update_data and update_data["is_active"] != previous_active:
        member_user_ids = select(Membership.user_id).where(
            Membership.organization_id == organization.id
        )
        await db.execute(
            update(User)
            .where(
                or_(
                    User.organization_id == organization.id,
                    User.id.in_(member_user_ids),
                )
            )
            .values(token_version=User.token_version + 1)
        )
        invalidate_authz_cache(organization_id=organization.id)

    await db.flush()
    await db.refresh(organization)
    if update_data:
        await record_audit_event(
            db,
            organization_id=organization.id,
            user_id=_superuser.id,
            action=AuditAction.UPDATE,
            resource_type="organization",
            resource_id=organization.id,
            description="Platform admin updated organization",
            metadata={
                "updated_fields": update_data,
                "previous_is_active": previous_active,
                "current_is_active": organization.is_active,
            },
            request=request,
        )

    user_count = await db.scalar(
        select(func.count(distinct(Membership.user_id))).where(
            Membership.organization_id == organization.id,
            Membership.status == MembershipStatus.ACTIVE,
        )
    )
    client_count = await db.scalar(
        select(func.count(Client.id)).where(Client.organization_id == organization.id)
    )
    team_count = await db.scalar(
        select(func.count(Team.id)).where(Team.organization_id == organization.id)
    )
    return AdminOrganizationResponse(
        id=organization.id,
        name=organization.name,
        slug=organization.slug,
        plan=organization.plan,
        is_active=organization.is_active,
        user_count=int(user_count or 0),
        client_count=int(client_count or 0),
        team_count=int(team_count or 0),
        created_at=organization.created_at,
        updated_at=organization.updated_at,
    )


@router.get("/users", response_model=List[AdminUserResponse])
async def list_admin_users(
    _superuser: SuperUser,
    db: DBSession,
    organization_id: Optional[UUID] = None,
    is_active: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> List[AdminUserResponse]:
    """List users globally or for a specific organization."""
    query = (
        select(User)
        .options(
            selectinload(User.memberships).selectinload(Membership.organization),
            selectinload(User.memberships).selectinload(Membership.role),
            selectinload(User.memberships).selectinload(Membership.teams),
        )
        .order_by(User.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    if organization_id is not None:
        member_user_ids = select(Membership.user_id).where(
            Membership.organization_id == organization_id
        )
        query = query.where(User.id.in_(member_user_ids))
    if is_active is not None:
        query = query.where(User.is_active == is_active)

    result = await db.execute(query)
    return [_admin_user_response(user) for user in result.scalars().unique().all()]


@router.get("/clients", response_model=List[AdminClientResponse])
async def list_admin_clients(
    _superuser: SuperUser,
    db: DBSession,
    organization_id: Optional[UUID] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> List[AdminClientResponse]:
    """List all business clients/carteiras across organizations."""
    wallet_counts = (
        select(
            Wallet.client_id,
            func.count(Wallet.id).label("wallet_count"),
            func.count(Wallet.id).filter(Wallet.is_active.is_(True)).label("active_wallet_count"),
            func.max(Wallet.last_scan_at).label("last_wallet_scan_at"),
        )
        .group_by(Wallet.client_id)
        .subquery()
    )
    exchange_counts = (
        select(
            Exchange.client_id,
            func.count(Exchange.id).label("exchange_count"),
            func.count(Exchange.id).filter(Exchange.is_active.is_(True)).label("active_exchange_count"),
            func.count(Exchange.id).filter(Exchange.sync_error.is_not(None)).label("sync_error_count"),
            func.max(Exchange.last_sync_at).label("last_exchange_sync_at"),
        )
        .group_by(Exchange.client_id)
        .subquery()
    )
    team_scope_counts = (
        select(TeamClient.client_id, func.count(TeamClient.team_id).label("team_scope_count"))
        .group_by(TeamClient.client_id)
        .subquery()
    )
    membership_scope_counts = (
        select(
            MembershipClient.client_id,
            func.count(MembershipClient.membership_id).label("membership_scope_count"),
        )
        .group_by(MembershipClient.client_id)
        .subquery()
    )
    query = (
        select(
            Client,
            Organization.name.label("organization_name"),
            func.coalesce(wallet_counts.c.wallet_count, 0).label("wallet_count"),
            func.coalesce(wallet_counts.c.active_wallet_count, 0).label("active_wallet_count"),
            wallet_counts.c.last_wallet_scan_at.label("last_wallet_scan_at"),
            func.coalesce(exchange_counts.c.exchange_count, 0).label("exchange_count"),
            func.coalesce(exchange_counts.c.active_exchange_count, 0).label("active_exchange_count"),
            func.coalesce(exchange_counts.c.sync_error_count, 0).label("sync_error_count"),
            exchange_counts.c.last_exchange_sync_at.label("last_exchange_sync_at"),
            func.coalesce(team_scope_counts.c.team_scope_count, 0).label("team_scope_count"),
            func.coalesce(membership_scope_counts.c.membership_scope_count, 0).label("membership_scope_count"),
        )
        .join(Organization, Organization.id == Client.organization_id)
        .outerjoin(wallet_counts, wallet_counts.c.client_id == Client.id)
        .outerjoin(exchange_counts, exchange_counts.c.client_id == Client.id)
        .outerjoin(team_scope_counts, team_scope_counts.c.client_id == Client.id)
        .outerjoin(membership_scope_counts, membership_scope_counts.c.client_id == Client.id)
        .order_by(Client.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    if organization_id is not None:
        query = query.where(Client.organization_id == organization_id)
    if search:
        query = query.where(Client.name.ilike(f"%{search.strip()}%"))

    result = await db.execute(query)
    return [
        AdminClientResponse(
            id=client.id,
            organization_id=client.organization_id,
            organization_name=organization_name,
            name=client.name,
            email=client.email,
            color=client.color,
            wallet_count=int(wallet_count or 0),
            active_wallet_count=int(active_wallet_count or 0),
            exchange_count=int(exchange_count or 0),
            active_exchange_count=int(active_exchange_count or 0),
            sync_error_count=int(sync_error_count or 0),
            team_scope_count=int(team_scope_count or 0),
            membership_scope_count=int(membership_scope_count or 0),
            last_wallet_scan_at=last_wallet_scan_at,
            last_exchange_sync_at=last_exchange_sync_at,
            created_at=client.created_at,
            updated_at=client.updated_at,
        )
        for (
            client,
            organization_name,
            wallet_count,
            active_wallet_count,
            last_wallet_scan_at,
            exchange_count,
            active_exchange_count,
            sync_error_count,
            last_exchange_sync_at,
            team_scope_count,
            membership_scope_count,
        ) in result.all()
    ]


@router.get("/audit-logs", response_model=List[AdminAuditLogResponse])
async def list_admin_audit_logs(
    _superuser: SuperUser,
    db: DBSession,
    organization_id: Optional[UUID] = None,
    resource_type: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> List[AdminAuditLogResponse]:
    """List audit events globally for platform operators."""
    query = (
        select(
            AuditLog,
            Organization.name.label("organization_name"),
            User.email.label("user_email"),
        )
        .outerjoin(Organization, Organization.id == AuditLog.organization_id)
        .outerjoin(User, User.id == AuditLog.user_id)
        .order_by(AuditLog.timestamp.desc())
        .offset(skip)
        .limit(limit)
    )
    if organization_id is not None:
        query = query.where(AuditLog.organization_id == organization_id)
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type.strip())

    result = await db.execute(query)
    return [
        AdminAuditLogResponse(
            id=log.id,
            organization_id=log.organization_id,
            organization_name=organization_name,
            user_id=log.user_id,
            user_email=user_email,
            action=log.action.value if hasattr(log.action, "value") else str(log.action),
            resource_type=log.resource_type,
            resource_id=log.resource_id,
            description=log.description,
            metadata=log.log_metadata,
            ip_address=log.ip_address,
            user_agent=log.user_agent,
            timestamp=log.timestamp,
        )
        for log, organization_name, user_email in result.all()
    ]


@router.patch("/users/{user_id}", response_model=AdminUserResponse)
async def update_admin_user(
    user_id: UUID,
    data: AdminUserUpdate,
    superuser: Annotated[User, Depends(require_superuser)],
    db: DBSession,
    request: Request,
) -> AdminUserResponse:
    """Update user platform flags and revoke sessions by bumping token version."""
    result = await db.execute(
        select(User)
        .options(
            selectinload(User.memberships).selectinload(Membership.organization),
            selectinload(User.memberships).selectinload(Membership.role),
            selectinload(User.memberships).selectinload(Membership.teams),
        )
        .where(User.id == user_id)
        .with_for_update()
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    if user.id == superuser.id and data.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own platform user",
        )

    update_data = data.model_dump(exclude_unset=True)
    changed_security_flag = False
    for field, value in update_data.items():
        if getattr(user, field) != value:
            setattr(user, field, value)
            changed_security_flag = True

    if changed_security_flag:
        user.token_version = int(user.token_version or 0) + 1
        invalidate_authz_cache(user_id=user.id)

    await db.flush()
    if update_data:
        await record_audit_event(
            db,
            organization_id=user.organization_id or superuser.organization_id,
            user_id=superuser.id,
            action=AuditAction.UPDATE,
            resource_type="user",
            resource_id=user.id,
            description="Platform admin updated user",
            metadata={
                "updated_fields": update_data,
                "token_version": user.token_version,
            },
            request=request,
        )
    await db.refresh(user)
    return _admin_user_response(user)
