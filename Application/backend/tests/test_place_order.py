from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.infra.db.models import ComboItem, Order, OrderItem
from app.infra.db.session import create_session_factory
from tests.admin_test_utils import (
    enable_option,
    new_category,
    new_combo_with_items,
    new_option,
    new_option_group,
    new_product,
)
from tests.auth_test_utils import build_test_app

ADDRESS = {"administrative_unit": "Ba Đình", "street": "1 Phố Huế"}
RECIPIENT = {"recipient_name": "Nguyen Van An", "recipient_phone": "0912345678"}


def _fixture(slug: str):
    app = build_test_app(slug)
    cid = new_category("Pizza")
    pid = new_product(cid, "Margherita", base_price_vnd=125_000, is_pizza=True)
    g = new_option_group("Size", select_type="single", required=True, sort_order=1)
    m = new_option(g, "M", price_delta_vnd=30_000, sort_order=2)
    enable_option(pid, m)
    return app, pid, m


def _cart_with_line(app, pid, m, note="Well-done"):
    client = TestClient(app)
    csrf = client.get("/api/cart").json()["csrf_token"]
    client.post(
        "/api/cart/lines",
        json={"kind": "item", "item_id": pid, "option_ids": [m], "quantity": 2, "note": note},
        headers={"X-CSRF-Token": csrf},
    )
    return client, csrf


def test_place_order_happy_path():
    app, pid, m = _fixture("order-happy")
    client, csrf = _cart_with_line(app, pid, m)
    r = client.post(
        "/api/orders",
        json={**RECIPIENT, "address": ADDRESS, "delivery_note": "Ring twice", "redeem_points": 0},
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["order_code"].startswith("PIZZ-")
    assert body["status"] == "Received"
    assert body["total_vnd"] == 2 * 155_000 + 22_000
    assert client.get("/api/cart").json()["lines"] == []


def test_out_of_service_area_rejected():
    app, pid, m = _fixture("order-osa")
    client, csrf = _cart_with_line(app, pid, m)
    r = client.post(
        "/api/orders",
        json={**RECIPIENT, "address": {"administrative_unit": "Đà Lạt", "street": "x"}},
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "OUT_OF_SERVICE_AREA"
    assert len(client.get("/api/cart").json()["lines"]) == 1


def test_empty_cart_rejected():
    app, *_ = _fixture("order-empty")
    client = TestClient(app)
    csrf = client.get("/api/cart").json()["csrf_token"]
    r = client.post(
        "/api/orders", json={**RECIPIENT, "address": ADDRESS}, headers={"X-CSRF-Token": csrf}
    )
    assert r.status_code == 400


def test_bad_phone_rejected():
    app, pid, m = _fixture("order-phone")
    client, csrf = _cart_with_line(app, pid, m)
    r = client.post(
        "/api/orders",
        json={"recipient_name": "A", "recipient_phone": "12345", "address": ADDRESS},
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_dish_note_lands_on_order_item():
    app, pid, m = _fixture("order-note")
    client, csrf = _cart_with_line(app, pid, m, note="No basil")
    client.post(
        "/api/orders", json={**RECIPIENT, "address": ADDRESS}, headers={"X-CSRF-Token": csrf}
    )
    with create_session_factory()() as db:
        item = db.scalars(select(OrderItem).where(OrderItem.product_id.isnot(None))).one()
        assert item.notes == "No basil"
        order = db.scalars(select(Order)).one()
        assert order.delivery_ward == "Ba Đình"
        assert order.promised_at is not None


def test_order_code_collision_retries_deterministically(monkeypatch):
    app, pid, m = _fixture("order-collision")
    client, csrf = _cart_with_line(app, pid, m)
    first = client.post(
        "/api/orders", json={**RECIPIENT, "address": ADDRESS}, headers={"X-CSRF-Token": csrf}
    ).json()

    import app.api.orders as orders_module

    codes = iter([first["order_code"].removeprefix("PIZZ-"), "AAAAAA"])
    monkeypatch.setattr(orders_module, "generate_order_code", lambda: f"PIZZ-{next(codes)}")
    client2, csrf2 = _cart_with_line(app, pid, m)
    r = client2.post(
        "/api/orders", json={**RECIPIENT, "address": ADDRESS}, headers={"X-CSRF-Token": csrf2}
    )
    assert r.status_code == 201, r.text
    assert r.json()["order_code"] == "PIZZ-AAAAAA"


def _combo_fixture(slug: str):
    app = build_test_app(slug)
    cat_p = new_category("Pizza")
    marg = new_product(cat_p, "Margherita", base_price_vnd=120_000)
    pep = new_product(cat_p, "Pepperoni", base_price_vnd=130_000)
    cat_s = new_category("Sides")
    bread = new_product(cat_s, "Garlic Bread", base_price_vnd=45_000, is_pizza=False)
    g_top = new_option_group("Toppings", select_type="multi", required=False)
    cheese = new_option(g_top, "Extra Cheese", price_delta_vnd=15_000)
    enable_option(marg, cheese)
    combo_id = new_combo_with_items("Feast", [bread], price_vnd=250_000)
    with create_session_factory()() as db:
        db.add(ComboItem(combo_id=combo_id, category_id=cat_p, quantity=2))
        db.commit()
        rows = db.scalars(select(ComboItem).where(ComboItem.combo_id == combo_id)).all()
        fixed_id = next(r.combo_item_id for r in rows if r.product_id is not None)
        slot_id = next(r.combo_item_id for r in rows if r.category_id is not None)
    return app, {
        "combo": combo_id,
        "fixed": fixed_id,
        "slot": slot_id,
        "marg": marg,
        "pep": pep,
        "bread": bread,
        "cheese": cheese,
    }


def test_place_order_combo_parent_child():
    app, ids = _combo_fixture("order-combo")
    client = TestClient(app)
    csrf = client.get("/api/cart").json()["csrf_token"]
    client.post(
        "/api/cart/lines",
        json={
            "kind": "combo",
            "combo_id": ids["combo"],
            "quantity": 1,
            "selections": [
                {
                    "combo_item_id": ids["fixed"],
                    "picks": [{"product_id": ids["bread"], "option_ids": []}],
                },
                {
                    "combo_item_id": ids["slot"],
                    "picks": [
                        {"product_id": ids["marg"], "option_ids": [ids["cheese"]]},
                        {"product_id": ids["pep"], "option_ids": []},
                    ],
                },
            ],
        },
        headers={"X-CSRF-Token": csrf},
    )
    r = client.post(
        "/api/orders",
        json={**RECIPIENT, "address": ADDRESS},
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 201, r.text
    assert r.json()["total_vnd"] == 275_000 + 22_000
    with create_session_factory()() as db:
        items = db.scalars(select(OrderItem).order_by(OrderItem.order_item_id)).all()
        parent = next(i for i in items if i.combo_id is not None)
        children = [i for i in items if i.parent_order_item_id == parent.order_item_id]
        assert parent.unit_price_vnd == 250_000
        assert len(children) == 3
        assert (
            sum(c.unit_price_vnd * c.quantity for c in children)
            + parent.unit_price_vnd * parent.quantity
            == 275_000
        )
