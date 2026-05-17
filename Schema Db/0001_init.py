"""init: create all tables

Revision ID: 0001_init
Revises: 
Create Date: 2024-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = "0001_init"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── users ───────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("user_id",             sa.Integer(),     primary_key=True, autoincrement=True),
        sa.Column("full_name",           sa.String(100),   nullable=False),
        sa.Column("phone_number",        sa.String(15),    nullable=False),
        sa.Column("password_hash",       sa.String(255),   nullable=True),
        sa.Column("address",             sa.String(255),   nullable=True),
        sa.Column("role",                sa.Enum("CUSTOMER","ADMIN","KITCHEN","DELIVERY", name="userrole"), nullable=False, server_default="CUSTOMER"),
        sa.Column("current_points",      sa.Integer(),     nullable=False, server_default="0"),
        sa.Column("total_points_earned", sa.Integer(),     nullable=False, server_default="0"),
        sa.Column("membership_tier",     sa.Enum("STANDARD","SILVER","GOLD", name="membershiptier"), nullable=False, server_default="STANDARD"),
    )
    op.create_unique_constraint("uq_users_phone", "users", ["phone_number"])

    # ── categories ──────────────────────────────────────────
    op.create_table(
        "categories",
        sa.Column("category_id", sa.Integer(),    primary_key=True, autoincrement=True),
        sa.Column("name",        sa.String(50),   nullable=False),
        sa.Column("description", sa.Text(),       nullable=True),
    )

    # ── products ────────────────────────────────────────────
    op.create_table(
        "products",
        sa.Column("product_id",  sa.Integer(),       primary_key=True, autoincrement=True),
        sa.Column("category_id", sa.Integer(),       nullable=False),
        sa.Column("name",        sa.String(100),     nullable=False),
        sa.Column("base_price",  sa.Numeric(10, 2),  nullable=False),
        sa.Column("is_pizza",    sa.Boolean(),       nullable=False, server_default="false"),
        sa.ForeignKeyConstraint(["category_id"], ["categories.category_id"], name="fk_products_category"),
    )
    op.create_index("idx_products_category_id", "products", ["category_id"])

    # ── pizza_sizes ──────────────────────────────────────────
    op.create_table(
        "pizza_sizes",
        sa.Column("size_id",        sa.Integer(),      primary_key=True, autoincrement=True),
        sa.Column("name",           sa.String(10),     nullable=False),
        sa.Column("price_modifier", sa.Numeric(10, 2), nullable=False, server_default="0"),
    )

    # ── pizza_crusts ─────────────────────────────────────────
    op.create_table(
        "pizza_crusts",
        sa.Column("crust_id", sa.Integer(),   primary_key=True, autoincrement=True),
        sa.Column("name",     sa.String(50),  nullable=False),
    )

    # ── toppings ─────────────────────────────────────────────
    op.create_table(
        "toppings",
        sa.Column("topping_id", sa.Integer(),      primary_key=True, autoincrement=True),
        sa.Column("name",       sa.String(100),    nullable=False),
        sa.Column("price",      sa.Numeric(10, 2), nullable=False),
    )

    # ── combos ───────────────────────────────────────────────
    op.create_table(
        "combos",
        sa.Column("combo_id",      sa.Integer(),      primary_key=True, autoincrement=True),
        sa.Column("name",          sa.String(100),    nullable=False),
        sa.Column("description",   sa.Text(),         nullable=True),
        sa.Column("combo_price",   sa.Numeric(10, 2), nullable=False),
        sa.Column("target_people", sa.String(50),     nullable=True),
    )

    # ── combo_items ──────────────────────────────────────────
    op.create_table(
        "combo_items",
        sa.Column("combo_item_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("combo_id",      sa.Integer(), nullable=False),
        sa.Column("product_id",    sa.Integer(), nullable=False),
        sa.Column("quantity",      sa.Integer(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(["combo_id"],   ["combos.combo_id"],     name="fk_combo_items_combo"),
        sa.ForeignKeyConstraint(["product_id"], ["products.product_id"], name="fk_combo_items_product"),
    )

    # ── orders ───────────────────────────────────────────────
    op.create_table(
        "orders",
        sa.Column("order_id",         sa.Integer(),      primary_key=True, autoincrement=True),
        sa.Column("user_id",          sa.Integer(),      nullable=True),
        sa.Column("total_amount",     sa.Numeric(10, 2), nullable=False),
        sa.Column("delivery_fee",     sa.Numeric(10, 2), nullable=False, server_default="22000"),
        sa.Column("payment_method",   sa.String(20),     nullable=False, server_default="CASH"),
        sa.Column("current_status",   sa.Enum("PENDING","CONFIRMED","KITCHEN_PREP","READY","DELIVERING","DONE","CANCELLED", name="orderstatus"), nullable=False, server_default="PENDING"),
        sa.Column("delivery_address", sa.String(255),    nullable=False),
        sa.Column("created_at",       sa.DateTime(),     nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"], name="fk_orders_user"),
    )
    op.create_index("idx_orders_user_id", "orders", ["user_id"])
    op.create_index("idx_orders_status",  "orders", ["current_status"])

    # ── order_items ──────────────────────────────────────────
    op.create_table(
        "order_items",
        sa.Column("order_item_id", sa.Integer(),      primary_key=True, autoincrement=True),
        sa.Column("order_id",      sa.Integer(),      nullable=False),
        sa.Column("product_id",    sa.Integer(),      nullable=True),
        sa.Column("combo_id",      sa.Integer(),      nullable=True),
        sa.Column("size_id",       sa.Integer(),      nullable=True),
        sa.Column("crust_id",      sa.Integer(),      nullable=True),
        sa.Column("quantity",      sa.Integer(),      nullable=False, server_default="1"),
        sa.Column("unit_price",    sa.Numeric(10, 2), nullable=False),
        sa.Column("notes",         sa.String(255),    nullable=True),
        sa.ForeignKeyConstraint(["order_id"],   ["orders.order_id"],           name="fk_order_items_order"),
        sa.ForeignKeyConstraint(["product_id"], ["products.product_id"],       name="fk_order_items_product"),
        sa.ForeignKeyConstraint(["combo_id"],   ["combos.combo_id"],           name="fk_order_items_combo"),
        sa.ForeignKeyConstraint(["size_id"],    ["pizza_sizes.size_id"],       name="fk_order_items_size"),
        sa.ForeignKeyConstraint(["crust_id"],   ["pizza_crusts.crust_id"],     name="fk_order_items_crust"),
        sa.CheckConstraint(
            "(product_id IS NOT NULL AND combo_id IS NULL) OR "
            "(product_id IS NULL AND combo_id IS NOT NULL)",
            name="chk_product_or_combo",
        ),
    )
    op.create_index("idx_order_items_order_id", "order_items", ["order_id"])

    # ── order_item_toppings ──────────────────────────────────
    op.create_table(
        "order_item_toppings",
        sa.Column("id",            sa.Integer(),      primary_key=True, autoincrement=True),
        sa.Column("order_item_id", sa.Integer(),      nullable=False),
        sa.Column("topping_id",    sa.Integer(),      nullable=False),
        sa.Column("quantity",      sa.Integer(),      nullable=False, server_default="1"),
        sa.Column("price_at_time", sa.Numeric(10, 2), nullable=False),
        sa.ForeignKeyConstraint(["order_item_id"], ["order_items.order_item_id"], name="fk_oit_order_item"),
        sa.ForeignKeyConstraint(["topping_id"],    ["toppings.topping_id"],       name="fk_oit_topping"),
    )
    op.create_index("idx_oit_order_item_id", "order_item_toppings", ["order_item_id"])

    # ── order_tracking ───────────────────────────────────────
    op.create_table(
        "order_tracking",
        sa.Column("tracking_id", sa.Integer(),   primary_key=True, autoincrement=True),
        sa.Column("order_id",    sa.Integer(),   nullable=False),
        sa.Column("updated_by",  sa.Integer(),   nullable=True),
        sa.Column("status",      sa.Enum("PENDING","CONFIRMED","KITCHEN_PREP","READY","DELIVERING","DONE","CANCELLED", name="orderstatus"), nullable=False),
        sa.Column("created_at",  sa.DateTime(),  nullable=False, server_default=sa.text("NOW()")),
        sa.Column("note",        sa.String(255), nullable=True),
        sa.ForeignKeyConstraint(["order_id"],   ["orders.order_id"],  name="fk_tracking_order"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.user_id"],    name="fk_tracking_staff"),
    )
    op.create_index("idx_tracking_order_id", "order_tracking", ["order_id"])


def downgrade() -> None:
    # Drop theo thứ tự ngược lại (child → parent)
    op.drop_table("order_tracking")
    op.drop_table("order_item_toppings")
    op.drop_table("order_items")
    op.drop_table("orders")
    op.drop_table("combo_items")
    op.drop_table("combos")
    op.drop_table("toppings")
    op.drop_table("pizza_crusts")
    op.drop_table("pizza_sizes")
    op.drop_table("products")
    op.drop_table("categories")
    op.drop_table("users")

    # Drop custom enum types (PostgreSQL)
    op.execute("DROP TYPE IF EXISTS orderstatus")
    op.execute("DROP TYPE IF EXISTS membershiptier")
    op.execute("DROP TYPE IF EXISTS userrole")
