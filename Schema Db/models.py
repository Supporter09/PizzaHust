from datetime import datetime
from sqlalchemy import (
    Boolean, CheckConstraint, Column, DateTime,
    Enum, ForeignKey, Integer, Numeric, String, Text
)
from sqlalchemy.orm import DeclarativeBase, relationship
import enum


class Base(DeclarativeBase):
    pass


# ──────────────────────────────────────────────
# Enums
# ──────────────────────────────────────────────

class UserRole(str, enum.Enum):
    CUSTOMER = "CUSTOMER"
    ADMIN    = "ADMIN"
    KITCHEN  = "KITCHEN"
    DELIVERY = "DELIVERY"


class MembershipTier(str, enum.Enum):
    STANDARD = "STANDARD"
    SILVER   = "SILVER"
    GOLD     = "GOLD"


class OrderStatus(str, enum.Enum):
    PENDING       = "PENDING"
    CONFIRMED     = "CONFIRMED"
    KITCHEN_PREP  = "KITCHEN_PREP"
    READY         = "READY"
    DELIVERING    = "DELIVERING"
    DONE          = "DONE"
    CANCELLED     = "CANCELLED"


# ──────────────────────────────────────────────
# 1. CỤM NGƯỜI DÙNG & KHÁCH HÀNG
# ──────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    user_id             = Column(Integer, primary_key=True, autoincrement=True)
    full_name           = Column(String(100), nullable=False)
    phone_number        = Column(String(15),  nullable=False, unique=True)
    password_hash       = Column(String(255), nullable=True)   # NULL → khách vãng lai
    address             = Column(String(255), nullable=True)
    role                = Column(Enum(UserRole), nullable=False, default=UserRole.CUSTOMER)
    current_points      = Column(Integer, nullable=False, default=0)
    total_points_earned = Column(Integer, nullable=False, default=0)
    membership_tier     = Column(Enum(MembershipTier), nullable=False, default=MembershipTier.STANDARD)

    # relationships
    orders          = relationship("Order",         back_populates="user",       foreign_keys="Order.user_id")
    tracking_logs   = relationship("OrderTracking", back_populates="staff",      foreign_keys="OrderTracking.updated_by")


# ──────────────────────────────────────────────
# 2. CỤM SẢN PHẨM & MENU
# ──────────────────────────────────────────────

class Category(Base):
    __tablename__ = "categories"

    category_id = Column(Integer, primary_key=True, autoincrement=True)
    name        = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)

    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"

    product_id  = Column(Integer, primary_key=True, autoincrement=True)
    category_id = Column(Integer, ForeignKey("categories.category_id"), nullable=False)
    name        = Column(String(100), nullable=False)
    base_price  = Column(Numeric(10, 2), nullable=False)
    is_pizza    = Column(Boolean, nullable=False, default=False)

    category    = relationship("Category",   back_populates="products")
    combo_items = relationship("ComboItem",  back_populates="product")
    order_items = relationship("OrderItem",  back_populates="product")


class PizzaSize(Base):
    __tablename__ = "pizza_sizes"

    size_id        = Column(Integer, primary_key=True, autoincrement=True)
    name           = Column(String(10), nullable=False)   # S | M | L
    price_modifier = Column(Numeric(10, 2), nullable=False, default=0)

    order_items = relationship("OrderItem", back_populates="size")


class PizzaCrust(Base):
    __tablename__ = "pizza_crusts"

    crust_id = Column(Integer, primary_key=True, autoincrement=True)
    name     = Column(String(50), nullable=False)   # Đế giòn, Đế mềm xốp …

    order_items = relationship("OrderItem", back_populates="crust")


class Topping(Base):
    __tablename__ = "toppings"

    topping_id = Column(Integer, primary_key=True, autoincrement=True)
    name       = Column(String(100), nullable=False)
    price      = Column(Numeric(10, 2), nullable=False)

    order_item_toppings = relationship("OrderItemTopping", back_populates="topping")


class Combo(Base):
    __tablename__ = "combos"

    combo_id      = Column(Integer, primary_key=True, autoincrement=True)
    name          = Column(String(100), nullable=False)
    description   = Column(Text, nullable=True)
    combo_price   = Column(Numeric(10, 2), nullable=False)
    target_people = Column(String(50), nullable=True)   # "2-3 người"

    combo_items = relationship("ComboItem",  back_populates="combo")
    order_items = relationship("OrderItem",  back_populates="combo")


class ComboItem(Base):
    __tablename__ = "combo_items"

    combo_item_id = Column(Integer, primary_key=True, autoincrement=True)
    combo_id      = Column(Integer, ForeignKey("combos.combo_id"),     nullable=False)
    product_id    = Column(Integer, ForeignKey("products.product_id"), nullable=False)
    quantity      = Column(Integer, nullable=False, default=1)

    combo   = relationship("Combo",   back_populates="combo_items")
    product = relationship("Product", back_populates="combo_items")


# ──────────────────────────────────────────────
# 3. CỤM ĐẶT HÀNG & XỬ LÝ
# ──────────────────────────────────────────────

class Order(Base):
    __tablename__ = "orders"

    order_id         = Column(Integer, primary_key=True, autoincrement=True)
    user_id          = Column(Integer, ForeignKey("users.user_id"), nullable=True)   # NULL → khách vãng lai
    total_amount     = Column(Numeric(10, 2), nullable=False)
    delivery_fee     = Column(Numeric(10, 2), nullable=False, default=22000)
    payment_method   = Column(String(20),     nullable=False, default="CASH")
    current_status   = Column(Enum(OrderStatus), nullable=False, default=OrderStatus.PENDING)
    delivery_address = Column(String(255),    nullable=False)
    created_at       = Column(DateTime, nullable=False, default=datetime.utcnow)

    user        = relationship("User",          back_populates="orders", foreign_keys=[user_id])
    items       = relationship("OrderItem",     back_populates="order",  cascade="all, delete-orphan")
    tracking    = relationship("OrderTracking", back_populates="order",  cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"
    __table_args__ = (
        # Mỗi item phải thuộc product hoặc combo, không đồng thời cả hai
        CheckConstraint(
            "(product_id IS NOT NULL AND combo_id IS NULL) OR "
            "(product_id IS NULL AND combo_id IS NOT NULL)",
            name="chk_product_or_combo",
        ),
    )

    order_item_id = Column(Integer, primary_key=True, autoincrement=True)
    order_id      = Column(Integer, ForeignKey("orders.order_id"),           nullable=False)
    product_id    = Column(Integer, ForeignKey("products.product_id"),       nullable=True)
    combo_id      = Column(Integer, ForeignKey("combos.combo_id"),           nullable=True)
    size_id       = Column(Integer, ForeignKey("pizza_sizes.size_id"),       nullable=True)
    crust_id      = Column(Integer, ForeignKey("pizza_crusts.crust_id"),     nullable=True)
    quantity      = Column(Integer,        nullable=False, default=1)
    unit_price    = Column(Numeric(10, 2), nullable=False)   # giá chốt tại thời điểm đặt
    notes         = Column(String(255),    nullable=True)

    order    = relationship("Order",      back_populates="items")
    product  = relationship("Product",    back_populates="order_items")
    combo    = relationship("Combo",      back_populates="order_items")
    size     = relationship("PizzaSize",  back_populates="order_items")
    crust    = relationship("PizzaCrust", back_populates="order_items")
    toppings = relationship("OrderItemTopping", back_populates="order_item", cascade="all, delete-orphan")


class OrderItemTopping(Base):
    __tablename__ = "order_item_toppings"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    order_item_id = Column(Integer, ForeignKey("order_items.order_item_id"), nullable=False)
    topping_id    = Column(Integer, ForeignKey("toppings.topping_id"),       nullable=False)
    quantity      = Column(Integer,        nullable=False, default=1)
    price_at_time = Column(Numeric(10, 2), nullable=False)   # giá tại thời điểm đặt

    order_item = relationship("OrderItem", back_populates="toppings")
    topping    = relationship("Topping",   back_populates="order_item_toppings")


class OrderTracking(Base):
    __tablename__ = "order_tracking"

    tracking_id = Column(Integer, primary_key=True, autoincrement=True)
    order_id    = Column(Integer, ForeignKey("orders.order_id"),  nullable=False)
    updated_by  = Column(Integer, ForeignKey("users.user_id"),    nullable=True)   # NULL → tự động
    status      = Column(Enum(OrderStatus), nullable=False)
    created_at  = Column(DateTime, nullable=False, default=datetime.utcnow)
    note        = Column(String(255), nullable=True)

    order = relationship("Order", back_populates="tracking")
    staff = relationship("User",  back_populates="tracking_logs", foreign_keys=[updated_by])
