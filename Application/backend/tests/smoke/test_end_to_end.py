"""End-to-end smoke against the running compose stack.

Asserts the canonical happy path: place COD order → kitchen accepts → kitchen
marks ready (triggers T1) → delivery-mock fires T2 webhook → tracking endpoint
reports Delivered.

Infra is now in place (delivery port + mock landed in infra-005). The full path
still needs the use-case endpoints that don't exist yet: order placement (U6),
kitchen accept/ready (K1–K3), and the tracking endpoint. Skipped until those land.
"""

from __future__ import annotations

import os

import httpx
import pytest


@pytest.mark.skip(reason="needs U6 order placement + kitchen (K1-K3) + tracking endpoint")
def test_place_cod_order_through_to_delivered() -> None:
    raise NotImplementedError


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
