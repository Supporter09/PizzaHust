"""U11 — reorder past orders into the session cart (best-effort)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.infra.auth.passwords import hash_password
from app.infra.db.models import (
    Combo,
    ComboItem,
    Order,
    OrderItem,
    OrderItemOption,
    OrderStatus,
    Product,
    User,
    UserRole,
)
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


def _make_customer(phone: str = "0988111222", password: str = "strongpass123") -> int:
    with create_session_factory()() as db:
        u = User(
            full_name="Hana Pham",
            phone_number=phone,
            password_hash=hash_password(password),
            role=UserRole.CUSTOMER,
        )
        db.add(u)
        db.commit()
        db.refresh(u)
        return u.user_id


def _login(app, phone: str = "0988111222", password: str = "strongpass123") -> TestClient:
    client = TestClient(app)
    resp = client.post("/api/auth/login", json={"phone_number": phone, "password": password})
    assert resp.status_code == 200, resp.text
    return client


def _csrf(client: TestClient) -> str:
    return client.get("/api/cart").json()["csrf_token"]


def _item_fixture(slug: str):
    app = build_test_app(slug)
    cid = new_category("Pizza")
    pid = new_product(cid, "Margherita", base_price_vnd=125_000)
    g = new_option_group("Size", select_type="single", required=True, sort_order=1)
    m = new_option(g, "M", price_delta_vnd=30_000, sort_order=2)
    enable_option(pid, m)
    return app, pid, m


def _seed_item_order(user_id: int, code: str, *, product_id: int, option_name: str = "M") -> None:
    with create_session_factory()() as db:
        product = db.get(Product, product_id)
        assert product is not None
        order = Order(
            order_code=code,
            user_id=user_id,
            recipient_name="Hana Pham",
            recipient_phone="0901111111",
            delivery_address="1 Dai Co Viet, Hai Ba Trung",
            delivery_ward="Bach Khoa",
            total_amount_vnd=177_000,
            delivery_fee_vnd=22_000,
            promised_at=datetime(2026, 1, 1, 12, 0, 0),
            current_status=OrderStatus.DELIVERED,
        )
        db.add(order)
        db.flush()
        item = OrderItem(
            order_id=order.order_id,
            product_id=product_id,
            quantity=2,
            unit_price_vnd=155_000,
            notes="Extra crisp",
        )
        db.add(item)
        db.flush()
        db.add(
            OrderItemOption(
                order_item_id=item.order_item_id,
                group_name="Size",
                option_name=option_name,
                price_delta_vnd=30_000,
            )
        )
        db.commit()


def _combo_fixture(slug: str):
    app = build_test_app(slug)
    cat_p = new_category("Pizza")
    marg = new_product(cat_p, "Margherita", base_price_vnd=120_000)
    pep = new_product(cat_p, "Pepperoni", base_price_vnd=130_000)
    cat_s = new_category("Sides")
    bread = new_product(cat_s, "Garlic Bread", base_price_vnd=45_000)
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


def _seed_combo_order_from_placed(app, ids: dict, user_id: int, code: str) -> None:
    client = _login(app)
    csrf = _csrf(client)
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
    from tests.test_place_order import ADDRESS, RECIPIENT

    r = client.post(
        "/api/orders",
        json={**RECIPIENT, "address": ADDRESS},
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 201, r.text
    with create_session_factory()() as db:
        order = db.scalar(select(Order).where(Order.user_id == user_id).order_by(Order.order_id.desc()))
        assert order is not None
        order.order_code = code
        db.commit()


def test_reorder_item_exact_when_menu_unchanged() -> None:
    app, pid, m = _item_fixture("reorder-exact")
    uid = _make_customer()
    _seed_item_order(uid, "PIZZ-REORD01", product_id=pid)
    client = _login(app)
    csrf = _csrf(client)
    r = client.post(
        "/api/orders/me/PIZZ-REORD01/reorder",
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["added_count"] == 1
    assert body["unavailable"] == []
    lines = body["cart"]["lines"]
    assert len(lines) == 1
    assert lines[0]["payload"]["item_id"] == pid
    assert lines[0]["payload"]["option_ids"] == [m]
    assert lines[0]["quantity"] == 2
    assert lines[0]["note"] == "Extra crisp"


def test_reorder_option_lapsed_reports_option_changed() -> None:
    app, pid, _m = _item_fixture("reorder-opt")
    uid = _make_customer()
    _seed_item_order(uid, "PIZZ-REORD02", product_id=pid, option_name="L")
    client = _login(app)
    csrf = _csrf(client)
    r = client.post(
        "/api/orders/me/PIZZ-REORD02/reorder",
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["added_count"] == 0
    assert len(body["unavailable"]) == 1
    assert body["unavailable"][0]["reason"] == "option_changed"
    assert body["cart"]["lines"] == []


def test_reorder_inactive_product_reports_item_unavailable() -> None:
    app, pid, m = _item_fixture("reorder-inact")
    uid = _make_customer()
    _seed_item_order(uid, "PIZZ-REORD03", product_id=pid)
    with create_session_factory()() as db:
        product = db.get(Product, pid)
        assert product is not None
        product.is_active = False
        db.commit()
    client = _login(app)
    csrf = _csrf(client)
    r = client.post(
        "/api/orders/me/PIZZ-REORD03/reorder",
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["added_count"] == 0
    assert body["unavailable"][0]["reason"] == "item_unavailable"


def test_reorder_appends_to_nonempty_cart() -> None:
    app, pid, m = _item_fixture("reorder-append")
    uid = _make_customer()
    _seed_item_order(uid, "PIZZ-REORD04", product_id=pid)
    client = _login(app)
    csrf = _csrf(client)
    client.post(
        "/api/cart/lines",
        json={"kind": "item", "item_id": pid, "option_ids": [m], "quantity": 1},
        headers={"X-CSRF-Token": csrf},
    )
    r = client.post(
        "/api/orders/me/PIZZ-REORD04/reorder",
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["added_count"] == 1
    assert len(body["cart"]["lines"]) >= 1
    total_qty = sum(line["quantity"] for line in body["cart"]["lines"])
    assert total_qty >= 3


def test_reorder_requires_csrf() -> None:
    app, pid, _m = _item_fixture("reorder-csrf")
    uid = _make_customer()
    _seed_item_order(uid, "PIZZ-REORD05", product_id=pid)
    client = _login(app)
    r = client.post("/api/orders/me/PIZZ-REORD05/reorder")
    assert r.status_code == 403


def test_reorder_requires_login() -> None:
    app, pid, _m = _item_fixture("reorder-auth")
    uid = _make_customer()
    _seed_item_order(uid, "PIZZ-REORD06", product_id=pid)
    client = TestClient(app)
    csrf = _csrf(client)
    r = client.post(
        "/api/orders/me/PIZZ-REORD06/reorder",
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 401


def test_reorder_404_for_non_owned_order() -> None:
    app, pid, _m = _item_fixture("reorder-404")
    uid = _make_customer()
    other = _make_customer("0988333444")
    _seed_item_order(other, "PIZZ-OTHER01", product_id=pid)
    client = _login(app)
    csrf = _csrf(client)
    r = client.post(
        "/api/orders/me/PIZZ-OTHER01/reorder",
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 404


def test_reorder_combo_happy_path_after_seed_shape() -> None:
    app, ids = _combo_fixture("reorder-combo")
    uid = _make_customer()
    _seed_combo_order_from_placed(app, ids, uid, "PIZZ-CMBR01")
    client = _login(app)
    csrf = _csrf(client)
    r = client.post(
        "/api/orders/me/PIZZ-CMBR01/reorder",
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["added_count"] == 1
    assert body["unavailable"] == []
    combo_lines = [ln for ln in body["cart"]["lines"] if ln["payload"]["kind"] == "combo"]
    assert len(combo_lines) == 1
    assert combo_lines[0]["payload"]["combo_id"] == ids["combo"]


def test_reorder_combo_changed_when_structure_differs() -> None:
    app, ids = _combo_fixture("reorder-combo-chg")
    uid = _make_customer()
    _seed_combo_order_from_placed(app, ids, uid, "PIZZ-CMBR02")
    with create_session_factory()() as db:
        db.execute(delete(ComboItem).where(ComboItem.combo_id == ids["combo"]))
        db.commit()
    client = _login(app)
    csrf = _csrf(client)
    r = client.post(
        "/api/orders/me/PIZZ-CMBR02/reorder",
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["added_count"] == 0
    assert body["unavailable"][0]["reason"] == "combo_changed"


def test_reorder_combo_unavailable_when_expired() -> None:
    app, ids = _combo_fixture("reorder-combo-exp")
    uid = _make_customer()
    _seed_combo_order_from_placed(app, ids, uid, "PIZZ-CMBR03")
    with create_session_factory()() as db:
        combo = db.get(Combo, ids["combo"])
        assert combo is not None
        past = datetime.now(UTC).replace(tzinfo=None) - timedelta(days=2)
        combo.validity_end = past
        db.commit()
    client = _login(app)
    csrf = _csrf(client)
    r = client.post(
        "/api/orders/me/PIZZ-CMBR03/reorder",
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["added_count"] == 0
    assert body["unavailable"][0]["reason"] == "combo_unavailable"