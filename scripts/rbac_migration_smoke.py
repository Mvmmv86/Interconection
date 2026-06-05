"""Smoke checks for RBAC foundation migration (0b).

This script is intentionally simple and safe for production-like environments:
- it only runs read-only SQL checks;
- it does not change flags or run writes;
- it validates the migration artifacts that must exist after `alembic upgrade head`.
"""

from __future__ import annotations

import os
import re
from pathlib import Path

import asyncio

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

try:
    from dotenv import load_dotenv
except Exception:  # pragma: no cover
    load_dotenv = None


FALLBACK_REQUIRED_OWNER_PERMISSIONS = {
    "dashboard:view",
    "clients:list",
    "clients:create",
    "clients:edit",
    "clients:delete",
    "wallets:view",
    "wallets:create",
    "wallets:edit",
    "wallets:delete",
    "exchanges:view",
    "exchanges:create",
    "exchanges:delete",
    "exchanges:sync",
    "manual_assets:view",
    "manual_assets:create",
    "manual_assets:edit",
    "manual_assets:delete",
    "positions:view",
}


def _collect_required_route_permissions(repo_root: Path) -> set[str]:
    endpoints_dir = repo_root / "backend" / "app" / "api" / "v1" / "endpoints"
    if not endpoints_dir.exists():
        return FALLBACK_REQUIRED_OWNER_PERMISSIONS

    required_permissions: set[str] = set()
    pattern = re.compile(r'require_permission\("([^"]+)"')
    for path in endpoints_dir.glob("*.py"):
        required_permissions.update(pattern.findall(path.read_text(encoding="utf-8")))

    return required_permissions or FALLBACK_REQUIRED_OWNER_PERMISSIONS


async def _assert(
    label: str,
    condition: bool,
    expected: str,
    actual: str | int | None = None,
) -> None:
    if condition:
        print(f"OK  [{label}]")
    else:
        print(f"ERR [{label}] {expected} | actual={actual}")
        raise SystemExit(1)


async def main() -> None:
    # Keep backward compatibility for different working directories.
    base_dir = Path(__file__).resolve().parent
    repo_root = base_dir.parent
    required_owner_permissions = _collect_required_route_permissions(repo_root)
    backend_dotenv = base_dir.parent / "backend" / ".env"
    if backend_dotenv.exists() and load_dotenv is not None:
        load_dotenv(backend_dotenv)

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("ERR missing DATABASE_URL (set in backend/.env or env)")
        raise SystemExit(1)

    engine = create_async_engine(database_url)
    async with engine.connect() as conn:
        # migration + schema shape
        result = await conn.execute(
            text(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'users'
                  AND table_schema = 'public'
                  AND column_name IN ('is_superuser', 'token_version', 'organization_id')
                """
            )
        )
        user_columns = {row.column_name for row in result}
        await _assert("users columns", {"is_superuser", "token_version", "organization_id"} <= user_columns,
                      "expected users.is_superuser, users.token_version and users.organization_id")

        rows = await conn.execute(
            text(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name IN ('roles','role_permissions','memberships','membership_permission_overrides','membership_clients','invitations')
                """
            )
        )
        present_tables = {row.table_name for row in rows}
        required_tables = {
            "roles",
            "role_permissions",
            "memberships",
            "membership_permission_overrides",
            "membership_clients",
            "invitations",
        }
        await _assert("RBAC tables", required_tables <= present_tables, f"expected {required_tables}")

        # Enum values must match models (UPPERCASE names).
        enum_rows = await conn.execute(
            text(
                """
                SELECT t.typname, e.enumlabel
                FROM pg_type t
                JOIN pg_enum e ON e.enumtypid = t.oid
                WHERE t.typname IN ('membershipstatus', 'membershipclientaccessmode', 'membershippermissioneffect', 'invitationstatus')
                ORDER BY t.typname, e.enumsortorder
                """
            )
        )
        enums = {}
        for row in enum_rows:
            enums.setdefault(row.typname, set()).add(row.enumlabel)

        await _assert(
            "membershipstatus enum values",
            enums.get("membershipstatus") == {"ACTIVE", "INVITED", "SUSPENDED"},
            "ACTIVE, INVITED, SUSPENDED",
            enums.get("membershipstatus"),
        )
        await _assert(
            "membershipclientaccessmode enum values",
            enums.get("membershipclientaccessmode") == {"ALL", "SPECIFIC"},
            "ALL, SPECIFIC",
            enums.get("membershipclientaccessmode"),
        )
        await _assert(
            "membershippermissioneffect enum values",
            enums.get("membershippermissioneffect") == {"GRANT", "DENY"},
            "GRANT, DENY",
            enums.get("membershippermissioneffect"),
        )
        await _assert(
            "invitationstatus enum values",
            enums.get("invitationstatus") == {"PENDING", "ACCEPTED", "REVOKED", "EXPIRED"},
            "PENDING, ACCEPTED, REVOKED, EXPIRED",
            enums.get("invitationstatus"),
        )

        system_roles = {"owner": 1, "admin": 1, "manager": 1, "viewer": 1}
        role_counts = await conn.execute(
            text(
                """
                SELECT name, count(*) AS total
                FROM roles
                WHERE organization_id IS NULL
                  AND is_system = true
                GROUP BY name
                """
            )
        )
        roles = {row.name: row.total for row in role_counts}
        for role_name, expected_total in system_roles.items():
            await _assert(
                f"system role seeded: {role_name}",
                roles.get(role_name, 0) == expected_total,
                f"{expected_total} role named {role_name} (is_system=true, organization_id IS NULL)",
                roles.get(role_name),
            )

        owner_permissions_result = await conn.execute(
            text(
                """
                SELECT rp.permission_key
                FROM role_permissions rp
                JOIN roles r ON r.id = rp.role_id
                WHERE r.organization_id IS NULL
                  AND r.is_system = true
                  AND r.name = 'owner'
                """
            )
        )
        owner_permissions = {row.permission_key for row in owner_permissions_result}
        missing_owner_permissions = required_owner_permissions - owner_permissions
        await _assert(
            "owner route permission coverage",
            not missing_owner_permissions,
            "owner has every permission used by RBAC-protected routes",
            ", ".join(sorted(missing_owner_permissions)) or None,
        )

        invitation_indexes_result = await conn.execute(
            text(
                """
                SELECT indexdef
                FROM pg_indexes
                WHERE schemaname = 'public'
                  AND tablename = 'invitations'
                  AND indexname = 'uq_invitations_org_email_active'
                """
            )
        )
        invitation_index = invitation_indexes_result.scalar_one_or_none()
        await _assert(
            "pending invitation partial unique index",
            invitation_index is not None
            and "WHERE" in invitation_index
            and "PENDING" in invitation_index,
            "partial unique index on pending invitation email per organization",
            invitation_index,
        )

        legacy_backfill_gap = await conn.scalar(
            text(
                """
                SELECT COUNT(*)
                FROM users u
                WHERE u.organization_id IS NOT NULL
                  AND NOT EXISTS (
                    SELECT 1
                    FROM memberships m
                    WHERE m.user_id = u.id AND m.organization_id = u.organization_id
                  )
                """
            )
        )
        await _assert("legacy users mapped into memberships", legacy_backfill_gap == 0, "0 missing mappings", legacy_backfill_gap)

        pending_invites = await conn.scalar(
            text("SELECT count(*) FROM invitations WHERE status='PENDING'")
        )
        print(f"INFO pending invitations: {pending_invites}")

    await engine.dispose()
    print("OK all RBAC foundation checks passed")


if __name__ == "__main__":
    asyncio.run(main())
