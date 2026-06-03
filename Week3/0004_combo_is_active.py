"""add is_active to combos for auto-expire

Revision ID: 0004_combo_is_active
Revises: 0003_catalog_admin_columns
Create Date: 2026-06-03 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0004_combo_is_active"
down_revision = "0003_catalog_admin_columns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "combos",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
    )


def downgrade() -> None:
    op.drop_column("combos", "is_active")
