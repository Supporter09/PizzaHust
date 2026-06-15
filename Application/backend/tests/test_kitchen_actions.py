"""K2/K3 — kitchen order action endpoints (accept, mark-ready)."""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.infra.db.models import Order, OrderStatus, OrderTracking, TrackingNoteSource, UserRole
from app.infra.db.session import create_session_factory
from app.infra.delivery import get_delivery_port
from app.infra.delivery.mock import DeliveryError
from app.infra.delivery.port import DeliveryReference, OrderForDispatch
from tests.admin_test_utils import admin_client
from tests.kitchen_test_utils import anon_client, kitchen_client, logged_in_client, make_order


def _get_order(order_id: int) -> Order:
    with create_session_factory()() as db:
        return db.get(Order, order_id)  # type: ignore[return-value]


def _tracking(order_id: int) -> list[OrderTracking]:
    with create_session_factory()() as db:
        return list(
            db.scalars(
                select(OrderTracking)
                .where(OrderTracking.order_id == order_id)
                .order_by(OrderTracking.tracking_id)
            ).all()
        )


# ---- K2: accept ----------------------------------------------------------


def test_accept_advances_received_to_preparing() -> None:
    client = kitchen_client("k2-accept-ok")
    order_id = make_order(status=OrderStatus.RECEIVED)

    resp = client.post(f"/api/kitchen/orders/{order_id}/accept")

    assert resp.status_code == 204, resp.text
    assert _get_order(order_id).current_status == OrderStatus.PREPARING
    rows = _tracking(order_id)
    assert len(rows) == 1
    assert rows[0].status == OrderStatus.PREPARING
    assert rows[0].note_source == TrackingNoteSource.KITCHEN
    assert rows[0].updated_by is not None  # kitchen.user_id wired, not None


def test_accept_rejects_wrong_status_409() -> None:
    client = kitchen_client("k2-accept-wrong")
    order_id = make_order(status=OrderStatus.PREPARING)

    resp = client.post(f"/api/kitchen/orders/{order_id}/accept")

    assert resp.status_code == 409
    assert _get_order(order_id).current_status == OrderStatus.PREPARING
    assert _tracking(order_id) == []


def test_accept_missing_order_404() -> None:
    client = kitchen_client("k2-accept-404")
    resp = client.post("/api/kitchen/orders/999999/accept")
    assert resp.status_code == 404


def test_add_note_attaches_kitchen_tracking_row() -> None:
    client = kitchen_client("k2-note-ok")
    order_id = make_order(status=OrderStatus.PREPARING)

    resp = client.post(f"/api/kitchen/orders/{order_id}/notes", json={"note": "Need extra sauce"})

    assert resp.status_code == 204, resp.text
    rows = _tracking(order_id)
    assert len(rows) == 1
    assert rows[0].status == OrderStatus.PREPARING
    assert rows[0].note_source == TrackingNoteSource.KITCHEN
    assert rows[0].note == "Need extra sauce"


def test_accept_requires_kitchen_role_401() -> None:
    client = anon_client("k2-accept-anon")
    order_id = make_order(status=OrderStatus.RECEIVED)
    resp = client.post(f"/api/kitchen/orders/{order_id}/accept")
    assert resp.status_code == 401


class _FakePort:
    def __init__(self, reference: str = "mock-K3REF") -> None:
        self.reference = reference
        self.seen: OrderForDispatch | None = None

    def request(self, order: OrderForDispatch) -> DeliveryReference:
        self.seen = order
        return DeliveryReference(reference=self.reference)

    def status(self, reference: str):  # pragma: no cover - unused here
        raise NotImplementedError


class _FailingPort:
    def request(self, order: OrderForDispatch) -> DeliveryReference:
        raise DeliveryError("provider unreachable")

    def status(self, reference: str):  # pragma: no cover - unused here
        raise NotImplementedError


# ---- K3: mark-ready ------------------------------------------------------


def test_mark_ready_dispatches_and_advances_to_ready() -> None:
    client = kitchen_client("k3-ready-ok")
    order_id = make_order(status=OrderStatus.PREPARING)
    fake = _FakePort("mock-HANDOFF")
    client.app.dependency_overrides[get_delivery_port] = lambda: fake

    resp = client.post(f"/api/kitchen/orders/{order_id}/mark-ready")

    assert resp.status_code == 200, resp.text
    assert resp.json() == {"status": "ReadyForDispatch"}
    order = _get_order(order_id)
    assert order.current_status == OrderStatus.READY_FOR_DISPATCH
    assert order.delivery_reference == "mock-HANDOFF"
    assert fake.seen is not None and fake.seen.pickup_address  # config-sourced
    rows = _tracking(order_id)
    assert rows[-1].status == OrderStatus.READY_FOR_DISPATCH
    assert rows[-1].note_source == TrackingNoteSource.TRANSPORT


def test_mark_ready_provider_failure_hands_off_to_admin() -> None:
    client = kitchen_client("k3-ready-fail")
    order_id = make_order(status=OrderStatus.PREPARING)
    client.app.dependency_overrides[get_delivery_port] = lambda: _FailingPort()

    resp = client.post(f"/api/kitchen/orders/{order_id}/mark-ready")

    # Failure is handed to admin (DispatchPending), NOT rolled back — so 200, not 502.
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"status": "DispatchPending"}
    order = _get_order(order_id)  # fresh session — proves the change committed
    assert order.current_status == OrderStatus.DISPATCH_PENDING
    assert order.delivery_reference is None
    rows = _tracking(order_id)
    assert rows[-1].status == OrderStatus.DISPATCH_PENDING


def test_mark_ready_rejects_wrong_status_409() -> None:
    client = kitchen_client("k3-ready-wrong")
    order_id = make_order(status=OrderStatus.RECEIVED)
    client.app.dependency_overrides[get_delivery_port] = lambda: _FakePort()

    resp = client.post(f"/api/kitchen/orders/{order_id}/mark-ready")

    assert resp.status_code == 409
    assert _get_order(order_id).current_status == OrderStatus.RECEIVED


def test_mark_ready_missing_order_404() -> None:
    client = kitchen_client("k3-ready-404")
    client.app.dependency_overrides[get_delivery_port] = lambda: _FakePort()
    resp = client.post("/api/kitchen/orders/999999/mark-ready")
    assert resp.status_code == 404


# ---- K4: confirm pickup --------------------------------------------------


def test_pickup_advances_ready_to_delivering() -> None:
    client = kitchen_client("k4-pickup-ok")
    order_id = make_order(status=OrderStatus.READY_FOR_DISPATCH)

    resp = client.post(f"/api/kitchen/orders/{order_id}/pickup")

    assert resp.status_code == 204, resp.text
    order = _get_order(order_id)  # fresh session — proves the change committed
    assert order.current_status == OrderStatus.DELIVERING
    rows = _tracking(order_id)
    assert rows[-1].status == OrderStatus.DELIVERING
    assert rows[-1].note_source == TrackingNoteSource.KITCHEN
    assert rows[-1].note == "Pickup confirmed by kitchen"
    assert rows[-1].updated_by is not None  # kitchen.user_id wired, not None


@pytest.mark.parametrize(
    "wrong",
    [
        OrderStatus.RECEIVED,
        OrderStatus.PREPARING,
        OrderStatus.DELIVERING,
        OrderStatus.DELIVERED,
        OrderStatus.CANCELLED,
    ],
)
def test_pickup_rejects_non_ready_status_409(wrong: OrderStatus) -> None:
    client = kitchen_client(f"k4-pickup-wrong-{wrong.value}")
    order_id = make_order(status=wrong)

    resp = client.post(f"/api/kitchen/orders/{order_id}/pickup")

    assert resp.status_code == 409, resp.text
    assert _get_order(order_id).current_status == wrong
    assert _tracking(order_id) == []


def test_pickup_missing_order_404() -> None:
    client = kitchen_client("k4-pickup-404")
    resp = client.post("/api/kitchen/orders/999999/pickup")
    assert resp.status_code == 404


def test_pickup_requires_kitchen_role_401_anon() -> None:
    client = anon_client("k4-pickup-anon")
    order_id = make_order(status=OrderStatus.READY_FOR_DISPATCH)
    resp = client.post(f"/api/kitchen/orders/{order_id}/pickup")
    assert resp.status_code == 401


@pytest.mark.parametrize("role", [UserRole.CUSTOMER])
def test_pickup_rejects_non_kitchen_role_403(role: UserRole) -> None:
    client = logged_in_client(f"k4-pickup-{role.value}", role)
    order_id = make_order(status=OrderStatus.READY_FOR_DISPATCH)
    resp = client.post(f"/api/kitchen/orders/{order_id}/pickup")
    assert resp.status_code == 403


def test_pickup_allows_admin_role() -> None:
    # Admins share kitchen access for operational oversight; the tracking row is
    # attributed to the real admin user (admin_client persists one).
    client = admin_client("k4-pickup-admin")
    order_id = make_order(status=OrderStatus.READY_FOR_DISPATCH)
    resp = client.post(f"/api/kitchen/orders/{order_id}/pickup")
    assert resp.status_code == 204, resp.text
    assert _get_order(order_id).current_status == OrderStatus.DELIVERING
    assert _tracking(order_id)[-1].updated_by is not None
