"""Merge the order-tracking and combo-choice migration heads.

Revision ID: 0007_merge_a5_a10_heads
Revises: 0005_order_tracking_note_source, 0006_combo_choice_slots
Create Date: 2026-06-12 00:00:00.000000
"""

from __future__ import annotations

revision = "0007_merge_a5_a10_heads"
down_revision = ("0005_order_tracking_note_source", "0006_combo_choice_slots")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
