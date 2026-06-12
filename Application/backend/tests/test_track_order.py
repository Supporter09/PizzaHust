from __future__ import annotations

from fastapi.testclient import TestClient

from tests.admin_test_utils import new_category, new_product
from tests.auth_test_utils import build_test_app

ADDRESS = {"administrative_unit": "Ba Đình", "street": "15 Trần Hưng Đạo"}


def _order_fixture(slug: str):
    app = build_test_app(slug)
    cid = new_category("Pizza")
    pid = new_product(cid, "Margherita", base_price_vnd=125_000, is_pizza=True)
    client = TestClient(app)
    csrf = client.get("/api/cart").json()["csrf_token"]
    client.post(
        "/api/cart/lines",
        json={"kind": "item", "item_id": pid, "option_ids": [], "quantity": 1},
        headers={"X-CSRF-Token": csrf},
    )
    r = client.post(
        "/api/orders",
        json={
            "recipient_name": "Nguyen Thi Lan",
            "recipient_phone": "0911112222",
            "address": ADDRESS,
            "delivery_note": "Ring doorbell twice",
        },
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 201, r.text
    return app, r.json()["order_code"]


def test_track_projection_masks_pii():
    app, code = _order_fixture("track-mask")
    fresh = TestClient(app)
    r = fresh.get(f"/api/orders/track/{code}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "Received"
    assert body["timeline"][0]["status"] == "Received"
    assert body["recipient_first_name"] == "Lan"
    assert body["phone_last4"] == "2222"
    assert "Trần Hưng Đạo" not in body["address_masked"]
    assert "Ba Đình" in body["address_masked"]
    assert body["delivery_note"] == "Ring doorbell twice"
    assert body["promised_at"]
    assert "recipient_phone" not in body


def test_unknown_code_404_and_case_insensitive_lookup():
    app, code = _order_fixture("track-404")
    fresh = TestClient(app)
    assert fresh.get("/api/orders/track/PIZZ-000000").status_code == 404
    assert fresh.get(f"/api/orders/track/{code.lower()}").status_code == 200


def test_rate_limited_after_five():
    app, code = _order_fixture("track-rl")
    fresh = TestClient(app)
    for _ in range(5):
        assert fresh.get(f"/api/orders/track/{code}").status_code == 200
    r = fresh.get(f"/api/orders/track/{code}")
    assert r.status_code == 429
    assert r.json()["error"]["code"] == "RATE_LIMITED"
