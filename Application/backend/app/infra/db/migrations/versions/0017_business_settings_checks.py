"""add loyalty range checks to business_settings

Enforce the loyalty invariants the admin settings API already validates at the
database layer: accrual rate and redeem value are positive, and the max-redeem
percentage is a fraction in ``(0, 1]``. Defense-in-depth against bad writes that
bypass the API.

Constraint names are bare suffixes; the metadata ``ck`` naming convention
prefixes ``ck_business_settings_`` (see app/infra/db/base.py).

Revision ID: 0017_business_settings_checks
Revises: 0016_order_loyalty_points_earned
Create Date: 2026-06-14 00:00:00.000000
"""

from __future__ import annotations

from alembic import op

revision = "0017_business_settings_checks"
down_revision = "0016_order_loyalty_points_earned"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_check_constraint(
        "accrual_rate_positive",
        "business_settings",
        "loyalty_accrual_rate > 0",
    )
    op.create_check_constraint(
        "redeem_value_positive",
        "business_settings",
        "loyalty_redeem_value_vnd > 0",
    )
    op.create_check_constraint(
        "max_redeem_pct_fraction",
        "business_settings",
        "loyalty_max_redeem_pct > 0 AND loyalty_max_redeem_pct <= 1",
    )


def downgrade() -> None:
    op.drop_constraint("max_redeem_pct_fraction", "business_settings", type_="check")
    op.drop_constraint("redeem_value_positive", "business_settings", type_="check")
    op.drop_constraint("accrual_rate_positive", "business_settings", type_="check")
