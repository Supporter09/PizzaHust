from __future__ import annotations

from datetime import datetime
from enum import Enum, StrEnum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
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


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    phone_number: Mapped[str] = mapped_column(String(15), nullable=False, unique=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
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


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (Index("ix_products_category_id", "category_id"),)

    product_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.category_id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    base_price_vnd: Mapped[int] = mapped_column(Integer, nullable=False)
    is_pizza: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="0"
    )
    image_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="1"
    )

    category: Mapped[Category] = relationship(back_populates="products")
    combo_items: Mapped[list[ComboItem]] = relationship(back_populates="product")
    order_items: Mapped[list[OrderItem]] = relationship(back_populates="product")


class OptionGroup(Base):
    __tablename__ = "option_groups"

    group_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
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
        Index("ix_orders_order_code", "order_code", unique=True),
    )

    order_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_code: Mapped[str] = mapped_column(String(26), nullable=False)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.user_id"), nullable=True)
    recipient_name: Mapped[str] = mapped_column(String(100), nullable=False)
    recipient_phone: Mapped[str] = mapped_column(String(15), nullable=False)
    delivery_address: Mapped[str] = mapped_column(String(255), nullable=False)
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
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    unit_price_vnd: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)

    order: Mapped[Order] = relationship(back_populates="items")
    product: Mapped[Product | None] = relationship(back_populates="order_items")
    combo: Mapped[Combo | None] = relationship(back_populates="order_items")
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


class OrderTracking(Base):
    __tablename__ = "order_tracking"
    __table_args__ = (Index("ix_order_tracking_order_id", "order_id"),)

    tracking_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.order_id"), nullable=False)
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("users.user_id"), nullable=True)
    status: Mapped[OrderStatus] = mapped_column(order_status_enum, nullable=False)
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
