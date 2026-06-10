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


def test_detail_returns_enabled_option_groups():
    app = build_test_app("menu-detail-groups")
    cid = new_category("Pizza")
    pid = new_product(cid, "Margherita", base_price_vnd=125_000, is_pizza=True)
    g_size = new_option_group("Size", select_type="single", required=True, sort_order=1)
    s = new_option(g_size, "S", price_delta_vnd=0, sort_order=1)
    m = new_option(g_size, "M", price_delta_vnd=30_000, sort_order=2)
    g_top = new_option_group("Toppings", select_type="multi", required=False, sort_order=2)
    cheese = new_option(g_top, "Extra Cheese", price_delta_vnd=15_000)
    g_empty = new_option_group("Sauces", select_type="multi", required=False, sort_order=3)
    new_option(g_empty, "BBQ", price_delta_vnd=5_000)
    for oid in (s, m, cheese):
        enable_option(pid, oid)

    r = TestClient(app).get(f"/api/items/{pid}")
    assert r.status_code == 200, r.text
    groups = r.json()["option_groups"]
    assert [g["name"] for g in groups] == ["Size", "Toppings"]
    assert groups[0]["select_type"] == "single" and groups[0]["required"] is True
    assert [o["name"] for o in groups[0]["options"]] == ["S", "M"]
    assert groups[0]["options"][1]["price_delta_vnd"] == 30_000
    assert "sizes" not in r.json()


def test_detail_dish_without_options_returns_empty_list():
    app = build_test_app("menu-detail-plain")
    cid = new_category("Sides")
    pid = new_product(cid, "Garlic Bread", base_price_vnd=45_000, is_pizza=False)
    r = TestClient(app).get(f"/api/items/{pid}")
    assert r.status_code == 200
    assert r.json()["option_groups"] == []


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
