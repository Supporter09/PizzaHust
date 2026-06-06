from __future__ import annotations

from tests.admin_test_utils import admin_client, new_category, new_product


def test_create_defaults_active_and_zero_sort():
    client = admin_client("cat-create")
    r = client.post("/api/admin/categories", json={"name": "Pizza"})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["is_active"] is True
    assert body["sort_order"] == 0


def test_list_ordered_by_sort_order():
    client = admin_client("cat-order")
    client.post("/api/admin/categories", json={"name": "Pizza", "sort_order": 2})
    client.post("/api/admin/categories", json={"name": "Drinks", "sort_order": 1})
    names = [c["name"] for c in client.get("/api/admin/categories").json()]
    assert names.index("Drinks") < names.index("Pizza")


def test_duplicate_name_conflict():
    client = admin_client("cat-dup")
    client.post("/api/admin/categories", json={"name": "Pizza"})
    r = client.post("/api/admin/categories", json={"name": "Pizza"})
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "CONFLICT"


def test_get_missing_404():
    client = admin_client("cat-404")
    assert client.get("/api/admin/categories/9999").status_code == 404


def test_patch_updates_fields():
    client = admin_client("cat-patch")
    cid = client.post("/api/admin/categories", json={"name": "Pizza"}).json()["category_id"]
    r = client.patch(
        f"/api/admin/categories/{cid}",
        json={"name": "Pizzas", "sort_order": 5, "is_active": False},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == "Pizzas"
    assert body["sort_order"] == 5
    assert body["is_active"] is False


def test_patch_duplicate_name_conflict():
    client = admin_client("cat-patch-dup")
    client.post("/api/admin/categories", json={"name": "Pizza"})
    cid = client.post("/api/admin/categories", json={"name": "Drinks"}).json()["category_id"]
    r = client.patch(f"/api/admin/categories/{cid}", json={"name": "Pizza"})
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "CONFLICT"


def test_delete_empty_category_204():
    client = admin_client("cat-del")
    cid = client.post("/api/admin/categories", json={"name": "Temp"}).json()["category_id"]
    assert client.delete(f"/api/admin/categories/{cid}").status_code == 204
    assert client.get(f"/api/admin/categories/{cid}").status_code == 404


def test_delete_category_with_products_conflict():
    client = admin_client("cat-del-guard")
    cid = new_category("Pizza")
    new_product(cid, "Margherita")
    r = client.delete(f"/api/admin/categories/{cid}")
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "CONFLICT"
