from __future__ import annotations

from tests.admin_test_utils import (
    admin_client,
    new_crust,
    new_size,
    new_topping,
    reference_crust_in_order,
    reference_size_in_order,
    reference_topping_in_order,
)

# ── Sizes ──────────────────────────────────────────────────────────────────


def test_size_create_list_patch():
    client = admin_client("opt-size-crud")
    r = client.post("/api/admin/sizes", json={"name": "M", "price_modifier_vnd": 30_000})
    assert r.status_code == 201, r.text
    sid = r.json()["size_id"]
    assert r.json()["price_modifier_vnd"] == 30_000

    names = [s["name"] for s in client.get("/api/admin/sizes").json()]
    assert "M" in names

    p = client.patch(f"/api/admin/sizes/{sid}", json={"price_modifier_vnd": 50_000})
    assert p.status_code == 200
    assert p.json()["price_modifier_vnd"] == 50_000


def test_size_duplicate_conflict():
    client = admin_client("opt-size-dup")
    client.post("/api/admin/sizes", json={"name": "L", "price_modifier_vnd": 0})
    r = client.post("/api/admin/sizes", json={"name": "L", "price_modifier_vnd": 0})
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "CONFLICT"


def test_size_delete_ok():
    client = admin_client("opt-size-del")
    sid = client.post("/api/admin/sizes", json={"name": "S"}).json()["size_id"]
    assert client.delete(f"/api/admin/sizes/{sid}").status_code == 204
    assert "S" not in [s["name"] for s in client.get("/api/admin/sizes").json()]


def test_size_delete_guard_when_referenced():
    client = admin_client("opt-size-guard")
    sid = new_size("M")
    reference_size_in_order(sid)
    r = client.delete(f"/api/admin/sizes/{sid}")
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "CONFLICT"


# ── Crusts ─────────────────────────────────────────────────────────────────


def test_crust_create_list_patch():
    client = admin_client("opt-crust-crud")
    r = client.post("/api/admin/crusts", json={"name": "thin"})
    assert r.status_code == 201, r.text
    cid = r.json()["crust_id"]
    assert "thin" in [c["name"] for c in client.get("/api/admin/crusts").json()]
    p = client.patch(f"/api/admin/crusts/{cid}", json={"name": "thick"})
    assert p.status_code == 200
    assert p.json()["name"] == "thick"


def test_crust_duplicate_conflict():
    client = admin_client("opt-crust-dup")
    client.post("/api/admin/crusts", json={"name": "cheese"})
    r = client.post("/api/admin/crusts", json={"name": "cheese"})
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "CONFLICT"


def test_crust_delete_ok():
    client = admin_client("opt-crust-del")
    cid = client.post("/api/admin/crusts", json={"name": "pan"}).json()["crust_id"]
    assert client.delete(f"/api/admin/crusts/{cid}").status_code == 204


def test_crust_delete_guard_when_referenced():
    client = admin_client("opt-crust-guard")
    cid = new_crust("thin")
    reference_crust_in_order(cid)
    r = client.delete(f"/api/admin/crusts/{cid}")
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "CONFLICT"


# ── Toppings ───────────────────────────────────────────────────────────────


def test_topping_create_list_patch():
    client = admin_client("opt-top-crud")
    r = client.post("/api/admin/toppings", json={"name": "Mushroom", "price_vnd": 12_000})
    assert r.status_code == 201, r.text
    tid = r.json()["topping_id"]
    assert r.json()["price_vnd"] == 12_000
    p = client.patch(f"/api/admin/toppings/{tid}", json={"price_vnd": 15_000})
    assert p.status_code == 200
    assert p.json()["price_vnd"] == 15_000


def test_topping_duplicate_conflict():
    client = admin_client("opt-top-dup")
    client.post("/api/admin/toppings", json={"name": "Beef", "price_vnd": 20_000})
    r = client.post("/api/admin/toppings", json={"name": "Beef", "price_vnd": 20_000})
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "CONFLICT"


def test_topping_delete_ok():
    client = admin_client("opt-top-del")
    tid = client.post("/api/admin/toppings", json={"name": "Olives", "price_vnd": 9_000}).json()[
        "topping_id"
    ]
    assert client.delete(f"/api/admin/toppings/{tid}").status_code == 204


def test_topping_delete_guard_when_referenced():
    client = admin_client("opt-top-guard")
    tid = new_topping("Cheese")
    reference_topping_in_order(tid)
    r = client.delete(f"/api/admin/toppings/{tid}")
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "CONFLICT"
