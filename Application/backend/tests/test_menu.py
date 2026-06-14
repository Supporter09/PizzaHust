from __future__ import annotations

from fastapi.testclient import TestClient

from tests.admin_test_utils import (
    enable_option,
    new_category,
    new_option,
    new_option_group,
    new_product,
)
from tests.auth_test_utils import build_test_app


def test_items_only_active():
    app = build_test_app("menu-active")
    cid = new_category("Pizza")
    new_product(cid, "Margherita", base_price_vnd=120_000)
    new_product(cid, "Hidden Pie", is_active=False)
    client = TestClient(app)
    names = [i["name"] for i in client.get("/api/items").json()]
    assert "Margherita" in names
    assert "Hidden Pie" not in names


def test_items_filter_by_category():
    app = build_test_app("menu-filter")
    pizza = new_category("Pizza")
    drinks = new_category("Drinks")
    new_product(pizza, "Margherita")
    new_product(drinks, "Cola")
    client = TestClient(app)
    names = [i["name"] for i in client.get(f"/api/items?category={drinks}").json()]
    assert names == ["Cola"]


def test_items_unknown_category_returns_empty():
    app = build_test_app("menu-unknown")
    client = TestClient(app)
    r = client.get("/api/items?category=99999")
    assert r.status_code == 200
    assert r.json() == []


def test_items_bad_category_is_400():
    app = build_test_app("menu-bad")
    client = TestClient(app)
    r = client.get("/api/items?category=abc")
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_item_shape_and_vnd_integer():
    app = build_test_app("menu-shape")
    cid = new_category("Pizza")
    new_product(cid, "Margherita", base_price_vnd=120_000)
    client = TestClient(app)
    item = client.get("/api/items").json()[0]
    assert set(item) == {
        "product_id",
        "category_id",
        "name",
        "base_price_vnd",
        "has_price_options",
        "image_url",
    }
    assert item["base_price_vnd"] == 120_000 and isinstance(item["base_price_vnd"], int)
    assert item["image_url"] is None
    # No enabled options → base price is the only price, so no "from" floor.
    assert item["has_price_options"] is False


def test_has_price_options_true_when_enabled_option_moves_price():
    """has_price_options is derived: True only when an enabled option carries a
    non-zero price delta (so base_price renders as a 'from' floor)."""
    app = build_test_app("menu-haspriceopts")
    cid = new_category("Pizza")
    pid = new_product(cid, "Margherita", base_price_vnd=120_000)
    free_pid = new_product(cid, "Plain", base_price_vnd=90_000)
    group = new_option_group("Size", category_id=cid)
    paid = new_option(group, "Large", price_delta_vnd=30_000)
    free = new_option(group, "Regular", price_delta_vnd=0)
    enable_option(pid, paid)
    enable_option(free_pid, free)
    client = TestClient(app)
    by_name = {i["name"]: i for i in client.get("/api/items").json()}
    assert by_name["Margherita"]["has_price_options"] is True
    # An enabled but zero-delta option must NOT flip the flag.
    assert by_name["Plain"]["has_price_options"] is False


def test_categories_active_ordered_by_sort():
    from app.infra.db.models import Category
    from app.infra.db.session import create_session_factory

    app = build_test_app("menu-cats")
    with create_session_factory()() as db:
        db.add_all(
            [
                # Drinks + Salads share sort_order 3 → exercises the `name` tiebreaker.
                Category(name="Salads", sort_order=3, is_active=True),
                Category(name="Drinks", sort_order=3, is_active=True),
                Category(name="Pizza", sort_order=1, is_active=True),
                Category(name="Off", sort_order=2, is_active=False),
            ]
        )
        db.commit()
    client = TestClient(app)
    cats = client.get("/api/categories").json()
    names = [c["name"] for c in cats]
    # sort_order primary, name secondary: Pizza(1), then Drinks/Salads(3) alphabetically.
    assert names == ["Pizza", "Drinks", "Salads"]
    assert all({"category_id", "name", "sort_order"} == set(c) for c in cats)


def test_items_ordered_by_name():
    app = build_test_app("menu-item-order")
    cid = new_category("Pizza")
    # Insert out of alphabetical order; the endpoint must return them sorted by name.
    new_product(cid, "Pepperoni")
    new_product(cid, "Margherita")
    new_product(cid, "Hawaiian")
    client = TestClient(app)
    names = [i["name"] for i in client.get("/api/items").json()]
    assert names == ["Hawaiian", "Margherita", "Pepperoni"]


def test_menu_is_public_no_auth():
    app = build_test_app("menu-public")
    client = TestClient(app)
    assert client.get("/api/categories").status_code == 200
    assert client.get("/api/items").status_code == 200
