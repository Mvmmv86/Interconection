"""Audit log helpers for security-sensitive actions."""

from datetime import date, datetime, timezone
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_maker
from app.models.audit_log import AuditAction, AuditLog


def _json_safe(value: Any) -> Any:
    """Convert common Python values to JSONB-safe primitives."""
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(item) for item in value]
    return value


def _request_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip()
    return request.client.host if request.client else None


def build_audit_log(
    *,
    organization_id: UUID,
    action: AuditAction,
    resource_type: str,
    user_id: UUID | None = None,
    resource_id: UUID | None = None,
    description: str | None = None,
    metadata: dict[str, Any] | None = None,
    request: Request | None = None,
) -> AuditLog:
    """Build an AuditLog instance with request context."""
    return AuditLog(
        id=uuid4(),
        organization_id=organization_id,
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        description=description,
        log_metadata=_json_safe(metadata) if metadata else None,
        ip_address=_request_ip(request),
        user_agent=request.headers.get("user-agent") if request is not None else None,
        timestamp=datetime.now(timezone.utc),
    )


async def record_audit_event(
    db: AsyncSession,
    *,
    organization_id: UUID | None,
    action: AuditAction,
    resource_type: str,
    user_id: UUID | None = None,
    resource_id: UUID | None = None,
    description: str | None = None,
    metadata: dict[str, Any] | None = None,
    request: Request | None = None,
) -> None:
    """Record an audit event in the caller's transaction."""
    if organization_id is None:
        return

    db.add(
        build_audit_log(
            organization_id=organization_id,
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            description=description,
            metadata=metadata,
            request=request,
        )
    )


async def record_audit_event_immediate(
    *,
    organization_id: UUID | None,
    action: AuditAction,
    resource_type: str,
    user_id: UUID | None = None,
    resource_id: UUID | None = None,
    description: str | None = None,
    metadata: dict[str, Any] | None = None,
    request: Request | None = None,
) -> None:
    """Record an audit event in its own transaction.

    Use this for failure paths where the request transaction is expected to
    rollback, but the security/audit event still needs to be durable.
    """
    if organization_id is None:
        return

    async with async_session_maker() as session:
        session.add(
            build_audit_log(
                organization_id=organization_id,
                user_id=user_id,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                description=description,
                metadata=metadata,
                request=request,
            )
        )
        await session.commit()
