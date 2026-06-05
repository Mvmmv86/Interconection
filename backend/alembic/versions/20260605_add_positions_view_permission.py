"""Add positions view permission for system roles

Revision ID: d4e8f7a9c2b1
Revises: e4c8d9a2f7b3
Create Date: 2026-06-05 00:00:00.000000+00:00
"""
from __future__ import annotations

from typing import Sequence, Union
from uuid import uuid4

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "d4e8f7a9c2b1"
down_revision: Union[str, None] = "e4c8d9a2f7b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    context = op.get_context()
    is_offline = getattr(context, "is_offline_mode", lambda: False)()
    if is_offline:
        return

    connection = op.get_bind()
    roles_result = connection.execute(
        sa.text(
            """
            SELECT id
            FROM roles
            WHERE organization_id IS NULL
              AND name IN ('owner', 'admin', 'manager', 'viewer')
            """
        )
    )

    for row in roles_result.fetchall():
        connection.execute(
            sa.text(
                """
                INSERT INTO role_permissions (id, role_id, permission_key)
                SELECT :id, :role_id, :permission
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM role_permissions
                    WHERE role_id = :role_id
                      AND permission_key = :permission
                )
                """
            ),
            {
                "id": str(uuid4()),
                "role_id": str(row.id),
                "permission": "positions:view",
            },
        )


def downgrade() -> None:
    context = op.get_context()
    is_offline = getattr(context, "is_offline_mode", lambda: False)()
    if is_offline:
        return

    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            DELETE FROM role_permissions
            WHERE permission_key = :permission
            """
        ),
        {"permission": "positions:view"},
    )
