from __future__ import annotations

from datetime import datetime

from app.infra.db.models import Category, Order, OrderItem, OrderStatus, Product
from app.infra.db.session import create_session_factory
from tests.admin_test_utils import admin_client


def _seed_product(name: str = "Margherita") -> int:
    with create_session_factory()() as db:
        category = Category(name="Pizzas", is_active=True)
        db.add(category)
        db.flush()
        product = Product(
            category_id=category.category_id,
            name=name,
            base_price_vnd=120_000,
            is_pizza=True,
            is_active=True,
        )
        db.add(product)
        db.commit()
        db.refresh(product)
        return product.product_id


def _seed_order(
    *,
    code: str,
    product_id: int,
    created_at: datetime,
    quantity: int,
    total_amount_vnd: int,
    status: OrderStatus = OrderStatus.DELIVERED,
) -> None:
    with create_session_factory()() as db:
        order = Order(
            order_code=code,
            recipient_name="Mai",
            recipient_phone="0901234567",
            delivery_address="5 Trang Tien",
            total_amount_vnd=total_amount_vnd,
            promised_at=created_at,
            created_at=created_at,
            current_status=status,
        )
        db.add(order)
        db.flush()
        db.add(
            OrderItem(
                order_id=order.order_id,
                product_id=product_id,
                quantity=quantity,
                unit_price_vnd=120_000,
            )
        )
        db.commit()


def test_sales_report_returns_daily_rows_with_top_items() -> None:
    client = admin_client("reports-daily")
    product_id = _seed_product("Margherita")
    _seed_order(
        code="PIZZ-REP001",
        product_id=product_id,
        created_at=datetime(2026, 6, 8, 10, 0, 0),
        quantity=2,
        total_amount_vnd=240_000,
    )
    _seed_order(
        code="PIZZ-REP002",
        product_id=product_id,
        created_at=datetime(2026, 6, 8, 14, 0, 0),
        quantity=1,
        total_amount_vnd=120_000,
    )
    _seed_order(
        code="PIZZ-REP003",
        product_id=product_id,
        created_at=datetime(2026, 6, 8, 15, 0, 0),
        quantity=1,
        total_amount_vnd=999_000,
        status=OrderStatus.CANCELLED,
    )

    resp = client.get("/api/admin/reports/sales?from=2026-06-08&to=2026-06-08")

    assert resp.status_code == 200, resp.text
    assert resp.json() == [
        {
            "date": "2026-06-08",
            "order_count": 2,
            "revenue_vnd": 360000,
            "top_items": [{"name": "Margherita", "count": 3}],
        }
    ]


def test_sales_report_can_export_csv() -> None:
    client = admin_client("reports-csv")
    product_id = _seed_product("Pepperoni")
    _seed_order(
        code="PIZZ-CSV001",
        product_id=product_id,
        created_at=datetime(2026, 6, 9, 10, 0, 0),
        quantity=1,
        total_amount_vnd=150_000,
    )

    resp = client.get("/api/admin/reports/sales?from=2026-06-09&to=2026-06-09&format=csv")

    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"].startswith("text/csv")
    assert "date,order_count,revenue_vnd,top_items" in resp.text
    assert "2026-06-09,1,150000,Pepperoni:1" in resp.text


def test_sales_report_can_group_by_week() -> None:
    client = admin_client("reports-weekly")
    product_id = _seed_product("Hawaiian")
    _seed_order(
        code="PIZZ-WEEK01",
        product_id=product_id,
        created_at=datetime(2026, 6, 8, 10, 0, 0),
        quantity=1,
        total_amount_vnd=100_000,
    )
    _seed_order(
        code="PIZZ-WEEK02",
        product_id=product_id,
        created_at=datetime(2026, 6, 10, 10, 0, 0),
        quantity=2,
        total_amount_vnd=200_000,
    )
    _seed_order(
        code="PIZZ-WEEK03",
        product_id=product_id,
        created_at=datetime(2026, 6, 15, 10, 0, 0),
        quantity=1,
        total_amount_vnd=120_000,
    )

    resp = client.get("/api/admin/reports/sales?from=2026-06-08&to=2026-06-15&group_by=week")

    assert resp.status_code == 200, resp.text
    assert resp.json() == [
        {
            "date": "2026-06-08",
            "order_count": 2,
            "revenue_vnd": 300000,
            "top_items": [{"name": "Hawaiian", "count": 3}],
        },
        {
            "date": "2026-06-15",
            "order_count": 1,
            "revenue_vnd": 120000,
            "top_items": [{"name": "Hawaiian", "count": 1}],
        },
    ]
