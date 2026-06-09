from __future__ import annotations

from fastapi.testclient import TestClient

from tests.admin_test_utils import (
    new_category,
    new_crust,
    new_product,
    new_size,
    new_topping,
)
from tests.auth_test_utils import build_test_app


def test_detail_pizza_embeds_ordered_options():
    app = build_test_app("menu-detail-pizza")
    cid = new_category("Pizza")
    pid = new_product(cid, "Margherita", base_price_vnd=125_000, is_pizza=True)
    # Insert sizes out of price order; endpoint must order by price_modifier_vnd.
    new_size("L", modifier=60_000)
    new_size("S", modifier=0)
    new_size("M", modifier=30_000)
    new_crust("thin")  # crust order = crust_id (creation order)
    new_crust("cheese-stuffed")
    new_topping("Cheese", price_vnd=15_000)  # topping order = name
    new_topping("Beef", price_vnd=20_000)

    body = TestClient(app).get(f"/api/items/{pid}").json()

    assert body["product_id"] == pid
    assert body["is_pizza"] is True
    assert body["base_price_vnd"] == 125_000 and isinstance(body["base_price_vnd"], int)
    assert [s["name"] for s in body["sizes"]] == ["S", "M", "L"]
    assert set(body["sizes"][0]) == {"size_id", "name", "price_modifier_vnd"}
    assert body["sizes"][2]["price_modifier_vnd"] == 60_000
    assert [c["name"] for c in body["crusts"]] == ["thin", "cheese-stuffed"]
    assert set(body["crusts"][0]) == {"crust_id", "name"}
    assert [t["name"] for t in body["toppings"]] == ["Beef", "Cheese"]
    assert set(body["toppings"][0]) == {"topping_id", "name", "price_vnd"}


def test_detail_non_pizza_has_empty_options():
    app = build_test_app("menu-detail-side")
    cid = new_category("Sides")
    pid = new_product(cid, "Garlic Bread", base_price_vnd=45_000, is_pizza=False)
    new_size("M", modifier=30_000)  # exists globally but must NOT appear for a non-pizza
    body = TestClient(app).get(f"/api/items/{pid}").json()
    assert body["is_pizza"] is False
    assert body["sizes"] == [] and body["crusts"] == [] and body["toppings"] == []


def test_detail_unknown_id_404():
    app = build_test_app("menu-detail-unknown")
    r = TestClient(app).get("/api/items/999999")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"


def test_detail_inactive_id_404():
    app = build_test_app("menu-detail-inactive")
    cid = new_category("Pizza")
    pid = new_product(cid, "Hidden", is_active=False)
    assert TestClient(app).get(f"/api/items/{pid}").status_code == 404


def test_detail_bad_id_400():
    app = build_test_app("menu-detail-bad")
    r = TestClient(app).get("/api/items/abc")
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_detail_public_no_auth():
    app = build_test_app("menu-detail-public")
    cid = new_category("Pizza")
    pid = new_product(cid, "Margherita")
    assert TestClient(app).get(f"/api/items/{pid}").status_code == 200
