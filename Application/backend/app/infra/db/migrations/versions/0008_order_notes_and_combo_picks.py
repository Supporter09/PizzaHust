"""U6 – delivery note/ward, combo-pick parent-child, cart_lines quantity check.

Revision ID: 0008_order_notes_and_combo_picks
Revises: 0007_cart_tables
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0008_order_notes_and_combo_picks"
down_revision = "0007_cart_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("delivery_ward", sa.String(length=100), nullable=True))
    op.add_column("orders", sa.Column("delivery_note", sa.String(length=255), nullable=True))
    op.add_column(
        "order_items",
        sa.Column("parent_order_item_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_order_items_parent_order_item_id",
        "order_items",
        "order_items",
        ["parent_order_item_id"],
        ["order_item_id"],
    )
    op.create_check_constraint(
        "ck_cart_lines_quantity_range",
        "cart_lines",
        "quantity >= 1 AND quantity <= 99",
    )


def downgrade() -> None:
    op.drop_constraint("ck_cart_lines_quantity_range", "cart_lines", type_="check")
    op.drop_constraint("fk_order_items_parent_order_item_id", "order_items", type_="foreignkey")
    op.drop_column("order_items", "parent_order_item_id")
    op.drop_column("orders", "delivery_note")
    op.drop_column("orders", "delivery_ward")