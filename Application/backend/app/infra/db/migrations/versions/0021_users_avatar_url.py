"""add users.avatar_url

U12 — customer avatar (nullable). Existing rows have no avatar.

Revision ID: 0021_users_avatar_url
Revises: 0020_merge_0019_heads
Create Date: 2026-06-15 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0021_users_avatar_url"
down_revision = "0020_merge_0019_heads"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_url", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "avatar_url")
