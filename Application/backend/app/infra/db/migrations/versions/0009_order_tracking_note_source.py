"""add order_tracking.note_source for phase-linked feedback tags

Revision ID: 0009_order_tracking_note_source
Revises: 0008_order_notes_and_combo_picks
Create Date: 2026-06-11 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0009_order_tracking_note_source"
down_revision = "0008_order_notes_and_combo_picks"
branch_labels = None
depends_on = None

NOTE_SOURCE_VALUES = ("system", "kitchen", "transport", "customer")


def upgrade() -> None:
    op.add_column(
        "order_tracking",
        sa.Column(
            "note_source",
            sa.Enum(*NOTE_SOURCE_VALUES, name="tracking_note_source"),
            nullable=False,
            server_default=sa.text("'system'"),
        ),
    )
    op.create_index(
        "ix_order_tracking_status",
        "order_tracking",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_order_tracking_note_source",
        "order_tracking",
        ["note_source"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_order_tracking_note_source", table_name="order_tracking")
    op.drop_index("ix_order_tracking_status", table_name="order_tracking")
    op.drop_column("order_tracking", "note_source")
