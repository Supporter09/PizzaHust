"""merge the two 0019 heads (kitchen queue priority + orders user history index)

Both 0019 migrations branched off 0018, creating two Alembic heads. This is a
no-op merge revision that rejoins them so `alembic upgrade head` resolves to a
single head.

Revision ID: 0020_merge_0019_heads
Revises: 0019_kitchen_queue_priority, 0019_orders_user_history_index
Create Date: 2026-06-15 00:00:00.000000
"""

from __future__ import annotations

revision = "0020_merge_0019_heads"
down_revision = (
    "0019_kitchen_queue_priority",
    "0019_orders_user_history_index",
)
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
