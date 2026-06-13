"""Unit test for the 0014 backfill helper (migration's risky logic).

The migration adds ``option_groups.category_id`` and backfills each existing
group's category by majority vote over the products that enable its options
(``product_options -> products -> category_id``); a group with no usage falls
back to the lowest ``categories.category_id``. Production has live data, so the
backfill is tested in isolation against an in-memory SQLite engine with a
hand-built pre-migration schema (``category_id`` present but nullable, mirroring
the migration's first ``add_column`` step).
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

import sqlalchemy as sa

_MIGRATION = (
    Path(__file__).resolve().parent.parent
    / "app/infra/db/migrations/versions/0014_option_groups_per_category.py"
)


def _load_backfill():
    spec = importlib.util.spec_from_file_location("_mig_0014", _MIGRATION)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.backfill_group_categories


def _build_pre_migration_schema(conn: sa.Connection) -> None:
    """The subset of tables the backfill reads/writes, in their mid-migration
    shape: ``option_groups.category_id`` exists but is still nullable."""
    conn.execute(
        sa.text(
            "CREATE TABLE categories ("
            "category_id INTEGER PRIMARY KEY AUTOINCREMENT, name VARCHAR(50) NOT NULL)"
        )
    )
    conn.execute(
        sa.text(
            "CREATE TABLE products ("
            "product_id INTEGER PRIMARY KEY AUTOINCREMENT, "
            "category_id INTEGER NOT NULL, name VARCHAR(100) NOT NULL)"
        )
    )
    conn.execute(
        sa.text(
            "CREATE TABLE option_groups ("
            "group_id INTEGER PRIMARY KEY AUTOINCREMENT, name VARCHAR(100) NOT NULL, "
            "category_id INTEGER NULL)"
        )
    )
    conn.execute(
        sa.text(
            "CREATE TABLE options ("
            "option_id INTEGER PRIMARY KEY AUTOINCREMENT, "
            "group_id INTEGER NOT NULL, name VARCHAR(100) NOT NULL)"
        )
    )
    conn.execute(
        sa.text(
            "CREATE TABLE product_options ("
            "product_id INTEGER NOT NULL, option_id INTEGER NOT NULL, "
            "PRIMARY KEY (product_id, option_id))"
        )
    )


def _insert(conn: sa.Connection, table: str, **cols: object) -> None:
    keys = ", ".join(cols)
    placeholders = ", ".join(f":{k}" for k in cols)
    conn.execute(sa.text(f"INSERT INTO {table} ({keys}) VALUES ({placeholders})"), cols)


def _group_category(conn: sa.Connection, group_id: int) -> int | None:
    return conn.execute(
        sa.text("SELECT category_id FROM option_groups WHERE group_id = :g"), {"g": group_id}
    ).scalar_one()


def test_backfill_assigns_majority_and_fallback_categories():
    backfill_group_categories = _load_backfill()
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    with engine.begin() as conn:
        _build_pre_migration_schema(conn)

        # Categories — A is the lowest id (the no-usage fallback target).
        _insert(conn, "categories", category_id=1, name="A")
        _insert(conn, "categories", category_id=2, name="B")
        _insert(conn, "categories", category_id=3, name="C")

        # Products: three in A, one in B.
        _insert(conn, "products", product_id=10, category_id=1, name="a1")
        _insert(conn, "products", product_id=11, category_id=1, name="a2")
        _insert(conn, "products", product_id=12, category_id=1, name="a3")
        _insert(conn, "products", product_id=20, category_id=2, name="b1")

        # Group 100: used only by products in A -> A.
        _insert(conn, "option_groups", group_id=100, name="OnlyA")
        _insert(conn, "options", option_id=1000, group_id=100, name="x")
        _insert(conn, "product_options", product_id=10, option_id=1000)
        _insert(conn, "product_options", product_id=11, option_id=1000)

        # Group 200: split 2-in-A / 1-in-B -> majority A.
        _insert(conn, "option_groups", group_id=200, name="SplitMajorityA")
        _insert(conn, "options", option_id=2000, group_id=200, name="y")
        _insert(conn, "product_options", product_id=10, option_id=2000)
        _insert(conn, "product_options", product_id=12, option_id=2000)
        _insert(conn, "product_options", product_id=20, option_id=2000)

        # Group 300: no product_options rows at all -> fallback to min(category_id) = 1.
        _insert(conn, "option_groups", group_id=300, name="Orphan")
        _insert(conn, "options", option_id=3000, group_id=300, name="z")

        backfill_group_categories(conn)

        assert _group_category(conn, 100) == 1
        assert _group_category(conn, 200) == 1
        assert _group_category(conn, 300) == 1

        # Every group must end up non-NULL (the migration then alters to NOT NULL).
        remaining = conn.execute(
            sa.text("SELECT COUNT(*) FROM option_groups WHERE category_id IS NULL")
        ).scalar_one()
        assert remaining == 0


def test_backfill_majority_picks_the_other_category_when_it_dominates():
    """Guard against accidentally hard-coding the fallback: a group whose usage
    is dominated by category B must resolve to B, not the lowest id."""
    backfill_group_categories = _load_backfill()
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    with engine.begin() as conn:
        _build_pre_migration_schema(conn)
        _insert(conn, "categories", category_id=1, name="A")
        _insert(conn, "categories", category_id=2, name="B")
        _insert(conn, "products", product_id=10, category_id=1, name="a1")
        _insert(conn, "products", product_id=20, category_id=2, name="b1")
        _insert(conn, "products", product_id=21, category_id=2, name="b2")

        _insert(conn, "option_groups", group_id=500, name="MajorityB")
        _insert(conn, "options", option_id=5000, group_id=500, name="x")
        _insert(conn, "product_options", product_id=10, option_id=5000)
        _insert(conn, "product_options", product_id=20, option_id=5000)
        _insert(conn, "product_options", product_id=21, option_id=5000)

        backfill_group_categories(conn)
        assert _group_category(conn, 500) == 2


def test_backfill_tie_resolves_to_lowest_category_id():
    """A group used by exactly one product in A and one in B (a 1-vs-1 vote tie)
    must resolve deterministically to the LOWER category_id, not the higher one
    and not the no-usage fallback."""
    backfill_group_categories = _load_backfill()
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    with engine.begin() as conn:
        _build_pre_migration_schema(conn)
        # Insert B before A so row/iteration order can't accidentally pick the
        # first-seen category instead of the lowest id.
        _insert(conn, "categories", category_id=2, name="B")
        _insert(conn, "categories", category_id=1, name="A")
        _insert(conn, "products", product_id=20, category_id=2, name="b1")
        _insert(conn, "products", product_id=10, category_id=1, name="a1")

        _insert(conn, "option_groups", group_id=600, name="TieAB")
        _insert(conn, "options", option_id=6000, group_id=600, name="x")
        _insert(conn, "product_options", product_id=20, option_id=6000)
        _insert(conn, "product_options", product_id=10, option_id=6000)

        backfill_group_categories(conn)
        assert _group_category(conn, 600) == 1
