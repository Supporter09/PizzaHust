"""initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-05-26 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


USER_ROLE_VALUES = ("customer", "admin", "kitchen")
MEMBERSHIP_TIER_VALUES = ("standard", "silver", "gold")
ORDER_STATUS_VALUES = (
    "Received",
    "Preparing",
    "ReadyForDispatch",
    "Delivering",
    "Delivered",
    "DeliveryFailed",
    "Cancelled",
)


def upgrade() -> None:
    user_role_enum = sa.Enum(*USER_ROLE_VALUES, name="user_role")
    membership_tier_enum = sa.Enum(
        *MEMBERSHIP_TIER_VALUES,
        name="membership_tier",
    )
    order_status_enum = sa.Enum(*ORDER_STATUS_VALUES, name="order_status")

    op.create_table(
        "users",
        sa.Column("user_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("full_name", sa.String(length=100), nullable=False),
        sa.Column("phone_number", sa.String(length=15), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=True),
        sa.Column("address", sa.String(length=255), nullable=True),
        sa.Column("role", user_role_enum, nullable=False, server_default="customer"),
        sa.Column("current_points", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_points_earned", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "membership_tier",
            membership_tier_enum,
            nullable=False,
            server_default="standard",
        ),
        sa.UniqueConstraint("phone_number", name="uq_users_phone_number"),
    )

    op.create_table(
        "categories",
        sa.Column("category_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
    )

    op.create_table(
        "pizza_crusts",
        sa.Column("crust_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(length=50), nullable=False),
    )

    op.create_table(
        "pizza_sizes",
        sa.Column("size_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(length=10), nullable=False),
        sa.Column("price_modifier_vnd", sa.Integer(), nullable=False, server_default="0"),
    )

    op.create_table(
        "toppings",
        sa.Column("topping_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("price_vnd", sa.Integer(), nullable=False),
    )

    op.create_table(
        "products",
        sa.Column("product_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("base_price_vnd", sa.Integer(), nullable=False),
        sa.Column("is_pizza", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["categories.category_id"],
            name="fk_products_category_id_categories",
        ),
    )
    op.create_index("ix_products_category_id", "products", ["category_id"], unique=False)

    op.create_table(
        "combos",
        sa.Column("combo_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("combo_price_vnd", sa.Integer(), nullable=False),
        sa.Column("target_people", sa.String(length=50), nullable=True),
    )

    op.create_table(
        "combo_items",
        sa.Column("combo_item_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("combo_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(
            ["combo_id"],
            ["combos.combo_id"],
            name="fk_combo_items_combo_id_combos",
        ),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["products.product_id"],
            name="fk_combo_items_product_id_products",
        ),
    )

    op.create_table(
        "orders",
        sa.Column("order_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("order_code", sa.String(length=26), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("recipient_name", sa.String(length=100), nullable=False),
        sa.Column("recipient_phone", sa.String(length=15), nullable=False),
        sa.Column("delivery_address", sa.String(length=255), nullable=False),
        sa.Column("total_amount_vnd", sa.Integer(), nullable=False),
        sa.Column("delivery_fee_vnd", sa.Integer(), nullable=False, server_default="22000"),
        sa.Column("payment_method", sa.String(length=20), nullable=False, server_default="COD"),
        sa.Column(
            "current_status",
            order_status_enum,
            nullable=False,
            server_default="Received",
        ),
        sa.Column("promised_at", sa.DateTime(), nullable=False),
        sa.Column("delivery_reference", sa.String(length=64), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"], name="fk_orders_user_id_users"),
    )
    op.create_index("ix_orders_current_status", "orders", ["current_status"], unique=False)
    op.create_index("ix_orders_order_code", "orders", ["order_code"], unique=True)
    op.create_index("ix_orders_user_id", "orders", ["user_id"], unique=False)

    op.create_table(
        "order_items",
        sa.Column("order_item_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=True),
        sa.Column("combo_id", sa.Integer(), nullable=True),
        sa.Column("size_id", sa.Integer(), nullable=True),
        sa.Column("crust_id", sa.Integer(), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("unit_price_vnd", sa.Integer(), nullable=False),
        sa.Column("notes", sa.String(length=255), nullable=True),
        sa.CheckConstraint(
            "(product_id IS NOT NULL AND combo_id IS NULL) OR "
            "(product_id IS NULL AND combo_id IS NOT NULL)",
            name="ck_order_items_product_or_combo",
        ),
        sa.ForeignKeyConstraint(
            ["combo_id"], ["combos.combo_id"], name="fk_order_items_combo_id_combos"
        ),
        sa.ForeignKeyConstraint(
            ["crust_id"],
            ["pizza_crusts.crust_id"],
            name="fk_order_items_crust_id_pizza_crusts",
        ),
        sa.ForeignKeyConstraint(
            ["order_id"], ["orders.order_id"], name="fk_order_items_order_id_orders"
        ),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["products.product_id"],
            name="fk_order_items_product_id_products",
        ),
        sa.ForeignKeyConstraint(
            ["size_id"],
            ["pizza_sizes.size_id"],
            name="fk_order_items_size_id_pizza_sizes",
        ),
    )
    op.create_index("ix_order_items_order_id", "order_items", ["order_id"], unique=False)

    op.create_table(
        "order_item_toppings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("order_item_id", sa.Integer(), nullable=False),
        sa.Column("topping_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("price_at_time_vnd", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["order_item_id"],
            ["order_items.order_item_id"],
            name="fk_order_item_toppings_order_item_id_order_items",
        ),
        sa.ForeignKeyConstraint(
            ["topping_id"],
            ["toppings.topping_id"],
            name="fk_order_item_toppings_topping_id_toppings",
        ),
    )
    op.create_index(
        "ix_order_item_toppings_order_item_id",
        "order_item_toppings",
        ["order_item_id"],
        unique=False,
    )

    op.create_table(
        "order_tracking",
        sa.Column("tracking_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.Column("status", order_status_enum, nullable=False),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")
        ),
        sa.Column("note", sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(
            ["order_id"], ["orders.order_id"], name="fk_order_tracking_order_id_orders"
        ),
        sa.ForeignKeyConstraint(
            ["updated_by"], ["users.user_id"], name="fk_order_tracking_updated_by_users"
        ),
    )
    op.create_index("ix_order_tracking_order_id", "order_tracking", ["order_id"], unique=False)

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


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS kitchen_queue_view")
    op.drop_table("order_tracking")
    op.drop_table("order_item_toppings")
    op.drop_table("order_items")
    op.drop_table("orders")
    op.drop_table("combo_items")
    op.drop_table("combos")
    op.drop_table("products")
    op.drop_table("toppings")
    op.drop_table("pizza_sizes")
    op.drop_table("pizza_crusts")
    op.drop_table("categories")
    op.drop_table("users")
