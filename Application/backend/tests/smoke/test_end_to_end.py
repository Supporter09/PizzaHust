"""End-to-end smoke against the running compose stack.

Asserts the canonical happy path: place COD order → kitchen accepts → kitchen
marks ready (triggers T1) → delivery-mock fires T2 webhook → tracking endpoint
reports Delivered.

The full path is now implemented end-to-end (U6 placement, K1–K3 kitchen,
tracking endpoint, T1 dispatch, T2 webhooks), so this runs unskipped against the
live stack.
"""

from __future__ import annotations

import os
import time

import httpx


def test_place_cod_order_through_to_delivered() -> None:
    """T1 + T2 end-to-end against the live mock.

    Place a COD order -> kitchen accept + mark ready (T1 books the real mock) ->
    the mock auto-advances and posts HMAC-signed webhooks (T2) -> the public
    tracking projection reports Delivered.
    """
    api = os.environ.get("E2E_API_URL", "http://localhost:8000")
    kphone = os.environ.get("KITCHEN_SEED_PHONE", "0900000002")
    kpass = os.environ.get("KITCHEN_SEED_PASSWORD", "kitchen123")

    # 1. Customer session: place a COD order into an in-service-area ward.
    with httpx.Client(base_url=api, timeout=15.0) as cust:
        ward = cust.get("/api/config/delivery").json()["service_area"][0]
        csrf = cust.get("/api/cart").json()["csrf_token"]
        items = cust.get("/api/items").json()
        assert items, "seed should expose at least one menu item"
        # Pick an item that has no required option groups so the add-to-cart call
        # succeeds without supplying selections.
        simple = next((i for i in items if not i.get("has_price_options")), items[0])
        item_id = simple["product_id"]

        add = cust.post(
            "/api/cart/lines",
            headers={"X-CSRF-Token": csrf},
            json={"kind": "item", "item_id": item_id, "quantity": 1},
        )
        assert add.status_code == 200, add.text

        placed = cust.post(
            "/api/orders",
            headers={"X-CSRF-Token": csrf},
            json={
                "recipient_name": "Smoke Tester",
                "recipient_phone": "0911112222",
                "address": {"administrative_unit": ward, "street": "1 Smoke St"},
                "delivery_note": "ring twice",
                "redeem_points": 0,
            },
        )
        assert placed.status_code == 201, placed.text
        order_code = placed.json()["order_code"]

    # 2. Kitchen session: accept + mark ready -> fires the real T1 dispatch to the mock.
    with httpx.Client(base_url=api, timeout=15.0) as kit:
        login = kit.post("/api/auth/login", json={"phone_number": kphone, "password": kpass})
        assert login.status_code == 200, login.text
        queue = kit.get("/api/kitchen/orders").json()
        ticket = next((t for t in queue if t["order_code"] == order_code), None)
        assert ticket is not None, f"order {order_code} not found in kitchen queue"
        oid = ticket["order_id"]
        assert kit.post(f"/api/kitchen/orders/{oid}/accept").status_code == 204
        ready = kit.post(f"/api/kitchen/orders/{oid}/mark-ready")
        assert ready.status_code == 200, ready.text
        assert ready.json()["status"] in {"ReadyForDispatch", "DispatchPending"}

    # 3. Poll the public tracking projection until the mock's T2 webhooks land Delivered.
    #    Poll at the frontend's 15s cadence to stay under the public track endpoint's
    #    5/min/IP rate limit (the mock delivers in ~8s, so 1-2 polls suffice).
    deadline = time.monotonic() + 45.0
    last_status = None
    with httpx.Client(base_url=api, timeout=15.0) as pub:
        while time.monotonic() < deadline:
            track = pub.get(f"/api/orders/track/{order_code}")
            assert track.status_code == 200, track.text
            body = track.json()
            last_status = body["status"]
            if last_status == "Delivered":
                states = [e["status"] for e in body["timeline"]]
                assert "Delivering" in states, states
                assert "Delivered" in states, states
                return
            assert last_status != "DeliveryFailed", "mock delivery failed unexpectedly"
            time.sleep(15.0)
    raise AssertionError(f"order {order_code} never reached Delivered (last status: {last_status})")


def test_kitchen_queue_lists_incoming_orders() -> None:
    api = os.environ.get("E2E_API_URL", "http://localhost:8000")
    phone = os.environ.get("KITCHEN_SEED_PHONE", "0900000002")
    password = os.environ.get("KITCHEN_SEED_PASSWORD", "kitchen123")
    with httpx.Client(base_url=api, timeout=10.0) as client:
        login = client.post("/api/auth/login", json={"phone_number": phone, "password": password})
        assert login.status_code == 200, login.text
        res = client.get("/api/kitchen/orders")
        assert res.status_code == 200, res.text
        tickets = res.json()
        statuses = {t["status"] for t in tickets}
        assert statuses <= {"Received", "Preparing", "ReadyForDispatch"}
        assert tickets, "seed should leave at least one incoming order"
        scores = [t["priority_score"] for t in tickets]
        assert scores == sorted(scores, reverse=True), "tickets must be priority-desc"
