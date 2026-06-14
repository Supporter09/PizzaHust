"""composite index for customer order history list (user_id + sort keys)

Revision ID: 0019_orders_user_history_index
Revises: 0018_drop_product_is_pizza
Create Date: 2026-06-14 00:00:00.000000
"""

from __future__ import annotations

from alembic import op

revision = "0019_orders_user_history_index"
down_revision = "0018_drop_product_is_pizza"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_orders_user_id_created_at_order_id",
        "orders",
        ["user_id", "created_at", "order_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_orders_user_id_created_at_order_id", table_name="orders")
