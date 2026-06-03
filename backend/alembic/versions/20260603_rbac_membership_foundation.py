"""RBAC membership foundation

Revision ID: e4c8d9a2f7b3
Revises: b36f224e3448
Create Date: 2026-06-03 00:00:00.000000+00:00
"""
from __future__ import annotations

from datetime import datetime
from typing import Sequence, Union
from uuid import uuid4

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e4c8d9a2f7b3"
down_revision: Union[str, None] = "b36f224e3448"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Legacy users belonged to one organization and used DB-level CASCADE delete.
    # Keep historical semantics safe when we start backfilling memberships.
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_organization_id_fkey")
    op.create_foreign_key(
        "fk_users_organization_id_set_null",
        "users",
        "organizations",
        ["organization_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.alter_column("users", "organization_id", existing_type=postgresql.UUID(), nullable=True)
    op.add_column(
        "users",
        sa.Column("is_superuser", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "users",
        sa.Column("token_version", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )

    op.create_table(
        "roles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "name", name="uq_roles_org_name"),
    )
    op.create_index(
        "uq_roles_system_name",
        "roles",
        ["name"],
        unique=True,
        postgresql_where=sa.text("organization_id IS NULL"),
    )

    op.create_table(
        "role_permissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("permission_key", sa.String(length=64), nullable=False),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("role_id", "permission_key", name="uq_role_permissions"),
    )

    op.create_table(
        "memberships",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "role_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum("ACTIVE", "INVITED", "SUSPENDED", name="membershipstatus"),
            nullable=False,
            server_default=sa.text("'INVITED'"),
        ),
        sa.Column(
            "client_access_mode",
            sa.Enum("ALL", "SPECIFIC", name="membershipclientaccessmode"),
            nullable=False,
            server_default=sa.text("'ALL'"),
        ),
        sa.Column(
            "invited_by_user_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("invited_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["invited_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "organization_id", name="uq_memberships_user_org"),
    )

    op.create_table(
        "membership_permission_overrides",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("membership_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("permission_key", sa.String(length=64), nullable=False),
        sa.Column(
            "effect",
            sa.Enum("GRANT", "DENY", name="membershippermissioneffect"),
            nullable=False,
            server_default=sa.text("'GRANT'"),
        ),
        sa.ForeignKeyConstraint(["membership_id"], ["memberships.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "membership_id",
            "permission_key",
            name="uq_membership_permission_overrides",
        ),
    )

    op.create_table(
        "membership_clients",
        sa.Column("membership_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["membership_id"], ["memberships.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("membership_id", "client_id"),
    )

    op.create_table(
        "invitations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("role_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "token",
            sa.String(length=255),
            nullable=False,
            unique=True,
        ),
        sa.Column(
        "status",
        sa.Enum("PENDING", "ACCEPTED", "REVOKED", "EXPIRED", name="invitationstatus"),
        nullable=False,
        server_default=sa.text("'PENDING'"),
        ),
        sa.Column(
            "invited_by_user_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["invited_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_memberships_organization_id", "memberships", ["organization_id"])
    op.create_index("ix_memberships_user_id", "memberships", ["user_id"])
    op.create_index("ix_memberships_role_id", "memberships", ["role_id"])
    op.create_index("ix_membership_clients_client_id", "membership_clients", ["client_id"])
    op.create_index("ix_role_permissions_permission", "role_permissions", ["permission_key"])
    op.create_index("ix_invitations_org_id_status", "invitations", ["organization_id", "status"])
    op.create_index(
        "uq_invitations_org_email_active",
        "invitations",
        ["organization_id", "email"],
        unique=True,
        postgresql_where=sa.text("status = 'PENDING'"),
    )

    created_at = datetime.utcnow()
    permission_sets = {
        "owner": [
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
            "exchanges:edit",
            "exchanges:delete",
            "exchanges:sync",
            "manual_assets:view",
            "manual_assets:create",
            "manual_assets:edit",
            "manual_assets:delete",
            "members:view",
            "members:invite",
            "members:edit",
            "members:revoke",
        "members:set_scope",
        "roles:view",
        "roles:edit",
        "scopes:all",
        "scopes:specific",
        "audit:view",
        "admin:organization",
    ],
        "admin": [
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
            "exchanges:edit",
            "exchanges:delete",
            "exchanges:sync",
            "manual_assets:view",
            "manual_assets:create",
            "manual_assets:edit",
            "manual_assets:delete",
            "members:view",
            "members:invite",
            "members:edit",
            "members:revoke",
            "members:set_scope",
            "roles:view",
            "scopes:all",
            "scopes:specific",
            "admin:organization",
            "audit:view",
        ],
        "manager": [
            "dashboard:view",
            "clients:list",
            "clients:edit",
            "wallets:view",
            "wallets:create",
            "wallets:edit",
            "wallets:delete",
            "exchanges:view",
            "exchanges:create",
            "exchanges:edit",
            "exchanges:delete",
            "exchanges:sync",
            "manual_assets:view",
            "manual_assets:create",
            "manual_assets:edit",
            "manual_assets:delete",
            "members:view",
            "scopes:all",
            "scopes:specific",
        ],
        "viewer": [
            "dashboard:view",
            "clients:list",
            "wallets:view",
            "exchanges:view",
            "manual_assets:view",
        ],
    }

    role_rows = []
    role_id_by_name: dict[str, str] = {}
    for name, permissions in permission_sets.items():
        role_id = str(uuid4())
        role_id_by_name[name] = role_id
        role_rows.append(
            {
                "id": role_id,
                "organization_id": None,
                "name": name,
                "is_system": True,
                "description": f"System role: {name}",
                "created_at": created_at,
                "updated_at": created_at,
            }
        )
    op.bulk_insert(
        sa.table(
            "roles",
            sa.column("id", postgresql.UUID(as_uuid=True)),
            sa.column("organization_id", postgresql.UUID(as_uuid=True)),
            sa.column("name", sa.String),
            sa.column("is_system", sa.Boolean),
            sa.column("description", sa.Text),
            sa.column("created_at", sa.DateTime(timezone=True)),
            sa.column("updated_at", sa.DateTime(timezone=True)),
        ),
        role_rows,
    )

    role_perm_rows = []
    for role_name, permissions in permission_sets.items():
        permission_role_id = role_id_by_name[role_name]
        for permission in permissions:
            role_perm_rows.append(
                {
                    "id": str(uuid4()),
                    "role_id": permission_role_id,
                    "permission_key": permission,
                }
            )
    op.bulk_insert(
        sa.table(
            "role_permissions",
            sa.column("id", postgresql.UUID(as_uuid=True)),
            sa.column("role_id", postgresql.UUID(as_uuid=True)),
            sa.column("permission_key", sa.String),
        ),
        role_perm_rows,
    )

    # Backfill memberships for existing users, preserving legacy organization ownership.
    # This step must be executed only in online mode, where SQLAlchemy bind is available.
    context = op.get_context()
    is_offline = getattr(context, "is_offline_mode", lambda: False)()
    if not is_offline:
        connection = op.get_bind()
        users_result = connection.execute(
            sa.text("SELECT id, organization_id, role FROM users WHERE organization_id IS NOT NULL")
        )
        users = users_result.fetchall() if users_result is not None else []
        for row in users:
            role_value = (
                row.role.value
                if hasattr(row.role, "value")
                else row._mapping.get("role") if hasattr(row, "_mapping") else row.role
            )
            legacy_role = str(role_value or "viewer").lower()
            membership_role = "owner" if legacy_role == "admin" else legacy_role
            if membership_role not in role_id_by_name:
                membership_role = "viewer"

            connection.execute(
                sa.text(
                    """
                    INSERT INTO memberships (
                        id, user_id, organization_id, role_id, status, client_access_mode, invited_at, created_at, updated_at
                    ) VALUES (:id, :user_id, :organization_id, :role_id, 'ACTIVE', 'ALL', :invited_at, :created_at, :updated_at)
                    ON CONFLICT (user_id, organization_id) DO NOTHING
                    """
                ),
                {
                    "id": str(uuid4()),
                    "user_id": row.id,
                    "organization_id": row.organization_id,
                    "role_id": role_id_by_name[membership_role],
                    "invited_at": created_at,
                    "created_at": created_at,
                    "updated_at": created_at,
                },
            )


def downgrade() -> None:
    op.drop_index("uq_invitations_org_email_active", table_name="invitations")
    op.drop_index("ix_memberships_role_id", table_name="memberships")
    op.drop_index("uq_roles_system_name", table_name="roles")
    op.drop_index("ix_invitations_org_id_status", table_name="invitations")
    op.drop_index("ix_role_permissions_permission", table_name="role_permissions")
    op.drop_index("ix_membership_clients_client_id", table_name="membership_clients")
    op.drop_index("ix_memberships_user_id", table_name="memberships")
    op.drop_index("ix_memberships_organization_id", table_name="memberships")

    op.drop_table("invitations")
    op.drop_table("membership_clients")
    op.drop_table("membership_permission_overrides")
    op.drop_table("memberships")
    op.drop_table("role_permissions")
    op.drop_table("roles")

    # Remove ENUM types created by this migration.
    op.execute("DROP TYPE IF EXISTS invitationstatus")
    op.execute("DROP TYPE IF EXISTS membershippermissioneffect")
    op.execute("DROP TYPE IF EXISTS membershipclientaccessmode")
    op.execute("DROP TYPE IF EXISTS membershipstatus")

    op.drop_column("users", "token_version")
    op.drop_column("users", "is_superuser")
    op.alter_column("users", "organization_id", existing_type=postgresql.UUID(), nullable=False)
    op.drop_constraint("fk_users_organization_id_set_null", "users", type_="foreignkey")
    op.create_foreign_key(
        "users_organization_id_fkey",
        "users",
        "organizations",
        ["organization_id"],
        ["id"],
        ondelete="CASCADE",
    )
