"""A10 – combo choice slots: combo_items.category_id (XOR product_id) + combos.image_url.

No data transform: every existing row keeps product_id set and satisfies the
new CHECK. Downgrade assumes no slot rows exist (drops category_id and
restores NOT NULL); run it only before any slot combo is created.

Revision ID: 0006_combo_choice_slots
Revises: 0005_generic_options
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0006_combo_choice_slots"
down_revision = "0005_generic_options"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("combos", sa.Column("image_url", sa.String(255), nullable=True))
    op.alter_column("combo_items", "product_id", existing_type=sa.Integer(), nullable=True)
    op.add_column("combo_items", sa.Column("category_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_combo_items_category_id",
        "combo_items",
        "categories",
        ["category_id"],
        ["category_id"],
    )
    op.create_check_constraint(
        "ck_combo_items_kind",
        "combo_items",
        "(product_id IS NULL) != (category_id IS NULL)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_combo_items_kind", "combo_items", type_="check")
    op.drop_constraint("fk_combo_items_category_id", "combo_items", type_="foreignkey")
    op.drop_column("combo_items", "category_id")
    op.alter_column("combo_items", "product_id", existing_type=sa.Integer(), nullable=False)
    op.drop_column("combos", "image_url")
