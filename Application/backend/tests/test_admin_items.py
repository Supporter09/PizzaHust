from __future__ import annotations

from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

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
from tests.auth_test_utils import build_test_app


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


def test_create_seeds_options_from_category_preset():
    """A category's own groups ARE its preset: a dish created in a category that
    owns a group seeds every option in that group as enabled."""
    client = admin_client("items-preset-seed")
    cat = new_category("Pizza")
    # Group + 2 options live on `cat` (via the real admin endpoints).
    g_size = new_option_group("Size", category_id=cat, select_type="single", required=True)
    s = new_option(g_size, "S")
    m = new_option(g_size, "M")

    pid = _create_pizza(client, cat).json()["product_id"]
    groups = client.get(f"/api/admin/items/{pid}/options").json()
    enabled = {o["option_id"] for g in groups for o in g["options"] if o["enabled"]}
    assert enabled == {s, m}


def test_create_without_preset_enables_nothing():
    """A dish created in a category that owns NO option groups has nothing
    enabled (its options view is empty)."""
    client = admin_client("items-no-preset")
    cat = new_category("Pizza")  # category owns no option groups
    pid = _create_pizza(client, cat).json()["product_id"]

    groups = client.get(f"/api/admin/items/{pid}/options").json()
    assert groups == []  # no groups in the category -> nothing to enable
    with create_session_factory()() as db:
        assert db.scalars(select(ProductOption).where(ProductOption.product_id == pid)).all() == []


def test_patch_category_change_reseeds_options_from_new_category():
    """Moving a dish to a different category must replace its ProductOption rows
    with the new category's preset. Both the admin GET /options view and the
    customer GET /api/items/{id} path must agree after the change."""
    app = build_test_app("items-recat")
    client = admin_client("items-recat")

    # --- Pizza category: Size group with S + M, Crust group with Thin ---
    pizza_cat = new_category("Pizza-recat")
    g_size = new_option_group("Size", category_id=pizza_cat, select_type="single", required=True)
    size_s = new_option(g_size, "S")
    size_m = new_option(g_size, "M")
    g_crust = new_option_group("Crust", category_id=pizza_cat, select_type="single", required=True)
    crust_thin = new_option(g_crust, "Thin")

    # --- Drinks category: Volume group with Small ---
    drinks_cat = new_category("Drinks-recat")
    g_vol = new_option_group("Volume", category_id=drinks_cat, select_type="single", required=True)
    vol_small = new_option(g_vol, "Small")

    # Create dish in Pizza via the create endpoint so _apply_category_preset runs.
    pid = client.post(
        "/api/admin/items",
        json={
            "category_id": pizza_cat,
            "name": "Margherita Recat",
            "base_price_vnd": 120_000,
            "kind": "pizza",
        },
    ).json()["product_id"]

    # Confirm Pizza preset is seeded correctly before the move.
    admin_groups_before = client.get(f"/api/admin/items/{pid}/options").json()
    enabled_before = {
        o["option_id"] for g in admin_groups_before for o in g["options"] if o["enabled"]
    }
    assert enabled_before == {size_s, size_m, crust_thin}

    # PATCH: move dish to Drinks.
    r = client.patch(f"/api/admin/items/{pid}", json={"category_id": drinks_cat})
    assert r.status_code == 200, r.text
    assert r.json()["category_id"] == drinks_cat

    # Admin view: only Drinks' options remain; none of Pizza's options survive.
    admin_groups_after = client.get(f"/api/admin/items/{pid}/options").json()
    group_names_after = [g["name"] for g in admin_groups_after]
    assert "Size" not in group_names_after
    assert "Crust" not in group_names_after
    assert "Volume" in group_names_after
    enabled_after = {
        o["option_id"] for g in admin_groups_after for o in g["options"] if o["enabled"]
    }
    assert enabled_after == {vol_small}

    # Customer path must agree: no Pizza options, only Drinks' Volume option.
    pub = TestClient(app).get(f"/api/items/{pid}")
    assert pub.status_code == 200, pub.text
    customer_option_ids = {
        o["option_id"] for g in pub.json()["option_groups"] for o in g["options"]
    }
    assert size_s not in customer_option_ids
    assert size_m not in customer_option_ids
    assert crust_thin not in customer_option_ids
    assert vol_small in customer_option_ids

    # Raw DB: no Pizza option rows remain.
    with create_session_factory()() as db:
        all_opts = db.scalars(select(ProductOption).where(ProductOption.product_id == pid)).all()
        all_opt_ids = {po.option_id for po in all_opts}
        assert size_s not in all_opt_ids
        assert size_m not in all_opt_ids
        assert crust_thin not in all_opt_ids
        assert vol_small in all_opt_ids


def test_patch_same_category_leaves_options_intact():
    """A PATCH that does NOT change category_id (either omits it or sends the
    current value) must NOT touch the dish's ProductOption rows."""
    client = admin_client("items-recat-noop")

    pizza_cat = new_category("Pizza-noop")
    g_size = new_option_group("Size", category_id=pizza_cat, select_type="single", required=True)
    size_s = new_option(g_size, "S")
    size_m = new_option(g_size, "M")

    pid = client.post(
        "/api/admin/items",
        json={
            "category_id": pizza_cat,
            "name": "Margherita Noop",
            "base_price_vnd": 120_000,
            "kind": "pizza",
        },
    ).json()["product_id"]

    # Manually enable only S (deviate from preset) to prove no reseed happens.
    with create_session_factory()() as db:
        db.execute(delete(ProductOption).where(ProductOption.product_id == pid))
        db.add(ProductOption(product_id=pid, option_id=size_s))
        db.commit()

    # PATCH omitting category_id — options must stay as-is.
    r = client.patch(f"/api/admin/items/{pid}", json={"base_price_vnd": 99_000})
    assert r.status_code == 200

    with create_session_factory()() as db:
        opt_ids = {
            po.option_id
            for po in db.scalars(select(ProductOption).where(ProductOption.product_id == pid)).all()
        }
    assert size_s in opt_ids
    assert size_m not in opt_ids  # M was never enabled; no reseed should add it back

    # PATCH sending the SAME category_id — options must still stay as-is.
    r = client.patch(f"/api/admin/items/{pid}", json={"category_id": pizza_cat})
    assert r.status_code == 200

    with create_session_factory()() as db:
        opt_ids = {
            po.option_id
            for po in db.scalars(select(ProductOption).where(ProductOption.product_id == pid)).all()
        }
    assert size_s in opt_ids
    assert size_m not in opt_ids  # still unchanged
