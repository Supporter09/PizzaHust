"""K1 queue, K2 accept, K3 mark-ready + T1 dispatch, and the full ordering loop."""

from __future__ import annotations

import hashlib
import hmac
import json

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.infra.auth import hash_password
from app.infra.db.models import Order, OrderStatus, User, UserRole
from app.infra.db.session import create_session_factory
from app.infra.delivery import get_delivery_port
from app.infra.delivery.mock import DeliveryError
from app.infra.delivery.port import DeliveryReference, OrderForDispatch
from tests.admin_test_utils import enable_option, new_category, new_option, new_option_group, new_product
from tests.auth_test_utils import build_test_app

IN_AREA = {"administrative_unit": "Ba Đình", "street": "12 Phan Dinh Phung"}
WEBHOOK_SECRET = "whsecret"


class _FakePort:
    def __init__(self, reference: str = "mock-REF") -> None:
        self.reference = reference

    def request(self, order: OrderForDispatch) -> DeliveryReference:
        return DeliveryReference(reference=self.reference)

    def status(self, reference: str):  # pragma: no cover
        raise NotImplementedError


class _FailingPort:
    def request(self, order: OrderForDispatch) -> DeliveryReference:
        raise DeliveryError("provider down")

    def status(self, reference: str):  # pragma: no cover
        raise NotImplementedError


def _app_with_pizza(slug: str):
    app = build_test_app(slug)
    cid = new_category("Pizza")
    pid = new_product(cid, "Pepperoni", base_price_vnd=150_000, is_pizza=True)
    g = new_option_group("Size", select_type="single", required=True, sort_order=1)
    s = new_option(g, "S", price_delta_vnd=0, sort_order=1)
    enable_option(pid, s)
    return app, pid, s


def _kitchen_client(app) -> TestClient:
    with create_session_factory()() as db:
        db.add(
            User(
                full_name="Kitchen Staff",
                phone_number="0900000777",
                password_hash=hash_password("kitchenpass1"),
                role=UserRole.KITCHEN,
            )
        )
        db.commit()
    client = TestClient(app)
    r = client.post("/api/auth/login", json={"phone_number": "0900000777", "password": "kitchenpass1"})
    assert r.status_code == 200, r.text
    return client


def _place(client, pid, sid):
    return client.post(
        "/api/orders",
        json={
            "lines": [{"kind": "item", "item_id": pid, "option_ids": [sid], "quantity": 1}],
            "recipient_name": "Tran Thi B",
            "recipient_phone": "0907654321",
            "address": IN_AREA,
        },
    )


def test_queue_requires_kitchen_or_admin():
    app, _, _ = _app_with_pizza("kq-guard")
    assert TestClient(app).get("/api/kitchen/queue").status_code == 401


def test_queue_lists_received_orders():
    app, pid, sid = _app_with_pizza("kq-list")
    guest = TestClient(app)
    _place(guest, pid, sid)
    kitchen = _kitchen_client(app)
    r = kitchen.get("/api/kitchen/queue")
    assert r.status_code == 200, r.text
    rows = r.json()
    assert len(rows) == 1
    assert rows[0]["current_status"] == "Received"
    assert rows[0]["items"][0]["name"] == "Pepperoni"


def test_accept_moves_to_preparing():
    app, pid, sid = _app_with_pizza("kq-accept")
    oid = _place(TestClient(app), pid, sid).json()["order_id"]
    kitchen = _kitchen_client(app)
    r = kitchen.post(f"/api/kitchen/orders/{oid}/accept")
    assert r.status_code == 200, r.text
    assert r.json()["current_status"] == "Preparing"


def test_ready_dispatches_to_delivering():
    app, pid, sid = _app_with_pizza("kq-ready")
    oid = _place(TestClient(app), pid, sid).json()["order_id"]
    kitchen = _kitchen_client(app)
    app.dependency_overrides[get_delivery_port] = lambda: _FakePort("mock-HANDOFF")
    kitchen.post(f"/api/kitchen/orders/{oid}/accept")
    r = kitchen.post(f"/api/kitchen/orders/{oid}/ready")
    assert r.status_code == 200, r.text
    assert r.json()["current_status"] == "Delivering"
    with create_session_factory()() as db:
        assert db.get(Order, oid).delivery_reference == "mock-HANDOFF"
    app.dependency_overrides.clear()


def test_ready_with_failing_provider_parks_dispatch_pending():
    app, pid, sid = _app_with_pizza("kq-fail")
    oid = _place(TestClient(app), pid, sid).json()["order_id"]
    kitchen = _kitchen_client(app)
    app.dependency_overrides[get_delivery_port] = lambda: _FailingPort()
    kitchen.post(f"/api/kitchen/orders/{oid}/accept")
    r = kitchen.post(f"/api/kitchen/orders/{oid}/ready")
    assert r.status_code == 200, r.text
    assert r.json()["current_status"] == "DispatchPending"
    with create_session_factory()() as db:
        assert db.get(Order, oid).delivery_reference is None
    app.dependency_overrides.clear()


def test_accept_wrong_state_conflicts():
    app, pid, sid = _app_with_pizza("kq-conflict")
    oid = _place(TestClient(app), pid, sid).json()["order_id"]
    kitchen = _kitchen_client(app)
    kitchen.post(f"/api/kitchen/orders/{oid}/accept")
    # Second accept: already Preparing -> illegal transition.
    assert kitchen.post(f"/api/kitchen/orders/{oid}/accept").status_code == 409


def _signed(payload: dict) -> tuple[bytes, str]:
    body = json.dumps(payload).encode()
    sig = hmac.new(WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
    return body, sig


def test_full_loop_place_to_delivered_accrues_loyalty():
    app, pid, sid = _app_with_pizza("loop-full")
    customer = TestClient(app)
    customer.post(
        "/api/auth/register",
        json={"full_name": "Loop Buyer", "phone_number": "0901112222", "password": "password123"},
    )
    customer.post("/api/auth/login", json={"phone_number": "0901112222", "password": "password123"})
    placed = _place(customer, pid, sid).json()
    oid, code = placed["order_id"], placed["order_code"]

    kitchen = _kitchen_client(app)
    app.dependency_overrides[get_delivery_port] = lambda: _FakePort("mock-LOOP")
    kitchen.post(f"/api/kitchen/orders/{oid}/accept")
    kitchen.post(f"/api/kitchen/orders/{oid}/ready")
    app.dependency_overrides.clear()

    body, sig = _signed({"reference": "mock-LOOP", "state": "Delivered", "event_id": "evt-1"})
    wh = TestClient(app).post("/api/webhooks/delivery", content=body, headers={"X-Signature": sig})
    assert wh.status_code == 204, wh.text

    track = customer.get(f"/api/orders/track/{code}")
    assert track.json()["current_status"] == "Delivered"
    # total 150_000 + 22_000 fee; accrual is on (total - fee) = 150_000 -> 15 points.
    with create_session_factory()() as db:
        user = db.scalar(select(User).where(User.phone_number == "0901112222"))
        assert user.current_points == 15
        assert user.total_points_earned == 15
        assert db.get(Order, oid).current_status == OrderStatus.DELIVERED
