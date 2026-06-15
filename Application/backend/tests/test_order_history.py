"""U11 — customer order history (list + detail)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from starlette.testclient import TestClient

from app.infra.auth.passwords import hash_password
from app.infra.db.models import (
    Combo,
    Order,
    OrderItem,
    OrderItemOption,
    OrderStatus,
    OrderTracking,
    Product,
    TrackingNoteSource,
    User,
    UserRole,
)
from app.infra.db.session import create_session_factory
from tests.auth_test_utils import build_test_app


def _make_customer(phone: str = "0988111222", password: str = "strongpass123") -> int:
    with create_session_factory()() as db:
        u = User(
            full_name="Hana Pham",
            phone_number=phone,
            password_hash=hash_password(password),
            role=UserRole.CUSTOMER,
        )
        db.add(u)
        db.commit()
        db.refresh(u)
        return u.user_id


def _login(app, phone: str = "0988111222", password: str = "strongpass123") -> TestClient:
    client = TestClient(app)
    resp = client.post("/api/auth/login", json={"phone_number": phone, "password": password})
    assert resp.status_code == 200, resp.text
    return client


def _seed_order(user_id: int | None, code: str, status: OrderStatus = OrderStatus.DELIVERED) -> int:
    with create_session_factory()() as db:
        order = Order(
            order_code=code,
            user_id=user_id,
            recipient_name="Hana Pham",
            recipient_phone="0901111111",
            delivery_address="1 Dai Co Viet, Hai Ba Trung",
            delivery_ward="Bach Khoa",
            total_amount_vnd=215_000,
            delivery_fee_vnd=20_000,
            promised_at=datetime(2026, 1, 1, 12, 0, 0),
            current_status=status,
        )
        db.add(order)
        db.flush()
        product = db.scalar(select(Product).where(Product.is_active.is_(True)))
        assert product is not None, "seed must provide at least one active product"
        item = OrderItem(
            order_id=order.order_id,
            product_id=product.product_id,
            quantity=1,
            unit_price_vnd=195_000,
            notes=None,
        )
        db.add(item)
        db.flush()
        db.add(
            OrderItemOption(
                order_item_id=item.order_item_id,
                group_name="Size",
                option_name="Large",
                price_delta_vnd=40_000,
            )
        )
        db.commit()
        return order.order_id


def _seed_combo_order(user_id: int, code: str) -> int:
    with create_session_factory()() as db:
        combo = Combo(name="Family Feast", combo_price_vnd=200_000)
        db.add(combo)
        db.flush()
        order = Order(
            order_code=code,
            user_id=user_id,
            recipient_name="Hana Pham",
            recipient_phone="0901111111",
            delivery_address="1 Dai Co Viet, Hai Ba Trung",
            delivery_ward="Bach Khoa",
            total_amount_vnd=247_000,
            delivery_fee_vnd=22_000,
            promised_at=datetime(2026, 1, 1, 12, 0, 0),
            current_status=OrderStatus.DELIVERED,
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
        product = db.scalar(select(Product).where(Product.is_active.is_(True)))
        assert product is not None
        db.add(
            OrderItem(
                order_id=order.order_id,
                product_id=product.product_id,
                parent_order_item_id=parent.order_item_id,
                quantity=1,
                unit_price_vnd=50_000,
            )
        )
        db.add(
            OrderItem(
                order_id=order.order_id,
                product_id=product.product_id,
                parent_order_item_id=parent.order_item_id,
                quantity=1,
                unit_price_vnd=25_000,
            )
        )
        db.commit()
        return order.order_id


def test_list_returns_only_callers_orders_newest_first() -> None:
    app = build_test_app("u11-list")
    from app.seeds.run import main as run_seeds

    run_seeds()
    uid = _make_customer()
    other = _make_customer("0988333444")
    _seed_order(uid, "PIZZ-MINE001")
    _seed_order(uid, "PIZZ-MINE002")
    _seed_order(other, "PIZZ-OTHER01")
    _seed_order(None, "PIZZ-GUEST01")

    client = _login(app)
    resp = client.get("/api/orders/me")

    assert resp.status_code == 200, resp.text
    rows = resp.json()
    codes = [r["order_code"] for r in rows]
    assert codes == ["PIZZ-MINE002", "PIZZ-MINE001"]
    assert rows[0]["total_vnd"] == 215_000
    assert rows[0]["status"] == "Delivered"
    assert rows[0]["item_summary"]
    assert "(Large)" in rows[0]["item_summary"][0]


def test_list_requires_login() -> None:
    app = build_test_app("u11-list-anon")
    resp = TestClient(app).get("/api/orders/me")
    assert resp.status_code == 401


def test_list_paginates() -> None:
    app = build_test_app("u11-list-page")
    from app.seeds.run import main as run_seeds

    run_seeds()
    uid = _make_customer()
    for i in range(3):
        _seed_order(uid, f"PIZZ-PAGE{i:03d}")

    client = _login(app)
    page1 = client.get("/api/orders/me?page=1&page_size=2").json()
    page2 = client.get("/api/orders/me?page=2&page_size=2").json()
    assert len(page1) == 2
    assert len(page2) == 1


def test_count_my_orders() -> None:
    app = build_test_app("u11-count")
    from app.seeds.run import main as run_seeds

    run_seeds()
    uid = _make_customer()
    other = _make_customer("0988333444")
    _seed_order(uid, "PIZZ-MINE001")
    _seed_order(uid, "PIZZ-MINE002")
    _seed_order(other, "PIZZ-OTHER01")

    client = _login(app)
    resp = client.get("/api/orders/me/count")
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"count": 2}


def test_count_requires_login() -> None:
    app = build_test_app("u11-count-anon")
    resp = TestClient(app).get("/api/orders/me/count")
    assert resp.status_code == 401


def test_detail_owner_only_and_full_breakdown() -> None:
    app = build_test_app("u11-detail")
    from app.seeds.run import main as run_seeds

    run_seeds()
    uid = _make_customer()
    other = _make_customer("0988333444")
    mine_id = _seed_order(uid, "PIZZ-MINE001")
    _seed_order(other, "PIZZ-OTHER01")
    with create_session_factory()() as db:
        db.add(
            OrderTracking(
                order_id=mine_id,
                status=OrderStatus.DELIVERED,
                note_source=TrackingNoteSource.SYSTEM,
            )
        )
        db.commit()

    client = _login(app)
    ok = client.get("/api/orders/me/PIZZ-MINE001")
    assert ok.status_code == 200, ok.text
    body = ok.json()
    assert body["order_code"] == "PIZZ-MINE001"
    assert body["total_vnd"] == 215_000
    assert body["delivery_fee_vnd"] == 20_000
    assert body["subtotal_vnd"] == 195_000
    assert body["savings_vnd"] == 0
    assert body["recipient_name"] == "Hana Pham"
    assert body["delivery_address"] == "1 Dai Co Viet, Hai Ba Trung"
    assert "recipient_phone" not in body
    assert "delivery_ward" not in body
    assert len(body["lines"]) == 1
    line = body["lines"][0]
    assert line["kind"] == "item"
    assert line["quantity"] == 1
    assert line["line_total_vnd"] == 195_000
    assert line["options"] == ["Size: Large"]
    assert line["children"] == []
    assert body["timeline"]

    assert client.get("/api/orders/me/PIZZ-OTHER01").status_code == 404
    assert client.get("/api/orders/me/PIZZ-NOTREAL").status_code == 404


def test_detail_combo_children_and_positive_savings() -> None:
    app = build_test_app("u11-detail-combo")
    from app.seeds.run import main as run_seeds

    run_seeds()
    uid = _make_customer()
    _seed_combo_order(uid, "PIZZ-COMBO01")

    client = _login(app)
    body = client.get("/api/orders/me/PIZZ-COMBO01").json()

    assert body["subtotal_vnd"] == 275_000
    assert body["delivery_fee_vnd"] == 22_000
    assert body["total_vnd"] == 247_000
    assert body["savings_vnd"] == 50_000
    assert len(body["lines"]) == 1
    combo_line = body["lines"][0]
    assert combo_line["kind"] == "combo"
    assert combo_line["line_total_vnd"] == 275_000
    assert len(combo_line["children"]) == 2
    child_totals = sorted(c["line_total_vnd"] for c in combo_line["children"])
    assert child_totals == [25_000, 50_000]
