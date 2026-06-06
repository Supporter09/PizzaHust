from __future__ import annotations

from tests.admin_test_utils import admin_client, new_category, new_combo_with_items


def _create_pizza(client, category_id, name="Margherita", price=120_000):
    return client.post(
        "/api/admin/items",
        json={"category_id": category_id, "name": name, "base_price_vnd": price, "kind": "pizza"},
    )


def test_create_pizza_returns_201_active_pizza():
    client = admin_client("items-create")
    cat = new_category("Pizza")
    r = _create_pizza(client, cat)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["is_pizza"] is True
    assert body["is_active"] is True
    assert body["category_id"] == cat
    assert body["name"] == "Margherita"


def test_duplicate_name_conflict():
    client = admin_client("items-dup")
    cat = new_category("Pizza")
    assert _create_pizza(client, cat).status_code == 201
    r = _create_pizza(client, cat)
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "CONFLICT"


def test_unknown_category_validation_failed():
    client = admin_client("items-unknown-cat")
    r = _create_pizza(client, 9999)
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_inactive_category_validation_failed():
    client = admin_client("items-inactive-cat")
    cat = new_category("Old", is_active=False)
    r = _create_pizza(client, cat)
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_list_filters_by_kind():
    client = admin_client("items-kind")
    cat = new_category("Pizza")
    _create_pizza(client, cat, name="Margherita")
    client.post(
        "/api/admin/items",
        json={"category_id": cat, "name": "Fries", "base_price_vnd": 40_000, "kind": "side"},
    )
    pizzas = [i["name"] for i in client.get("/api/admin/items?kind=pizza").json()]
    sides = [i["name"] for i in client.get("/api/admin/items?kind=side").json()]
    assert "Margherita" in pizzas and "Fries" not in pizzas
    assert "Fries" in sides and "Margherita" not in sides


def test_patch_updates_price():
    client = admin_client("items-patch")
    cat = new_category("Pizza")
    pid = _create_pizza(client, cat).json()["product_id"]
    r = client.patch(f"/api/admin/items/{pid}", json={"base_price_vnd": 99_000})
    assert r.status_code == 200, r.text
    assert r.json()["base_price_vnd"] == 99_000


def test_patch_to_unknown_category_400():
    client = admin_client("items-patch-unknown")
    cat = new_category("Pizza")
    pid = _create_pizza(client, cat).json()["product_id"]
    r = client.patch(f"/api/admin/items/{pid}", json={"category_id": 9999})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_patch_to_inactive_category_400():
    client = admin_client("items-patch-inactive")
    cat = new_category("Pizza")
    inactive = new_category("Old", is_active=False)
    pid = _create_pizza(client, cat).json()["product_id"]
    r = client.patch(f"/api/admin/items/{pid}", json={"category_id": inactive})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_delete_soft_deactivates():
    client = admin_client("items-delete")
    cat = new_category("Pizza")
    pid = _create_pizza(client, cat).json()["product_id"]
    r = client.delete(f"/api/admin/items/{pid}")
    assert r.status_code == 204
    got = client.get(f"/api/admin/items/{pid}")
    assert got.status_code == 200
    assert got.json()["is_active"] is False


def test_delete_pizza_referenced_by_combo_conflict():
    client = admin_client("items-delete-combo")
    cat = new_category("Pizza")
    pid = _create_pizza(client, cat).json()["product_id"]
    new_combo_with_items("Combo X", [pid])
    r = client.delete(f"/api/admin/items/{pid}")
    assert r.status_code == 409
    body = r.json()
    assert body["error"]["code"] == "CONFLICT"
    assert body["error"]["details"]["combos"]  # non-empty list of combo names
