"""Seed script – idempotent. Baseline + demo data for development and E2E tests."""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.infra.auth import hash_password
from app.infra.config import Settings, get_settings
from app.infra.db.models import (
    Category,
    Combo,
    ComboItem,
    MembershipTier,
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
import ulid as _ulid

DEMO_CUSTOMER_PASSWORD = "demo1234"


def _upsert_user(db: Session, phone: str, **kwargs) -> User:
    user = db.scalar(select(User).where(User.phone_number == phone))
    if user is None:
        user = User(phone_number=phone, **kwargs)
        db.add(user)
        db.flush()
    return user


def _upsert_category(db: Session, name: str, description: str) -> Category:
    cat = db.scalar(select(Category).where(Category.name == name))
    if cat is None:
        cat = Category(name=name, description=description)
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


def _seed_demo_order(
    db: Session,
    user: User,
    product: Product,
    size: PizzaSize,
    crust: PizzaCrust,
    status: OrderStatus,
    days_ago: int,
    amount: int,
) -> Order:
    created_at = datetime.utcnow() - timedelta(days=days_ago)
    code = str(_ulid.ULID.from_datetime(created_at))
    existing = db.scalar(select(Order).where(Order.order_code == code))
    if existing is not None:
        return existing
    order = Order(
        order_code=code,
        user_id=user.user_id,
        recipient_name=user.full_name,
        recipient_phone=user.phone_number,
        delivery_address="123 Le Thanh Nghi, Ha Noi",
        total_amount_vnd=amount,
        delivery_fee_vnd=22_000,
        payment_method="COD",
        current_status=status,
        promised_at=created_at + timedelta(minutes=45),
        created_at=created_at,
    )
    db.add(order)
    db.flush()
    db.add(OrderItem(
        order_id=order.order_id,
        product_id=product.product_id,
        size_id=size.size_id,
        crust_id=crust.crust_id,
        quantity=1,
        unit_price_vnd=amount - 22_000,
    ))
    db.add(OrderTracking(
        order_id=order.order_id,
        status=status,
        created_at=created_at + timedelta(minutes=40),
        note="Demo seed",
    ))
    db.flush()
    return order


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
    _upsert_user(
        db, phone=settings.admin_seed_phone,
        full_name="Admin PizzaHUST", email="admin@pizzahust.vn",
        password_hash=hash_password(settings.admin_seed_password),
        role=UserRole.ADMIN,
    )
    _upsert_user(
        db, phone=settings.kitchen_seed_phone,
        full_name="Kitchen Staff",
        password_hash=hash_password(settings.kitchen_seed_password),
        role=UserRole.KITCHEN,
    )

    # ── Categories ─────────────────────────────────────────────────
    cat_pizza = _upsert_category(db, "Pizza", "Handcrafted stone-oven pizzas")
    cat_side = _upsert_category(db, "Side Dishes", "Wings, fries, and more")
    _upsert_category(db, "Drinks", "Soft drinks and juices")

    # ── Sizes / Crusts ─────────────────────────────────────────────
    size_s = _upsert_size(db, "S", 0)
    size_m = _upsert_size(db, "M", 30_000)
    size_l = _upsert_size(db, "L", 60_000)
    crust_thin = _upsert_crust(db, "thin")
    crust_cheese = _upsert_crust(db, "cheese-stuffed")

    # ── Toppings ───────────────────────────────────────────────────
    for name, price in [
        ("Extra Cheese", 15_000), ("Mushroom", 12_000), ("Jalapeno", 10_000),
        ("Bell Pepper", 10_000), ("Chicken", 18_000), ("Beef", 20_000),
        ("Olives", 12_000), ("Onion", 8_000), ("Pineapple", 10_000), ("Shrimp", 22_000),
    ]:
        _upsert_topping(db, name, price)

    # ── Pizzas ─────────────────────────────────────────────────────
    pizza_data = [
        ("Margherita Classic", 125_000),
        ("Pepperoni Fire", 145_000),
        ("Four Cheese Royale", 155_000),
        ("BBQ Chicken Feast", 150_000),
        ("Hawaiian Sunset", 135_000),
        ("Spicy Meat Supreme", 160_000),
        ("Garden Veggie", 125_000),
        ("Seafood Delight", 175_000),
    ]
    pp = [_upsert_product(db, n, category_id=cat_pizza.category_id, base_price_vnd=p, is_pizza=True)
          for n, p in pizza_data]

    # ── Side dishes ────────────────────────────────────────────────
    side_data = [
        ("Garlic Bread (4pcs)", 45_000),
        ("Chicken Wings (6pcs)", 85_000),
        ("Truffle Fries", 55_000),
        ("Coleslaw", 35_000),
    ]
    sp = [_upsert_product(db, n, category_id=cat_side.category_id, base_price_vnd=p, is_pizza=False)
          for n, p in side_data]

    # ── Combos ─────────────────────────────────────────────────────
    now = datetime.utcnow()

    c1 = db.scalar(select(Combo).where(Combo.name == "Lunch Duo for 2"))
    if c1 is None:
        c1 = Combo(
            name="Lunch Duo for 2",
            description="2 Medium pizzas + 2 Garlic Breads – perfect midday deal",
            combo_price_vnd=255_000, target_group=2,
            validity_start=now, validity_end=now + timedelta(days=30), is_active=True,
        )
        db.add(c1); db.flush()
        db.add(ComboItem(combo_id=c1.combo_id, product_id=pp[0].product_id, quantity=2))
        db.add(ComboItem(combo_id=c1.combo_id, product_id=sp[0].product_id, quantity=2))

    c2 = db.scalar(select(Combo).where(Combo.name == "Family Feast 4"))
    if c2 is None:
        c2 = Combo(
            name="Family Feast 4",
            description="2 Large pizzas + 6 Wings + Fries – feeds the whole family",
            combo_price_vnd=480_000, target_group=4,
            validity_start=now, validity_end=now + timedelta(days=30), is_active=True,
        )
        db.add(c2); db.flush()
        db.add(ComboItem(combo_id=c2.combo_id, product_id=pp[1].product_id, quantity=2))
        db.add(ComboItem(combo_id=c2.combo_id, product_id=sp[1].product_id, quantity=1))
        db.add(ComboItem(combo_id=c2.combo_id, product_id=sp[2].product_id, quantity=1))

    # ── Demo Customer 1: Lan Anh – Silver, 320 pts, 6 delivered orders ──
    u1 = _upsert_user(
        db, phone="0901234567", full_name="Nguyen Lan Anh", email="lananh@test.vn",
        password_hash=hash_password(DEMO_CUSTOMER_PASSWORD), role=UserRole.CUSTOMER,
        current_points=320, total_points_earned=520, membership_tier=MembershipTier.SILVER,
    )
    for prod, size, crust, days in [
        (pp[0], size_m, crust_thin, 30), (pp[2], size_l, crust_cheese, 22),
        (pp[1], size_m, crust_thin, 15), (pp[4], size_l, crust_cheese, 10),
        (pp[3], size_m, crust_thin, 5),  (pp[0], size_l, crust_cheese, 1),
    ]:
        _seed_demo_order(db, u1, prod, size, crust, OrderStatus.DELIVERED, days,
                         prod.base_price_vnd + size.price_modifier_vnd + 22_000)

    # ── Demo Customer 2: Minh Khoi – Gold, 1850 pts, 12 delivered orders ──
    u2 = _upsert_user(
        db, phone="0912345678", full_name="Tran Minh Khoi", email=None,
        password_hash=hash_password(DEMO_CUSTOMER_PASSWORD), role=UserRole.CUSTOMER,
        current_points=1850, total_points_earned=2100, membership_tier=MembershipTier.GOLD,
    )
    for prod, size, crust, days in [
        (pp[5], size_l, crust_cheese, 60), (pp[7], size_l, crust_thin, 52),
        (pp[2], size_l, crust_cheese, 45), (pp[6], size_m, crust_thin, 38),
        (pp[1], size_l, crust_cheese, 30), (pp[3], size_l, crust_thin, 25),
        (pp[0], size_m, crust_cheese, 20), (pp[5], size_l, crust_thin, 15),
        (pp[4], size_l, crust_cheese, 10), (pp[7], size_l, crust_thin, 7),
        (pp[2], size_l, crust_cheese, 3),  (pp[1], size_l, crust_thin, 1),
    ]:
        _seed_demo_order(db, u2, prod, size, crust, OrderStatus.DELIVERED, days,
                         prod.base_price_vnd + size.price_modifier_vnd + 22_000)

    # ── Demo Customer 3: Thu Ha – Standard, 45 pts, 2 delivered + 1 cancelled ──
    u3 = _upsert_user(
        db, phone="0923456789", full_name="Le Thu Ha", email="thuha@test.vn",
        password_hash=hash_password(DEMO_CUSTOMER_PASSWORD), role=UserRole.CUSTOMER,
        current_points=45, total_points_earned=95, membership_tier=MembershipTier.STANDARD,
    )
    _seed_demo_order(db, u3, pp[0], size_s, crust_thin, OrderStatus.DELIVERED, 14,
                     pp[0].base_price_vnd + 22_000)
    _seed_demo_order(db, u3, pp[4], size_m, crust_cheese, OrderStatus.DELIVERED, 7,
                     pp[4].base_price_vnd + 30_000 + 22_000)
    _seed_demo_order(db, u3, pp[2], size_l, crust_thin, OrderStatus.CANCELLED, 3,
                     pp[2].base_price_vnd + 60_000 + 22_000)

    # ── QA-only extra accounts ─────────────────────────────────────
    for phone, name, email in [
        ("0934567890", "Pham Duc Trong", None),
        ("0945678901", "Vu Ngoc Linh", "ngolinh@test.vn"),
    ]:
        _upsert_user(
            db, phone=phone, full_name=name, email=email,
            password_hash=hash_password(DEMO_CUSTOMER_PASSWORD), role=UserRole.CUSTOMER,
        )


if __name__ == "__main__":
    main()
