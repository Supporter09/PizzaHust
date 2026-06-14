"""drop products.is_pizza

An item's nature is its category; there is no per-item pizza/side flag anymore.
Options are seeded from the category preset regardless, so the column drove only
cosmetic curation and is removed. Downgrade re-adds it defaulting to 0.

Revision ID: 0018_drop_product_is_pizza
Revises: 0017_business_settings_checks
Create Date: 2026-06-14 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0018_drop_product_is_pizza"
down_revision = "0017_business_settings_checks"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # batch_alter_table lets SQLite rebuild the table; on MySQL this is a plain ALTER.
    with op.batch_alter_table("products", schema=None) as batch:
        batch.drop_column("is_pizza")


def downgrade() -> None:
    with op.batch_alter_table("products", schema=None) as batch:
        batch.add_column(
            sa.Column(
                "is_pizza",
                sa.Boolean(),
                nullable=False,
                server_default="0",
            )
        )
