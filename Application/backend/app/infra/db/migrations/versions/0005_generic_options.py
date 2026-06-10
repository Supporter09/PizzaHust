"""A8 – generic options: option_groups/options/product_options/order_item_options.

Clean cut: creates the generic tables, migrates fixed sizes/crusts/toppings data
and order history into them, then drops the old structures. Downgrade recreates
the old tables empty (lossy) — acceptable for the single-node MVP.

Topping snapshots multiply price_at_time_vnd by order_item_toppings.quantity:
the generic snapshot has no quantity column, so a qty-2 topping row becomes one
row carrying the full amount (the quote flow never produced qty > 1 in practice).

Revision ID: 0005_generic_options
Revises: 0004_option_name_unique
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0005_generic_options"
down_revision = "0004_option_name_unique"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "option_groups",
        sa.Column("group_id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column(
            "select_type",
            sa.Enum("single", "multi", name="option_select_type"),
            nullable=False,
            server_default="multi",
        ),
        sa.Column("required", sa.Boolean, nullable=False, server_default="0"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
    )
    op.create_table(
        "options",
        sa.Column("option_id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "group_id",
            sa.Integer,
            sa.ForeignKey("option_groups.group_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.String(255), nullable=True),
        sa.Column("price_delta_vnd", sa.Integer, nullable=False, server_default="0"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.UniqueConstraint("group_id", "name", name="uq_options_group_name"),
    )
    op.create_table(
        "product_options",
        sa.Column(
            "product_id",
            sa.Integer,
            sa.ForeignKey("products.product_id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "option_id",
            sa.Integer,
            sa.ForeignKey("options.option_id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )
    op.create_table(
        "order_item_options",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "order_item_id",
            sa.Integer,
            sa.ForeignKey("order_items.order_item_id"),
            nullable=False,
        ),
        sa.Column("group_name", sa.String(100), nullable=False),
        sa.Column("option_name", sa.String(100), nullable=False),
        sa.Column("price_delta_vnd", sa.Integer, nullable=False),
    )
    op.create_index("ix_order_item_options_order_item_id", "order_item_options", ["order_item_id"])

    conn = op.get_bind()

    conn.execute(
        sa.text(
            "INSERT INTO option_groups (name, select_type, required, sort_order) VALUES "
            "('Size','single',1,1), ('Crust','single',1,2), ('Toppings','multi',0,3)"
        )
    )
    gid = {
        name: conn.execute(
            sa.text("SELECT group_id FROM option_groups WHERE name = :n"), {"n": name}
        ).scalar_one()
        for name in ("Size", "Crust", "Toppings")
    }

    conn.execute(
        sa.text(
            "INSERT INTO options (group_id, name, price_delta_vnd, sort_order) "
            "SELECT :g, name, price_modifier_vnd, size_id FROM pizza_sizes"
        ),
        {"g": gid["Size"]},
    )
    conn.execute(
        sa.text(
            "INSERT INTO options (group_id, name, price_delta_vnd, sort_order) "
            "SELECT :g, name, 0, crust_id FROM pizza_crusts"
        ),
        {"g": gid["Crust"]},
    )
    conn.execute(
        sa.text(
            "INSERT INTO options (group_id, name, price_delta_vnd, sort_order) "
            "SELECT :g, name, price_vnd, topping_id FROM toppings"
        ),
        {"g": gid["Toppings"]},
    )

    conn.execute(
        sa.text(
            "INSERT INTO product_options (product_id, option_id) "
            "SELECT p.product_id, o.option_id FROM products p CROSS JOIN options o "
            "WHERE p.is_pizza = 1"
        )
    )

    _snap = (
        "INSERT INTO order_item_options (order_item_id, group_name, option_name, price_delta_vnd) "
    )
    conn.execute(
        sa.text(
            _snap + "SELECT oi.order_item_id, 'Size', ps.name, ps.price_modifier_vnd "
            "FROM order_items oi JOIN pizza_sizes ps ON ps.size_id = oi.size_id"
        )
    )
    conn.execute(
        sa.text(
            _snap + "SELECT oi.order_item_id, 'Crust', pc.name, 0 "
            "FROM order_items oi JOIN pizza_crusts pc ON pc.crust_id = oi.crust_id"
        )
    )
    conn.execute(
        sa.text(
            _snap + "SELECT oit.order_item_id, 'Toppings', t.name, "
            "oit.price_at_time_vnd * oit.quantity "
            "FROM order_item_toppings oit JOIN toppings t ON t.topping_id = oit.topping_id "
            "ORDER BY oit.order_item_id, oit.id"
        )
    )

    insp = sa.inspect(conn)
    for fk in insp.get_foreign_keys("order_items"):
        if fk["referred_table"] in ("pizza_sizes", "pizza_crusts"):
            op.drop_constraint(fk["name"], "order_items", type_="foreignkey")
    op.drop_column("order_items", "size_id")
    op.drop_column("order_items", "crust_id")
    op.drop_table("order_item_toppings")
    op.drop_table("toppings")
    op.drop_table("pizza_crusts")
    op.drop_table("pizza_sizes")


def downgrade() -> None:
    op.create_table(
        "pizza_sizes",
        sa.Column("size_id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(10), nullable=False, unique=True),
        sa.Column("price_modifier_vnd", sa.Integer, nullable=False, server_default="0"),
    )
    op.create_table(
        "pizza_crusts",
        sa.Column("crust_id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(50), nullable=False, unique=True),
    )
    op.create_table(
        "toppings",
        sa.Column("topping_id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("price_vnd", sa.Integer, nullable=False),
    )
    op.create_table(
        "order_item_toppings",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "order_item_id", sa.Integer, sa.ForeignKey("order_items.order_item_id"), nullable=False
        ),
        sa.Column("topping_id", sa.Integer, sa.ForeignKey("toppings.topping_id"), nullable=False),
        sa.Column("quantity", sa.Integer, nullable=False, server_default="1"),
        sa.Column("price_at_time_vnd", sa.Integer, nullable=False),
    )
    op.add_column(
        "order_items",
        sa.Column("size_id", sa.Integer, sa.ForeignKey("pizza_sizes.size_id"), nullable=True),
    )
    op.add_column(
        "order_items",
        sa.Column("crust_id", sa.Integer, sa.ForeignKey("pizza_crusts.crust_id"), nullable=True),
    )
    op.drop_table("order_item_options")
    op.drop_table("product_options")
    op.drop_table("options")
    op.drop_table("option_groups")
