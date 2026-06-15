"""End-to-end smoke against the running compose stack.

Asserts the canonical happy path: place COD order → kitchen accepts → kitchen
marks ready (triggers T1) → delivery-mock fires T2 webhook → tracking endpoint
reports Delivered and loyalty points are credited after delivery.
"""

from __future__ import annotations

import os
import time

import httpx


def _wait_for(predicate, *, timeout: float = 20.0, step: float = 1.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return
        time.sleep(step)
    raise AssertionError("timed out waiting for condition")


def _login(client: httpx.Client, phone: str, password: str) -> str:
    resp = client.post("/api/auth/login", json={"phone_number": phone, "password": password})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    return body["csrf_token"]


def _pick_menu_item(client: httpx.Client) -> tuple[int, list[int]]:
    items = client.get("/api/items").json()
    assert items, "seed should expose at least one menu item"
    product_id = items[0]["product_id"]
    detail = client.get(f"/api/items/{product_id}").json()
    option_ids: list[int] = []
    for group in detail.get("option_groups", []):
        options = group.get("options", [])
        if group.get("required") and options:
            option_ids.append(options[0]["option_id"])
        elif options:
            option_ids.append(options[0]["option_id"])
    return product_id, option_ids


def test_place_cod_order_through_to_delivered() -> None:
    api = os.environ.get("E2E_API_URL", "http://localhost:8000")
    kitchen_phone = os.environ.get("KITCHEN_SEED_PHONE", "0900000002")
    kitchen_password = os.environ.get("KITCHEN_SEED_PASSWORD", "kitchen123")
    customer_phone = f"091{int(time.time()) % 10_000_000:07d}"
    customer_password = "testpass123"

    with httpx.Client(base_url=api, timeout=10.0) as customer:
        reg = customer.post(
            "/api/auth/register",
            json={
                "full_name": "Smoke Customer",
                "phone_number": customer_phone,
                "password": customer_password,
            },
        )
        assert reg.status_code == 201, reg.text
        customer_csrf = _login(customer, customer_phone, customer_password)

        product_id, option_ids = _pick_menu_item(customer)
        cart_state = customer.get("/api/cart")
        assert cart_state.status_code == 200, cart_state.text
        customer_csrf = cart_state.json()["csrf_token"]
        add = customer.post(
            "/api/cart/lines",
            json={
                "kind": "item",
                "item_id": product_id,
                "option_ids": option_ids,
                "quantity": 1,
            },
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert add.status_code == 200, add.text

        order = customer.post(
            "/api/orders",
            json={
                "recipient_name": "Smoke Customer",
                "recipient_phone": customer_phone,
                "address": {"administrative_unit": "Ba Dinh", "street": "1 Pho Hue"},
                "delivery_note": "Smoke test",
                "redeem_points": 0,
            },
            headers={"X-CSRF-Token": customer_csrf},
        )
        assert order.status_code == 201, order.text
        order_code = order.json()["order_code"]

    with httpx.Client(base_url=api, timeout=10.0) as kitchen:
        kitchen_csrf = _login(kitchen, kitchen_phone, kitchen_password)

        def _find_ticket() -> dict | None:
            res = kitchen.get("/api/kitchen/orders")
            assert res.status_code == 200, res.text
            for ticket in res.json():
                if ticket["order_code"] == order_code:
                    return ticket
            return None

        _wait_for(lambda: _find_ticket() is not None, timeout=15.0, step=1.0)
        ticket = _find_ticket()
        assert ticket is not None

        accept = kitchen.post(
            f"/api/kitchen/orders/{ticket['order_id']}/accept",
            headers={"X-CSRF-Token": kitchen_csrf},
        )
        assert accept.status_code == 204, accept.text

        ready = kitchen.post(
            f"/api/kitchen/orders/{ticket['order_id']}/mark-ready",
            headers={"X-CSRF-Token": kitchen_csrf},
        )
        assert ready.status_code == 200, ready.text
        assert ready.json()["status"] in {"ReadyForDispatch", "DispatchPending"}

    with httpx.Client(base_url=api, timeout=10.0) as customer:
        customer_csrf = _login(customer, customer_phone, customer_password)

        def _delivered() -> dict | None:
            res = customer.get(f"/api/orders/track/{order_code}")
            if res.status_code != 200:
                return None
            body = res.json()
            if body["status"] == "Delivered":
                return body
            return None

        _wait_for(lambda: _delivered() is not None, timeout=20.0, step=1.0)
        track = _delivered()
        assert track is not None
        assert track["status"] == "Delivered"

        loyalty = customer.get("/api/loyalty/me")
        assert loyalty.status_code == 200, loyalty.text
        body = loyalty.json()
        assert body["current_points"] > 0
        assert body["pending_points"] == 0


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
