from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import Enum, StrEnum

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infra.db.base import Base


def enum_values(enum_cls: type[Enum]) -> list[str]:
    return [member.value for member in enum_cls]


class UserRole(StrEnum):
    CUSTOMER = "customer"
    ADMIN = "admin"
    KITCHEN = "kitchen"


class MembershipTier(StrEnum):
    STANDARD = "standard"
    SILVER = "silver"
    GOLD = "gold"


class OrderStatus(StrEnum):
    RECEIVED = "Received"
    PREPARING = "Preparing"
    READY_FOR_DISPATCH = "ReadyForDispatch"
    DISPATCH_PENDING = "DispatchPending"
    DELIVERING = "Delivering"
    DELIVERED = "Delivered"
    DELIVERY_FAILED = "DeliveryFailed"
    CANCELLED = "Cancelled"


class TrackingNoteSource(StrEnum):
    SYSTEM = "system"
    KITCHEN = "kitchen"
    TRANSPORT = "transport"
    CUSTOMER = "customer"


user_role_enum = SqlEnum(
    UserRole,
    name="user_role",
    validate_strings=True,
    values_callable=enum_values,
)
membership_tier_enum = SqlEnum(
    MembershipTier,
    name="membership_tier",
    validate_strings=True,
    values_callable=enum_values,
)
order_status_enum = SqlEnum(
    OrderStatus,
    name="order_status",
    validate_strings=True,
    values_callable=enum_values,
)
tracking_note_source_enum = SqlEnum(
    TrackingNoteSource,
    name="tracking_note_source",
    validate_strings=True,
    values_callable=enum_values,
)


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    phone_number: Mapped[str] = mapped_column(String(15), nullable=False, unique=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_locked: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="0"
    )
    role: Mapped[UserRole] = mapped_column(
        user_role_enum,
        nullable=False,
        default=UserRole.CUSTOMER,
        server_default=UserRole.CUSTOMER.value,
    )
    current_points: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    total_points_earned: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    membership_tier: Mapped[MembershipTier] = mapped_column(
        membership_tier_enum,
        nullable=False,
        default=MembershipTier.STANDARD,
        server_default=MembershipTier.STANDARD.value,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now()
    )

    orders: Mapped[list[Order]] = relationship(back_populates="user", foreign_keys="Order.user_id")
    tracking_logs: Mapped[list[OrderTracking]] = relationship(
        back_populates="staff",
        foreign_keys="OrderTracking.updated_by",
    )


class Category(Base):
    __tablename__ = "categories"

    category_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="1"
    )

    products: Mapped[list[Product]] = relationship(back_populates="category")
    option_groups: Mapped[list[OptionGroup]] = relationship(
        back_populates="category", cascade="all, delete-orphan"
    )


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (Index("ix_products_category_id", "category_id"),)

    product_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.category_id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    base_price_vnd: Mapped[int] = mapped_column(Integer, nullable=False)
    image_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="1"
    )

    category: Mapped[Category] = relationship(back_populates="products")
    combo_items: Mapped[list[ComboItem]] = relationship(back_populates="product")
    order_items: Mapped[list[OrderItem]] = relationship(back_populates="product")
    images: Mapped[list[ProductImage]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )


class ProductImage(Base):
    __tablename__ = "product_images"
    __table_args__ = (Index("ix_product_images_product_id_sort", "product_id", "sort_order"),)

    image_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.product_id", ondelete="CASCADE"), nullable=False
    )
    url: Mapped[str] = mapped_column(String(255), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    is_cover: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="0"
    )

    product: Mapped[Product] = relationship(back_populates="images")


class OptionGroup(Base):
    __tablename__ = "option_groups"
    __table_args__ = (
        UniqueConstraint("category_id", "name", name="uq_option_groups_category_name"),
        Index("ix_option_groups_category_id", "category_id"),
    )

    group_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.category_id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    select_type: Mapped[str] = mapped_column(
        SqlEnum("single", "multi", name="option_select_type"),
        nullable=False,
        default="multi",
        server_default="multi",
    )
    required: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="0"
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    category: Mapped[Category] = relationship(back_populates="option_groups")
    options: Mapped[list[Option]] = relationship(
        back_populates="group", cascade="all, delete-orphan"
    )


class Option(Base):
    __tablename__ = "options"
    __table_args__ = (UniqueConstraint("group_id", "name", name="uq_options_group_name"),)

    option_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    group_id: Mapped[int] = mapped_column(
        ForeignKey("option_groups.group_id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    price_delta_vnd: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    group: Mapped[OptionGroup] = relationship(back_populates="options")


class ProductOption(Base):
    """Per-dish enablement: row present = option enabled for the product."""

    __tablename__ = "product_options"

    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.product_id", ondelete="CASCADE"), primary_key=True
    )
    option_id: Mapped[int] = mapped_column(
        ForeignKey("options.option_id", ondelete="CASCADE"), primary_key=True
    )


class OrderItemOption(Base):
    """Snapshot of one selected option at order time. No FK to options — admin
    deletes never touch history. Rows are inserted in (group.sort_order,
    option.sort_order) order; readers order by id."""

    __tablename__ = "order_item_options"
    __table_args__ = (Index("ix_order_item_options_order_item_id", "order_item_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_item_id: Mapped[int] = mapped_column(
        ForeignKey("order_items.order_item_id"), nullable=False
    )
    group_name: Mapped[str] = mapped_column(String(100), nullable=False)
    option_name: Mapped[str] = mapped_column(String(100), nullable=False)
    price_delta_vnd: Mapped[int] = mapped_column(Integer, nullable=False)

    order_item: Mapped[OrderItem] = relationship(back_populates="options")


class Combo(Base):
    __tablename__ = "combos"
    __table_args__ = (
        CheckConstraint(
            "validity_start IS NULL OR validity_end IS NULL OR validity_start <= validity_end",
            name="validity_range",
        ),
    )

    combo_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    combo_price_vnd: Mapped[int] = mapped_column(Integer, nullable=False)
    target_group: Mapped[int | None] = mapped_column(Integer, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    validity_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    validity_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)

    combo_items: Mapped[list[ComboItem]] = relationship(back_populates="combo")
    order_items: Mapped[list[OrderItem]] = relationship(back_populates="combo")
    images: Mapped[list[ComboImage]] = relationship(
        back_populates="combo", cascade="all, delete-orphan"
    )


class ComboImage(Base):
    __tablename__ = "combo_images"
    __table_args__ = (Index("ix_combo_images_combo_id_sort", "combo_id", "sort_order"),)

    image_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    combo_id: Mapped[int] = mapped_column(
        ForeignKey("combos.combo_id", ondelete="CASCADE"), nullable=False
    )
    url: Mapped[str] = mapped_column(String(255), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    is_cover: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="0"
    )

    combo: Mapped[Combo] = relationship(back_populates="images")


class ComboItem(Base):
    """Fixed component (product_id) XOR choice slot (category_id). A slot means
    "any active product from this category × quantity"; see domain/combo_slots."""

    __tablename__ = "combo_items"
    __table_args__ = (
        CheckConstraint(
            "(product_id IS NULL) != (category_id IS NULL)",
            name="ck_combo_items_kind",
        ),
    )

    combo_item_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    combo_id: Mapped[int] = mapped_column(ForeignKey("combos.combo_id"), nullable=False)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.product_id"), nullable=True)
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.category_id"), nullable=True
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")

    combo: Mapped[Combo] = relationship(back_populates="combo_items")
    product: Mapped[Product | None] = relationship(back_populates="combo_items")
    category: Mapped[Category | None] = relationship()


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (
        Index("ix_orders_current_status", "current_status"),
        Index("ix_orders_user_id", "user_id"),
        Index(
            "ix_orders_user_id_created_at_order_id",
            "user_id",
            "created_at",
            "order_id",
        ),
        Index("ix_orders_order_code", "order_code", unique=True),
        CheckConstraint(
            "loyalty_points_earned >= 0", name="ck_orders_loyalty_points_earned_nonneg"
        ),
    )

    order_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_code: Mapped[str] = mapped_column(String(26), nullable=False)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.user_id"), nullable=True)
    recipient_name: Mapped[str] = mapped_column(String(100), nullable=False)
    recipient_phone: Mapped[str] = mapped_column(String(15), nullable=False)
    delivery_address: Mapped[str] = mapped_column(String(255), nullable=False)
    delivery_ward: Mapped[str | None] = mapped_column(String(100), nullable=True)
    delivery_note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    total_amount_vnd: Mapped[int] = mapped_column(Integer, nullable=False)
    delivery_fee_vnd: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=22000,
        server_default="22000",
    )
    payment_method: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="COD",
        server_default="COD",
    )
    current_status: Mapped[OrderStatus] = mapped_column(
        order_status_enum,
        nullable=False,
        default=OrderStatus.RECEIVED,
        server_default=OrderStatus.RECEIVED.value,
    )
    promised_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    delivery_reference: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Loyalty points credited to the user at placement. Stored so cancellation can
    # reverse the exact amount even if the admin-configured accrual rate later changes.
    loyalty_points_earned: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=func.now(),
    )

    user: Mapped[User | None] = relationship(back_populates="orders", foreign_keys=[user_id])
    items: Mapped[list[OrderItem]] = relationship(
        back_populates="order",
        cascade="all, delete-orphan",
    )
    tracking: Mapped[list[OrderTracking]] = relationship(
        back_populates="order",
        cascade="all, delete-orphan",
    )


class OrderItem(Base):
    __tablename__ = "order_items"
    __table_args__ = (
        CheckConstraint(
            "(product_id IS NOT NULL AND combo_id IS NULL) OR "
            "(product_id IS NULL AND combo_id IS NOT NULL)",
            name="product_or_combo",
        ),
        Index("ix_order_items_order_id", "order_id"),
    )

    order_item_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.order_id"), nullable=False)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.product_id"), nullable=True)
    combo_id: Mapped[int | None] = mapped_column(ForeignKey("combos.combo_id"), nullable=True)
    parent_order_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("order_items.order_item_id"), nullable=True
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    unit_price_vnd: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)

    order: Mapped[Order] = relationship(back_populates="items")
    product: Mapped[Product | None] = relationship(back_populates="order_items")
    combo: Mapped[Combo | None] = relationship(back_populates="order_items")
    parent: Mapped[OrderItem | None] = relationship(
        back_populates="children", remote_side="OrderItem.order_item_id"
    )
    children: Mapped[list[OrderItem]] = relationship(back_populates="parent")
    options: Mapped[list[OrderItemOption]] = relationship(
        back_populates="order_item",
        cascade="all, delete-orphan",
    )


class WebhookEvent(Base):
    """Idempotency store for incoming delivery webhook events."""

    __tablename__ = "webhook_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=func.now(),
    )


class Cart(Base):
    __tablename__ = "carts"
    __table_args__ = (Index("ix_carts_user_id", "user_id", unique=True),)

    cart_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.user_id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now()
    )
    touched_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)

    lines: Mapped[list[CartLine]] = relationship(
        back_populates="cart", cascade="all, delete-orphan", order_by="CartLine.line_id"
    )


class CartLine(Base):
    __tablename__ = "cart_lines"
    __table_args__ = (
        CheckConstraint("quantity >= 1 AND quantity <= 99", name="ck_cart_lines_quantity_range"),
        Index("ix_cart_lines_cart_id", "cart_id"),
    )

    line_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cart_id: Mapped[int] = mapped_column(
        ForeignKey("carts.cart_id", ondelete="CASCADE"), nullable=False
    )
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now()
    )

    cart: Mapped[Cart] = relationship(back_populates="lines")


class OrderTracking(Base):
    __tablename__ = "order_tracking"
    __table_args__ = (
        Index("ix_order_tracking_order_id", "order_id"),
        Index("ix_order_tracking_status", "status"),
        Index("ix_order_tracking_note_source", "note_source"),
    )

    tracking_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.order_id"), nullable=False)
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("users.user_id"), nullable=True)
    status: Mapped[OrderStatus] = mapped_column(order_status_enum, nullable=False)
    note_source: Mapped[TrackingNoteSource] = mapped_column(
        tracking_note_source_enum,
        nullable=False,
        default=TrackingNoteSource.SYSTEM,
        server_default=TrackingNoteSource.SYSTEM.value,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=func.now(),
    )
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)

    order: Mapped[Order] = relationship(back_populates="tracking")
    staff: Mapped[User | None] = relationship(
        back_populates="tracking_logs", foreign_keys=[updated_by]
    )


class BusinessSettings(Base):
    __tablename__ = "business_settings"
    # Names are bare suffixes; the metadata ``ck`` naming convention prefixes
    # ``ck_business_settings_`` (see app/infra/db/base.py). The pre-existing
    # singleton keeps its already-prefixed name for back-compat with migration 0015.
    __table_args__ = (
        CheckConstraint("id = 1", name="ck_business_settings_singleton"),
        CheckConstraint("loyalty_accrual_rate > 0", name="accrual_rate_positive"),
        CheckConstraint("loyalty_redeem_value_vnd > 0", name="redeem_value_positive"),
        CheckConstraint(
            "loyalty_max_redeem_pct > 0 AND loyalty_max_redeem_pct <= 1",
            name="max_redeem_pct_fraction",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=False)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False)
    loyalty_accrual_rate: Mapped[int] = mapped_column(Integer, nullable=False)
    loyalty_redeem_value_vnd: Mapped[int] = mapped_column(Integer, nullable=False)
    loyalty_max_redeem_pct: Mapped[Decimal] = mapped_column(Numeric(3, 2), nullable=False)


class DeliveryWardFee(Base):
    __tablename__ = "delivery_ward_fees"
    __table_args__ = (
        UniqueConstraint("ward_name", name="uq_delivery_ward_fees_name"),
        UniqueConstraint("ward_normalized", name="uq_delivery_ward_fees_normalized"),
        CheckConstraint("fee_vnd >= 0", name="ck_delivery_ward_fees_nonneg"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    ward_name: Mapped[str] = mapped_column(String(128), nullable=False)
    ward_normalized: Mapped[str] = mapped_column(String(128), nullable=False)
    fee_vnd: Mapped[int] = mapped_column(Integer, nullable=False)
