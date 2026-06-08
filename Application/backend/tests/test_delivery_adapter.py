"""infra-005 — MockDeliveryAdapter unit tests.

The adapter is the backend's implementation of DeliveryPort that talks to the
standalone delivery-mock HTTP service. Tested against an injected
httpx.MockTransport so no real service is needed.
"""

from __future__ import annotations

import httpx
import pytest

from app.infra.delivery.mock import DeliveryError, MockDeliveryAdapter
from app.infra.delivery.port import OrderForDispatch

ORDER = OrderForDispatch(
    order_code="PIZZ-ABC123",
    recipient_name="Lan",
    recipient_phone="0901234567",
    address="12 Hang Bong, Hoan Kiem",
    cod_amount_vnd=345_000,
    pickup_address="PizzaHUST kitchen",
)


def _adapter(handler) -> MockDeliveryAdapter:
    return MockDeliveryAdapter(
        base_url="http://delivery-mock:9000",
        timeout=5.0,
        transport=httpx.MockTransport(handler),
    )


def test_request_posts_order_and_returns_reference() -> None:
    seen: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        import json

        seen["method"] = request.method
        seen["path"] = request.url.path
        seen["payload"] = json.loads(request.content)
        return httpx.Response(200, json={"reference": "mock-xyz"})

    ref = _adapter(handler).request(ORDER)

    assert ref.reference == "mock-xyz"
    assert seen["method"] == "POST"
    assert seen["path"] == "/deliveries"
    assert seen["payload"] == {
        "order_code": "PIZZ-ABC123",
        "recipient_name": "Lan",
        "recipient_phone": "0901234567",
        "address": "12 Hang Bong, Hoan Kiem",
        "cod_amount_vnd": 345_000,
        "pickup_address": "PizzaHUST kitchen",
    }


def test_request_raises_delivery_error_on_5xx() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, text="provider down")

    with pytest.raises(DeliveryError):
        _adapter(handler).request(ORDER)


def test_request_raises_delivery_error_on_transport_failure() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused")

    with pytest.raises(DeliveryError):
        _adapter(handler).request(ORDER)


def test_request_raises_delivery_error_on_missing_reference_field() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"unexpected": "shape"})

    with pytest.raises(DeliveryError):
        _adapter(handler).request(ORDER)


def test_request_raises_delivery_error_on_non_json_body() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="not json")

    with pytest.raises(DeliveryError):
        _adapter(handler).request(ORDER)


def test_status_raises_delivery_error_on_missing_state_field() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"order_code": "PIZZ-ABC123"})

    with pytest.raises(DeliveryError):
        _adapter(handler).status("mock-xyz")


def test_status_returns_state_for_reference() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "GET"
        assert request.url.path == "/deliveries/mock-xyz"
        return httpx.Response(200, json={"order_code": "PIZZ-ABC123", "state": "Delivering"})

    status = _adapter(handler).status("mock-xyz")

    assert status.reference == "mock-xyz"
    assert status.state == "Delivering"
