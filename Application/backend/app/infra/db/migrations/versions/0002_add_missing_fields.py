"""add missing fields: user email/is_locked, combo validity, DispatchPending status, webhook_events

Revision ID: 0002_add_missing_fields
Revises: 0001_initial_schema
Create Date: 2026-05-27 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0002_add_missing_fields"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None

NEW_ORDER_STATUS_VALUES = (
    "Received",
    "Preparing",
    "ReadyForDispatch",
    "DispatchPending",
    "Delivering",
    "Delivered",
    "DeliveryFailed",
    "Cancelled",
)
OLD_ORDER_STATUS_VALUES = (
    "Received",
    "Preparing",
    "ReadyForDispatch",
    "Delivering",
    "Delivered",
    "DeliveryFailed",
    "Cancelled",
)


def _enum_values_sql(values: tuple[str, ...]) -> str:
    return ",".join(f"'{v}'" for v in values)


def upgrade() -> None:
    op.add_column("users", sa.Column("email", sa.String(255), nullable=True))
    op.add_column(
        "users",
        sa.Column("is_locked", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )
    op.create_unique_constraint("uq_users_email", "users", ["email"])

    op.add_column("combos", sa.Column("target_group", sa.Integer(), nullable=True))
    op.add_column("combos", sa.Column("validity_start", sa.DateTime(), nullable=True))
    op.add_column("combos", sa.Column("validity_end", sa.DateTime(), nullable=True))

    new_vals = _enum_values_sql(NEW_ORDER_STATUS_VALUES)
    op.execute(
        f"ALTER TABLE orders MODIFY COLUMN current_status "
        f"ENUM({new_vals}) NOT NULL DEFAULT 'Received'"
    )
    op.execute(
        f"ALTER TABLE order_tracking MODIFY COLUMN status "
        f"ENUM({new_vals}) NOT NULL"
    )

    op.create_table(
        "webhook_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("event_id", sa.String(128), nullable=False),
        sa.Column(
            "received_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.UniqueConstraint("event_id", name="uq_webhook_events_event_id"),
    )

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
        WHERE o.current_status IN ('Received', 'Preparing', 'DispatchPending')
        """
    )


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
        WHERE o.current_status IN ('Received', 'Preparing')
        """
    )

    op.drop_table("webhook_events")

    old_vals = _enum_values_sql(OLD_ORDER_STATUS_VALUES)
    op.execute(
        f"ALTER TABLE order_tracking MODIFY COLUMN status "
        f"ENUM({old_vals}) NOT NULL"
    )
    op.execute(
        f"ALTER TABLE orders MODIFY COLUMN current_status "
        f"ENUM({old_vals}) NOT NULL DEFAULT 'Received'"
    )

    op.drop_column("combos", "validity_end")
    op.drop_column("combos", "validity_start")
    op.drop_column("combos", "target_group")

    op.drop_constraint("uq_users_email", "users", type_="unique")
    op.drop_column("users", "is_locked")
    op.drop_column("users", "email")
