"""Seed script – idempotent. Baseline + demo data for development and E2E tests."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.infra.auth import hash_password
from app.infra.config import Settings, get_settings
from app.infra.db.models import (
    Category,
    Combo,
    ComboItem,
    Order,
    OrderItem,
    OrderStatus,
    OrderTracking,
    PizzaCrust,
    PizzaSize,
    Product,
    Topping,
    User,
    UserRole,
)
from app.infra.db.session import create_session_factory

# Non-privileged demo customer password — QA fixtures only, never a real account.
DEMO_CUSTOMER_PASSWORD = "demo1234"


def _upsert_user(db: Session, phone: str, **kwargs) -> User:
    user = db.scalar(select(User).where(User.phone_number == phone))
    if user is None:
        user = User(phone_number=phone, **kwargs)
        db.add(user)
        db.flush()
    return user


def _upsert_category(db: Session, name: str, description: str, sort_order: int = 0) -> Category:
    cat = db.scalar(select(Category).where(Category.name == name))
    if cat is None:
        cat = Category(name=name, description=description, sort_order=sort_order)
        db.add(cat)
        db.flush()
    return cat


def _upsert_product(db: Session, name: str, **kwargs) -> Product:
    prod = db.scalar(select(Product).where(Product.name == name))
    if prod is None:
        prod = Product(name=name, **kwargs)
        db.add(prod)
        db.flush()
    return prod


def _upsert_topping(db: Session, name: str, price: int) -> Topping:
    t = db.scalar(select(Topping).where(Topping.name == name))
    if t is None:
        t = Topping(name=name, price_vnd=price)
        db.add(t)
        db.flush()
    return t


def _upsert_size(db: Session, name: str, modifier: int) -> PizzaSize:
    s = db.scalar(select(PizzaSize).where(PizzaSize.name == name))
    if s is None:
        s = PizzaSize(name=name, price_modifier_vnd=modifier)
        db.add(s)
        db.flush()
    return s


def _upsert_crust(db: Session, name: str) -> PizzaCrust:
    c = db.scalar(select(PizzaCrust).where(PizzaCrust.name == name))
    if c is None:
        c = PizzaCrust(name=name)
        db.add(c)
        db.flush()
    return c


def main() -> None:
    settings = get_settings()
    if not settings.admin_seed_password or not settings.kitchen_seed_password:
        raise SystemExit(
            "ADMIN_SEED_PASSWORD and KITCHEN_SEED_PASSWORD must be set to seed "
            "privileged accounts (see .env.example)."
        )
    factory = create_session_factory()
    db: Session = factory()
    try:
        _seed(db, settings)
        db.commit()
        print("seeds: done")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def _seed(db: Session, settings: Settings) -> None:
    # ── Privileged accounts ────────────────────────────────────────
    # Passwords come from the environment — no weak credentials in source.
    _upsert_user(
        db,
        phone=settings.admin_seed_phone,
        full_name="Admin PizzaHUST",
        email="admin@pizzahust.vn",
        password_hash=hash_password(settings.admin_seed_password),
        role=UserRole.ADMIN,
    )
    _upsert_user(
        db,
        phone=settings.kitchen_seed_phone,
        full_name="Kitchen Staff",
        password_hash=hash_password(settings.kitchen_seed_password),
        role=UserRole.KITCHEN,
    )

    # ── 5 test customer accounts (QA test data) ────────────────────
    test_customers = [
        ("0901234567", "Nguyễn Lan Anh", "lananh@test.vn", 0),
        ("0912345678", "Trần Minh Khôi", None, 120),
        ("0923456789", "Lê Thu Hà", "thuha@test.vn", 45),
        ("0934567890", "Phạm Đức Trọng", None, 0),
        ("0945678901", "Vũ Ngọc Linh", "ngolinh@test.vn", 310),
    ]
    for phone, name, email, pts in test_customers:
        _upsert_user(
            db,
            phone=phone,
            full_name=name,
            email=email,
            password_hash=hash_password(DEMO_CUSTOMER_PASSWORD),
            role=UserRole.CUSTOMER,
            current_points=pts,
            total_points_earned=pts,
        )

    # ── Categories ─────────────────────────────────────────────────
    cat_pizza = _upsert_category(db, "Pizza", "Handcrafted stone-oven pizzas", sort_order=1)
    cat_side = _upsert_category(db, "Side Dishes", "Wings, fries, and more", sort_order=2)
    _upsert_category(db, "Drinks", "Soft drinks and juices", sort_order=3)

    # ── Sizes ──────────────────────────────────────────────────────
    _upsert_size(db, "S", 0)
    _upsert_size(db, "M", 30_000)
    _upsert_size(db, "L", 60_000)

    # ── Crusts ─────────────────────────────────────────────────────
    _upsert_crust(db, "thin")
    _upsert_crust(db, "cheese-stuffed")

    # ── Toppings ───────────────────────────────────────────────────
    toppings = [
        ("Extra Cheese", 15_000),
        ("Mushroom", 12_000),
        ("Jalapeño", 10_000),
        ("Bell Pepper", 10_000),
        ("Chicken", 18_000),
        ("Beef", 20_000),
        ("Olives", 12_000),
        ("Onion", 8_000),
        ("Pineapple", 10_000),
        ("Shrimp", 22_000),
    ]
    for name, price in toppings:
        _upsert_topping(db, name, price)

    # ── Pizzas ─────────────────────────────────────────────────────
    pizzas = [
        ("Margherita Classic", 125_000),
        ("Pepperoni Fire", 145_000),
        ("Four Cheese Royale", 155_000),
        ("BBQ Chicken Feast", 150_000),
        ("Hawaiian Sunset", 135_000),
        ("Spicy Meat Supreme", 160_000),
        ("Garden Veggie", 125_000),
        ("Seafood Delight", 175_000),
    ]
    pizza_products = [
        _upsert_product(
            db, name, category_id=cat_pizza.category_id, base_price_vnd=price, is_pizza=True
        )
        for name, price in pizzas
    ]

    # ── Side dishes ────────────────────────────────────────────────
    sides = [
        ("Garlic Bread (4pcs)", 45_000),
        ("Chicken Wings (6pcs)", 85_000),
        ("Truffle Fries", 55_000),
        ("Coleslaw", 35_000),
    ]
    side_products = [
        _upsert_product(
            db, name, category_id=cat_side.category_id, base_price_vnd=price, is_pizza=False
        )
        for name, price in sides
    ]

    # ── Combos ─────────────────────────────────────────────────────
    # naive UTC to match the DateTime(timezone=False) columns (utcnow() is deprecated).
    now = datetime.now(UTC).replace(tzinfo=None)

    combo1 = db.scalar(select(Combo).where(Combo.name == "Lunch Duo for 2"))
    if combo1 is None:
        combo1 = Combo(
            name="Lunch Duo for 2",
            description="2 Medium pizzas + 2 Garlic Breads",
            combo_price_vnd=255_000,
            target_group=2,
            validity_start=now,
            validity_end=now + timedelta(days=30),
        )
        db.add(combo1)
        db.flush()
        db.add(
            ComboItem(combo_id=combo1.combo_id, product_id=pizza_products[0].product_id, quantity=2)
        )
        db.add(
            ComboItem(combo_id=combo1.combo_id, product_id=side_products[0].product_id, quantity=2)
        )

    combo2 = db.scalar(select(Combo).where(Combo.name == "Family Feast 4"))
    if combo2 is None:
        combo2 = Combo(
            name="Family Feast 4",
            description="2 Large pizzas + 6 Wings + Fries",
            combo_price_vnd=480_000,
            target_group=4,
            validity_start=now,
            validity_end=now + timedelta(days=30),
        )
        db.add(combo2)
        db.flush()
        db.add(
            ComboItem(combo_id=combo2.combo_id, product_id=pizza_products[1].product_id, quantity=2)
        )
        db.add(
            ComboItem(combo_id=combo2.combo_id, product_id=side_products[1].product_id, quantity=1)
        )
        db.add(
            ComboItem(combo_id=combo2.combo_id, product_id=side_products[2].product_id, quantity=1)
        )

    # ── Demo orders ────────────────────────────────────────────────
    # Deterministic order codes keyed by (user_id, days_ago) so re-seeding is a
    # no-op (no duplicate orders) — unlike a random/ULID code that re-randomizes.
    demo_orders = [
        ("0901234567", 1, OrderStatus.DELIVERED, [(pizza_products[0], 1), (side_products[0], 1)]),
        ("0912345678", 2, OrderStatus.PREPARING, [(pizza_products[1], 2)]),
        ("0923456789", 0, OrderStatus.RECEIVED, [(pizza_products[4], 1), (side_products[1], 1)]),
    ]
    for phone, days_ago, status, lines in demo_orders:
        user = db.scalar(select(User).where(User.phone_number == phone))
        if user is None:
            continue
        order_code = f"PIZZ-SEED{user.user_id:02d}{days_ago:02d}"
        if db.scalar(select(Order).where(Order.order_code == order_code)):
            continue
        items_total = sum(product.base_price_vnd * qty for product, qty in lines)
        order = Order(
            order_code=order_code,
            user_id=user.user_id,
            recipient_name=user.full_name,
            recipient_phone=phone,
            delivery_address="123 Demo Street, Ba Đình, Hà Nội",
            total_amount_vnd=items_total + 22_000,
            current_status=status,
            promised_at=now + timedelta(minutes=45),
            created_at=now - timedelta(days=days_ago),
        )
        db.add(order)
        db.flush()
        for product, qty in lines:
            db.add(
                OrderItem(
                    order_id=order.order_id,
                    product_id=product.product_id,
                    quantity=qty,
                    unit_price_vnd=product.base_price_vnd,
                )
            )
        db.add(OrderTracking(order_id=order.order_id, status=status))


if __name__ == "__main__":
    main()
