# tests/test_admin_combo_images.py
from __future__ import annotations

from tests.admin_test_utils import admin_client, new_category

PNG = ("a.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 64, "image/png")


def _two_pizzas(client, cat: int) -> tuple[int, int]:
    a = client.post(
        "/api/admin/items",
        json={"category_id": cat, "name": "CA", "base_price_vnd": 100, "kind": "pizza"},
    ).json()["product_id"]
    b = client.post(
        "/api/admin/items",
        json={"category_id": cat, "name": "CB", "base_price_vnd": 100, "kind": "pizza"},
    ).json()["product_id"]
    return a, b


def _combo(client) -> int:
    cat = new_category()
    a, b = _two_pizzas(client, cat)
    return client.post(
        "/api/admin/combos",
        json={
            "name": "Combo A9",
            "combo_price_vnd": 150,
            "items": [
                {"kind": "product", "product_id": a, "quantity": 1},
                {"kind": "product", "product_id": b, "quantity": 1},
            ],
        },
    ).json()["combo_id"]


def _add(client, cid: int):
    return client.post(f"/api/admin/combos/{cid}/images", files={"image": PNG})


def test_first_upload_becomes_cover(tmp_path, monkeypatch):
    monkeypatch.setenv("IMAGE_UPLOAD_DIR", str(tmp_path))
    client = admin_client("a9-combo-first")
    cid = _combo(client)
    r = _add(client, cid)
    assert r.status_code == 201, r.text
    assert r.json()["is_cover"] is True
    detail = client.get(f"/api/admin/combos/{cid}").json()
    assert detail["image_url"] == r.json()["url"]
    assert len(detail["images"]) == 1


def test_set_cover_and_delete_promotes(tmp_path, monkeypatch):
    monkeypatch.setenv("IMAGE_UPLOAD_DIR", str(tmp_path))
    client = admin_client("a9-combo-cover")
    cid = _combo(client)
    first = _add(client, cid).json()
    second = _add(client, cid).json()
    cover = f"/api/admin/combos/{cid}/images/{second['image_id']}/cover"
    assert client.post(cover).status_code == 204
    assert client.get(f"/api/admin/combos/{cid}").json()["image_url"] == second["url"]
    assert client.delete(f"/api/admin/combos/{cid}/images/{second['image_id']}").status_code == 204
    assert client.get(f"/api/admin/combos/{cid}").json()["image_url"] == first["url"]


def test_legacy_singular_delete_removes_cover(tmp_path, monkeypatch):
    monkeypatch.setenv("IMAGE_UPLOAD_DIR", str(tmp_path))
    client = admin_client("a9-combo-legacy-del")
    cid = _combo(client)
    _add(client, cid)
    assert client.delete(f"/api/admin/combos/{cid}/image").status_code == 204
    detail = client.get(f"/api/admin/combos/{cid}").json()
    assert detail["image_url"] is None
    assert detail["images"] == []


def test_ninth_upload_rejected(tmp_path, monkeypatch):
    monkeypatch.setenv("IMAGE_UPLOAD_DIR", str(tmp_path))
    client = admin_client("a9-combo-cap")
    cid = _combo(client)
    for _ in range(8):
        assert _add(client, cid).status_code == 201
    assert _add(client, cid).status_code == 400
