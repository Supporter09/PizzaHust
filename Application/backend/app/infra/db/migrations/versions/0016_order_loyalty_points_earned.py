"""add orders.loyalty_points_earned

Records the loyalty points credited to the customer when an order is placed, so
cancellation can reverse exactly that many points regardless of any later change
to the admin-configured accrual rate. Existing rows backfill to 0.

Revision ID: 0016_order_loyalty_points_earned
Revises: 0015_business_settings
Create Date: 2026-06-14 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0016_order_loyalty_points_earned"
down_revision = "0015_business_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column(
            "loyalty_points_earned",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.create_check_constraint(
        "ck_orders_loyalty_points_earned_nonneg",
        "orders",
        "loyalty_points_earned >= 0",
    )


def downgrade() -> None:
    op.drop_constraint("ck_orders_loyalty_points_earned_nonneg", "orders", type_="check")
    op.drop_column("orders", "loyalty_points_earned")
