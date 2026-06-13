"""K1: kitchen_queue_view filters Received/Preparing/ReadyForDispatch.

The 0002 view included the admin-only DispatchPending state and omitted
ReadyForDispatch, contradicting the design state model. Swap membership;
the priority_score expression is unchanged (it stays the SQL single source
of truth for kitchen ordering).

Revision ID: 0012_kitchen_queue_rdy_dispatch
Revises: 0011_catalog_image_galleries
"""

from __future__ import annotations

from alembic import op

revision = "0012_kitchen_queue_rdy_dispatch"
down_revision = "0011_catalog_image_galleries"
branch_labels = None
depends_on = None

_VIEW = """
    CREATE VIEW kitchen_queue_view AS
    SELECT
        o.order_id,
        o.order_code,
        o.current_status,
        o.created_at,
        o.promised_at,
        TIMESTAMPDIFF(SECOND, o.created_at, UTC_TIMESTAMP())
            + GREATEST(TIMESTAMPDIFF(SECOND, o.promised_at, UTC_TIMESTAMP()), 0) * 5
            + CASE WHEN o.current_status = 'Preparing' THEN 10 ELSE 0 END
            AS priority_score
    FROM orders o
    WHERE o.current_status IN ({states})
"""


def _recreate(states: str) -> None:
    op.execute("DROP VIEW IF EXISTS kitchen_queue_view")
    op.execute(_VIEW.format(states=states))


def upgrade() -> None:
    _recreate("'Received', 'Preparing', 'ReadyForDispatch'")


def downgrade() -> None:
    _recreate("'Received', 'Preparing', 'DispatchPending'")
