from __future__ import annotations

from tests.admin_test_utils import (
    admin_client,
    enable_option,
    new_category,
    new_option,
    new_option_group,
    new_product,
)


def test_group_crud_roundtrip():
    c = admin_client("og-crud")
    r = c.post(
        "/api/admin/option-groups",
        json={"name": "Size", "select_type": "single", "required": True, "sort_order": 1},
    )
    assert r.status_code == 201, r.text
    gid = r.json()["group_id"]
    assert r.json()["select_type"] == "single"

    r = c.patch(f"/api/admin/option-groups/{gid}", json={"name": "Pizza Size", "required": False})
    assert r.status_code == 200
    assert r.json()["name"] == "Pizza Size"
    assert r.json()["required"] is False

    r = c.get("/api/admin/option-groups")
    assert [g["name"] for g in r.json()] == ["Pizza Size"]

    assert c.delete(f"/api/admin/option-groups/{gid}").status_code == 204
    assert c.get("/api/admin/option-groups").json() == []


def test_duplicate_group_name_409():
    c = admin_client("og-dupe")
    assert c.post("/api/admin/option-groups", json={"name": "Size"}).status_code == 201
    r = c.post("/api/admin/option-groups", json={"name": "Size"})
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "CONFLICT"


def test_option_crud_and_dupe_within_group():
    c = admin_client("og-opt")
    gid = new_option_group("Toppings", select_type="multi", required=False)
    r = c.post(
        f"/api/admin/option-groups/{gid}/options",
        json={"name": "Extra Cheese", "price_delta_vnd": 15_000, "description": "More mozz"},
    )
    assert r.status_code == 201, r.text
    oid = r.json()["option_id"]

    r = c.post(f"/api/admin/option-groups/{gid}/options", json={"name": "Extra Cheese"})
    assert r.status_code == 409

    gid2 = new_option_group("Size")
    assert (
        c.post(
            f"/api/admin/option-groups/{gid2}/options", json={"name": "Extra Cheese"}
        ).status_code
        == 201
    )

    r = c.patch(f"/api/admin/options/{oid}", json={"price_delta_vnd": 18_000})
    assert r.status_code == 200
    assert r.json()["price_delta_vnd"] == 18_000

    assert c.delete(f"/api/admin/options/{oid}").status_code == 204


def test_patch_option_clears_description_with_explicit_null():
    c = admin_client("og-clear-desc")
    gid = new_option_group("Toppings", select_type="multi", required=False)
    r = c.post(
        f"/api/admin/option-groups/{gid}/options",
        json={"name": "Extra Cheese", "description": "More mozz"},
    )
    oid = r.json()["option_id"]
    assert r.json()["description"] == "More mozz"

    # Omitting description must leave it untouched.
    r = c.patch(f"/api/admin/options/{oid}", json={"price_delta_vnd": 1_000})
    assert r.json()["description"] == "More mozz"

    # Explicit null must clear it.
    r = c.patch(f"/api/admin/options/{oid}", json={"description": None})
    assert r.status_code == 200, r.text
    assert r.json()["description"] is None


def test_group_delete_cascades_options():
    c = admin_client("og-cascade")
    gid = new_option_group("Size")
    new_option(gid, "M", price_delta_vnd=30_000)
    assert c.delete(f"/api/admin/option-groups/{gid}").status_code == 204
    assert c.get("/api/admin/option-groups").json() == []


def test_requires_admin_role():
    from fastapi.testclient import TestClient

    from tests.auth_test_utils import build_test_app

    app = build_test_app("og-guard")
    r = TestClient(app).get("/api/admin/option-groups")
    assert r.status_code == 401


def test_item_options_view_and_replace():
    c = admin_client("og-item")
    cid = new_category("Pizza")
    pid = new_product(cid, "Margherita")
    gid = new_option_group("Size", select_type="single", required=True)
    m = new_option(gid, "M", price_delta_vnd=30_000)
    l_ = new_option(gid, "L", price_delta_vnd=60_000)
    enable_option(pid, m)

    r = c.get(f"/api/admin/items/{pid}/options")
    assert r.status_code == 200, r.text
    (group,) = r.json()
    assert group["name"] == "Size"
    enabled = {o["option_id"]: o["enabled"] for o in group["options"]}
    assert enabled == {m: True, l_: False}

    r = c.put(f"/api/admin/items/{pid}/options", json={"option_ids": [l_]})
    assert r.status_code == 200
    r = c.get(f"/api/admin/items/{pid}/options")
    enabled = {o["option_id"]: o["enabled"] for o in r.json()[0]["options"]}
    assert enabled == {m: False, l_: True}


def test_item_options_unknown_product_404():
    c = admin_client("og-item-404")
    assert c.get("/api/admin/items/999/options").status_code == 404


def test_item_options_put_unknown_option_404():
    c = admin_client("og-item-badopt")
    cid = new_category("Pizza")
    pid = new_product(cid, "Margherita")
    r = c.put(f"/api/admin/items/{pid}/options", json={"option_ids": [12345]})
    assert r.status_code == 404


def test_negative_price_delta_rejected_on_create():
    c = admin_client("og-negdelta")
    gid = new_option_group("Toppings", select_type="multi", required=False)
    r = c.post(
        f"/api/admin/option-groups/{gid}/options",
        json={"name": "Bad", "price_delta_vnd": -1_000},
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_negative_price_delta_rejected_on_patch():
    c = admin_client("og-negdelta-patch")
    gid = new_option_group("Toppings", select_type="multi", required=False)
    oid = new_option(gid, "Cheese", price_delta_vnd=15_000)
    r = c.patch(f"/api/admin/options/{oid}", json={"price_delta_vnd": -1})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_option_delete_cascades_product_enablement():
    from app.infra.db.models import ProductOption
    from app.infra.db.session import create_session_factory

    c = admin_client("og-fk-cascade")
    cid = new_category("Pizza")
    pid = new_product(cid, "Margherita")
    gid = new_option_group("Size")
    oid = new_option(gid, "M", price_delta_vnd=30_000)
    enable_option(pid, oid)

    assert c.delete(f"/api/admin/options/{oid}").status_code == 204
    with create_session_factory()() as db:
        assert db.get(ProductOption, (pid, oid)) is None
