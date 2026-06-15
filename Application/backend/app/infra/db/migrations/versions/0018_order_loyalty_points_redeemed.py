"""add orders.loyalty_points_redeemed

Stores the loyalty points reserved at checkout so they can be released on
cancelled/failed orders and kept out of the available balance while the order
is in progress.

Revision ID: 0018_order_loyalty_points_redeemed
Revises: 0017_business_settings_checks
Create Date: 2026-06-15
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0018_order_loyalty_points_redeemed"
down_revision = "0017_business_settings_checks"
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


def downgrade() -> None:
    op.drop_column("orders", "loyalty_points_redeemed")
