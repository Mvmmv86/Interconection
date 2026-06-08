"""Add account teams for grouped RBAC scope

Revision ID: f7c2a1b8d9e0
Revises: a8f2d6c4b9e1
Create Date: 2026-06-08 00:00:00.000000+00:00
"""
from __future__ import annotations

from typing import Sequence, Union
from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "f7c2a1b8d9e0"
down_revision: Union[str, None] = "a8f2d6c4b9e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TEAM_PERMISSION_SETS = {
    "owner": [
        "teams:view",
        "teams:create",
        "teams:edit",
        "teams:delete",
        "teams:members",
    ],
    "admin": [
        "teams:view",
        "teams:create",
        "teams:edit",
        "teams:delete",
        "teams:members",
    ],
    "manager": [
        "teams:view",
    ],
    "viewer": [],
}


def upgrade() -> None:
    op.create_table(
        "teams",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("slug", sa.String(length=140), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("color", sa.String(length=7), nullable=False, server_default="#3b82f6"),
        sa.Column(
            "status",
            sa.Enum("ACTIVE", "ARCHIVED", name="teamstatus"),
            nullable=False,
            server_default=sa.text("'ACTIVE'"),
        ),
        sa.Column("role_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "client_access_mode",
            postgresql.ENUM("ALL", "SPECIFIC", name="membershipclientaccessmode", create_type=False),
            nullable=False,
            server_default=sa.text("'ALL'"),
        ),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "slug", name="uq_teams_org_slug"),
    )
    op.create_index("ix_teams_organization_status", "teams", ["organization_id", "status"])

    op.create_table(
        "team_members",
        sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("membership_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("added_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["membership_id"], ["memberships.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["added_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("team_id", "membership_id"),
    )
    op.create_index("ix_team_members_membership_id", "team_members", ["membership_id"])

    op.create_table(
        "team_clients",
        sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("team_id", "client_id"),
    )
    op.create_index("ix_team_clients_client_id", "team_clients", ["client_id"])

    op.add_column(
        "invitations",
        sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_invitations_team_id",
        "invitations",
        "teams",
        ["team_id"],
        ["id"],
        ondelete="SET NULL",
    )

    context = op.get_context()
    is_offline = getattr(context, "is_offline_mode", lambda: False)()
    if is_offline:
        return

    connection = op.get_bind()
    roles_result = connection.execute(
        sa.text(
            """
            SELECT roles.id, roles.name
            FROM roles
            WHERE roles.organization_id IS NULL
              AND roles.is_system = true
              AND roles.name IN ('owner', 'admin', 'manager', 'viewer')
            """
        )
    )

    for row in roles_result.fetchall():
        for permission_key in TEAM_PERMISSION_SETS.get(row.name, []):
            connection.execute(
                sa.text(
                    """
                    INSERT INTO role_permissions (id, role_id, permission_key)
                    VALUES (CAST(:id AS uuid), CAST(:role_id AS uuid), :permission_key)
                    ON CONFLICT (role_id, permission_key) DO NOTHING
                    """
                ),
                {
                    "id": str(uuid4()),
                    "role_id": str(row.id),
                    "permission_key": permission_key,
                },
            )


def downgrade() -> None:
    context = op.get_context()
    is_offline = getattr(context, "is_offline_mode", lambda: False)()
    if not is_offline:
        op.execute(
            sa.text(
                """
                DELETE FROM role_permissions
                USING roles
                WHERE role_permissions.role_id = roles.id
                  AND role_permissions.permission_key IN (
                    'teams:view',
                    'teams:create',
                    'teams:edit',
                    'teams:delete',
                    'teams:members'
                  )
                  AND roles.organization_id IS NULL
                  AND roles.is_system = true
                  AND roles.name IN ('owner', 'admin', 'manager', 'viewer')
                """
            )
        )

    op.drop_index("ix_team_clients_client_id", table_name="team_clients")
    op.drop_constraint("fk_invitations_team_id", "invitations", type_="foreignkey")
    op.drop_column("invitations", "team_id")
    op.drop_table("team_clients")
    op.drop_index("ix_team_members_membership_id", table_name="team_members")
    op.drop_table("team_members")
    op.drop_index("ix_teams_organization_status", table_name="teams")
    op.drop_table("teams")
    op.execute("DROP TYPE IF EXISTS teamstatus")
