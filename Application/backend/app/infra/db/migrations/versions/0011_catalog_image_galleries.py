"""A9 — product/combo image galleries; backfill existing cover into them

Revision ID: 0011_catalog_image_galleries
Revises: 0010_users_created_at
Create Date: 2026-06-13 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0011_catalog_image_galleries"
down_revision = "0010_users_created_at"
branch_labels = None
depends_on = None


def _create_gallery_table(name: str, owner_col: str, owner_table: str) -> None:
    op.create_table(
        name,
        sa.Column("image_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("url", sa.String(length=255), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_cover", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column(
            owner_col,
            sa.Integer(),
            sa.ForeignKey(f"{owner_table}.{owner_col}", ondelete="CASCADE"),
            nullable=False,
        ),
    )
    op.create_index(f"ix_{name}_{owner_col}_sort", name, [owner_col, "sort_order"])


def upgrade() -> None:
    _create_gallery_table("product_images", "product_id", "products")
    _create_gallery_table("combo_images", "combo_id", "combos")
    op.execute(
        "INSERT INTO product_images (product_id, url, sort_order, is_cover) "
        "SELECT product_id, image_url, 0, 1 FROM products WHERE image_url IS NOT NULL"
    )
    op.execute(
        "INSERT INTO combo_images (combo_id, url, sort_order, is_cover) "
        "SELECT combo_id, image_url, 0, 1 FROM combos WHERE image_url IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_table("combo_images")
    op.drop_table("product_images")
