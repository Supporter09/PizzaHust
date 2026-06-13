from __future__ import annotations

from datetime import UTC, datetime

import pytest
from sqlalchemy import select

from app.infra.db.models import Order, OrderItem, ProductOption
from app.infra.db.session import create_session_factory
from tests.admin_test_utils import (
    admin_client,
    enable_option,
    new_category,
    new_combo_with_items,
    new_option,
    new_option_group,
)


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


def test_hard_delete_removes_reference_free_item():
    client = admin_client("items-hard-delete")
    cat = new_category("Pizza")
    pid = _create_pizza(client, cat).json()["product_id"]
    # enable one option so we can prove product_options is cleaned up
    gid = new_option_group("Size", select_type="single", required=True)
    oid = new_option(gid, "M")
    enable_option(pid, oid)

    r = client.delete(f"/api/admin/items/{pid}?hard=true")
    assert r.status_code == 204, r.text
    assert client.get(f"/api/admin/items/{pid}").status_code == 404
    with create_session_factory()() as db:
        assert db.scalars(select(ProductOption).where(ProductOption.product_id == pid)).all() == []


def test_hard_delete_blocked_by_order_history():
    client = admin_client("items-hard-order")
    cat = new_category("Pizza")
    pid = _create_pizza(client, cat).json()["product_id"]
    with create_session_factory()() as db:
        order = Order(
            order_code="PIZZ-AA1AA1",
            recipient_name="R",
            recipient_phone="0900000000",
            delivery_address="addr",
            total_amount_vnd=1,
            promised_at=datetime(2026, 1, 1, tzinfo=UTC),
        )
        db.add(order)
        db.flush()
        db.add(OrderItem(order_id=order.order_id, product_id=pid, quantity=1, unit_price_vnd=1))
        db.commit()

    r = client.delete(f"/api/admin/items/{pid}?hard=true")
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "CONFLICT"
    assert client.get(f"/api/admin/items/{pid}").status_code == 200  # still present


def test_hard_delete_blocked_by_combo():
    client = admin_client("items-hard-combo")
    cat = new_category("Pizza")
    pid = _create_pizza(client, cat).json()["product_id"]
    new_combo_with_items("Combo Y", [pid])
    r = client.delete(f"/api/admin/items/{pid}?hard=true")
    assert r.status_code == 409
    assert r.json()["error"]["details"]["combos"]


@pytest.mark.skip(
    reason="Task 3 reworks preset seeding to read from the category's own option groups; "
    "PUT /categories/{id}/preset is removed in Task 1"
)
def test_create_seeds_options_from_category_preset():
    client = admin_client("items-preset-seed")
    cat = new_category("Pizza")
    g_size = new_option_group("Size", select_type="single", required=True)
    s = new_option(g_size, "S")
    m = new_option(g_size, "M")
    client.put(f"/api/admin/categories/{cat}/preset", json={"group_ids": [g_size]})

    pid = _create_pizza(client, cat).json()["product_id"]
    groups = client.get(f"/api/admin/items/{pid}/options").json()
    enabled = {o["option_id"] for g in groups for o in g["options"] if o["enabled"]}
    assert enabled == {s, m}


@pytest.mark.skip(
    reason="Task 3 seeding rework: a category's own groups ARE its preset, so dish creation "
    "always seeds from the category's groups — 'no preset / nothing enabled' no longer exists"
)
def test_create_without_preset_enables_nothing():
    client = admin_client("items-no-preset")
    cat = new_category("Pizza")
    g_size = new_option_group("Size", category_id=cat, select_type="single", required=True)
    new_option(g_size, "S")
    pid = _create_pizza(client, cat).json()["product_id"]
    groups = client.get(f"/api/admin/items/{pid}/options").json()
    assert any(g["options"] for g in groups)  # options exist; we're asserting none are enabled
    assert all(not o["enabled"] for g in groups for o in g["options"])
