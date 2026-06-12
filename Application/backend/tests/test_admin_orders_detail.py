"""Admin order detail contract tests.

These verify the monitor-orders detail endpoint and default date window logic.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from uuid import uuid4

from app.infra.db.models import (
    Category,
    Order,
    OrderItem,
    OrderItemTopping,
    OrderStatus,
    OrderTracking,
    PizzaCrust,
    PizzaSize,
    Product,
    Topping,
    TrackingNoteSource,
)
from app.infra.db.session import create_session_factory
from tests.admin_test_utils import admin_client


def _seed_order_with_detail(
    *,
    order_code: str,
    created_at: datetime,
    status: OrderStatus,
) -> int:
    with create_session_factory()() as db:
        suffix = uuid4().hex[:6]
        category = Category(name=f"cat-{suffix}", is_active=True)
        db.add(category)
        db.flush()

        product = Product(
            category_id=category.category_id,
            name=f"Pizza {suffix}",
            base_price_vnd=120_000,
            is_pizza=True,
        )
        db.add(product)
        db.flush()

        size = PizzaSize(name=f"M-{suffix}", price_modifier_vnd=0)
        crust = PizzaCrust(name=f"thin-{suffix}")
        topping = Topping(name=f"Cheese-{suffix}", price_vnd=15_000)
        db.add_all([size, crust, topping])
        db.flush()

        order = Order(
            order_code=order_code,
            recipient_name="Lê Thu Hà",
            recipient_phone="0923456789",
            delivery_address="123 Demo Street, Ba Dinh",
            total_amount_vnd=242_000,
            promised_at=created_at + timedelta(hours=2),
            current_status=status,
            created_at=created_at,
        )
        db.add(order)
        db.flush()

        order_item = OrderItem(
            order_id=order.order_id,
            product_id=product.product_id,
            size_id=size.size_id,
            crust_id=crust.crust_id,
            quantity=2,
            unit_price_vnd=120_000,
            notes="Less chili",
        )
        db.add(order_item)
        db.flush()

        db.add(
            OrderItemTopping(
                order_item_id=order_item.order_item_id,
                topping_id=topping.topping_id,
                quantity=1,
                price_at_time_vnd=15_000,
            )
        )

        db.add_all(
            [
                OrderTracking(
                    order_id=order.order_id,
                    status=OrderStatus.RECEIVED,
                    note_source=TrackingNoteSource.SYSTEM,
                    note="Order received",
                    created_at=created_at,
                ),
                OrderTracking(
                    order_id=order.order_id,
                    status=OrderStatus.PREPARING,
                    note_source=TrackingNoteSource.KITCHEN,
                    note="Kitchen is waiting for a replacement topping",
                    created_at=created_at + timedelta(minutes=20),
                ),
                OrderTracking(
                    order_id=order.order_id,
                    status=OrderStatus.DISPATCH_PENDING,
                    note_source=TrackingNoteSource.TRANSPORT,
                    note="Driver delayed, re-check handoff",
                    created_at=created_at + timedelta(minutes=45),
                ),
            ]
        )
        db.commit()
        db.refresh(order)
        return order.order_id


def test_list_orders_defaults_to_today_when_dates_missing() -> None:
    client = admin_client("orders-default-range")
    today = datetime.now().replace(hour=10, minute=0, second=0, microsecond=0)
    yesterday = today - timedelta(days=1)

    today_order_id = _seed_order_with_detail(
        order_code="PIZZ-TODAY1",
        created_at=today,
        status=OrderStatus.RECEIVED,
    )
    _seed_order_with_detail(
        order_code="PIZZ-YESTERDAY1",
        created_at=yesterday,
        status=OrderStatus.RECEIVED,
    )

    resp = client.get("/api/admin/orders")

    assert resp.status_code == 200, resp.text
    rows = resp.json()
    assert [row["order_id"] for row in rows] == [today_order_id]
    assert rows[0]["order_code"] == "PIZZ-TODAY1"


def test_list_orders_filters_by_explicit_date_range() -> None:
    client = admin_client("orders-explicit-range")
    today = datetime.now().replace(hour=10, minute=0, second=0, microsecond=0)
    yesterday = today - timedelta(days=1)

    _seed_order_with_detail(
        order_code="PIZZ-RANGE-TODAY",
        created_at=today,
        status=OrderStatus.RECEIVED,
    )
    yesterday_order_id = _seed_order_with_detail(
        order_code="PIZZ-RANGE-YESTERDAY",
        created_at=yesterday,
        status=OrderStatus.RECEIVED,
    )

    resp = client.get(
        f"/api/admin/orders?from={yesterday.date().isoformat()}&to={yesterday.date().isoformat()}"
    )

    assert resp.status_code == 200, resp.text
    rows = resp.json()
    assert [row["order_id"] for row in rows] == [yesterday_order_id]
    assert rows[0]["order_code"] == "PIZZ-RANGE-YESTERDAY"


def test_get_order_returns_items_and_phase_notes() -> None:
    client = admin_client("orders-detail")
    created_at = datetime.now().replace(hour=10, minute=0, second=0, microsecond=0)
    order_id = _seed_order_with_detail(
        order_code="PIZZ-DETAIL1",
        created_at=created_at,
        status=OrderStatus.DELIVERING,
    )

    resp = client.get(f"/api/admin/orders/{order_id}")

    assert resp.status_code == 200, resp.text
    payload = resp.json()
    assert payload["order_code"] == "PIZZ-DETAIL1"
    assert payload["current_status"] == "Delivering"
    assert payload["promised_at"].startswith(created_at.date().isoformat())

    assert len(payload["items"]) == 1
    item = payload["items"][0]
    assert item["display_name"].startswith("Pizza ")
    assert item["size"].startswith("M-")
    assert item["crust"].startswith("thin-")
    assert item["notes"] == "Less chili"
    assert item["toppings"][0]["name"].startswith("Cheese-")

    assert [event["note_source"] for event in payload["tracking"]] == [
        "system",
        "kitchen",
        "transport",
    ]
    assert payload["tracking"][1]["note"].startswith("Kitchen is waiting")
    assert payload["tracking"][2]["note"].startswith("Driver delayed")
