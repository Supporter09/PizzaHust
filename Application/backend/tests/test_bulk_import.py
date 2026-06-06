from __future__ import annotations

from tests.admin_test_utils import admin_client, count_categories, new_category

PIZZA_CSV = "name,category_name,base_price_vnd\nMargherita,Pizza,120000\nPepperoni,Pizza,140000\n"


def _upload(client, path, content: str):
    return client.post(path, files={"file": ("data.csv", content.encode(), "text/csv")})


def test_import_pizzas_creates_then_updates_idempotent():
    client = admin_client("imp-pizza")
    new_category("Pizza")

    r1 = _upload(client, "/api/admin/import/pizzas", PIZZA_CSV)
    assert r1.status_code == 200, r1.text
    assert r1.json()["created"] == 2
    assert r1.json()["updated"] == 0

    r2 = _upload(client, "/api/admin/import/pizzas", PIZZA_CSV)
    assert r2.json()["created"] == 0
    assert r2.json()["updated"] == 2


def test_unknown_category_reported_not_autocreated():
    client = admin_client("imp-unknown")
    new_category("Pizza")
    before = count_categories()

    csv = "name,category_name,base_price_vnd\nCola,Drinks,10000\n"
    r = _upload(client, "/api/admin/import/pizzas", csv)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["created"] == 0
    assert body["skipped"] == 1
    assert any("Drinks" in e for e in body["errors"])
    assert count_categories() == before  # no silent auto-create


def test_bad_price_row_skipped():
    client = admin_client("imp-badprice")
    new_category("Pizza")
    csv = "name,category_name,base_price_vnd\nGood,Pizza,100000\nBad,Pizza,abc\n"
    r = _upload(client, "/api/admin/import/pizzas", csv)
    body = r.json()
    assert body["created"] == 1
    assert body["skipped"] == 1
    assert any("price" in e.lower() for e in body["errors"])


def test_oversize_file_rejected(monkeypatch):
    monkeypatch.setenv("CSV_IMPORT_MAX_BYTES", "16")
    client = admin_client("imp-big")
    new_category("Pizza")
    big = "name,category_name,base_price_vnd\n" + ("A,Pizza,1\n" * 100)
    r = _upload(client, "/api/admin/import/pizzas", big)
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_import_toppings_idempotent():
    client = admin_client("imp-top")
    csv = "name,price_vnd\nCheese,15000\nMushroom,12000\n"
    r1 = _upload(client, "/api/admin/import/toppings", csv)
    assert r1.status_code == 200, r1.text
    assert r1.json()["created"] == 2
    r2 = _upload(client, "/api/admin/import/toppings", csv)
    assert r2.json()["created"] == 0
    assert r2.json()["updated"] == 2
