"""Admin order detail contract tests.

These verify the monitor-orders detail endpoint and default date window logic.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from uuid import uuid4

from app.infra.db.models import (
    Category,
    Option,
    OptionGroup,
    Order,
    OrderItem,
    OrderItemOption,
    OrderStatus,
    OrderTracking,
    Product,
    ProductOption,
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
        )
        db.add(product)
        db.flush()

        group = OptionGroup(
            category_id=category.category_id,
            name=f"Toppings-{suffix}",
            select_type="multi",
            required=False,
        )
        option = Option(
            group=group,
            name=f"Cheese-{suffix}",
            price_delta_vnd=15_000,
            sort_order=1,
        )
        db.add_all([group, option])
        db.flush()
        db.add(ProductOption(product_id=product.product_id, option_id=option.option_id))

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
            quantity=2,
            unit_price_vnd=120_000,
            notes="Less chili",
        )
        db.add(order_item)
        db.flush()

        db.add(
            OrderItemOption(
                order_item_id=order_item.order_item_id,
                group_name=group.name,
                option_name=option.name,
                price_delta_vnd=option.price_delta_vnd,
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
                    note="Kitchen is waiting for a replacement option",
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
    assert item["notes"] == "Less chili"
    assert item["options"][0]["group_name"].startswith("Toppings-")
    assert item["options"][0]["option_name"].startswith("Cheese-")

    assert [event["note_source"] for event in payload["tracking"]] == [
        "system",
        "kitchen",
        "transport",
    ]
    assert payload["tracking"][1]["note"].startswith("Kitchen is waiting")
    assert payload["tracking"][2]["note"].startswith("Driver delayed")


def test_get_order_serializes_timestamps_as_utc_instants() -> None:
    client = admin_client("orders-detail-utc")
    created_at = datetime(2026, 6, 15, 15, 26, 0)
    order_id = _seed_order_with_detail(
        order_code="PIZZ-UTC001",
        created_at=created_at,
        status=OrderStatus.RECEIVED,
    )

    resp = client.get(f"/api/admin/orders/{order_id}")

    assert resp.status_code == 200, resp.text
    payload = resp.json()
    assert payload["created_at"] == "2026-06-15T15:26:00Z"
    assert payload["promised_at"] == "2026-06-15T17:26:00Z"
    assert payload["tracking"][0]["created_at"] == "2026-06-15T15:26:00Z"


def test_list_orders_searches_code_and_recipient_with_item_count() -> None:
    client = admin_client("orders-search")
    today = datetime.now().replace(hour=10, minute=0, second=0, microsecond=0)

    target_id = _seed_order_with_detail(
        order_code="PIZZ-FINDME1",
        created_at=today,
        status=OrderStatus.RECEIVED,
    )
    _seed_order_with_detail(
        order_code="PIZZ-OTHER01",
        created_at=today,
        status=OrderStatus.RECEIVED,
    )

    by_code = client.get("/api/admin/orders?q=FINDME")
    assert by_code.status_code == 200, by_code.text
    rows = by_code.json()
    assert [row["order_id"] for row in rows] == [target_id]
    assert rows[0]["item_count"] == 1

    by_name = client.get("/api/admin/orders?q=Thu Hà")
    assert by_name.status_code == 200, by_name.text
    assert len(by_name.json()) == 2

    no_match = client.get("/api/admin/orders?q=NOPE-XYZ")
    assert no_match.status_code == 200, no_match.text
    assert no_match.json() == []
