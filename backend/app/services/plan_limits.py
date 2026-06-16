"""Plan registry and usage enforcement for SaaS limits."""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.exchange import Exchange
from app.models.membership import (
    Invitation,
    InvitationStatus,
    Membership,
    MembershipStatus,
    Team,
    TeamStatus,
)
from app.models.organization import Organization, PlanType
from app.models.wallet import Wallet

PlanLimitResource = Literal[
    "members",
    "teams",
    "portfolios",
    "wallets",
    "exchanges",
    "bots",
    "strategies",
]


PLAN_RESOURCES: tuple[PlanLimitResource, ...] = (
    "members",
    "teams",
    "portfolios",
    "wallets",
    "exchanges",
    "bots",
    "strategies",
)


@dataclass(frozen=True)
class PlanDefinition:
    """Static plan definition used until billing becomes data-driven."""

    plan: PlanType
    label: str
    limits: dict[PlanLimitResource, int | None]
    features: tuple[str, ...]


PLAN_DEFINITIONS: dict[PlanType, PlanDefinition] = {
    PlanType.FREE: PlanDefinition(
        plan=PlanType.FREE,
        label="Free",
        limits={
            "members": 3,
            "teams": 1,
            "portfolios": 5,
            "wallets": 10,
            "exchanges": 3,
            "bots": 0,
            "strategies": 3,
        },
        features=(
            "Carteiras e exchanges para validar a operacao",
            "Equipe pequena com limite de membros",
            "Sem bots operacionais",
        ),
    ),
    PlanType.PRO: PlanDefinition(
        plan=PlanType.PRO,
        label="Pro",
        limits={
            "members": 15,
            "teams": 5,
            "portfolios": 50,
            "wallets": 150,
            "exchanges": 30,
            "bots": 5,
            "strategies": 50,
        },
        features=(
            "Mais carteiras, exchanges e equipes",
            "Bots e estrategias liberados com limite operacional",
            "Escopo por carteira para membros e equipes",
        ),
    ),
    PlanType.ENTERPRISE: PlanDefinition(
        plan=PlanType.ENTERPRISE,
        label="Enterprise",
        limits={
            "members": None,
            "teams": None,
            "portfolios": None,
            "wallets": None,
            "exchanges": None,
            "bots": None,
            "strategies": None,
        },
        features=(
            "Limites customizados por contrato",
            "Operacao multi-equipe sem teto padrao",
            "Governanca e suporte avancados",
        ),
    ),
}


def list_plan_definitions() -> list[PlanDefinition]:
    """Return plans in commercial display order."""
    return [
        PLAN_DEFINITIONS[PlanType.FREE],
        PLAN_DEFINITIONS[PlanType.PRO],
        PLAN_DEFINITIONS[PlanType.ENTERPRISE],
    ]


def get_plan_definition(plan: PlanType) -> PlanDefinition:
    """Return a plan definition with a safe Free fallback."""
    return PLAN_DEFINITIONS.get(plan, PLAN_DEFINITIONS[PlanType.FREE])


async def get_plan_usage(
    db: AsyncSession,
    organization_id: UUID,
) -> dict[PlanLimitResource, int]:
    """Return usage counters for resources governed by plan limits."""
    active_members = await db.scalar(
        select(func.count(distinct(Membership.user_id))).where(
            Membership.organization_id == organization_id,
            Membership.status == MembershipStatus.ACTIVE,
        )
    )
    pending_invites = await db.scalar(
        select(func.count(Invitation.id)).where(
            Invitation.organization_id == organization_id,
            Invitation.status == InvitationStatus.PENDING,
            Invitation.expires_at > datetime.now(timezone.utc),
        )
    )
    teams = await db.scalar(
        select(func.count(Team.id)).where(
            Team.organization_id == organization_id,
            Team.status == TeamStatus.ACTIVE,
        )
    )
    portfolios = await db.scalar(
        select(func.count(Client.id)).where(Client.organization_id == organization_id)
    )
    wallets = await db.scalar(
        select(func.count(Wallet.id))
        .join(Client, Client.id == Wallet.client_id)
        .where(Client.organization_id == organization_id)
    )
    exchanges = await db.scalar(
        select(func.count(Exchange.id))
        .join(Client, Client.id == Exchange.client_id)
        .where(Client.organization_id == organization_id)
    )

    return {
        "members": int(active_members or 0) + int(pending_invites or 0),
        "teams": int(teams or 0),
        "portfolios": int(portfolios or 0),
        "wallets": int(wallets or 0),
        "exchanges": int(exchanges or 0),
        "bots": 0,
        "strategies": 0,
    }


async def get_plan_usage_many(
    db: AsyncSession,
    organization_ids: list[UUID],
) -> dict[UUID, dict[PlanLimitResource, int]]:
    """Return usage counters for many organizations without N+1 queries."""
    usage_by_org: dict[UUID, dict[PlanLimitResource, int]] = {
        organization_id: {resource: 0 for resource in PLAN_RESOURCES}
        for organization_id in organization_ids
    }
    if not organization_ids:
        return usage_by_org

    active_members_result = await db.execute(
        select(
            Membership.organization_id,
            func.count(distinct(Membership.user_id)),
        )
        .where(
            Membership.organization_id.in_(organization_ids),
            Membership.status == MembershipStatus.ACTIVE,
        )
        .group_by(Membership.organization_id)
    )
    for organization_id, count in active_members_result.all():
        usage_by_org[organization_id]["members"] += int(count or 0)

    pending_invites_result = await db.execute(
        select(Invitation.organization_id, func.count(Invitation.id))
        .where(
            Invitation.organization_id.in_(organization_ids),
            Invitation.status == InvitationStatus.PENDING,
            Invitation.expires_at > datetime.now(timezone.utc),
        )
        .group_by(Invitation.organization_id)
    )
    for organization_id, count in pending_invites_result.all():
        usage_by_org[organization_id]["members"] += int(count or 0)

    teams_result = await db.execute(
        select(Team.organization_id, func.count(Team.id))
        .where(
            Team.organization_id.in_(organization_ids),
            Team.status == TeamStatus.ACTIVE,
        )
        .group_by(Team.organization_id)
    )
    for organization_id, count in teams_result.all():
        usage_by_org[organization_id]["teams"] = int(count or 0)

    portfolios_result = await db.execute(
        select(Client.organization_id, func.count(Client.id))
        .where(Client.organization_id.in_(organization_ids))
        .group_by(Client.organization_id)
    )
    for organization_id, count in portfolios_result.all():
        usage_by_org[organization_id]["portfolios"] = int(count or 0)

    wallets_result = await db.execute(
        select(Client.organization_id, func.count(Wallet.id))
        .select_from(Wallet)
        .join(Client, Client.id == Wallet.client_id)
        .where(Client.organization_id.in_(organization_ids))
        .group_by(Client.organization_id)
    )
    for organization_id, count in wallets_result.all():
        usage_by_org[organization_id]["wallets"] = int(count or 0)

    exchanges_result = await db.execute(
        select(Client.organization_id, func.count(Exchange.id))
        .select_from(Exchange)
        .join(Client, Client.id == Exchange.client_id)
        .where(Client.organization_id.in_(organization_ids))
        .group_by(Client.organization_id)
    )
    for organization_id, count in exchanges_result.all():
        usage_by_org[organization_id]["exchanges"] = int(count or 0)

    return usage_by_org


def calculate_remaining(
    limits: dict[PlanLimitResource, int | None],
    usage: dict[PlanLimitResource, int],
) -> dict[PlanLimitResource, int | None]:
    """Calculate remaining capacity per resource."""
    return {
        resource: None if limits[resource] is None else max(limits[resource] - usage[resource], 0)
        for resource in PLAN_RESOURCES
    }


def calculate_over_limit(
    limits: dict[PlanLimitResource, int | None],
    usage: dict[PlanLimitResource, int],
) -> dict[PlanLimitResource, bool]:
    """Return whether each resource is above the current plan limit."""
    return {
        resource: False if limits[resource] is None else usage[resource] > limits[resource]
        for resource in PLAN_RESOURCES
    }


async def enforce_plan_limit(
    db: AsyncSession,
    organization_id: UUID,
    resource: PlanLimitResource,
    increment: int = 1,
) -> None:
    """Serialize and enforce a plan limit before creating a limited resource."""
    result = await db.execute(
        select(Organization)
        .where(Organization.id == organization_id)
        .with_for_update()
    )
    organization = result.scalar_one_or_none()
    if organization is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    definition = get_plan_definition(organization.plan)
    limit = definition.limits[resource]
    if limit is None:
        return

    usage = await get_plan_usage(db, organization_id)
    projected = usage[resource] + increment
    if projected > limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "message": "Plan limit reached",
                "plan": organization.plan.value,
                "resource": resource,
                "limit": limit,
                "usage": usage[resource],
            },
        )
