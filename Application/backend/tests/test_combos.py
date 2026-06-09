from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.infra.db.models import Combo, ComboItem
from app.infra.db.session import create_session_factory
from tests.admin_test_utils import new_category, new_product
from tests.auth_test_utils import build_test_app


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _add_combo(name, price, items, *, start=None, end=None):
    """items: list of (product_id, quantity)."""
    with create_session_factory()() as db:
        combo = Combo(
            name=name,
            description=f"{name} desc",
            combo_price_vnd=price,
            target_group=2,
            validity_start=start,
            validity_end=end,
        )
        db.add(combo)
        db.flush()
        for pid, qty in items:
            db.add(ComboItem(combo_id=combo.combo_id, product_id=pid, quantity=qty))
        db.commit()
        db.refresh(combo)
        return combo.combo_id


def test_lists_active_combo_with_savings():
    app = build_test_app("combos-active")
    cid = new_category("Pizza")
    p1 = new_product(cid, "Margherita", base_price_vnd=125_000, is_pizza=True)
    p2 = new_product(cid, "Garlic Bread", base_price_vnd=45_000, is_pizza=False)
    # items_total = 125000*2 + 45000*1 = 295000; combo price 255000 -> savings 40000
    _add_combo("Lunch Duo", 255_000, [(p1, 2), (p2, 1)])

    r = TestClient(app).get("/api/combos")
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body) == 1
    combo = body[0]
    assert combo["name"] == "Lunch Duo"
    assert combo["combo_price_vnd"] == 255_000
    assert combo["items_total_vnd"] == 295_000
    assert combo["savings_vnd"] == 40_000
    assert combo["target_group"] == 2
    assert "validity_start" not in combo and "status" not in combo
    items = combo["items"]
    assert len(items) == 2
    assert set(items[0]) == {"product_id", "name", "quantity", "image_url", "base_price_vnd"}
    names = {i["name"]: i["quantity"] for i in items}
    assert names == {"Margherita": 2, "Garlic Bread": 1}


def test_excludes_scheduled_and_expired():
    app = build_test_app("combos-window")
    cid = new_category("Pizza")
    p1 = new_product(cid, "A", base_price_vnd=100_000, is_pizza=True)
    p2 = new_product(cid, "B", base_price_vnd=50_000, is_pizza=False)
    now = _now()
    _add_combo(
        "Future",
        100_000,
        [(p1, 1), (p2, 1)],
        start=now + timedelta(days=1),
        end=now + timedelta(days=2),
    )
    _add_combo(
        "Past",
        100_000,
        [(p1, 1), (p2, 1)],
        start=now - timedelta(days=2),
        end=now - timedelta(days=1),
    )
    _add_combo(
        "LiveNow",
        120_000,
        [(p1, 1), (p2, 1)],
        start=now - timedelta(days=1),
        end=now + timedelta(days=1),
    )

    body = TestClient(app).get("/api/combos").json()
    assert [c["name"] for c in body] == ["LiveNow"]


def test_overpriced_combo_savings_zero():
    app = build_test_app("combos-overpriced")
    cid = new_category("Pizza")
    p1 = new_product(cid, "A", base_price_vnd=100_000, is_pizza=True)
    p2 = new_product(cid, "B", base_price_vnd=50_000, is_pizza=False)
    _add_combo("Pricey", 200_000, [(p1, 1), (p2, 1)])  # parts 150000 < 200000
    body = TestClient(app).get("/api/combos").json()
    assert body[0]["savings_vnd"] == 0


def test_empty_when_no_active_combos():
    app = build_test_app("combos-empty")
    r = TestClient(app).get("/api/combos")
    assert r.status_code == 200
    assert r.json() == []


def test_public_no_auth():
    app = build_test_app("combos-public")
    assert TestClient(app).get("/api/combos").status_code == 200


def test_component_image_url_surfaced():
    app = build_test_app("combos-image")
    cid = new_category("Pizza")
    p1 = new_product(cid, "WithImg", base_price_vnd=100_000, is_pizza=True)
    p2 = new_product(cid, "NoImg", base_price_vnd=50_000, is_pizza=False)
    with create_session_factory()() as db:
        from sqlalchemy import select

        from app.infra.db.models import Product

        prod = db.scalar(select(Product).where(Product.product_id == p1))
        prod.image_url = "/static/img/withimg.png"
        db.commit()
    _add_combo("ImgCombo", 120_000, [(p1, 1), (p2, 1)])
    body = TestClient(app).get("/api/combos").json()
    items = {i["name"]: i["image_url"] for i in body[0]["items"]}
    assert items["WithImg"] == "/static/img/withimg.png"
    assert items["NoImg"] is None


def test_excludes_combo_with_inactive_component():
    app = build_test_app("combos-inactive-part")
    cid = new_category("Pizza")
    p1 = new_product(cid, "Active", base_price_vnd=100_000, is_pizza=True)
    p2 = new_product(cid, "GoneSoon", base_price_vnd=50_000, is_pizza=False)
    _add_combo("HasInactive", 120_000, [(p1, 1), (p2, 1)])
    with create_session_factory()() as db:
        from sqlalchemy import select

        from app.infra.db.models import Product

        prod = db.scalar(select(Product).where(Product.product_id == p2))
        prod.is_active = False
        db.commit()
    r = TestClient(app).get("/api/combos")
    assert r.status_code == 200
    assert r.json() == []