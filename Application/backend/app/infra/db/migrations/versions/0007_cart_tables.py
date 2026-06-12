"""U5 – server cart tables (carts, cart_lines).

Revision ID: 0007_cart_tables
Revises: 0006_combo_choice_slots
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0007_cart_tables"
down_revision = "0006_combo_choice_slots"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "carts",
        sa.Column("cart_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("touched_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"]),
        sa.PrimaryKeyConstraint("cart_id"),
    )
    op.create_index("ix_carts_user_id", "carts", ["user_id"], unique=True)

    op.create_table(
        "cart_lines",
        sa.Column("line_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("cart_id", sa.Integer(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("quantity", sa.Integer(), server_default="1", nullable=False),
        sa.Column("note", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["cart_id"], ["carts.cart_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("line_id"),
    )
    op.create_index("ix_cart_lines_cart_id", "cart_lines", ["cart_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_cart_lines_cart_id", table_name="cart_lines")
    op.drop_table("cart_lines")
    op.drop_index("ix_carts_user_id", table_name="carts")
    op.drop_table("carts")
