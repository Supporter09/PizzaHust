"""option groups belong to a category (drops the global preset table)

Each Category now owns its option groups: a category's groups ARE its preset.
``option_groups.name`` is no longer globally unique — it is unique per category.
The old ``category_preset_groups`` join table is removed.

Backfill (``backfill_group_categories``) assigns each existing group a category by
majority vote over the products enabling its options
(``product_options -> products -> category_id``); a group with no usage falls back
to the lowest ``categories.category_id``. It is pure, dialect-portable SQL run via
the given connection, so it is unit-tested against SQLite (production is MySQL).

Revision ID: 0014_option_groups_per_category
Revises: 0013_category_preset_groups
Create Date: 2026-06-14 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0014_option_groups_per_category"
down_revision = "0013_category_preset_groups"
branch_labels = None
depends_on = None


def backfill_group_categories(conn: sa.Connection) -> None:
    """Set ``option_groups.category_id`` for every group.

    Run after the (nullable) ``category_id`` column has been added and before it
    is made NOT NULL. Dialect-portable: only standard SQL, parameterless, so it
    behaves identically on SQLite (tests) and MySQL (production).

    A group's category is the most common ``category_id`` among the products that
    enable any of its options. Groups with no usage get the lowest category id.
    """
    fallback = conn.execute(sa.text("SELECT MIN(category_id) FROM categories")).scalar()

    rows = conn.execute(
        sa.text(
            "SELECT og.group_id, p.category_id, COUNT(*) AS n "
            "FROM option_groups og "
            "JOIN options o ON o.group_id = og.group_id "
            "JOIN product_options po ON po.option_id = o.option_id "
            "JOIN products p ON p.product_id = po.product_id "
            "GROUP BY og.group_id, p.category_id"
        )
    ).all()

    # Majority vote per group; ties resolve to the lowest category_id (deterministic).
    best: dict[int, tuple[int, int]] = {}  # group_id -> (count, category_id)
    for group_id, category_id, n in rows:
        prev = best.get(group_id)
        if prev is None or n > prev[0] or (n == prev[0] and category_id < prev[1]):
            best[group_id] = (n, category_id)

    for group_id, (_n, category_id) in best.items():
        conn.execute(
            sa.text("UPDATE option_groups SET category_id = :c WHERE group_id = :g"),
            {"c": category_id, "g": group_id},
        )

    # Any group with no product usage falls back to the lowest category id.
    if fallback is not None:
        conn.execute(
            sa.text("UPDATE option_groups SET category_id = :c WHERE category_id IS NULL"),
            {"c": fallback},
        )


def upgrade() -> None:
    op.add_column("option_groups", sa.Column("category_id", sa.Integer(), nullable=True))

    backfill_group_categories(op.get_bind())

    # batch_alter_table lets SQLite rebuild the table; on MySQL these become ALTERs.
    # The old global unique on ``name`` was created inline (migration 0005) and is
    # named by the project naming convention -> ``uq_option_groups_name`` on MySQL.
    with op.batch_alter_table("option_groups", schema=None) as batch:
        batch.alter_column("category_id", existing_type=sa.Integer(), nullable=False)
        batch.drop_constraint("uq_option_groups_name", type_="unique")
        batch.create_foreign_key(
            "fk_option_groups_category_id_categories",
            "categories",
            ["category_id"],
            ["category_id"],
            ondelete="CASCADE",
        )
        batch.create_unique_constraint("uq_option_groups_category_name", ["category_id", "name"])
        batch.create_index("ix_option_groups_category_id", ["category_id"])

    op.drop_table("category_preset_groups")


def downgrade() -> None:
    op.create_table(
        "category_preset_groups",
        sa.Column(
            "category_id",
            sa.Integer(),
            sa.ForeignKey("categories.category_id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "group_id",
            sa.Integer(),
            sa.ForeignKey("option_groups.group_id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )

    with op.batch_alter_table("option_groups", schema=None) as batch:
        # Drop the FK first: on MySQL its backing index (the composite unique /
        # ix_option_groups_category_id) can't be dropped while the FK still needs it.
        batch.drop_constraint("fk_option_groups_category_id_categories", type_="foreignkey")
        batch.drop_index("ix_option_groups_category_id")
        batch.drop_constraint("uq_option_groups_category_name", type_="unique")
        batch.create_unique_constraint("uq_option_groups_name", ["name"])

    op.drop_column("option_groups", "category_id")
