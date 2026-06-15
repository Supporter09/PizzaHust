from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.infra.db.models import Order, User
from app.infra.db.session import create_session_factory
from tests.admin_test_utils import (
    enable_option,
    new_category,
    new_option,
    new_option_group,
    new_product,
)
from tests.auth_test_utils import build_test_app

ADDRESS = {"administrative_unit": "Ba Đình", "street": "1 Phố Huế"}
RECIPIENT = {"recipient_name": "Nguyen Van An", "recipient_phone": "0912345678"}
# 2 x (125_000 + 30_000) = 310_000 subtotal; 50% cap = 155_000 -> 155 points.


def _catalog(app):
    cid = new_category("Pizza")
    pid = new_product(cid, "Margherita", base_price_vnd=125_000)
    g = new_option_group("Size", select_type="single", required=True, sort_order=1)
    m = new_option(g, "M", price_delta_vnd=30_000, sort_order=2)
    enable_option(pid, m)
    return pid, m


def _register_login(app, phone="0912345678", password="strongpass123") -> TestClient:
    client = TestClient(app)
    client.post(
        "/api/auth/register",
        json={"full_name": "Loyal", "phone_number": phone, "password": password},
    )
    client.post("/api/auth/login", json={"phone_number": phone, "password": password})
    return client


def _set_points(n: int, phone="0912345678") -> None:
    with create_session_factory()() as db:
        user = db.scalar(select(User).where(User.phone_number == phone))
        assert user is not None
        user.current_points = n
        db.commit()


def _user(phone="0912345678") -> User:
    with create_session_factory()() as db:
        user = db.scalar(select(User).where(User.phone_number == phone))
        assert user is not None
        return user


def _order(user_id: int) -> Order:
    with create_session_factory()() as db:
        order = db.scalar(select(Order).where(Order.user_id == user_id))
        assert order is not None
        return order


def _add_line(client: TestClient, pid: int, m: int, qty: int = 2) -> None:
    csrf = client.get("/api/cart").json()["csrf_token"]
    client.post(
        "/api/cart/lines",
        json={"kind": "item", "item_id": pid, "option_ids": [m], "quantity": qty},
        headers={"X-CSRF-Token": csrf},
    )


def _checkout_quote(client: TestClient, redeem_points: int):
    csrf = client.get("/api/cart").json()["csrf_token"]
    return client.post(
        "/api/cart/checkout-quote",
        json={"address": ADDRESS, "redeem_points": redeem_points},
        headers={"X-CSRF-Token": csrf},
    )


def _place(client: TestClient, redeem_points: int):
    csrf = client.get("/api/cart").json()["csrf_token"]
    return client.post(
        "/api/orders",
        json={**RECIPIENT, "address": ADDRESS, "redeem_points": redeem_points},
        headers={"X-CSRF-Token": csrf},
    )


def test_checkout_quote_applies_real_balance():
    app = build_test_app("u14-quote")
    pid, m = _catalog(app)
    client = _register_login(app)
    _set_points(50)
    _add_line(client, pid, m)

    r = _checkout_quote(client, 20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["loyalty"]["balance"] == 50
    assert body["loyalty"]["redeemed"] == 20
    assert body["discount_loyalty_vnd"] == 20_000
    assert body["subtotal_vnd"] == 310_000
    assert body["total_vnd"] == 310_000 - 20_000 + 22_000


def test_checkout_quote_caps_at_half_subtotal():
    app = build_test_app("u14-cap")
    pid, m = _catalog(app)
    client = _register_login(app)
    _set_points(1_000)
    _add_line(client, pid, m)

    r = _checkout_quote(client, 1_000)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["loyalty"]["max_redeemable"] == 155
    assert body["loyalty"]["redeemed"] == 155
    assert body["discount_loyalty_vnd"] == 155_000


def test_checkout_quote_over_balance_422():
    app = build_test_app("u14-over")
    pid, m = _catalog(app)
    client = _register_login(app)
    _set_points(10)
    _add_line(client, pid, m)

    r = _checkout_quote(client, 50)
    assert r.status_code == 422, r.text
    assert r.json()["error"]["code"] == "INSUFFICIENT_LOYALTY"


def test_placement_reserves_points_and_nets_balance():
    app = build_test_app("u14-place")
    pid, m = _catalog(app)
    client = _register_login(app)
    _set_points(50)
    _add_line(client, pid, m)

    r = _place(client, 20)
    assert r.status_code == 201, r.text

    # accrual base = 310_000 - 0 combo - 20_000 loyalty = 290_000 -> 29 earned
    user = _user()
    assert user.current_points == 50 - 20 + 29  # 59
    assert user.total_points_earned == 29

    order = _order(user.user_id)
    assert order.loyalty_points_redeemed == 20
    assert order.loyalty_points_earned == 29


def test_placement_over_balance_422_creates_no_order():
    app = build_test_app("u14-place-over")
    pid, m = _catalog(app)
    client = _register_login(app)
    _set_points(5)
    _add_line(client, pid, m)

    r = _place(client, 50)
    assert r.status_code == 422, r.text
    assert r.json()["error"]["code"] == "INSUFFICIENT_LOYALTY"
    assert _user().current_points == 5  # unchanged
    with create_session_factory()() as db:
        assert db.scalar(select(Order)) is None


def test_cancel_releases_reserved_points():
    from tests.test_loyalty_accrual import admin_client_on

    app = build_test_app("u14-cancel")
    pid, m = _catalog(app)
    client = _register_login(app)
    _set_points(50)
    _add_line(client, pid, m)
    assert _place(client, 20).status_code == 201

    user = _user()
    assert user.current_points == 59  # 50 - 20 + 29
    order_id = _order(user.user_id).order_id

    admin = admin_client_on(app)
    resp = admin.post(f"/api/admin/orders/{order_id}/cancel", json={"reason": "test"})
    assert resp.status_code == 204, resp.text

    after = _user()
    assert after.current_points == 50  # 59 + 20 released - 29 earned reversed
    assert after.total_points_earned == 0
    with create_session_factory()() as db:
        order = db.get(Order, order_id)
        assert order.loyalty_points_redeemed == 0
        assert order.loyalty_points_earned == 0
