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


def _pizza_fixture(slug: str):
    app = build_test_app(slug)
    cid = new_category("Pizza")
    pid = new_product(cid, "Margherita", base_price_vnd=125_000, is_pizza=True)
    new_size("S", modifier=0)
    new_size("M", modifier=30_000)
    new_size("L", modifier=60_000)
    new_crust("thin")
    tid_cheese = new_topping("Cheese", price_vnd=15_000)
    tid_beef = new_topping("Beef", price_vnd=20_000)
    return app, pid, tid_cheese, tid_beef


def test_quote_pizza_line_sums_size_toppings_quantity():
    app, pid, tid_cheese, tid_beef = _pizza_fixture("cart-pizza")
    body = {
        "lines": [
            {
                "kind": "pizza",
                "item_id": pid,
                "size": "M",
                "crust": "thin",
                "topping_ids": [tid_cheese, tid_beef],
                "quantity": 2,
            }
        ]
    }
    r = TestClient(app).post("/api/cart/quote", json=body)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["subtotal_vnd"] == 380_000
    assert data["delivery_fee_vnd"] == 0
    assert data["total_vnd"] == 380_000
    assert data["loyalty"] == {"balance": 0, "redeemed": 0, "max_redeemable": 190}


def test_quote_side_line_uses_base_price():
    app = build_test_app("cart-side")
    cid = new_category("Sides")
    pid = new_product(cid, "Garlic Bread", base_price_vnd=45_000, is_pizza=False)
    r = TestClient(app).post(
        "/api/cart/quote",
        json={"lines": [{"kind": "side", "item_id": pid, "quantity": 3}]},
    )
    assert r.status_code == 200, r.text
    assert r.json()["subtotal_vnd"] == 135_000


def test_quote_in_area_address_adds_delivery_fee():
    app, pid, *_ = _pizza_fixture("cart-addr-ok")
    r = TestClient(app).post(
        "/api/cart/quote",
        json={
            "lines": [{"kind": "pizza", "item_id": pid, "size": "S", "quantity": 1}],
            "address": {"administrative_unit": "Ba Đình"},
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["delivery_fee_vnd"] == 22_000
    assert data["total_vnd"] == 125_000 + 22_000


def test_quote_out_of_area_address_422():
    app, pid, *_ = _pizza_fixture("cart-addr-bad")
    r = TestClient(app).post(
        "/api/cart/quote",
        json={
            "lines": [{"kind": "pizza", "item_id": pid, "size": "S", "quantity": 1}],
            "address": {"administrative_unit": "Thu Duc"},
        },
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "OUT_OF_SERVICE_AREA"


def test_quote_unknown_product_400():
    app = build_test_app("cart-unknown")
    r = TestClient(app).post(
        "/api/cart/quote",
        json={"lines": [{"kind": "pizza", "item_id": 999999, "quantity": 1}]},
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_quote_inactive_product_400():
    app = build_test_app("cart-inactive")
    cid = new_category("Pizza")
    pid = new_product(cid, "Hidden", is_pizza=True, is_active=False)
    r = TestClient(app).post(
        "/api/cart/quote",
        json={"lines": [{"kind": "pizza", "item_id": pid, "quantity": 1}]},
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_quote_combo_kind_rejected_400():
    app = build_test_app("cart-combo")
    r = TestClient(app).post(
        "/api/cart/quote",
        json={"lines": [{"kind": "combo", "combo_id": 1, "quantity": 1}]},
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_quote_unknown_size_name_400():
    app, pid, *_ = _pizza_fixture("cart-badsize")
    r = TestClient(app).post(
        "/api/cart/quote",
        json={"lines": [{"kind": "pizza", "item_id": pid, "size": "XXL", "quantity": 1}]},
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_quote_unknown_crust_name_400():
    app, pid, *_ = _pizza_fixture("cart-badcrust")
    r = TestClient(app).post(
        "/api/cart/quote",
        json={"lines": [{"kind": "pizza", "item_id": pid, "crust": "lava", "quantity": 1}]},
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_quote_unknown_topping_id_400():
    app, pid, *_ = _pizza_fixture("cart-badtop")
    r = TestClient(app).post(
        "/api/cart/quote",
        json={"lines": [{"kind": "pizza", "item_id": pid, "topping_ids": [999999], "quantity": 1}]},
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_quote_side_with_pizza_options_400():
    app = build_test_app("cart-side-opts")
    cid = new_category("Sides")
    pid = new_product(cid, "Garlic Bread", base_price_vnd=45_000, is_pizza=False)
    r = TestClient(app).post(
        "/api/cart/quote",
        json={"lines": [{"kind": "side", "item_id": pid, "size": "M", "quantity": 1}]},
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_quote_pizza_kind_on_side_product_400():
    app = build_test_app("cart-kind-mismatch")
    cid = new_category("Sides")
    pid = new_product(cid, "Garlic Bread", base_price_vnd=45_000, is_pizza=False)
    r = TestClient(app).post(
        "/api/cart/quote",
        json={"lines": [{"kind": "pizza", "item_id": pid, "quantity": 1}]},
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_quote_redeem_points_without_balance_422():
    app, pid, *_ = _pizza_fixture("cart-redeem-none")
    r = TestClient(app).post(
        "/api/cart/quote",
        json={
            "lines": [{"kind": "pizza", "item_id": pid, "size": "S", "quantity": 1}],
            "redeem_points": 5,
        },
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "INSUFFICIENT_LOYALTY"


def test_quote_side_with_crust_400():
    app = build_test_app("cart-side-crust")
    cid = new_category("Sides")
    pid = new_product(cid, "Garlic Bread", base_price_vnd=45_000, is_pizza=False)
    r = TestClient(app).post(
        "/api/cart/quote",
        json={"lines": [{"kind": "side", "item_id": pid, "crust": "thin", "quantity": 1}]},
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_quote_side_with_toppings_400():
    app = build_test_app("cart-side-tops")
    cid = new_category("Sides")
    pid = new_product(cid, "Garlic Bread", base_price_vnd=45_000, is_pizza=False)
    r = TestClient(app).post(
        "/api/cart/quote",
        json={"lines": [{"kind": "side", "item_id": pid, "topping_ids": [1], "quantity": 1}]},
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"
