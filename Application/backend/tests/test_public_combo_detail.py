"""A10: GET /api/combos/{id} — customizer data source (spec §2.3)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.infra.db.models import Combo, ComboItem
from app.infra.db.session import create_session_factory
from tests.admin_test_utils import new_category, new_combo_with_items, new_product
from tests.auth_test_utils import build_test_app


def _slot_combo(slug):
    app = build_test_app(slug)
    cat_p = new_category("Pizza")
    pz1 = new_product(cat_p, "Margherita", base_price_vnd=120_000)
    pz2 = new_product(cat_p, "Pepperoni", base_price_vnd=130_000)
    new_product(cat_p, "Ghost", base_price_vnd=90_000, is_active=False)
    cat_s = new_category("Sides")
    bread = new_product(cat_s, "Garlic Bread", base_price_vnd=45_000)
    combo_id = new_combo_with_items("Feast", [bread], price_vnd=250_000)
    with create_session_factory()() as db:
        db.add(ComboItem(combo_id=combo_id, category_id=cat_p, quantity=2))
        db.commit()
    return app, combo_id, {"pz1": pz1, "pz2": pz2, "bread": bread, "cat_p": cat_p}


def test_detail_components_eligible_products_and_surcharges():
    app, combo_id, ids = _slot_combo("detail-happy")
    r = TestClient(app).get(f"/api/combos/{combo_id}")
    assert r.status_code == 200, r.text
    body = r.json()
    fixed, slot = body["components"]
    assert fixed["kind"] == "product"
    assert fixed["product_id"] == ids["bread"]
    assert fixed["base_price_vnd"] == 45_000
    assert slot["kind"] == "category"
    assert slot["from_price_vnd"] == 120_000
    eligible = slot["eligible_products"]
    assert [p["product_id"] for p in eligible] == [ids["pz1"], ids["pz2"]]
    assert eligible[0]["surcharge_vnd"] == 0
    assert eligible[1]["surcharge_vnd"] == 10_000
    assert body["items_total_vnd"] == 285_000
    assert body["savings_vnd"] == 35_000


def test_detail_404_when_not_active():
    app, combo_id, _ = _slot_combo("detail-expired")
    past = datetime.now(UTC).replace(tzinfo=None) - timedelta(days=1)
    with create_session_factory()() as db:
        combo = db.get(Combo, combo_id)
        combo.validity_end = past
        db.commit()
    assert TestClient(app).get(f"/api/combos/{combo_id}").status_code == 404


def test_detail_404_when_unknown():
    app, _, _ = _slot_combo("detail-unknown")
    assert TestClient(app).get("/api/combos/999999").status_code == 404
