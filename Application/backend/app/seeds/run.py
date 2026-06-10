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
    Option,
    OptionGroup,
    Order,
    OrderItem,
    OrderStatus,
    OrderTracking,
    Product,
    ProductOption,
    User,
    UserRole,
)
from app.infra.db.session import create_session_factory

# Non-privileged demo customer password — QA fixtures only, never a real account.
DEMO_CUSTOMER_PASSWORD = "demo1234"

# Crockford base32 alphabet (excludes I, L, O, U), per the ORDER_CODE_FORMAT contract.
_CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


def _seed_order_code(user_id: int, days_ago: int) -> str:
    """Deterministic ``PIZZ-`` + 6 Crockford-base32 chars from (user_id, days_ago).

    Stable per (user, day) so re-seeding stays a no-op, while matching the
    documented order-code shape instead of the non-conformant ``PIZZ-SEED…`` form.
    """
    n = user_id * 1000 + days_ago
    chars = []
    for _ in range(6):
        chars.append(_CROCKFORD[n % 32])
        n //= 32
    return "PIZZ-" + "".join(reversed(chars))


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


def _upsert_option_group(
    db: Session, name: str, *, select_type: str, required: bool, sort_order: int
) -> OptionGroup:
    g = db.scalar(select(OptionGroup).where(OptionGroup.name == name))
    if g is None:
        g = OptionGroup(
            name=name, select_type=select_type, required=required, sort_order=sort_order
        )
        db.add(g)
        db.flush()
    else:
        g.select_type, g.required, g.sort_order = select_type, required, sort_order
    return g


def _upsert_option(
    db: Session, group: OptionGroup, name: str, *, delta: int, sort_order: int = 0
) -> Option:
    o = db.scalar(select(Option).where(Option.group_id == group.group_id, Option.name == name))
    if o is None:
        o = Option(group_id=group.group_id, name=name, price_delta_vnd=delta, sort_order=sort_order)
        db.add(o)
        db.flush()
    else:
        o.price_delta_vnd, o.sort_order = delta, sort_order
    return o


def _enable_for(db: Session, product_ids: list[int], option: Option) -> None:
    for pid in product_ids:
        if not db.get(ProductOption, (pid, option.option_id)):
            db.add(ProductOption(product_id=pid, option_id=option.option_id))


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

    # ── Option groups (A8) ─────────────────────────────────────────
    pizza_ids = [p.product_id for p in pizza_products]
    g_size = _upsert_option_group(db, "Size", select_type="single", required=True, sort_order=1)
    g_crust = _upsert_option_group(db, "Crust", select_type="single", required=True, sort_order=2)
    g_top = _upsert_option_group(db, "Toppings", select_type="multi", required=False, sort_order=3)

    for i, (name, delta) in enumerate([("S", 0), ("M", 30_000), ("L", 60_000)], start=1):
        _enable_for(db, pizza_ids, _upsert_option(db, g_size, name, delta=delta, sort_order=i))
    for i, name in enumerate(["thin", "cheese-stuffed"], start=1):
        _enable_for(db, pizza_ids, _upsert_option(db, g_crust, name, delta=0, sort_order=i))
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
    for i, (name, delta) in enumerate(toppings, start=1):
        _enable_for(db, pizza_ids, _upsert_option(db, g_top, name, delta=delta, sort_order=i))

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
        order_code = _seed_order_code(user.user_id, days_ago)
        if db.scalar(select(Order).where(Order.order_code == order_code)):
            continue
        items_total = sum(product.base_price_vnd * qty for product, qty in lines)
        created_at = now - timedelta(days=days_ago)
        order = Order(
            order_code=order_code,
            user_id=user.user_id,
            recipient_name=user.full_name,
            recipient_phone=phone,
            delivery_address="123 Demo Street, Ba Đình, Hà Nội",
            total_amount_vnd=items_total + 22_000,
            current_status=status,
            promised_at=created_at + timedelta(minutes=45),
            created_at=created_at,
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
