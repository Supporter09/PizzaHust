"""Helpers for kitchen-endpoint tests: a logged-in kitchen TestClient plus
direct-DB order factories (single product, combo parent+children)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.infra.auth import get_current_user, hash_password
from app.infra.db.models import (
    Category,
    Combo,
    Order,
    OrderItem,
    OrderItemOption,
    OrderStatus,
    Product,
    User,
    UserRole,
)
from app.infra.db.session import create_session_factory
from tests.auth_test_utils import build_test_app


def kitchen_client(db_slug: str) -> TestClient:
    app = build_test_app(db_slug)
    with create_session_factory()() as db:
        user = User(
            full_name="Kitchen Test",
            phone_number="0900000002",
            password_hash=hash_password("kitchen123"),
            role=UserRole.KITCHEN,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        uid = user.user_id
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(
        user_id=uid, role=UserRole.KITCHEN
    )
    return TestClient(app)


def anon_client(db_slug: str) -> TestClient:
    """No login override → get_current_user raises 401."""
    return TestClient(build_test_app(db_slug))


def _new_product(db, name: str, price: int = 100_000) -> Product:
    cat = Category(name=f"cat-{uuid.uuid4().hex[:6]}", is_active=True)
    db.add(cat)
    db.flush()
    product = Product(category_id=cat.category_id, name=name, base_price_vnd=price)
    db.add(product)
    db.flush()
    return product


def _seconds_floor(dt: datetime) -> datetime:
    # SQLite strftime('%s', …) is happiest without microseconds.
    return dt.replace(microsecond=0)


def make_order(
    *,
    status: OrderStatus,
    code: str | None = None,
    created_minutes_ago: int = 5,
    delivery_note: str | None = None,
    product_name: str = "Margherita",
    quantity: int = 2,
    note: str | None = None,
    options: list[tuple[str, str]] | None = None,
) -> int:
    with create_session_factory()() as db:
        product = _new_product(db, product_name)
        now = _seconds_floor(datetime.now(UTC).replace(tzinfo=None))
        order = Order(
            order_code=code or f"PIZZ-{uuid.uuid4().hex[:6].upper()}",
            recipient_name="R",
            recipient_phone="0900000000",
            delivery_address="addr",
            total_amount_vnd=product.base_price_vnd,
            current_status=status,
            delivery_note=delivery_note,
            created_at=now - timedelta(minutes=created_minutes_ago),
            promised_at=now + timedelta(minutes=20),
        )
        db.add(order)
        db.flush()
        item = OrderItem(
            order_id=order.order_id,
            product_id=product.product_id,
            quantity=quantity,
            unit_price_vnd=product.base_price_vnd,
            notes=note,
        )
        db.add(item)
        db.flush()
        for group_name, option_name in options or []:
            db.add(
                OrderItemOption(
                    order_item_id=item.order_item_id,
                    group_name=group_name,
                    option_name=option_name,
                    price_delta_vnd=0,
                )
            )
        db.commit()
        return order.order_id


def make_combo_order(
    *,
    status: OrderStatus,
    combo_name: str = "Family Combo",
    child_names: tuple[str, ...] = ("Pepperoni", "Coke"),
) -> int:
    with create_session_factory()() as db:
        combo = Combo(name=combo_name, combo_price_vnd=200_000)
        db.add(combo)
        db.flush()
        now = _seconds_floor(datetime.now(UTC).replace(tzinfo=None))
        order = Order(
            order_code=f"PIZZ-{uuid.uuid4().hex[:6].upper()}",
            recipient_name="R",
            recipient_phone="0900000000",
            delivery_address="addr",
            total_amount_vnd=200_000,
            current_status=status,
            created_at=now - timedelta(minutes=3),
            promised_at=now + timedelta(minutes=20),
        )
        db.add(order)
        db.flush()
        parent = OrderItem(
            order_id=order.order_id,
            combo_id=combo.combo_id,
            quantity=1,
            unit_price_vnd=200_000,
        )
        db.add(parent)
        db.flush()
        for child_name in child_names:
            child_product = _new_product(db, child_name)
            db.add(
                OrderItem(
                    order_id=order.order_id,
                    product_id=child_product.product_id,
                    parent_order_item_id=parent.order_item_id,
                    quantity=1,
                    unit_price_vnd=0,
                )
            )
        db.commit()
        return order.order_id
