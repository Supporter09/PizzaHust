"""infra-005 — admin retry-dispatch wires the delivery port.

A DispatchPending order, on retry, is handed to the delivery provider; on success
it stores the reference and advances to Delivering, on provider failure it stays
DispatchPending (retryable) and the request 502s.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import select

from app.infra.db.models import Order, OrderStatus, OrderTracking
from app.infra.db.session import create_session_factory
from app.infra.delivery import get_delivery_port
from app.infra.delivery.mock import DeliveryError
from app.infra.delivery.port import DeliveryReference, OrderForDispatch
from tests.admin_test_utils import admin_client


class _FakePort:
    def __init__(self, reference: str = "mock-REF1") -> None:
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


def _new_order(status: OrderStatus, code: str) -> int:
    with create_session_factory()() as db:
        order = Order(
            order_code=code,
            recipient_name="Mai",
            recipient_phone="0901234567",
            delivery_address="5 Trang Tien, Hoan Kiem",
            total_amount_vnd=250_000,
            promised_at=datetime(2026, 1, 1, 12, 0, 0),
            current_status=status,
        )
        db.add(order)
        db.commit()
        db.refresh(order)
        return order.order_id


def _get_order(order_id: int) -> Order:
    with create_session_factory()() as db:
        return db.get(Order, order_id)  # type: ignore[return-value]


def _tracking_count(order_id: int) -> int:
    with create_session_factory()() as db:
        rows = db.scalars(select(OrderTracking).where(OrderTracking.order_id == order_id)).all()
        return len(rows)


def test_retry_dispatch_hands_off_and_advances_to_delivering() -> None:
    client = admin_client("dispatch-ok")
    order_id = _new_order(OrderStatus.DISPATCH_PENDING, "PIZZ-D1S5K1")
    fake = _FakePort("mock-HANDOFF")
    client.app.dependency_overrides[get_delivery_port] = lambda: fake

    resp = client.post(f"/api/admin/orders/{order_id}/retry-dispatch")

    assert resp.status_code == 204, resp.text
    order = _get_order(order_id)
    assert order.current_status == OrderStatus.DELIVERING
    assert order.delivery_reference == "mock-HANDOFF"
    assert fake.seen is not None
    assert fake.seen.order_code == "PIZZ-D1S5K1"
    assert fake.seen.cod_amount_vnd == 250_000
    assert fake.seen.pickup_address  # sourced from config, non-empty
    assert _tracking_count(order_id) == 1


def test_retry_dispatch_provider_failure_keeps_order_retryable() -> None:
    client = admin_client("dispatch-fail")
    order_id = _new_order(OrderStatus.DISPATCH_PENDING, "PIZZ-D2SFK1")
    client.app.dependency_overrides[get_delivery_port] = lambda: _FailingPort()

    resp = client.post(f"/api/admin/orders/{order_id}/retry-dispatch")

    assert resp.status_code == 502
    assert "DELIVERY_UPSTREAM_ERROR" in resp.text  # canonical closed-set code
    order = _get_order(order_id)
    assert order.current_status == OrderStatus.DISPATCH_PENDING
    assert order.delivery_reference is None
    assert _tracking_count(order_id) == 0


def test_retry_dispatch_rejects_wrong_state() -> None:
    client = admin_client("dispatch-state")
    order_id = _new_order(OrderStatus.DELIVERED, "PIZZ-D3SST1")
    client.app.dependency_overrides[get_delivery_port] = lambda: _FakePort()

    resp = client.post(f"/api/admin/orders/{order_id}/retry-dispatch")

    assert resp.status_code == 409


def test_retry_dispatch_missing_order_404() -> None:
    client = admin_client("dispatch-404")
    client.app.dependency_overrides[get_delivery_port] = lambda: _FakePort()

    resp = client.post("/api/admin/orders/999999/retry-dispatch")

    assert resp.status_code == 404


def test_cancel_order_rejects_terminal_delivery_failed() -> None:
    client = admin_client("cancel-terminal-failed")
    order_id = _new_order(OrderStatus.DELIVERY_FAILED, "PIZZ-CANFK1")

    resp = client.post(f"/api/admin/orders/{order_id}/cancel", json={"reason": "late"})

    assert resp.status_code == 409
    assert _get_order(order_id).current_status == OrderStatus.DELIVERY_FAILED


def test_cancel_order_rejects_terminal_cancelled() -> None:
    client = admin_client("cancel-terminal-cancelled")
    order_id = _new_order(OrderStatus.CANCELLED, "PIZZ-CANCA1")

    resp = client.post(f"/api/admin/orders/{order_id}/cancel", json={"reason": "duplicate"})

    assert resp.status_code == 409
    assert _get_order(order_id).current_status == OrderStatus.CANCELLED
