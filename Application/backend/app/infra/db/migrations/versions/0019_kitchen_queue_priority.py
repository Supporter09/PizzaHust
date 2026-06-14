"""Kitchen queue priority scoring and stable preparing bucket.

Revision ID: 0019_kitchen_queue_priority
Revises: 0018_drop_product_is_pizza

Note: revision id kept <= 32 chars to fit alembic_version.version_num
(VARCHAR(32)); the original "..._scoring" id was 35 chars and could never be
recorded. Renamed before it was ever applied to any DB.
"""

from __future__ import annotations

from alembic import op

revision = "0019_kitchen_queue_priority"
down_revision = "0018_drop_product_is_pizza"
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
        CASE
            WHEN o.current_status = 'Preparing' THEN
                2000000000 + TIMESTAMPDIFF(SECOND, o.created_at, UTC_TIMESTAMP())
            WHEN o.current_status = 'Received' THEN
                1000000000
                + TIMESTAMPDIFF(SECOND, o.created_at, UTC_TIMESTAMP())
                + TIMESTAMPDIFF(SECOND, o.promised_at, UTC_TIMESTAMP()) * 10
            WHEN o.current_status = 'ReadyForDispatch' THEN
                TIMESTAMPDIFF(SECOND, o.created_at, UTC_TIMESTAMP())
            ELSE
                TIMESTAMPDIFF(SECOND, o.created_at, UTC_TIMESTAMP())
        END AS priority_score
    FROM orders o
    WHERE o.current_status IN ('Received', 'Preparing', 'ReadyForDispatch')
"""


def upgrade() -> None:
    op.execute("DROP VIEW IF EXISTS kitchen_queue_view")
    op.execute(_VIEW)


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS kitchen_queue_view")
    op.execute(
        """
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
        WHERE o.current_status IN ('Received', 'Preparing', 'ReadyForDispatch')
        """
    )
