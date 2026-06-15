"""add orders.loyalty_points_redeemed

U14 - points reserved (spent) on an order at placement. Held until the order is
Delivered (consumed) or Cancelled / Delivery-Failed (released back to the balance).
Stored so a release returns exactly the reserved amount. Existing rows backfill to 0.

Revision ID: 0022_order_loyalty_redeemed
Revises: 0021_users_avatar_url
Create Date: 2026-06-15 12:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0022_order_loyalty_redeemed"
down_revision = "0021_users_avatar_url"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column(
            "loyalty_points_redeemed",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.create_check_constraint(
        "ck_orders_loyalty_points_redeemed_nonneg",
        "orders",
        "loyalty_points_redeemed >= 0",
    )


def downgrade() -> None:
    op.drop_constraint("ck_orders_loyalty_points_redeemed_nonneg", "orders", type_="check")
    op.drop_column("orders", "loyalty_points_redeemed")
