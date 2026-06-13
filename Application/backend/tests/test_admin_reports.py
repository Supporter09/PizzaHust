"""Admin sales report contract tests.

These verify the dashboard summary, daily series zero-fill, and sales export
compatibility for the reports page.
"""

from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace
from uuid import uuid4

from app.api.admin.reports import sales_overview, sales_report
from app.infra.db.models import Category, Order, OrderItem, OrderStatus, Product, User, UserRole
from app.infra.db.session import create_session_factory
from tests.admin_test_utils import admin_client
from tests.auth_test_utils import build_test_app


def _bootstrap(db_slug: str) -> None:
    build_test_app(db_slug)


def _new_customer(*, full_name: str, phone_number: str) -> int:
    with create_session_factory()() as db:
        user = User(
            full_name=full_name,
            phone_number=phone_number,
            password_hash="hash",
            role=UserRole.CUSTOMER,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user.user_id


def _seed_order(
    *,
    user_id: int,
    order_code: str,
    created_at: datetime,
    status: OrderStatus,
    total_amount_vnd: int,
    item_name: str,
    item_quantity: int,
    item_unit_price_vnd: int,
) -> int:
    with create_session_factory()() as db:
        suffix = uuid4().hex[:6]
        category = Category(name=f"cat-{suffix}", is_active=True)
        db.add(category)
        db.flush()

        product = Product(
            category_id=category.category_id,
            name=item_name,
            base_price_vnd=item_unit_price_vnd,
            is_pizza=True,
        )
        db.add(product)
        db.flush()

        order = Order(
            order_code=order_code,
            user_id=user_id,
            recipient_name="Report Customer",
            recipient_phone="0900000000",
            delivery_address="123 Report Street",
            total_amount_vnd=total_amount_vnd,
            promised_at=created_at,
            current_status=status,
            created_at=created_at,
        )
        db.add(order)
        db.flush()

        db.add(
            OrderItem(
                order_id=order.order_id,
                product_id=product.product_id,
                quantity=item_quantity,
                unit_price_vnd=item_unit_price_vnd,
            )
        )
        db.commit()
        db.refresh(order)
        return order.order_id


def test_sales_overview_summarizes_delivered_orders_and_zero_fills_days() -> None:
    _bootstrap("reports-overview")
    customer_a = _new_customer(full_name="Active A", phone_number="0901111111")
    customer_b = _new_customer(full_name="Active B", phone_number="0902222222")
    customer_c = _new_customer(full_name="Cancelled C", phone_number="0903333333")
    admin = SimpleNamespace(user_id=1, role=UserRole.ADMIN)

    _seed_order(
        user_id=customer_a,
        order_code="PIZZ-RPT-001",
        created_at=datetime(2026, 6, 9, 10, 0, 0),
        status=OrderStatus.DELIVERED,
        total_amount_vnd=300_000,
        item_name="Pepperoni",
        item_quantity=3,
        item_unit_price_vnd=100_000,
    )
    _seed_order(
        user_id=customer_a,
        order_code="PIZZ-RPT-002",
        created_at=datetime(2026, 6, 10, 11, 0, 0),
        status=OrderStatus.DELIVERED,
        total_amount_vnd=200_000,
        item_name="Margherita",
        item_quantity=2,
        item_unit_price_vnd=100_000,
    )
    _seed_order(
        user_id=customer_b,
        order_code="PIZZ-RPT-003",
        created_at=datetime(2026, 6, 10, 13, 0, 0),
        status=OrderStatus.DELIVERED,
        total_amount_vnd=150_000,
        item_name="Pepperoni",
        item_quantity=1,
        item_unit_price_vnd=100_000,
    )
    _seed_order(
        user_id=customer_c,
        order_code="PIZZ-RPT-004",
        created_at=datetime(2026, 6, 11, 9, 0, 0),
        status=OrderStatus.CANCELLED,
        total_amount_vnd=99_000,
        item_name="Ignored",
        item_quantity=1,
        item_unit_price_vnd=99_000,
    )

    with create_session_factory()() as db:
        payload = sales_overview(
            from_date=datetime(2026, 6, 9).date(),
            to_date=datetime(2026, 6, 11).date(),
            db=db,
            _admin=admin,
        )

    assert payload.summary.total_orders == 3
    assert payload.summary.total_revenue_vnd == 650_000
    assert payload.summary.avg_order_value_vnd == 216_666
    assert payload.summary.active_customers == 2
    assert [point.date for point in payload.series] == [
        "2026-06-09",
        "2026-06-10",
        "2026-06-11",
    ]
    assert payload.series[0].revenue_vnd == 300_000
    assert payload.series[1].order_count == 2
    assert payload.series[2].revenue_vnd == 0
    assert payload.top_items[0].name == "Pepperoni"
    assert payload.top_items[0].order_count == 4
    assert payload.top_items[0].revenue_vnd == 400_000


def test_sales_report_keeps_json_and_csv_contracts() -> None:
    _bootstrap("reports-sales")
    customer = _new_customer(full_name="Report Customer", phone_number="0904444444")
    admin = SimpleNamespace(user_id=1, role=UserRole.ADMIN)

    _seed_order(
        user_id=customer,
        order_code="PIZZ-RPT-005",
        created_at=datetime(2026, 6, 12, 12, 0, 0),
        status=OrderStatus.DELIVERED,
        total_amount_vnd=220_000,
        item_name="Hawaiian",
        item_quantity=2,
        item_unit_price_vnd=110_000,
    )

    with create_session_factory()() as db:
        rows = sales_report(
            from_date=datetime(2026, 6, 12).date(),
            to_date=datetime(2026, 6, 12).date(),
            group_by="day",
            response_format="json",
            db=db,
            _admin=admin,
        )
        csv_response = sales_report(
            from_date=datetime(2026, 6, 12).date(),
            to_date=datetime(2026, 6, 12).date(),
            group_by="day",
            response_format="csv",
            db=db,
            _admin=admin,
        )

    assert len(rows) == 1
    assert rows[0].date == "2026-06-12"
    assert rows[0].order_count == 1
    assert rows[0].revenue_vnd == 220_000
    assert rows[0].top_items[0].name == "Hawaiian"
    assert rows[0].top_items[0].count == 2

    assert csv_response.media_type == "text/csv"
    assert "date,order_count,revenue_vnd,top_items" in csv_response.body.decode()
    assert "2026-06-12,1,220000,Hawaiian:2" in csv_response.body.decode()


def test_reports_reject_reversed_date_window() -> None:
    client = admin_client("reports-window")

    sales = client.get("/api/admin/reports/sales?from=2026-06-12&to=2026-06-10")
    overview = client.get("/api/admin/reports/overview?from=2026-06-12&to=2026-06-10")

    assert sales.status_code == 400
    assert "VALIDATION_FAILED" in sales.text
    assert overview.status_code == 400
    assert "VALIDATION_FAILED" in overview.text


def test_sales_export_declares_csv_in_contract() -> None:
    app = build_test_app("reports-contract")

    content = app.openapi()["paths"]["/api/admin/reports/sales"]["get"]["responses"]["200"][
        "content"
    ]

    assert "application/json" in content
    assert "text/csv" in content
