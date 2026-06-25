"""add catalog admin columns

Revision ID: 0003_catalog_admin_columns
Revises: 0002_add_missing_fields
Create Date: 2026-05-26 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0003_catalog_admin_columns"
down_revision = "0002_add_missing_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # products: image_url + is_active
    op.add_column("products", sa.Column("image_url", sa.String(length=255), nullable=True))
    op.add_column(
        "products",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
    )

    # categories: sort_order + is_active
    op.add_column(
        "categories",
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    op.add_column(
        "categories",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
    )


def downgrade() -> None:
    op.drop_column("categories", "is_active")
    op.drop_column("categories", "sort_order")
    op.drop_column("products", "is_active")
    op.drop_column("products", "image_url")
