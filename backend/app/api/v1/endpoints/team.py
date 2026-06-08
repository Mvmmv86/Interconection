"""Team administration endpoints."""

from datetime import datetime, timedelta, timezone
import re
from secrets import token_urlsafe
from typing import Annotated, List
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import and_, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.api.deps import (
    DBSession,
    MembershipAuthContext,
    invalidate_authz_cache,
    require_permission,
)
from app.core.security import get_password_hash
from app.models.audit_log import AuditAction
from app.models.client import Client
from app.models.membership import (
    Invitation,
    InvitationStatus,
    Membership,
    MembershipClientAccessMode,
    MembershipStatus,
    Role,
    Team,
    TeamMember,
    TeamStatus,
)
from app.models.user import User, UserRole
from app.schemas.common import SuccessResponse
from app.schemas.team import (
    TeamInvitationAccept,
    TeamInvitationAcceptResponse,
    TeamInvitationCreate,
    TeamInvitationResponse,
    AccountTeamCreate,
    AccountTeamMemberCreate,
    AccountTeamResponse,
    AccountTeamUpdate,
    TeamMemberResponse,
    TeamMemberScopeUpdate,
    TeamMemberUpdate,
    TeamRoleResponse,
    TeamUserSummary,
)
from app.services.audit_service import record_audit_event

router = APIRouter()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    slug = slug.strip("-")
    return slug or "team"


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
        team_id=invitation.team_id,
        team_name=invitation.team.name if invitation.team else None,
        token=invitation.token,
        status=invitation.status,
        expires_at=invitation.expires_at,
        invited_by_user_id=invitation.invited_by_user_id,
        accepted_at=invitation.accepted_at,
        notes=invitation.notes,
        created_at=invitation.created_at,
        updated_at=invitation.updated_at,
    )


def _account_team_response(team: Team, member_count: int | None = None) -> AccountTeamResponse:
    return AccountTeamResponse(
        id=team.id,
        organization_id=team.organization_id,
        name=team.name,
        slug=team.slug,
        description=team.description,
        color=team.color,
        status=team.status,
        role_id=team.role_id,
        role_name=team.role.name if team.role else None,
        client_access_mode=team.client_access_mode,
        client_ids=[client.id for client in team.clients],
        member_count=len(team.memberships) if member_count is None else member_count,
        created_by_user_id=team.created_by_user_id,
        created_at=team.created_at,
        updated_at=team.updated_at,
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


async def _get_team_for_admin(
    team_id: UUID,
    organization_id: UUID,
    db: DBSession,
) -> Team:
    result = await db.execute(
        select(Team)
        .options(
            selectinload(Team.role),
            selectinload(Team.clients),
            selectinload(Team.memberships),
        )
        .where(
            Team.id == team_id,
            Team.organization_id == organization_id,
        )
        .with_for_update()
    )
    team = result.scalar_one_or_none()
    if team is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )
    return team


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


@router.get("/teams", response_model=List[AccountTeamResponse])
async def list_account_teams(
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("teams:view", route_key="team", force=True)),
    ],
    db: DBSession,
) -> List[AccountTeamResponse]:
    """List named teams inside the active account."""
    result = await db.execute(
        select(Team)
        .options(
            selectinload(Team.role),
            selectinload(Team.clients),
            selectinload(Team.memberships),
        )
        .where(Team.organization_id == permission_ctx.organization_id)
        .order_by(Team.created_at.asc())
    )
    return [_account_team_response(team) for team in result.scalars().unique().all()]


@router.post("/teams", response_model=AccountTeamResponse, status_code=status.HTTP_201_CREATED)
async def create_account_team(
    data: AccountTeamCreate,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("teams:create", route_key="team", force=True)),
    ],
    db: DBSession,
    request: Request,
) -> AccountTeamResponse:
    """Create a named team and its grouped access policy."""
    if data.client_access_mode == MembershipClientAccessMode.SPECIFIC and not data.client_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="client_ids are required for specific scope",
        )

    role = (
        await _get_assignable_role(data.role_id, permission_ctx.organization_id, db)
        if data.role_id
        else None
    )
    clients = await _load_scope_clients(data.client_ids, permission_ctx.organization_id, db)
    base_slug = _slugify(data.name)
    slug = base_slug
    suffix = 2
    while await db.scalar(
        select(func.count(Team.id)).where(
            Team.organization_id == permission_ctx.organization_id,
            Team.slug == slug,
        )
    ):
        slug = f"{base_slug}-{suffix}"
        suffix += 1

    team = Team(
        id=uuid4(),
        organization_id=permission_ctx.organization_id,
        name=data.name.strip(),
        slug=slug,
        description=data.description,
        color=data.color,
        status=TeamStatus.ACTIVE,
        role_id=role.id if role else None,
        client_access_mode=data.client_access_mode,
        created_by_user_id=permission_ctx.user.id,
    )
    team.clients = clients if data.client_access_mode == MembershipClientAccessMode.SPECIFIC else []
    db.add(team)
    await db.flush()
    invalidate_authz_cache(organization_id=permission_ctx.organization_id)
    await record_audit_event(
        db,
        organization_id=permission_ctx.organization_id,
        user_id=permission_ctx.user.id,
        action=AuditAction.CREATE,
        resource_type="team",
        resource_id=team.id,
        description="Account team created",
        metadata={
            "name": team.name,
            "role_id": team.role_id,
            "client_access_mode": team.client_access_mode,
            "client_ids": [client.id for client in team.clients],
        },
        request=request,
    )
    team.role = role
    return _account_team_response(team, member_count=0)


@router.patch("/teams/{team_id}", response_model=AccountTeamResponse)
async def update_account_team(
    team_id: UUID,
    data: AccountTeamUpdate,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("teams:edit", route_key="team", force=True)),
    ],
    db: DBSession,
    request: Request,
) -> AccountTeamResponse:
    """Update a named team and invalidate grouped authorization."""
    team = await _get_team_for_admin(team_id, permission_ctx.organization_id, db)
    update_data = data.model_dump(exclude_unset=True)

    if data.client_access_mode == MembershipClientAccessMode.SPECIFIC and not data.client_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="client_ids are required for specific scope",
        )

    if data.name is not None and data.name.strip() != team.name:
        base_slug = _slugify(data.name)
        slug = base_slug
        suffix = 2
        while await db.scalar(
            select(func.count(Team.id)).where(
                Team.organization_id == permission_ctx.organization_id,
                Team.slug == slug,
                Team.id != team.id,
            )
        ):
            slug = f"{base_slug}-{suffix}"
            suffix += 1
        team.name = data.name.strip()
        team.slug = slug
    if data.description is not None:
        team.description = data.description
    if data.color is not None:
        team.color = data.color
    if data.status is not None:
        team.status = data.status
    if data.role_id is not None:
        role = await _get_assignable_role(data.role_id, permission_ctx.organization_id, db)
        team.role_id = role.id
        team.role = role
    if data.client_access_mode is not None:
        team.client_access_mode = data.client_access_mode
    if data.client_ids is not None:
        clients = await _load_scope_clients(data.client_ids, permission_ctx.organization_id, db)
        team.clients = clients if team.client_access_mode == MembershipClientAccessMode.SPECIFIC else []
    elif team.client_access_mode == MembershipClientAccessMode.ALL:
        team.clients = []

    await db.flush()
    invalidate_authz_cache(organization_id=permission_ctx.organization_id)
    await record_audit_event(
        db,
        organization_id=permission_ctx.organization_id,
        user_id=permission_ctx.user.id,
        action=AuditAction.UPDATE,
        resource_type="team",
        resource_id=team.id,
        description="Account team updated",
        metadata={"updated_fields": update_data},
        request=request,
    )
    return _account_team_response(team)


@router.delete("/teams/{team_id}", response_model=SuccessResponse)
async def archive_account_team(
    team_id: UUID,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("teams:delete", route_key="team", force=True)),
    ],
    db: DBSession,
    request: Request,
) -> SuccessResponse:
    """Archive a team without deleting historical audit context."""
    team = await _get_team_for_admin(team_id, permission_ctx.organization_id, db)
    team.status = TeamStatus.ARCHIVED
    await db.flush()
    invalidate_authz_cache(organization_id=permission_ctx.organization_id)
    await record_audit_event(
        db,
        organization_id=permission_ctx.organization_id,
        user_id=permission_ctx.user.id,
        action=AuditAction.DELETE,
        resource_type="team",
        resource_id=team.id,
        description="Account team archived",
        metadata={"name": team.name},
        request=request,
    )
    return SuccessResponse(message="Team archived successfully")


@router.get("/teams/{team_id}/members", response_model=List[TeamMemberResponse])
async def list_account_team_members(
    team_id: UUID,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("teams:view", route_key="team", force=True)),
    ],
    db: DBSession,
) -> List[TeamMemberResponse]:
    """List members assigned to a named team."""
    team = await _get_team_for_admin(team_id, permission_ctx.organization_id, db)
    membership_ids = [membership.id for membership in team.memberships]
    if not membership_ids:
        return []
    result = await db.execute(
        select(Membership)
        .options(
            selectinload(Membership.user),
            selectinload(Membership.role),
            selectinload(Membership.clients),
        )
        .where(Membership.id.in_(membership_ids))
        .order_by(Membership.created_at.asc())
    )
    return [_team_member_response(membership) for membership in result.scalars().unique().all()]


@router.post("/teams/{team_id}/members", response_model=AccountTeamResponse)
async def add_account_team_member(
    team_id: UUID,
    data: AccountTeamMemberCreate,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("teams:members", route_key="team", force=True)),
    ],
    db: DBSession,
    request: Request,
) -> AccountTeamResponse:
    """Add a membership to a named team idempotently."""
    team = await _get_team_for_admin(team_id, permission_ctx.organization_id, db)
    membership = await _get_membership_for_admin(
        data.membership_id,
        permission_ctx.organization_id,
        db,
    )
    exists = await db.scalar(
        select(func.count(TeamMember.team_id)).where(
            TeamMember.team_id == team.id,
            TeamMember.membership_id == membership.id,
        )
    )
    if not exists:
        db.add(
            TeamMember(
                team_id=team.id,
                membership_id=membership.id,
                added_by_user_id=permission_ctx.user.id,
            )
        )
        membership.user.token_version = int(membership.user.token_version or 0) + 1
        await db.flush()
        invalidate_authz_cache(
            user_id=membership.user_id,
            organization_id=permission_ctx.organization_id,
        )
        await record_audit_event(
            db,
            organization_id=permission_ctx.organization_id,
            user_id=permission_ctx.user.id,
            action=AuditAction.UPDATE,
            resource_type="team_member",
            resource_id=team.id,
            description="Member added to account team",
            metadata={
                "team_id": team.id,
                "membership_id": membership.id,
                "target_user_id": membership.user_id,
                "token_version": membership.user.token_version,
            },
            request=request,
        )
    member_count = await db.scalar(
        select(func.count(TeamMember.membership_id)).where(TeamMember.team_id == team.id)
    )
    return _account_team_response(team, member_count=int(member_count or 0))


@router.delete("/teams/{team_id}/members/{membership_id}", response_model=SuccessResponse)
async def remove_account_team_member(
    team_id: UUID,
    membership_id: UUID,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("teams:members", route_key="team", force=True)),
    ],
    db: DBSession,
    request: Request,
) -> SuccessResponse:
    """Remove a membership from a named team."""
    team = await _get_team_for_admin(team_id, permission_ctx.organization_id, db)
    membership = await _get_membership_for_admin(
        membership_id,
        permission_ctx.organization_id,
        db,
    )
    result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team.id,
            TeamMember.membership_id == membership.id,
        )
    )
    team_member = result.scalar_one_or_none()
    if team_member is not None:
        await db.delete(team_member)
        membership.user.token_version = int(membership.user.token_version or 0) + 1
        await db.flush()
        invalidate_authz_cache(
            user_id=membership.user_id,
            organization_id=permission_ctx.organization_id,
        )
        await record_audit_event(
            db,
            organization_id=permission_ctx.organization_id,
            user_id=permission_ctx.user.id,
            action=AuditAction.UPDATE,
            resource_type="team_member",
            resource_id=team.id,
            description="Member removed from account team",
            metadata={
                "team_id": team.id,
                "membership_id": membership.id,
                "target_user_id": membership.user_id,
                "token_version": membership.user.token_version,
            },
            request=request,
        )
    return SuccessResponse(message="Member removed from team")


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
    request: Request,
) -> TeamInvitationResponse:
    """Create a pending team invitation."""
    role = await _get_assignable_role(data.role_id, permission_ctx.organization_id, db)
    team = (
        await _get_team_for_admin(data.team_id, permission_ctx.organization_id, db)
        if data.team_id
        else None
    )
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
        team_id=team.id if team else None,
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
    await record_audit_event(
        db,
        organization_id=permission_ctx.organization_id,
        user_id=permission_ctx.user.id,
        action=AuditAction.CREATE,
        resource_type="invitation",
        resource_id=invitation.id,
        description="Team invitation created",
        metadata={
            "email": invitation.email,
            "role_id": invitation.role_id,
            "role_name": role.name,
            "team_id": invitation.team_id,
            "team_name": team.name if team else None,
            "expires_at": invitation.expires_at,
        },
        request=request,
    )
    invitation.team = team
    return _team_invitation_response(invitation)


@router.post(
    "/invitations/{token}/accept",
    response_model=TeamInvitationAcceptResponse,
)
async def accept_team_invitation(
    token: str,
    data: TeamInvitationAccept,
    db: DBSession,
    request: Request,
) -> TeamInvitationAcceptResponse:
    """Accept an invitation. This endpoint is intentionally public."""
    result = await db.execute(
        select(Invitation)
        .options(selectinload(Invitation.role), selectinload(Invitation.team))
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

    if invitation.team_id is not None:
        team_member_exists = await db.scalar(
            select(func.count(TeamMember.team_id)).where(
                TeamMember.team_id == invitation.team_id,
                TeamMember.membership_id == membership.id,
            )
        )
        if not team_member_exists:
            db.add(
                TeamMember(
                    team_id=invitation.team_id,
                    membership_id=membership.id,
                    added_by_user_id=invitation.invited_by_user_id,
                )
            )

    invitation.status = InvitationStatus.ACCEPTED
    invitation.accepted_at = now
    user.token_version = int(user.token_version or 0) + 1
    await db.flush()
    invalidate_authz_cache(user_id=user.id, organization_id=invitation.organization_id)
    await record_audit_event(
        db,
        organization_id=invitation.organization_id,
        user_id=user.id,
        action=AuditAction.UPDATE,
        resource_type="invitation",
        resource_id=invitation.id,
        description="Team invitation accepted",
        metadata={
            "email": email,
            "membership_id": membership.id,
            "role_id": invitation.role_id,
            "team_id": invitation.team_id,
            "created_user": created_user,
        },
        request=request,
    )

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
    request: Request,
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

    security_changed = False
    if data.role_id is not None:
        role = await _get_assignable_role(data.role_id, permission_ctx.organization_id, db)
        if membership.role_id != role.id:
            membership.role_id = role.id
            membership.role = role
            security_changed = True
    if data.status is not None:
        if membership.status != data.status:
            security_changed = True
            membership.status = data.status
        if data.status == MembershipStatus.ACTIVE and membership.accepted_at is None:
            membership.accepted_at = _now()

    if security_changed:
        membership.user.token_version = int(membership.user.token_version or 0) + 1

    await db.flush()
    if security_changed:
        invalidate_authz_cache(
            user_id=membership.user_id,
            organization_id=membership.organization_id,
        )
        await record_audit_event(
            db,
            organization_id=membership.organization_id,
            user_id=permission_ctx.user.id,
            action=AuditAction.UPDATE,
            resource_type="membership",
            resource_id=membership.id,
            description="Team member role or status updated",
            metadata={
                "target_user_id": membership.user_id,
                "role_id": membership.role_id,
                "status": membership.status,
                "token_version": membership.user.token_version,
            },
            request=request,
        )
    return _team_member_response(membership)


@router.delete("/members/{membership_id}", response_model=SuccessResponse)
async def revoke_team_member(
    membership_id: UUID,
    permission_ctx: Annotated[
        MembershipAuthContext,
        Depends(require_permission("members:revoke", route_key="team", force=True)),
    ],
    db: DBSession,
    request: Request,
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
    membership.user.token_version = int(membership.user.token_version or 0) + 1
    await db.flush()
    invalidate_authz_cache(
        user_id=membership.user_id,
        organization_id=membership.organization_id,
    )
    await record_audit_event(
        db,
        organization_id=membership.organization_id,
        user_id=permission_ctx.user.id,
        action=AuditAction.DELETE,
        resource_type="membership",
        resource_id=membership.id,
        description="Team member revoked",
        metadata={
            "target_user_id": membership.user_id,
            "token_version": membership.user.token_version,
        },
        request=request,
    )
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
    request: Request,
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

    previous_mode = membership.client_access_mode
    previous_client_ids = {client.id for client in membership.clients}
    clients = await _load_scope_clients(data.client_ids, permission_ctx.organization_id, db)
    next_client_ids = {client.id for client in clients}
    membership.client_access_mode = data.client_access_mode
    membership.clients = clients if data.client_access_mode == MembershipClientAccessMode.SPECIFIC else []
    next_effective_client_ids = (
        next_client_ids
        if data.client_access_mode == MembershipClientAccessMode.SPECIFIC
        else set()
    )
    if previous_mode != data.client_access_mode or previous_client_ids != next_effective_client_ids:
        membership.user.token_version = int(membership.user.token_version or 0) + 1
    await db.flush()
    invalidate_authz_cache(
        user_id=membership.user_id,
        organization_id=membership.organization_id,
    )
    if previous_mode != data.client_access_mode or previous_client_ids != next_effective_client_ids:
        await record_audit_event(
            db,
            organization_id=membership.organization_id,
            user_id=permission_ctx.user.id,
            action=AuditAction.UPDATE,
            resource_type="membership_scope",
            resource_id=membership.id,
            description="Team member client scope updated",
            metadata={
                "target_user_id": membership.user_id,
                "previous_mode": previous_mode,
                "previous_client_ids": previous_client_ids,
                "client_access_mode": membership.client_access_mode,
                "client_ids": next_effective_client_ids,
                "token_version": membership.user.token_version,
            },
            request=request,
        )
    return _team_member_response(membership)
