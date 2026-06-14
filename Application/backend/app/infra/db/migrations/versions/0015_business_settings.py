"""add business_settings and delivery_ward_fees tables

Stores operator-configurable business parameters (timezone, loyalty rules)
and per-ward delivery fees. Single-row ``business_settings`` enforced by a
check constraint; default values are inserted by ``app.seeds.run``.

Revision ID: 0015_business_settings
Revises: 0014_option_groups_per_category
Create Date: 2026-06-14 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0015_business_settings"
down_revision = "0014_option_groups_per_category"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "business_settings",
        sa.Column("id", sa.Integer(), autoincrement=False, nullable=False),
        sa.Column("timezone", sa.String(64), nullable=False),
        sa.Column("loyalty_accrual_rate", sa.Integer(), nullable=False),
        sa.Column("loyalty_redeem_value_vnd", sa.Integer(), nullable=False),
        sa.Column("loyalty_max_redeem_pct", sa.Numeric(3, 2), nullable=False),
        sa.CheckConstraint("id = 1", name="ck_business_settings_singleton"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "delivery_ward_fees",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("ward_name", sa.String(128), nullable=False),
        sa.Column("ward_normalized", sa.String(128), nullable=False),
        sa.Column("fee_vnd", sa.Integer(), nullable=False),
        sa.UniqueConstraint("ward_name", name="uq_delivery_ward_fees_name"),
        sa.UniqueConstraint("ward_normalized", name="uq_delivery_ward_fees_normalized"),
        sa.CheckConstraint("fee_vnd >= 0", name="ck_delivery_ward_fees_nonneg"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("delivery_ward_fees")
    op.drop_table("business_settings")
