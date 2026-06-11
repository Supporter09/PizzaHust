"""A10: cart quote prices resolved combo lines (spec §2.4)."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.infra.db.models import ComboItem
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


def _fixture(slug):
    """Combo 250k = fixed Garlic Bread 45k + slot 2x Pizza (ref 120k).
    Pepperoni costs 130k (+10k surcharge). Margherita has a 15k topping."""
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


def _combo_line(ids, picks_slot, picks_fixed=None, quantity=1):
    return {
        "kind": "combo",
        "combo_id": ids["combo"],
        "quantity": quantity,
        "selections": [
            {
                "combo_item_id": ids["fixed"],
                "picks": picks_fixed or [{"product_id": ids["bread"], "option_ids": []}],
            },
            {"combo_item_id": ids["slot"], "picks": picks_slot},
        ],
    }


def _quote(app, lines):
    return TestClient(app).post("/api/cart/quote", json={"lines": lines})


def test_combo_quote_happy_path_pricing():
    app, ids = _fixture("cartc-happy")
    line = _combo_line(
        ids,
        picks_slot=[
            {"product_id": ids["marg"], "option_ids": [ids["cheese"]]},
            {"product_id": ids["pep"], "option_ids": []},
        ],
    )
    r = _quote(app, [line])
    assert r.status_code == 200, r.text
    body = r.json()
    # reference total = 45k + 2x120k = 285k; surcharge 10k (pep); deltas 15k
    # full = 310k, charged = 250k + 25k = 275k, discount = 35k
    assert body["subtotal_vnd"] == 310_000
    assert body["discount_combo_vnd"] == 35_000
    assert body["total_vnd"] == 275_000


def test_combo_quote_quantity_multiplies():
    app, ids = _fixture("cartc-qty")
    line = _combo_line(
        ids,
        picks_slot=[
            {"product_id": ids["marg"], "option_ids": []},
            {"product_id": ids["marg"], "option_ids": []},
        ],
        quantity=2,
    )
    r = _quote(app, [line])
    assert r.status_code == 200, r.text
    body = r.json()
    # per unit: full 285k, charged 250k, discount 35k
    assert body["subtotal_vnd"] == 570_000
    assert body["discount_combo_vnd"] == 70_000
    assert body["total_vnd"] == 500_000


def test_combo_quote_duplicate_pick_options_deduped():
    app, ids = _fixture("cartc-dedupe")
    line = _combo_line(
        ids,
        picks_slot=[
            {"product_id": ids["marg"], "option_ids": [ids["cheese"], ids["cheese"]]},
            {"product_id": ids["pep"], "option_ids": []},
        ],
    )
    r = _quote(app, [line])
    assert r.status_code == 200, r.text
    assert r.json()["total_vnd"] == 275_000  # cheese counted once


def test_combo_quote_option_not_enabled_uses_a8_reason():
    app, ids = _fixture("cartc-opt")
    line = _combo_line(
        ids,
        picks_slot=[
            {"product_id": ids["pep"], "option_ids": [ids["cheese"]]},  # enabled on marg only
            {"product_id": ids["marg"], "option_ids": []},
        ],
    )
    r = _quote(app, [line])
    assert r.status_code == 400
    assert r.json()["error"]["details"]["reason"] == "option_not_available"


def test_combo_quote_unknown_combo():
    app, ids = _fixture("cartc-unknown")
    line = _combo_line(
        ids,
        picks_slot=[
            {"product_id": ids["marg"], "option_ids": []},
            {"product_id": ids["marg"], "option_ids": []},
        ],
    )
    line["combo_id"] = 999_999
    r = _quote(app, [line])
    assert r.status_code == 400
    assert r.json()["error"]["details"]["reason"] == "combo_not_active"


def test_combo_quote_pick_count_mismatch():
    app, ids = _fixture("cartc-count")
    line = _combo_line(ids, picks_slot=[{"product_id": ids["marg"], "option_ids": []}])
    r = _quote(app, [line])
    assert r.status_code == 400
    body = r.json()["error"]["details"]
    assert body["reason"] == "pick_count_mismatch"
    assert body["combo_item_id"] == ids["slot"]


def test_combo_quote_pick_outside_category():
    app, ids = _fixture("cartc-outside")
    line = _combo_line(
        ids,
        picks_slot=[
            {"product_id": ids["bread"], "option_ids": []},  # bread is Sides, slot is Pizza
            {"product_id": ids["marg"], "option_ids": []},
        ],
    )
    r = _quote(app, [line])
    assert r.status_code == 400
    assert r.json()["error"]["details"]["reason"] == "product_not_in_slot_category"


def test_combo_quote_fixed_component_mismatch():
    app, ids = _fixture("cartc-fixedmm")
    line = _combo_line(
        ids,
        picks_slot=[
            {"product_id": ids["marg"], "option_ids": []},
            {"product_id": ids["marg"], "option_ids": []},
        ],
        picks_fixed=[{"product_id": ids["marg"], "option_ids": []}],
    )
    r = _quote(app, [line])
    assert r.status_code == 400
    assert r.json()["error"]["details"]["reason"] == "product_mismatch_fixed_component"


def test_combo_quote_missing_selection():
    app, ids = _fixture("cartc-missing")
    line = _combo_line(
        ids,
        picks_slot=[
            {"product_id": ids["marg"], "option_ids": []},
            {"product_id": ids["marg"], "option_ids": []},
        ],
    )
    line["selections"] = line["selections"][1:]  # drop the fixed component
    r = _quote(app, [line])
    assert r.status_code == 400
    assert r.json()["error"]["details"]["reason"] == "component_selection_missing"


def test_item_line_with_combo_fields_is_schema_error():
    app, ids = _fixture("cartc-schema")
    r = _quote(app, [{"kind": "item", "item_id": ids["marg"], "quantity": 1, "selections": []}])
    assert r.status_code == 400
    assert "errors" in r.json()["error"]["details"]
