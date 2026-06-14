"""Admin order date-window timezone tests.

Order timestamps are stored naive UTC, but the admin "today" window the browser
supplies is a business-timezone (+07) calendar day. An order placed at
2026-06-13 19:57 UTC is the +07 calendar day 2026-06-14 — it must show up for
from=to=2026-06-14 and NOT for 2026-06-15.
"""

from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from app.infra.db.models import Category, Order, OrderItem, OrderStatus, Product
from app.infra.db.session import create_session_factory
from tests.admin_test_utils import admin_client


def _seed_order(*, order_code: str, created_at: datetime) -> int:
    with create_session_factory()() as db:
        suffix = uuid4().hex[:6]
        category = Category(name=f"cat-{suffix}", is_active=True)
        db.add(category)
        db.flush()
        product = Product(
            category_id=category.category_id,
            name=f"Pizza {suffix}",
            base_price_vnd=120_000,
        )
        db.add(product)
        db.flush()
        order = Order(
            order_code=order_code,
            recipient_name="Window Customer",
            recipient_phone="0900000000",
            delivery_address="123 Window Street",
            total_amount_vnd=120_000,
            promised_at=created_at,
            current_status=OrderStatus.RECEIVED,
            created_at=created_at,
        )
        db.add(order)
        db.flush()
        db.add(
            OrderItem(
                order_id=order.order_id,
                product_id=product.product_id,
                quantity=1,
                unit_price_vnd=120_000,
            )
        )
        db.commit()
        db.refresh(order)
        return order.order_id


def test_order_buckets_into_business_timezone_day() -> None:
    client = admin_client("admin-orders-window")
    # 19:57 UTC on 2026-06-13 is 02:57 +07 on 2026-06-14.
    order_id = _seed_order(
        order_code="PIZZ-WINDOW1",
        created_at=datetime(2026, 6, 13, 19, 57, 0),
    )

    resp = client.get("/api/admin/orders?from=2026-06-14&to=2026-06-14")
    assert resp.status_code == 200, resp.text
    assert [row["order_id"] for row in resp.json()] == [order_id]

    # The same order is NOT the UTC calendar day 2026-06-13 nor 2026-06-15.
    other = client.get("/api/admin/orders?from=2026-06-15&to=2026-06-15")
    assert other.status_code == 200, other.text
    assert order_id not in [row["order_id"] for row in other.json()]
