"""category option presets — groups auto-enabled on new dishes in a category

Revision ID: 0013_category_preset_groups
Revises: 0012_kitchen_queue_rdy_dispatch
Create Date: 2026-06-13 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0013_category_preset_groups"
down_revision = "0012_kitchen_queue_rdy_dispatch"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "category_preset_groups",
        sa.Column(
            "category_id",
            sa.Integer(),
            sa.ForeignKey("categories.category_id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "group_id",
            sa.Integer(),
            sa.ForeignKey("option_groups.group_id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_table("category_preset_groups")
