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


def _fixture(slug: str):
    app = build_test_app(slug)
    cid = new_category("Pizza")
    pid = new_product(cid, "Margherita", base_price_vnd=125_000)
    g = new_option_group("Size", select_type="single", required=True, sort_order=1)
    m = new_option(g, "M", price_delta_vnd=30_000, sort_order=2)
    enable_option(pid, m)
    return app, pid, m


def _client_with_csrf(app) -> tuple[TestClient, str]:
    client = TestClient(app)
    r = client.get("/api/cart")
    assert r.status_code == 200
    return client, r.json()["csrf_token"]


def _add_line(client: TestClient, csrf: str, pid: int, m: int, quantity: int = 1, note=None):
    return client.post(
        "/api/cart/lines",
        json={
            "kind": "item",
            "item_id": pid,
            "option_ids": [m],
            "quantity": quantity,
            "note": note,
        },
        headers={"X-CSRF-Token": csrf},
    )


def test_get_cart_is_empty_and_creates_no_rows():
    app, *_ = _fixture("cart-get-empty")
    client = TestClient(app)
    r = client.get("/api/cart")
    assert r.status_code == 200
    assert r.json()["lines"] == []
    assert client.get("/api/cart").json()["lines"] == []


def test_add_line_requires_csrf():
    app, pid, m = _fixture("cart-csrf")
    client = TestClient(app)
    r = client.post(
        "/api/cart/lines",
        json={"kind": "item", "item_id": pid, "option_ids": [m], "quantity": 1},
    )
    assert r.status_code == 403


def test_add_line_canonicalizes_and_prices():
    app, pid, m = _fixture("cart-add")
    client, csrf = _client_with_csrf(app)
    r = client.post(
        "/api/cart/lines",
        json={
            "kind": "item",
            "item_id": pid,
            "option_ids": [m, m],
            "quantity": 2,
            "note": "Well-done",
        },
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    line = body["lines"][0]
    assert line["payload"]["option_ids"] == [m]
    assert line["unit_price_vnd"] == 155_000
    assert line["line_total_vnd"] == 310_000
    assert line["note"] == "Well-done"
    assert line["name"] == "Margherita"
    assert body["quote"]["subtotal_vnd"] == 310_000
    assert body["quote"]["delivery_fee_vnd"] == 0


def test_patch_quantity_and_note_then_delete():
    app, pid, m = _fixture("cart-patch")
    client, csrf = _client_with_csrf(app)
    line_id = _add_line(client, csrf, pid, m).json()["lines"][0]["line_id"]
    r = client.patch(
        f"/api/cart/lines/{line_id}",
        json={"quantity": 3, "note": "Extra crispy"},
        headers={"X-CSRF-Token": csrf},
    )
    assert r.json()["lines"][0]["quantity"] == 3
    assert r.json()["lines"][0]["note"] == "Extra crispy"
    r = client.delete(f"/api/cart/lines/{line_id}", headers={"X-CSRF-Token": csrf})
    assert r.json()["lines"] == []


def test_stale_line_marked_unavailable_and_excluded_from_quote():
    app, pid, m = _fixture("cart-stale")
    client, csrf = _client_with_csrf(app)
    _add_line(client, csrf, pid, m)
    from app.infra.db.models import Product
    from app.infra.db.session import create_session_factory

    with create_session_factory()() as db:
        db.get(Product, pid).is_active = False
        db.commit()
    body = client.get("/api/cart").json()
    assert body["lines"][0]["unavailable"] is True
    assert body["quote"]["subtotal_vnd"] == 0


def test_checkout_quote_uses_session_cart_and_address():
    app, pid, m = _fixture("cart-coquote")
    client, csrf = _client_with_csrf(app)
    _add_line(client, csrf, pid, m)
    r = client.post(
        "/api/cart/checkout-quote",
        json={"address": {"administrative_unit": "Ba Đình", "street": "1 Phố X"}},
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 200, r.text
    assert r.json()["delivery_fee_vnd"] == 22_000
    assert r.json()["total_vnd"] == 155_000 + 22_000


def test_checkout_quote_empty_cart_is_validation_failed():
    app, *_ = _fixture("cart-coquote-empty")
    client, csrf = _client_with_csrf(app)
    r = client.post("/api/cart/checkout-quote", json={}, headers={"X-CSRF-Token": csrf})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def _combo_body(combo_id: int, quantity: int = 1) -> dict:
    from sqlalchemy import select

    from app.infra.db.models import ComboItem
    from app.infra.db.session import create_session_factory

    with create_session_factory()() as db:
        items = db.execute(
            select(ComboItem.combo_item_id, ComboItem.product_id).where(
                ComboItem.combo_id == combo_id
            )
        ).all()
    return {
        "kind": "combo",
        "combo_id": combo_id,
        "selections": [
            {"combo_item_id": cid, "picks": [{"product_id": pid, "option_ids": []}]}
            for cid, pid in items
        ],
        "quantity": quantity,
    }


def test_patch_note_null_clears_note():
    app, pid, m = _fixture("cart-note-clear")
    client, csrf = _client_with_csrf(app)
    line_id = _add_line(client, csrf, pid, m, note="Well-done").json()["lines"][0]["line_id"]
    r = client.patch(
        f"/api/cart/lines/{line_id}", json={"note": None}, headers={"X-CSRF-Token": csrf}
    )
    assert r.status_code == 200, r.text
    assert r.json()["lines"][0]["note"] is None


def test_patch_empty_string_note_stores_null():
    app, pid, m = _fixture("cart-note-empty")
    client, csrf = _client_with_csrf(app)
    line_id = _add_line(client, csrf, pid, m, note="Well-done").json()["lines"][0]["line_id"]
    r = client.patch(
        f"/api/cart/lines/{line_id}", json={"note": ""}, headers={"X-CSRF-Token": csrf}
    )
    assert r.status_code == 200, r.text
    assert r.json()["lines"][0]["note"] is None


def test_patch_quantity_only_leaves_note_untouched():
    app, pid, m = _fixture("cart-note-keep")
    client, csrf = _client_with_csrf(app)
    line_id = _add_line(client, csrf, pid, m, note="Well-done").json()["lines"][0]["line_id"]
    r = client.patch(
        f"/api/cart/lines/{line_id}", json={"quantity": 2}, headers={"X-CSRF-Token": csrf}
    )
    assert r.status_code == 200, r.text
    assert r.json()["lines"][0]["note"] == "Well-done"


def test_patch_note_on_combo_line_rejected():
    app, pid, m = _fixture("cart-combo-note")
    from tests.admin_test_utils import new_combo_with_items

    side = new_product(new_category("Sides"), "Garlic Bread", base_price_vnd=45_000)
    combo_id = new_combo_with_items("Duo", [side, side], price_vnd=80_000)
    client, csrf = _client_with_csrf(app)
    r = client.post("/api/cart/lines", json=_combo_body(combo_id), headers={"X-CSRF-Token": csrf})
    assert r.status_code == 200, r.text
    line_id = r.json()["lines"][0]["line_id"]
    r = client.patch(
        f"/api/cart/lines/{line_id}", json={"note": "nope"}, headers={"X-CSRF-Token": csrf}
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_add_item_line_quantity_above_cap_rejected():
    app, pid, m = _fixture("cart-qty-cap")
    client, csrf = _client_with_csrf(app)
    r = _add_line(client, csrf, pid, m, quantity=100)
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_add_combo_line_quantity_above_cap_rejected():
    app, pid, m = _fixture("cart-qty-cap-combo")
    from tests.admin_test_utils import new_combo_with_items

    side = new_product(new_category("Sides"), "Garlic Bread", base_price_vnd=45_000)
    combo_id = new_combo_with_items("Duo", [side, side], price_vnd=80_000)
    client, csrf = _client_with_csrf(app)
    r = client.post(
        "/api/cart/lines",
        json=_combo_body(combo_id, quantity=100),
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"
