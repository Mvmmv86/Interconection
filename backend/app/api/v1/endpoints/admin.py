"""Platform super-admin endpoints."""

from typing import Annotated, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import distinct, func, or_, select, update
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, SuperUser, invalidate_authz_cache, require_superuser
from app.models.audit_log import AuditAction, AuditLog
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
    AdminClientResponse,
    AdminUserMembershipResponse,
    AdminOverviewResponse,
    AdminOrganizationResponse,
    AdminOrganizationUpdate,
    AdminUserResponse,
    AdminUserUpdate,
)
from app.services.audit_service import record_audit_event

router = APIRouter(dependencies=[Depends(require_superuser)])


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
    return AdminOverviewResponse(
        organization_count=int(organization_count or 0),
        active_organization_count=int(active_organization_count or 0),
        user_count=int(user_count or 0),
        active_user_count=int(active_user_count or 0),
        client_count=int(client_count or 0),
        audit_event_count=int(audit_event_count or 0),
    )


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
