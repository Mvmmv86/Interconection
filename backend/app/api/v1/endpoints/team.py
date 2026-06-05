"""Team administration endpoints."""

from datetime import datetime, timedelta, timezone
from secrets import token_urlsafe
from typing import Annotated, List
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, MembershipAuthContext, require_permission
from app.core.security import get_password_hash
from app.models.client import Client
from app.models.membership import (
    Invitation,
    InvitationStatus,
    Membership,
    MembershipClientAccessMode,
    MembershipStatus,
    Role,
)
from app.models.user import User, UserRole
from app.schemas.common import SuccessResponse
from app.schemas.team import (
    TeamInvitationAccept,
    TeamInvitationAcceptResponse,
    TeamInvitationCreate,
    TeamInvitationResponse,
    TeamMemberResponse,
    TeamMemberScopeUpdate,
    TeamMemberUpdate,
    TeamRoleResponse,
    TeamUserSummary,
)

router = APIRouter()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _legacy_role_from_membership_role(role_name: str) -> UserRole:
    if role_name == "manager":
        return UserRole.MANAGER
    if role_name == "viewer":
        return UserRole.VIEWER
    return UserRole.ADMIN


def _team_member_response(membership: Membership) -> TeamMemberResponse:
    return TeamMemberResponse(
        id=membership.id,
        user_id=membership.user_id,
        organization_id=membership.organization_id,
        role_id=membership.role_id,
        role_name=membership.role.name if membership.role else "",
        status=membership.status,
        client_access_mode=membership.client_access_mode,
        client_ids=[client.id for client in membership.clients],
        invited_by_user_id=membership.invited_by_user_id,
        accepted_at=membership.accepted_at,
        invited_at=membership.invited_at,
        created_at=membership.created_at,
        updated_at=membership.updated_at,
        user=TeamUserSummary.model_validate(membership.user),
    )


def _team_invitation_response(invitation: Invitation) -> TeamInvitationResponse:
    return TeamInvitationResponse(
        id=invitation.id,
        organization_id=invitation.organization_id,
        email=invitation.email,
        role_id=invitation.role_id,
        role_name=invitation.role.name if invitation.role else "",
        token=invitation.token,
        status=invitation.status,
        expires_at=invitation.expires_at,
        invited_by_user_id=invitation.invited_by_user_id,
        accepted_at=invitation.accepted_at,
        notes=invitation.notes,
        created_at=invitation.created_at,
        updated_at=invitation.updated_at,
    )


async def _get_assignable_role(
    role_id: UUID,
    organization_id: UUID,
    db: DBSession,
) -> Role:
    result = await db.execute(
        select(Role)
        .options(selectinload(Role.permissions))
        .where(
            Role.id == role_id,
            (Role.organization_id.is_(None) | (Role.organization_id == organization_id)),
        )
    )
    role = result.scalar_one_or_none()
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found",
        )
    return role


async def _get_membership_for_admin(
    membership_id: UUID,
    organization_id: UUID,
    db: DBSession,
) -> Membership:
    result = await db.execute(
        select(Membership)
        .options(
            selectinload(Membership.user),
            selectinload(Membership.role),
            selectinload(Membership.clients),
        )
        .where(
            Membership.id == membership_id,
            Membership.organization_id == organization_id,
        )
        .with_for_update()
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        )
    return membership


async def _load_scope_clients(
    client_ids: list[UUID],
    organization_id: UUID,
    db: DBSession,
) -> list[Client]:
    if not client_ids:
        return []

    unique_client_ids = list(dict.fromkeys(client_ids))
    result = await db.execute(
        select(Client).where(
            Client.organization_id == organization_id,
            Client.id.in_(unique_client_ids),
        )
    )
    clients = result.scalars().all()
    if len(clients) != len(unique_client_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more clients are outside this account",
        )
    return clients


@router.get("/roles", response_model=List[TeamRoleResponse])
async def list_team_roles(
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("roles:view", route_key="team", force=True)),
    ],
    db: DBSession,
) -> List[TeamRoleResponse]:
    """List roles assignable inside the active account."""
    result = await db.execute(
        select(Role)
        .options(selectinload(Role.permissions))
        .where(
            Role.organization_id.is_(None)
            | (Role.organization_id == permission_ctx.organization_id)
        )
        .order_by(Role.is_system.desc(), Role.name.asc())
    )
    roles = result.scalars().all()
    return [
        TeamRoleResponse(
            id=role.id,
            name=role.name,
            is_system=role.is_system,
            description=role.description,
            permissions=sorted(permission.permission_key for permission in role.permissions),
        )
        for role in roles
    ]


@router.get("/members", response_model=List[TeamMemberResponse])
async def list_team_members(
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("members:view", route_key="team", force=True)),
    ],
    db: DBSession,
) -> List[TeamMemberResponse]:
    """List team members in the active account."""
    result = await db.execute(
        select(Membership)
        .options(
            selectinload(Membership.user),
            selectinload(Membership.role),
            selectinload(Membership.clients),
        )
        .where(Membership.organization_id == permission_ctx.organization_id)
        .order_by(Membership.created_at.asc())
    )
    return [_team_member_response(membership) for membership in result.scalars().all()]


@router.post(
    "/invitations",
    response_model=TeamInvitationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_team_invitation(
    data: TeamInvitationCreate,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("members:invite", route_key="team", force=True)),
    ],
    db: DBSession,
) -> TeamInvitationResponse:
    """Create a pending team invitation."""
    role = await _get_assignable_role(data.role_id, permission_ctx.organization_id, db)
    email = _normalize_email(data.email)

    pending_result = await db.execute(
        select(Invitation).where(
            Invitation.organization_id == permission_ctx.organization_id,
            func.lower(Invitation.email) == email,
            Invitation.status == InvitationStatus.PENDING,
        )
    )
    if pending_result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A pending invitation already exists for this email",
        )

    invitation = Invitation(
        id=uuid4(),
        organization_id=permission_ctx.organization_id,
        email=email,
        role_id=role.id,
        token=token_urlsafe(32),
        status=InvitationStatus.PENDING,
        expires_at=_now() + timedelta(days=data.expires_in_days),
        invited_by_user_id=permission_ctx.user.id,
        notes=data.notes,
    )
    db.add(invitation)

    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A pending invitation already exists for this email",
        ) from exc

    invitation.role = role
    return _team_invitation_response(invitation)


@router.post(
    "/invitations/{token}/accept",
    response_model=TeamInvitationAcceptResponse,
)
async def accept_team_invitation(
    token: str,
    data: TeamInvitationAccept,
    db: DBSession,
) -> TeamInvitationAcceptResponse:
    """Accept an invitation. This endpoint is intentionally public."""
    result = await db.execute(
        select(Invitation)
        .options(selectinload(Invitation.role))
        .where(Invitation.token == token)
        .with_for_update()
    )
    invitation = result.scalar_one_or_none()
    if invitation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found",
        )
    if invitation.status != InvitationStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation is not pending",
        )
    if invitation.expires_at <= _now():
        invitation.status = InvitationStatus.EXPIRED
        await db.flush()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation expired",
        )

    email = _normalize_email(invitation.email)
    user_result = await db.execute(select(User).where(func.lower(User.email) == email))
    user = user_result.scalar_one_or_none()
    created_user = False

    if user is None:
        if not data.name or not data.password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Name and password are required for new users",
            )
        role = invitation.role
        user = User(
            id=uuid4(),
            organization_id=invitation.organization_id,
            email=email,
            password_hash=get_password_hash(data.password),
            name=data.name,
            role=_legacy_role_from_membership_role(role.name if role else "viewer"),
            email_verified=True,
        )
        db.add(user)
        await db.flush()
        created_user = True
    elif user.organization_id is None:
        user.organization_id = invitation.organization_id

    membership_result = await db.execute(
        select(Membership)
        .where(
            Membership.user_id == user.id,
            Membership.organization_id == invitation.organization_id,
        )
        .with_for_update()
    )
    membership = membership_result.scalar_one_or_none()
    now = _now()

    if membership is None:
        membership = Membership(
            id=uuid4(),
            user_id=user.id,
            organization_id=invitation.organization_id,
            role_id=invitation.role_id,
            status=MembershipStatus.ACTIVE,
            client_access_mode=MembershipClientAccessMode.ALL,
            invited_by_user_id=invitation.invited_by_user_id,
            accepted_at=now,
            invited_at=invitation.created_at,
        )
        db.add(membership)
    else:
        membership.role_id = invitation.role_id
        membership.status = MembershipStatus.ACTIVE
        membership.accepted_at = now
        membership.invited_by_user_id = invitation.invited_by_user_id

    invitation.status = InvitationStatus.ACCEPTED
    invitation.accepted_at = now
    await db.flush()

    return TeamInvitationAcceptResponse(
        user_id=user.id,
        membership_id=membership.id,
        organization_id=invitation.organization_id,
        status=membership.status,
        created_user=created_user,
    )


@router.patch("/members/{membership_id}", response_model=TeamMemberResponse)
async def update_team_member(
    membership_id: UUID,
    data: TeamMemberUpdate,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("members:edit", route_key="team", force=True)),
    ],
    db: DBSession,
) -> TeamMemberResponse:
    """Update member role or lifecycle status."""
    membership = await _get_membership_for_admin(
        membership_id,
        permission_ctx.organization_id,
        db,
    )
    if membership.user_id == permission_ctx.user.id and data.status == MembershipStatus.SUSPENDED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot suspend your own membership",
        )

    if data.role_id is not None:
        role = await _get_assignable_role(data.role_id, permission_ctx.organization_id, db)
        membership.role_id = role.id
        membership.role = role
    if data.status is not None:
        membership.status = data.status
        if data.status == MembershipStatus.ACTIVE and membership.accepted_at is None:
            membership.accepted_at = _now()
        membership.user.token_version += 1

    await db.flush()
    return _team_member_response(membership)


@router.delete("/members/{membership_id}", response_model=SuccessResponse)
async def revoke_team_member(
    membership_id: UUID,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("members:revoke", route_key="team", force=True)),
    ],
    db: DBSession,
) -> SuccessResponse:
    """Revoke a member from the active account by suspending membership."""
    membership = await _get_membership_for_admin(
        membership_id,
        permission_ctx.organization_id,
        db,
    )
    if membership.user_id == permission_ctx.user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot revoke your own membership",
        )

    membership.status = MembershipStatus.SUSPENDED
    membership.user.token_version += 1
    await db.flush()
    return SuccessResponse(message="Member revoked successfully")


@router.patch("/members/{membership_id}/scope", response_model=TeamMemberResponse)
async def update_team_member_scope(
    membership_id: UUID,
    data: TeamMemberScopeUpdate,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("members:set_scope", route_key="team", force=True)),
    ],
    db: DBSession,
) -> TeamMemberResponse:
    """Update member client scope."""
    membership = await _get_membership_for_admin(
        membership_id,
        permission_ctx.organization_id,
        db,
    )
    if (
        data.client_access_mode == MembershipClientAccessMode.SPECIFIC
        and not data.client_ids
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="client_ids are required for specific scope",
        )

    clients = await _load_scope_clients(data.client_ids, permission_ctx.organization_id, db)
    membership.client_access_mode = data.client_access_mode
    membership.clients = clients if data.client_access_mode == MembershipClientAccessMode.SPECIFIC else []
    await db.flush()
    return _team_member_response(membership)
