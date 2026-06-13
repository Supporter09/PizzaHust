"""add users.created_at so admin can show customer join date

Revision ID: 0010_users_created_at
Revises: 0009_order_tracking_note_source
Create Date: 2026-06-13 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0010_users_created_at"
down_revision = "0009_order_tracking_note_source"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "created_at")
