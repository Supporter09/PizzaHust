"""infra-005 — T2 delivery webhook handler.

Locks the existing handler's behavior: HMAC verification (fail closed), payload
validation, idempotency, status mapping, and terminal-state protection.
"""

from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.infra.db.models import Order, OrderStatus, OrderTracking
from app.infra.db.session import create_session_factory
from tests.auth_test_utils import build_test_app

SECRET = "test-webhook-secret"


def _sign(body: bytes) -> str:
    return hmac.new(SECRET.encode(), body, hashlib.sha256).hexdigest()


def _post_event(client: TestClient, payload: dict, *, signature: str | None = None):
    body = json.dumps(payload, separators=(",", ":")).encode()
    sig = signature if signature is not None else _sign(body)
    return client.post(
        "/api/webhooks/delivery",
        content=body,
        headers={"Content-Type": "application/json", "X-Signature": sig},
    )


def _new_order(reference: str | None, status: OrderStatus) -> int:
    with create_session_factory()() as db:
        order = Order(
            # Contract format: PIZZ- + 6 Crockford base32 chars (no I/L/O/U). Each
            # test builds its own fresh DB, so one row needs no unique suffix.
            order_code="PIZZ-TEST01",
            recipient_name="Webhook",
            recipient_phone="0901234567",
            delivery_address="1 Test St",
            total_amount_vnd=100_000,
            promised_at=datetime(2026, 1, 1, 12, 0, 0),
            current_status=status,
            delivery_reference=reference,
        )
        db.add(order)
        db.commit()
        db.refresh(order)
        return order.order_id


def _order_status(order_id: int) -> OrderStatus:
    with create_session_factory()() as db:
        return db.get(Order, order_id).current_status  # type: ignore[union-attr]


def _tracking_count(order_id: int) -> int:
    with create_session_factory()() as db:
        return len(
            db.scalars(select(OrderTracking).where(OrderTracking.order_id == order_id)).all()
        )


def test_valid_event_advances_order_and_records_tracking(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DELIVERY_WEBHOOK_SECRET", SECRET)
    app = build_test_app("wh-ok")
    order_id = _new_order("mock-ok1", OrderStatus.DELIVERING)
    client = TestClient(app)

    resp = _post_event(client, {"reference": "mock-ok1", "state": "Delivered"})

    assert resp.status_code == 204
    assert _order_status(order_id) == OrderStatus.DELIVERED
    assert _tracking_count(order_id) == 1


def test_bad_signature_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DELIVERY_WEBHOOK_SECRET", SECRET)
    app = build_test_app("wh-badsig")
    _new_order("mock-x", OrderStatus.DELIVERING)
    client = TestClient(app)

    resp = _post_event(client, {"reference": "mock-x", "state": "Delivered"}, signature="deadbeef")

    assert resp.status_code == 401


def test_empty_webhook_secret_rejected_at_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    from pydantic import ValidationError

    from app.infra.config import get_settings

    monkeypatch.setenv("DELIVERY_WEBHOOK_SECRET", "")
    get_settings.cache_clear()
    with pytest.raises(ValidationError):
        get_settings()


def test_malformed_payload_is_400(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DELIVERY_WEBHOOK_SECRET", SECRET)
    app = build_test_app("wh-malformed")
    client = TestClient(app)

    body = b"{not valid json"
    resp = client.post(
        "/api/webhooks/delivery",
        content=body,
        headers={"X-Signature": _sign(body)},
    )

    assert resp.status_code == 400


def test_duplicate_event_is_idempotent(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DELIVERY_WEBHOOK_SECRET", SECRET)
    app = build_test_app("wh-dup")
    order_id = _new_order("mock-dup", OrderStatus.DELIVERING)
    client = TestClient(app)
    payload = {"reference": "mock-dup", "state": "Delivered", "event_id": "evt-1"}

    first = _post_event(client, payload)
    second = _post_event(client, payload)

    assert first.status_code == 204
    assert second.status_code == 204
    assert _tracking_count(order_id) == 1


def test_unknown_reference_is_noop(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DELIVERY_WEBHOOK_SECRET", SECRET)
    app = build_test_app("wh-unknown")
    order_id = _new_order("mock-known", OrderStatus.DELIVERING)
    client = TestClient(app)

    resp = _post_event(client, {"reference": "mock-MISSING", "state": "Delivered"})

    assert resp.status_code == 204
    assert _order_status(order_id) == OrderStatus.DELIVERING
    assert _tracking_count(order_id) == 0


def test_terminal_order_not_modified(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DELIVERY_WEBHOOK_SECRET", SECRET)
    app = build_test_app("wh-terminal")
    order_id = _new_order("mock-term", OrderStatus.CANCELLED)
    client = TestClient(app)

    resp = _post_event(client, {"reference": "mock-term", "state": "Delivered"})

    assert resp.status_code == 204
    assert _order_status(order_id) == OrderStatus.CANCELLED
    assert _tracking_count(order_id) == 0


def test_webhook_illegal_transition_is_noop(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DELIVERY_WEBHOOK_SECRET", SECRET)
    app = build_test_app("wh-illegal")
    order_id = _new_order("mock-illegal", OrderStatus.READY_FOR_DISPATCH)
    client = TestClient(app)

    resp = _post_event(client, {"reference": "mock-illegal", "state": "Failed"})

    assert resp.status_code == 204
    assert _order_status(order_id) == OrderStatus.READY_FOR_DISPATCH
    assert _tracking_count(order_id) == 0


def test_delivery_failed_releases_reserved_points(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.infra.auth import hash_password
    from app.infra.db.models import User, UserRole

    monkeypatch.setenv("DELIVERY_WEBHOOK_SECRET", SECRET)
    app = build_test_app("wh-release")
    with create_session_factory()() as db:
        user = User(
            full_name="R",
            phone_number="0901230000",
            password_hash=hash_password("x12345678"),
            role=UserRole.CUSTOMER,
            current_points=30,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        uid = user.user_id
        order = Order(
            order_code="PIZZ-REL001",
            user_id=uid,
            recipient_name="R",
            recipient_phone="0901230000",
            delivery_address="1 St",
            total_amount_vnd=100_000,
            promised_at=datetime(2026, 1, 1, 12, 0, 0),
            current_status=OrderStatus.DELIVERING,
            delivery_reference="mock-fail",
            loyalty_points_redeemed=20,
        )
        db.add(order)
        db.commit()

    client = TestClient(app)
    resp = _post_event(client, {"reference": "mock-fail", "state": "Failed"})

    assert resp.status_code == 204
    with create_session_factory()() as db:
        assert db.get(User, uid).current_points == 50  # 30 + 20 released
        o = db.scalar(select(Order).where(Order.delivery_reference == "mock-fail"))
        assert o.current_status == OrderStatus.DELIVERY_FAILED
        assert o.loyalty_points_redeemed == 0


def test_duplicate_failed_webhook_does_not_double_release_points(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.infra.auth import hash_password
    from app.infra.db.models import User, UserRole

    monkeypatch.setenv("DELIVERY_WEBHOOK_SECRET", SECRET)
    app = build_test_app("wh-fail-dup")
    with create_session_factory()() as db:
        user = User(
            full_name="R",
            phone_number="0901230001",
            password_hash=hash_password("x12345678"),
            role=UserRole.CUSTOMER,
            current_points=30,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        uid = user.user_id
        order = Order(
            order_code="PIZZ-REL002",
            user_id=uid,
            recipient_name="R",
            recipient_phone="0901230001",
            delivery_address="1 St",
            total_amount_vnd=100_000,
            promised_at=datetime(2026, 1, 1, 12, 0, 0),
            current_status=OrderStatus.DELIVERING,
            delivery_reference="mock-fail-dup",
            loyalty_points_redeemed=20,
        )
        db.add(order)
        db.commit()

    client = TestClient(app)
    payload = {
        "reference": "mock-fail-dup",
        "state": "Failed",
        "event_id": "evt-fail-dup-1",
    }
    first = _post_event(client, payload)
    second = _post_event(
        client,
        {
            "reference": "mock-fail-dup",
            "state": "Failed",
            "event_id": "evt-fail-dup-2",
        },
    )

    assert first.status_code == 204
    assert second.status_code == 204
    with create_session_factory()() as db:
        assert db.get(User, uid).current_points == 50
        o = db.scalar(select(Order).where(Order.delivery_reference == "mock-fail-dup"))
        assert o.current_status == OrderStatus.DELIVERY_FAILED
        assert o.loyalty_points_redeemed == 0
