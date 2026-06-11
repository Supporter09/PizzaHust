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


def _pizza_fixture(slug: str):
    app = build_test_app(slug)
    cid = new_category("Pizza")
    pid = new_product(cid, "Margherita", base_price_vnd=125_000, is_pizza=True)
    g_size = new_option_group("Size", select_type="single", required=True, sort_order=1)
    s = new_option(g_size, "S", price_delta_vnd=0, sort_order=1)
    m = new_option(g_size, "M", price_delta_vnd=30_000, sort_order=2)
    g_top = new_option_group("Toppings", select_type="multi", required=False, sort_order=2)
    cheese = new_option(g_top, "Extra Cheese", price_delta_vnd=15_000)
    beef = new_option(g_top, "Beef", price_delta_vnd=20_000)
    for oid in (s, m, cheese, beef):
        enable_option(pid, oid)
    return app, pid, {"s": s, "m": m, "cheese": cheese, "beef": beef}


def _quote(app, lines, **extra):
    return TestClient(app).post("/api/cart/quote", json={"lines": lines, **extra})


def test_quote_item_sums_option_deltas_and_quantity():
    app, pid, o = _pizza_fixture("cart-deltas")
    r = _quote(
        app,
        [
            {
                "kind": "item",
                "item_id": pid,
                "option_ids": [o["m"], o["cheese"], o["beef"]],
                "quantity": 2,
            }
        ],
    )
    assert r.status_code == 200, r.text
    assert r.json()["subtotal_vnd"] == 2 * (125_000 + 30_000 + 15_000 + 20_000)


def test_quote_duplicate_option_ids_do_not_double_charge():
    app, pid, o = _pizza_fixture("cart-dedupe")
    r = _quote(
        app,
        [
            {
                "kind": "item",
                "item_id": pid,
                "option_ids": [o["m"], o["cheese"], o["cheese"]],
                "quantity": 1,
            }
        ],
    )
    assert r.status_code == 200, r.text
    assert r.json()["subtotal_vnd"] == 125_000 + 30_000 + 15_000


def test_quote_dish_without_options_uses_base_price():
    app = build_test_app("cart-plain")
    cid = new_category("Sides")
    pid = new_product(cid, "Garlic Bread", base_price_vnd=45_000, is_pizza=False)
    r = _quote(app, [{"kind": "item", "item_id": pid, "quantity": 3}])
    assert r.status_code == 200, r.text
    assert r.json()["subtotal_vnd"] == 135_000


def test_quote_non_pizza_with_enabled_options():
    app = build_test_app("cart-side-opts")
    cid = new_category("Sides")
    pid = new_product(cid, "Wings", base_price_vnd=80_000, is_pizza=False)
    g = new_option_group("Sauce", select_type="single", required=False)
    bbq = new_option(g, "BBQ", price_delta_vnd=5_000)
    enable_option(pid, bbq)
    r = _quote(app, [{"kind": "item", "item_id": pid, "option_ids": [bbq], "quantity": 1}])
    assert r.status_code == 200, r.text
    assert r.json()["subtotal_vnd"] == 85_000


def test_quote_option_not_enabled_for_dish_rejected():
    app, pid, o = _pizza_fixture("cart-noten")
    g = new_option_group("Sauces", select_type="multi", required=False)
    stray = new_option(g, "BBQ", price_delta_vnd=5_000)
    r = _quote(
        app, [{"kind": "item", "item_id": pid, "option_ids": [o["s"], stray], "quantity": 1}]
    )
    assert r.status_code == 400
    body = r.json()["error"]
    assert body["code"] == "VALIDATION_FAILED"
    assert body["details"]["reason"] == "option_not_available"
    assert body["details"]["option_id"] == stray


def test_quote_required_group_missing_rejected():
    app, pid, o = _pizza_fixture("cart-reqmiss")
    r = _quote(app, [{"kind": "item", "item_id": pid, "option_ids": [o["cheese"]], "quantity": 1}])
    assert r.status_code == 400
    body = r.json()["error"]
    assert body["details"]["reason"] == "required_group_missing"
    assert body["details"]["group_name"] == "Size"


def test_quote_two_picks_in_single_group_rejected():
    app, pid, o = _pizza_fixture("cart-conflict")
    r = _quote(
        app, [{"kind": "item", "item_id": pid, "option_ids": [o["s"], o["m"]], "quantity": 1}]
    )
    assert r.status_code == 400
    assert r.json()["error"]["details"]["reason"] == "single_group_conflict"


def test_quote_in_area_address_adds_delivery_fee():
    app, pid, o = _pizza_fixture("cart-addr-ok")
    r = _quote(
        app,
        [{"kind": "item", "item_id": pid, "option_ids": [o["s"]], "quantity": 1}],
        address={"administrative_unit": "Ba Đình"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["delivery_fee_vnd"] == 22_000
    assert r.json()["total_vnd"] == 125_000 + 22_000


def test_quote_out_of_area_address_422():
    app, pid, o = _pizza_fixture("cart-addr-bad")
    r = _quote(
        app,
        [{"kind": "item", "item_id": pid, "option_ids": [o["s"]], "quantity": 1}],
        address={"administrative_unit": "Thu Duc"},
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "OUT_OF_SERVICE_AREA"


def test_quote_unknown_product_400():
    app = build_test_app("cart-unknown")
    r = _quote(app, [{"kind": "item", "item_id": 999999, "quantity": 1}])
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_quote_inactive_product_400():
    app = build_test_app("cart-inactive")
    cid = new_category("Pizza")
    pid = new_product(cid, "Hidden", is_pizza=True, is_active=False)
    r = _quote(app, [{"kind": "item", "item_id": pid, "quantity": 1}])
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_quote_redeem_points_without_balance_422():
    app, pid, o = _pizza_fixture("cart-redeem-none")
    r = _quote(
        app,
        [{"kind": "item", "item_id": pid, "option_ids": [o["s"]], "quantity": 1}],
        redeem_points=5,
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "INSUFFICIENT_LOYALTY"
