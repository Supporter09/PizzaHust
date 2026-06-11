"""U6 Place COD Order, U7 Track Order, U11 Order History, U14 redeem-at-placement."""

from __future__ import annotations

from datetime import datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.infra.auth import hash_password
from app.infra.db.models import Combo, ComboItem, Order, OrderStatus, User, UserRole
from app.infra.db.session import create_session_factory
from tests.admin_test_utils import enable_option, new_category, new_option, new_option_group, new_product
from tests.auth_test_utils import build_test_app

IN_AREA = {"administrative_unit": "Ba Đình", "street": "12 Phan Dinh Phung"}


def _pizza_app(slug: str):
    app = build_test_app(slug)
    cid = new_category("Pizza")
    pid = new_product(cid, "Margherita", base_price_vnd=125_000, is_pizza=True)
    g = new_option_group("Size", select_type="single", required=True, sort_order=1)
    s = new_option(g, "S", price_delta_vnd=0, sort_order=1)
    m = new_option(g, "M", price_delta_vnd=30_000, sort_order=2)
    enable_option(pid, s)
    enable_option(pid, m)
    return app, pid, {"s": s, "m": m}


def _item_line(pid, opts):
    return {"kind": "item", "item_id": pid, "option_ids": opts, "quantity": 1}


def _place(client: TestClient, lines, **extra):
    body = {
        "lines": lines,
        "recipient_name": "Nguyen Van A",
        "recipient_phone": "0901234567",
        "address": IN_AREA,
        **extra,
    }
    return client.post("/api/orders", json=body)


def test_place_order_in_area_charges_delivery_fee_and_starts_received():
    app, pid, o = _pizza_app("place-ok")
    client = TestClient(app)
    r = _place(client, [_item_line(pid, [o["m"]])])
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["current_status"] == "Received"
    assert body["delivery_fee_vnd"] == 22_000
    assert body["total_amount_vnd"] == 125_000 + 30_000 + 22_000
    assert body["order_code"].startswith("PIZZ-")


def test_place_order_out_of_area_422():
    app, pid, o = _pizza_app("place-area")
    client = TestClient(app)
    r = _place(
        client,
        [_item_line(pid, [o["s"]])],
        address={"administrative_unit": "Thu Duc", "street": "1 Vo Van Ngan"},
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "OUT_OF_SERVICE_AREA"


def test_place_order_invalid_phone_rejected():
    app, pid, o = _pizza_app("place-phone")
    client = TestClient(app)
    body = {
        "lines": [_item_line(pid, [o["s"]])],
        "recipient_name": "Bad Phone",
        "recipient_phone": "12345",
        "address": IN_AREA,
    }
    r = client.post("/api/orders", json=body)
    # The app remaps request-validation errors to a 400 VALIDATION_FAILED envelope.
    assert r.status_code == 400


def test_place_order_persists_items_and_option_snapshot():
    app, pid, o = _pizza_app("place-persist")
    client = TestClient(app)
    r = _place(client, [_item_line(pid, [o["m"]])])
    oid = r.json()["order_id"]
    with create_session_factory()() as db:
        order = db.get(Order, oid)
        assert len(order.items) == 1
        item = order.items[0]
        assert item.product_id == pid
        assert item.unit_price_vnd == 155_000
        assert [(op.group_name, op.option_name) for op in item.options] == [("Size", "M")]
        assert len(order.tracking) == 1
        assert order.tracking[0].status == OrderStatus.RECEIVED


def test_place_combo_order():
    app, pid, o = _pizza_app("place-combo")
    with create_session_factory()() as db:
        combo = Combo(name="Duo", combo_price_vnd=180_000)
        db.add(combo)
        db.flush()
        db.add(ComboItem(combo_id=combo.combo_id, product_id=pid, quantity=2))
        db.commit()
        combo_id = combo.combo_id
    client = TestClient(app)
    r = _place(client, [{"kind": "combo", "combo_id": combo_id, "quantity": 1}])
    assert r.status_code == 201, r.text
    assert r.json()["total_amount_vnd"] == 180_000 + 22_000


def test_track_order_returns_timeline_and_items():
    app, pid, o = _pizza_app("track-ok")
    client = TestClient(app)
    code = _place(client, [_item_line(pid, [o["s"]])]).json()["order_code"]
    r = client.get(f"/api/orders/track/{code}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["current_status"] == "Received"
    assert body["items"][0]["name"] == "Margherita"
    assert body["timeline"][0]["status"] == "Received"


def test_track_unknown_code_404():
    app, _, _ = _pizza_app("track-404")
    r = TestClient(app).get("/api/orders/track/PIZZ-NOPE12")
    assert r.status_code == 404


def _register(client: TestClient, phone: str) -> int:
    """Register and log in (registration does not start a session on its own)."""
    r = client.post(
        "/api/auth/register",
        json={"full_name": "Loyal Customer", "phone_number": phone, "password": "password123"},
    )
    assert r.status_code in (200, 201), r.text
    login = client.post("/api/auth/login", json={"phone_number": phone, "password": "password123"})
    assert login.status_code == 200, login.text
    with create_session_factory()() as db:
        user = db.scalar(select(User).where(User.phone_number == phone))
        return user.user_id


def test_my_orders_requires_auth():
    app, _, _ = _pizza_app("hist-auth")
    assert TestClient(app).get("/api/orders/me").status_code == 401


def test_my_orders_lists_only_own_orders():
    app, pid, o = _pizza_app("hist-list")
    client = TestClient(app)
    _register(client, "0909999999")
    _place(client, [_item_line(pid, [o["s"]])])
    r = client.get("/api/orders/me")
    assert r.status_code == 200, r.text
    orders = r.json()
    assert len(orders) == 1
    assert orders[0]["items"][0]["name"] == "Margherita"


def test_redeem_points_deducted_at_placement():
    app, pid, o = _pizza_app("redeem-ok")
    client = TestClient(app)
    uid = _register(client, "0908888888")
    with create_session_factory()() as db:
        user = db.get(User, uid)
        user.current_points = 100
        db.commit()
    # Subtotal 125_000 -> max redeem 50% = 62_500 VND = 62 points.
    r = _place(client, [_item_line(pid, [o["s"]])], redeem_points=40)
    assert r.status_code == 201, r.text
    assert r.json()["loyalty_redeemed"] == 40
    with create_session_factory()() as db:
        assert db.get(User, uid).current_points == 60
