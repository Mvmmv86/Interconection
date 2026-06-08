"""Platform super-admin endpoints."""

from typing import Annotated, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select, update

from app.api.deps import DBSession, SuperUser, invalidate_authz_cache, require_superuser
from app.models.audit_log import AuditAction
from app.models.client import Client
from app.models.membership import Membership
from app.models.organization import Organization
from app.models.user import User
from app.schemas.admin import (
    AdminOrganizationResponse,
    AdminOrganizationUpdate,
    AdminUserResponse,
    AdminUserUpdate,
)
from app.services.audit_service import record_audit_event

router = APIRouter(dependencies=[Depends(require_superuser)])


@router.get("/organizations", response_model=List[AdminOrganizationResponse])
async def list_admin_organizations(
    _superuser: SuperUser,
    db: DBSession,
    is_active: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> List[AdminOrganizationResponse]:
    """List organizations with aggregate counts for platform governance."""
    user_counts = (
        select(User.organization_id, func.count(User.id).label("user_count"))
        .group_by(User.organization_id)
        .subquery()
    )
    client_counts = (
        select(Client.organization_id, func.count(Client.id).label("client_count"))
        .group_by(Client.organization_id)
        .subquery()
    )
    query = (
        select(
            Organization,
            func.coalesce(user_counts.c.user_count, 0).label("user_count"),
            func.coalesce(client_counts.c.client_count, 0).label("client_count"),
        )
        .outerjoin(user_counts, user_counts.c.organization_id == Organization.id)
        .outerjoin(client_counts, client_counts.c.organization_id == Organization.id)
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
            created_at=organization.created_at,
            updated_at=organization.updated_at,
        )
        for organization, user_count, client_count in result.all()
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
        select(func.count(User.id)).where(User.organization_id == organization.id)
    )
    client_count = await db.scalar(
        select(func.count(Client.id)).where(Client.organization_id == organization.id)
    )
    return AdminOrganizationResponse(
        id=organization.id,
        name=organization.name,
        slug=organization.slug,
        plan=organization.plan,
        is_active=organization.is_active,
        user_count=int(user_count or 0),
        client_count=int(client_count or 0),
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
    query = select(User).order_by(User.created_at.desc()).offset(skip).limit(limit)
    if organization_id is not None:
        query = query.where(User.organization_id == organization_id)
    if is_active is not None:
        query = query.where(User.is_active == is_active)

    result = await db.execute(query)
    return [AdminUserResponse.model_validate(user) for user in result.scalars().all()]


@router.patch("/users/{user_id}", response_model=AdminUserResponse)
async def update_admin_user(
    user_id: UUID,
    data: AdminUserUpdate,
    superuser: Annotated[User, Depends(require_superuser)],
    db: DBSession,
    request: Request,
) -> AdminUserResponse:
    """Update user platform flags and revoke sessions by bumping token version."""
    result = await db.execute(select(User).where(User.id == user_id).with_for_update())
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
    return AdminUserResponse.model_validate(user)
