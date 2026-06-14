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


def _register(client, phone):
    client.post(
        "/api/auth/register",
        json={"full_name": "Merge Tester", "phone_number": phone, "password": "secret-pass-1"},
    )


def _guest_add(client, pid, m, qty=1):
    csrf = client.get("/api/cart").json()["csrf_token"]
    r = client.post(
        "/api/cart/lines",
        json={"kind": "item", "item_id": pid, "option_ids": [m], "quantity": qty},
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 200, r.text
    return csrf


def test_login_claims_guest_cart_despite_session_clear():
    app, pid, m = _fixture("merge-claim")
    client = TestClient(app)
    _register(client, "0911111111")
    _guest_add(client, pid, m, qty=2)
    r = client.post(
        "/api/auth/login", json={"phone_number": "0911111111", "password": "secret-pass-1"}
    )
    assert r.status_code == 200
    body = client.get("/api/cart").json()
    assert len(body["lines"]) == 1
    assert body["lines"][0]["quantity"] == 2


def test_login_merges_guest_into_existing_account_cart_with_qty_sum():
    app, pid, m = _fixture("merge-sum")
    client_a = TestClient(app)
    _register(client_a, "0922222222")
    client_a.post(
        "/api/auth/login",
        json={"phone_number": "0922222222", "password": "secret-pass-1"},
    )
    _guest_add(client_a, pid, m, qty=1)
    client_a.post(
        "/api/auth/logout",
        headers={"X-CSRF-Token": client_a.get("/api/cart").json()["csrf_token"]},
    )

    _guest_add(client_a, pid, m, qty=2)
    client_a.post(
        "/api/auth/login",
        json={"phone_number": "0922222222", "password": "secret-pass-1"},
    )
    body = client_a.get("/api/cart").json()
    assert len(body["lines"]) == 1
    assert body["lines"][0]["quantity"] == 3


def test_logout_keeps_account_cart_and_empties_browser():
    app, pid, m = _fixture("merge-logout")
    client = TestClient(app)
    _register(client, "0933333333")
    client.post("/api/auth/login", json={"phone_number": "0933333333", "password": "secret-pass-1"})
    csrf = _guest_add(client, pid, m)
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    assert client.get("/api/cart").json()["lines"] == []
    client.post("/api/auth/login", json={"phone_number": "0933333333", "password": "secret-pass-1"})
    assert len(client.get("/api/cart").json()["lines"]) == 1


def test_merge_quantity_sum_is_clamped_to_line_cap():
    app, pid, m = _fixture("merge-cap")
    client = TestClient(app)
    _register(client, "0955555555")
    client.post("/api/auth/login", json={"phone_number": "0955555555", "password": "secret-pass-1"})
    _guest_add(client, pid, m, qty=60)  # account cart: 60
    client.post(
        "/api/auth/logout",
        headers={"X-CSRF-Token": client.get("/api/cart").json()["csrf_token"]},
    )

    _guest_add(client, pid, m, qty=60)  # guest cart: 60
    client.post("/api/auth/login", json={"phone_number": "0955555555", "password": "secret-pass-1"})
    body = client.get("/api/cart").json()
    assert len(body["lines"]) == 1
    assert body["lines"][0]["quantity"] == 99  # 60+60 clamps to the write-path cap
