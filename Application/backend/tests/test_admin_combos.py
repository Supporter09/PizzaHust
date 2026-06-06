from __future__ import annotations

from datetime import UTC, datetime, timedelta

from tests.admin_test_utils import admin_client, new_category, new_product


def _two_pizzas(price: int = 100_000):
    cat = new_category("Pizza")
    return new_product(cat, "Pz1", base_price_vnd=price), new_product(
        cat, "Pz2", base_price_vnd=price
    )


def _items(*product_ids):
    return [{"product_id": pid, "quantity": 1} for pid in product_ids]


def _post(client, **overrides):
    body = {"name": "Combo", "combo_price_vnd": 150_000}
    body.update(overrides)
    return client.post("/api/admin/combos", json=body)


def test_create_active_when_no_window():
    client = admin_client("combo-active")
    p1, p2 = _two_pizzas()
    r = _post(client, items=_items(p1, p2))
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "Active"


def test_create_scheduled_when_start_in_future():
    client = admin_client("combo-sched")
    p1, p2 = _two_pizzas()
    start = (datetime.now(UTC) + timedelta(days=5)).isoformat()
    end = (datetime.now(UTC) + timedelta(days=10)).isoformat()
    r = _post(client, items=_items(p1, p2), validity_start=start, validity_end=end)
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "Scheduled"


def test_create_expired_when_end_in_past():
    client = admin_client("combo-expired")
    p1, p2 = _two_pizzas()
    start = (datetime.now(UTC) - timedelta(days=10)).isoformat()
    end = (datetime.now(UTC) - timedelta(days=5)).isoformat()
    r = _post(client, items=_items(p1, p2), validity_start=start, validity_end=end)
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "Expired"


def test_overpriced_combo_is_accepted():
    # A4 warn-and-override: price above the sum of parts is allowed, not rejected.
    client = admin_client("combo-overpriced")
    p1, p2 = _two_pizzas(price=100_000)  # parts sum 200_000
    r = _post(client, combo_price_vnd=500_000, items=_items(p1, p2))
    assert r.status_code == 201, r.text


def test_validity_end_before_start_rejected():
    client = admin_client("combo-badrange")
    p1, p2 = _two_pizzas()
    start = (datetime.now(UTC) + timedelta(days=10)).isoformat()
    end = (datetime.now(UTC) + timedelta(days=5)).isoformat()
    r = _post(client, items=_items(p1, p2), validity_start=start, validity_end=end)
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_validity_equal_is_accepted():
    client = admin_client("combo-eqrange")
    p1, p2 = _two_pizzas()
    when = (datetime.now(UTC) + timedelta(days=5)).isoformat()
    r = _post(client, items=_items(p1, p2), validity_start=when, validity_end=when)
    assert r.status_code == 201, r.text


def test_empty_combo_rejected():
    client = admin_client("combo-empty")
    r = _post(client, items=[])
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_single_item_combo_rejected():
    client = admin_client("combo-single")
    p1, _ = _two_pizzas()
    r = _post(client, items=_items(p1))
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_inactive_product_rejected():
    client = admin_client("combo-inactive")
    cat = new_category("Pizza")
    p1 = new_product(cat, "Active1")
    p_inactive = new_product(cat, "Gone", is_active=False)
    r = _post(client, items=_items(p1, p_inactive))
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_missing_product_rejected():
    client = admin_client("combo-missing")
    p1, _ = _two_pizzas()
    r = _post(client, items=_items(p1, 999_999))
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_patch_replaces_items():
    client = admin_client("combo-patch")
    cat = new_category("Pizza")
    p1 = new_product(cat, "A")
    p2 = new_product(cat, "B")
    p3 = new_product(cat, "C")
    combo_id = _post(client, items=_items(p1, p2)).json()["combo_id"]
    r = client.patch(f"/api/admin/combos/{combo_id}", json={"items": _items(p1, p3)})
    assert r.status_code == 200, r.text
    returned = {i["product_id"] for i in r.json()["items"]}
    assert returned == {p1, p3}


def test_patch_to_single_item_rejected():
    client = admin_client("combo-patch-single")
    p1, p2 = _two_pizzas()
    combo_id = _post(client, items=_items(p1, p2)).json()["combo_id"]
    r = client.patch(f"/api/admin/combos/{combo_id}", json={"items": _items(p1)})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_delete_returns_204():
    client = admin_client("combo-delete")
    p1, p2 = _two_pizzas()
    combo_id = _post(client, items=_items(p1, p2)).json()["combo_id"]
    assert client.delete(f"/api/admin/combos/{combo_id}").status_code == 204
    assert client.get(f"/api/admin/combos/{combo_id}").status_code == 404
