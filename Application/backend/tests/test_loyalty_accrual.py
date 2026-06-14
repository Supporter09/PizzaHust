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

# 2 x (125_000 base + 30_000 size) = 310_000 subtotal, no combo/loyalty discount.
# Default accrual rate (unseeded settings fall back to LOYALTY_ACCRUAL_RATE = 10_000).
EXPECTED_POINTS = 310_000 // 10_000  # 31


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
        json={"full_name": "Loyal Customer", "phone_number": phone, "password": password},
    )
    client.post("/api/auth/login", json={"phone_number": phone, "password": password})
    return client


def _add_line(client: TestClient, pid: int, m: int) -> None:
    csrf = client.get("/api/cart").json()["csrf_token"]
    client.post(
        "/api/cart/lines",
        json={"kind": "item", "item_id": pid, "option_ids": [m], "quantity": 2},
        headers={"X-CSRF-Token": csrf},
    )


def _place(client: TestClient):
    csrf = client.get("/api/cart").json()["csrf_token"]
    return client.post(
        "/api/orders",
        json={**RECIPIENT, "address": ADDRESS, "redeem_points": 0},
        headers={"X-CSRF-Token": csrf},
    )


def _user(phone="0912345678") -> User:
    with create_session_factory()() as db:
        user = db.scalar(select(User).where(User.phone_number == phone))
        assert user is not None
        return user


def test_logged_in_placement_accrues_points() -> None:
    app = build_test_app("accrual-earn")
    pid, m = _catalog(app)
    client = _register_login(app)
    _add_line(client, pid, m)

    r = _place(client)
    assert r.status_code == 201, r.text

    user = _user()
    assert user.current_points == EXPECTED_POINTS
    assert user.total_points_earned == EXPECTED_POINTS

    with create_session_factory()() as db:
        order = db.scalar(select(Order).where(Order.user_id == user.user_id))
        assert order is not None
        assert order.loyalty_points_earned == EXPECTED_POINTS


def test_guest_placement_accrues_nothing() -> None:
    app = build_test_app("accrual-guest")
    pid, m = _catalog(app)
    client = TestClient(app)  # never logs in -> session.user_id is None
    _add_line(client, pid, m)

    r = _place(client)
    assert r.status_code == 201, r.text

    with create_session_factory()() as db:
        order = db.scalar(select(Order))
        assert order is not None
        assert order.user_id is None
        assert order.loyalty_points_earned == 0


def test_cancel_reverses_accrued_points() -> None:
    app = build_test_app("accrual-cancel")
    pid, m = _catalog(app)
    client = _register_login(app)
    _add_line(client, pid, m)
    assert _place(client).status_code == 201

    user = _user()
    assert user.current_points == EXPECTED_POINTS
    order_id = _order_id(user.user_id)

    admin = admin_client_on(app)
    resp = admin.post(f"/api/admin/orders/{order_id}/cancel", json={"reason": "test"})
    assert resp.status_code == 204, resp.text

    reversed_user = _user()
    assert reversed_user.current_points == 0
    assert reversed_user.total_points_earned == 0

    with create_session_factory()() as db:
        order = db.scalar(select(Order).where(Order.order_id == order_id))
        assert order is not None
        assert order.loyalty_points_earned == 0  # zeroed so a re-reversal is a no-op


def test_cancel_one_of_two_orders_reverses_only_that_orders_points() -> None:
    app = build_test_app("accrual-multi")
    pid, m = _catalog(app)
    client = _register_login(app)

    _add_line(client, pid, m)
    assert _place(client).status_code == 201
    _add_line(client, pid, m)
    assert _place(client).status_code == 201

    user = _user()
    assert user.current_points == 2 * EXPECTED_POINTS
    assert user.total_points_earned == 2 * EXPECTED_POINTS

    with create_session_factory()() as db:
        first_order_id = db.scalars(
            select(Order.order_id).where(Order.user_id == user.user_id).order_by(Order.order_id)
        ).first()

    admin = admin_client_on(app)
    resp = admin.post(f"/api/admin/orders/{first_order_id}/cancel", json={"reason": "x"})
    assert resp.status_code == 204, resp.text

    # Only the cancelled order's points are clawed back; the other order's stay.
    after = _user()
    assert after.current_points == EXPECTED_POINTS
    assert after.total_points_earned == EXPECTED_POINTS


def _order_id(user_id: int) -> int:
    with create_session_factory()() as db:
        order = db.scalar(select(Order).where(Order.user_id == user_id))
        assert order is not None
        return order.order_id


def admin_client_on(app) -> TestClient:
    """An admin TestClient bound to an already-built app (admin row + override)."""
    from types import SimpleNamespace

    from app.infra.auth import get_current_user, hash_password
    from app.infra.db.models import UserRole

    with create_session_factory()() as db:
        admin = User(
            full_name="Admin",
            phone_number="0900000001",
            password_hash=hash_password("adminpass123"),
            role=UserRole.ADMIN,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
        admin_id = admin.user_id
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(
        user_id=admin_id, role=UserRole.ADMIN
    )
    return TestClient(app)
