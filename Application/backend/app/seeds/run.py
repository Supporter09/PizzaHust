"""Seed script – idempotent. Populates test data for development and E2E tests."""

from __future__ import annotations

import os
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.infra.auth import hash_password
from app.infra.db.models import (
    Category,
    Combo,
    ComboItem,
    Order,
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


def main() -> None:
    factory = create_session_factory()
    db: Session = factory()
    try:
        _seed(db)
        db.commit()
        print("seeds: done")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def _seed(db: Session) -> None:
    # ── Admin ──────────────────────────────────────────────────────
    _upsert_user(
        db,
        phone="0900000001",
        full_name="Admin PizzaHUST",
        email="admin@pizzahust.vn",
        password_hash=hash_password("admin1234"),
        role=UserRole.ADMIN,
    )

    # ── Kitchen staff ──────────────────────────────────────────────
    _upsert_user(
        db,
        phone="0900000002",
        full_name="Kitchen Staff",
        password_hash=hash_password("kitchen1234"),
        role=UserRole.KITCHEN,
    )

    # ── 5 test customer accounts (QA test data) ────────────────────
    test_customers = [
        ("0901234567", "Nguyễn Lan Anh", "lananh@test.vn", "demo1234", 0),
        ("0912345678", "Trần Minh Khôi", None, "demo1234", 120),
        ("0923456789", "Lê Thu Hà", "thuha@test.vn", "demo1234", 45),
        ("0934567890", "Phạm Đức Trọng", None, "demo1234", 0),
        ("0945678901", "Vũ Ngọc Linh", "ngolinh@test.vn", "demo1234", 310),
    ]
    for phone, name, email, pw, pts in test_customers:
        u = _upsert_user(
            db,
            phone=phone,
            full_name=name,
            email=email,
            password_hash=hash_password(pw),
            role=UserRole.CUSTOMER,
            current_points=pts,
            total_points_earned=pts,
        )

    # ── Categories (3) ─────────────────────────────────────────────
    cat_pizza = _upsert_category(db, "Pizza", "Handcrafted stone-oven pizzas")
    cat_side = _upsert_category(db, "Side Dishes", "Wings, fries, and more")
    cat_drink = _upsert_category(db, "Drinks", "Soft drinks and juices")

    # ── Sizes (3) ──────────────────────────────────────────────────
    sz_s = _upsert_size(db, "S", 0)
    sz_m = _upsert_size(db, "M", 30_000)
    sz_l = _upsert_size(db, "L", 60_000)

    # ── Crusts (2) ─────────────────────────────────────────────────
    crust_thin = _upsert_crust(db, "thin")
    crust_stuffed = _upsert_crust(db, "cheese-stuffed")

    # ── Toppings (10) ──────────────────────────────────────────────
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

    # ── Pizzas (8) ─────────────────────────────────────────────────
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
    pizza_products = []
    for name, price in pizzas:
        p = _upsert_product(db, name, category_id=cat_pizza.category_id, base_price_vnd=price, is_pizza=True)
        pizza_products.append(p)

    # ── Side dishes (4) ────────────────────────────────────────────
    sides = [
        ("Garlic Bread (4pcs)", 45_000),
        ("Chicken Wings (6pcs)", 85_000),
        ("Truffle Fries", 55_000),
        ("Coleslaw", 35_000),
    ]
    side_products = []
    for name, price in sides:
        p = _upsert_product(db, name, category_id=cat_side.category_id, base_price_vnd=price, is_pizza=False)
        side_products.append(p)

    # ── Combos (2) ─────────────────────────────────────────────────
    now = datetime.utcnow()

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
        db.add(ComboItem(combo_id=combo1.combo_id, product_id=pizza_products[0].product_id, quantity=2))
        db.add(ComboItem(combo_id=combo1.combo_id, product_id=side_products[0].product_id, quantity=2))

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
        db.add(ComboItem(combo_id=combo2.combo_id, product_id=pizza_products[1].product_id, quantity=2))
        db.add(ComboItem(combo_id=combo2.combo_id, product_id=side_products[1].product_id, quantity=1))
        db.add(ComboItem(combo_id=combo2.combo_id, product_id=side_products[2].product_id, quantity=1))


if __name__ == "__main__":
    main()
