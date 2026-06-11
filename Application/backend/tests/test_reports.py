"""A7 Sales & Order Reports."""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import select

from app.infra.db.models import Category, Order, OrderItem, OrderStatus, Product
from app.infra.db.session import create_session_factory
from tests.admin_test_utils import admin_client
from tests.auth_test_utils import build_test_app


def _seed_orders():
    with create_session_factory()() as db:
        cat = Category(name="Pizza")
        db.add(cat)
        db.flush()
        p1 = Product(category_id=cat.category_id, name="Margherita", base_price_vnd=100_000, is_pizza=True)
        p2 = Product(category_id=cat.category_id, name="Hawaiian", base_price_vnd=120_000, is_pizza=True)
        db.add_all([p1, p2])
        db.flush()
        now = datetime.utcnow()

        def mk(code, status, when, lines):
            o = Order(
                order_code=code,
                recipient_name="R",
                recipient_phone="0900000000",
                delivery_address="addr, Ba Dinh",
                total_amount_vnd=sum(pr.base_price_vnd * q for pr, q in lines) + 22_000,
                delivery_fee_vnd=22_000,
                current_status=status,
                promised_at=when + timedelta(minutes=45),
                created_at=when,
            )
            db.add(o)
            db.flush()
            for pr, q in lines:
                db.add(OrderItem(order_id=o.order_id, product_id=pr.product_id, quantity=q, unit_price_vnd=pr.base_price_vnd))

        mk("PIZZ-DLV001", OrderStatus.DELIVERED, now - timedelta(days=1), [(p1, 2)])
        mk("PIZZ-DLV002", OrderStatus.DELIVERED, now - timedelta(days=1), [(p2, 1), (p1, 1)])
        mk("PIZZ-RCV001", OrderStatus.RECEIVED, now, [(p2, 3)])  # not realized revenue
        db.commit()


def test_sales_report_aggregates_delivered_revenue_and_top_items():
    client = admin_client("report-main")
    _seed_orders()
    r = client.get("/api/admin/reports/sales")
    assert r.status_code == 200, r.text
    body = r.json()
    # Delivered: (2*100k+22k) + (120k+100k+22k) = 222k + 242k = 464k
    assert body["total_revenue_vnd"] == 464_000
    assert body["delivered_order_count"] == 2
    assert body["total_order_count"] == 3
    names = {t["name"]: t["quantity_sold"] for t in body["top_items"]}
    assert names["Margherita"] == 3  # 2 + 1 across delivered orders
    assert names["Hawaiian"] == 1
    statuses = {s["status"]: s["count"] for s in body["orders_by_status"]}
    assert statuses["Delivered"] == 2
    assert statuses["Received"] == 1


def test_sales_report_requires_admin():
    app = build_test_app("report-guard")
    from fastapi.testclient import TestClient

    assert TestClient(app).get("/api/admin/reports/sales").status_code in (401, 403)


def test_sales_report_csv_export():
    client = admin_client("report-csv")
    _seed_orders()
    r = client.get("/api/admin/reports/sales.csv")
    assert r.status_code == 200, r.text
    assert r.headers["content-type"].startswith("text/csv")
    assert "revenue_vnd" in r.text
    assert "total_revenue_vnd" in r.text
