from __future__ import annotations

from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select, update

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
    pid = new_product(cid, "Margherita", base_price_vnd=125_000, is_pizza=True)
    g = new_option_group("Size", select_type="single", required=True, sort_order=1)
    m = new_option(g, "M", price_delta_vnd=30_000, sort_order=2)
    enable_option(pid, m)
    return app, pid, m


def _add_line(client: TestClient, pid: int, m: int) -> str:
    csrf = client.get("/api/cart").json()["csrf_token"]
    r = client.post(
        "/api/cart/lines",
        json={"kind": "item", "item_id": pid, "option_ids": [m], "quantity": 1},
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 200, r.text
    return csrf


def _cart_rows() -> list[tuple[int, int | None]]:
    from app.infra.db.models import Cart
    from app.infra.db.session import create_session_factory

    with create_session_factory()() as db:
        return [
            (cid, uid)
            for cid, uid in db.execute(
                select(Cart.cart_id, Cart.user_id).order_by(Cart.cart_id)
            ).all()
        ]


def _age_cart(cart_id: int, days: int) -> None:
    from app.api.cart_store import now_naive_utc
    from app.infra.db.models import Cart
    from app.infra.db.session import create_session_factory

    with create_session_factory()() as db:
        db.execute(
            update(Cart)
            .where(Cart.cart_id == cart_id)
            .values(touched_at=now_naive_utc() - timedelta(days=days))
        )
        db.commit()


def test_gc_sweeps_dormant_guest_carts_but_spares_account_and_fresh():
    app, pid, m = _fixture("cart-gc-sweep")

    account = TestClient(app)
    account.post(
        "/api/auth/register",
        json={"full_name": "GC Tester", "phone_number": "0944444444", "password": "secret-pass-1"},
    )
    account.post(
        "/api/auth/login", json={"phone_number": "0944444444", "password": "secret-pass-1"}
    )
    _add_line(account, pid, m)

    dormant_guest = TestClient(app)
    _add_line(dormant_guest, pid, m)

    fresh_guest = TestClient(app)
    _add_line(fresh_guest, pid, m)

    rows = _cart_rows()
    account_id = next(cid for cid, uid in rows if uid is not None)
    dormant_id, fresh_id = [cid for cid, uid in rows if uid is None]

    # dormant guest AND dormant account cart: only the guest may be swept
    _age_cart(dormant_id, days=8)
    _age_cart(account_id, days=8)

    _add_line(fresh_guest, pid, m)  # any cart write triggers opportunistic GC

    remaining = {cid for cid, _ in _cart_rows()}
    assert dormant_id not in remaining
    assert account_id in remaining
    assert fresh_id in remaining


def test_gc_never_deletes_the_current_cart_even_when_dormant():
    app, pid, m = _fixture("cart-gc-self")
    client = TestClient(app)
    csrf = _add_line(client, pid, m)
    ((cart_id, _),) = _cart_rows()

    _age_cart(cart_id, days=8)

    line_id = client.get("/api/cart").json()["lines"][0]["line_id"]
    r = client.patch(
        f"/api/cart/lines/{line_id}", json={"quantity": 2}, headers={"X-CSRF-Token": csrf}
    )
    assert r.status_code == 200, r.text

    from app.api.cart_store import now_naive_utc
    from app.infra.db.models import Cart
    from app.infra.db.session import create_session_factory

    with create_session_factory()() as db:
        cart = db.get(Cart, cart_id)
        assert cart is not None  # bump-first ordering: own write can never sweep itself
        assert cart.touched_at > now_naive_utc() - timedelta(minutes=1)
