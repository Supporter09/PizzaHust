"""Helpers for admin-router tests: an authenticated admin TestClient plus
direct-DB factories for catalog rows (categories/products/combos/options).

Admin routers do not enforce CSRF (same as the existing customers/orders
routers), so the logged-in TestClient's cookie jar is sufficient for mutations.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.infra.auth import hash_password
from app.infra.db.models import (
    Category,
    Combo,
    ComboItem,
    Option,
    OptionGroup,
    Order,
    OrderItem,
    Product,
    ProductOption,
    User,
    UserRole,
)
from app.infra.db.session import create_session_factory
from tests.auth_test_utils import build_test_app

ADMIN_PHONE = "0900000001"
ADMIN_PASSWORD = "adminpass123"


def admin_client(db_slug: str) -> TestClient:
    """Build a fresh test app on its own SQLite db and return a TestClient that
    is already logged in as an admin."""
    app = build_test_app(db_slug)
    with create_session_factory()() as db:
        db.add(
            User(
                full_name="Admin Test",
                phone_number=ADMIN_PHONE,
                password_hash=hash_password(ADMIN_PASSWORD),
                role=UserRole.ADMIN,
            )
        )
        db.commit()
    client = TestClient(app)
    resp = client.post(
        "/api/auth/login",
        json={"phone_number": ADMIN_PHONE, "password": ADMIN_PASSWORD},
    )
    assert resp.status_code == 200, resp.text
    return client


def count_categories() -> int:
    with create_session_factory()() as db:
        return len(db.scalars(select(Category)).all())


def new_category(name: str = "Pizza", *, is_active: bool = True) -> int:
    with create_session_factory()() as db:
        cat = Category(name=name, is_active=is_active)
        db.add(cat)
        db.commit()
        db.refresh(cat)
        return cat.category_id


def new_product(
    category_id: int,
    name: str,
    *,
    base_price_vnd: int = 100_000,
    is_pizza: bool = True,
    is_active: bool = True,
) -> int:
    with create_session_factory()() as db:
        p = Product(
            category_id=category_id,
            name=name,
            base_price_vnd=base_price_vnd,
            is_pizza=is_pizza,
            is_active=is_active,
        )
        db.add(p)
        db.commit()
        db.refresh(p)
        return p.product_id


def new_combo_with_items(name: str, product_ids: list[int], *, price_vnd: int = 200_000) -> int:
    with create_session_factory()() as db:
        combo = Combo(name=name, combo_price_vnd=price_vnd)
        db.add(combo)
        db.flush()
        for pid in product_ids:
            db.add(ComboItem(combo_id=combo.combo_id, product_id=pid, quantity=1))
        db.commit()
        db.refresh(combo)
        return combo.combo_id


def _new_order_item(db) -> OrderItem:
    """Create a minimal valid order + order_item (with its own category/product)."""
    suffix = uuid.uuid4().hex[:6]
    cat = Category(name=f"cat-{suffix}", is_active=True)
    db.add(cat)
    db.flush()
    prod = Product(
        category_id=cat.category_id, name=f"prod-{suffix}", base_price_vnd=1, is_pizza=True
    )
    db.add(prod)
    db.flush()
    order = Order(
        order_code=f"PIZZ-{suffix.upper()}",
        recipient_name="R",
        recipient_phone="0900000000",
        delivery_address="addr",
        total_amount_vnd=1,
        promised_at=datetime(2026, 1, 1, 0, 0, 0),
    )
    db.add(order)
    db.flush()
    oi = OrderItem(
        order_id=order.order_id,
        product_id=prod.product_id,
        quantity=1,
        unit_price_vnd=1,
    )
    db.add(oi)
    db.flush()
    return oi


def new_option_group(
    name: str = "Size", *, select_type: str = "single", required: bool = True, sort_order: int = 0
) -> int:
    with create_session_factory()() as db:
        g = OptionGroup(
            name=name, select_type=select_type, required=required, sort_order=sort_order
        )
        db.add(g)
        db.commit()
        db.refresh(g)
        return g.group_id


def new_option(
    group_id: int,
    name: str = "M",
    *,
    price_delta_vnd: int = 0,
    description: str | None = None,
    sort_order: int = 0,
) -> int:
    with create_session_factory()() as db:
        o = Option(
            group_id=group_id,
            name=name,
            description=description,
            price_delta_vnd=price_delta_vnd,
            sort_order=sort_order,
        )
        db.add(o)
        db.commit()
        db.refresh(o)
        return o.option_id


def enable_option(product_id: int, option_id: int) -> None:
    with create_session_factory()() as db:
        db.add(ProductOption(product_id=product_id, option_id=option_id))
        db.commit()
