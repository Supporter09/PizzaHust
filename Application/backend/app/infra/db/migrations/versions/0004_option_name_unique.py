"""unique constraints on pizza option names (sizes, crusts, toppings)

Backs the admin option-name conflict guard with a DB-level invariant so
concurrent inserts can't slip past the pre-check; the API maps IntegrityError
to a 409.

Revision ID: 0004_option_name_unique
Revises: 0003_catalog_admin_columns
Create Date: 2026-06-06 00:00:00.000000
"""

from __future__ import annotations

from alembic import op

revision = "0004_option_name_unique"
down_revision = "0003_catalog_admin_columns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint("uq_pizza_sizes_name", "pizza_sizes", ["name"])
    op.create_unique_constraint("uq_pizza_crusts_name", "pizza_crusts", ["name"])
    op.create_unique_constraint("uq_toppings_name", "toppings", ["name"])


def downgrade() -> None:
    op.drop_constraint("uq_toppings_name", "toppings", type_="unique")
    op.drop_constraint("uq_pizza_crusts_name", "pizza_crusts", type_="unique")
    op.drop_constraint("uq_pizza_sizes_name", "pizza_sizes", type_="unique")
