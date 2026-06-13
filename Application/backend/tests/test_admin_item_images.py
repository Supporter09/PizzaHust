# tests/test_admin_item_images.py
from __future__ import annotations

from tests.admin_test_utils import admin_client, new_category

PNG = ("a.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 64, "image/png")


def _pizza(client, cat: int, name: str = "P") -> int:
    return client.post(
        "/api/admin/items",
        json={"category_id": cat, "name": name, "base_price_vnd": 1, "kind": "pizza"},
    ).json()["product_id"]


def _add(client, pid: int):
    return client.post(f"/api/admin/items/{pid}/images", files={"image": PNG})


def test_first_upload_becomes_cover_and_sets_image_url(tmp_path, monkeypatch):
    monkeypatch.setenv("IMAGE_UPLOAD_DIR", str(tmp_path))
    client = admin_client("a9-item-first")
    pid = _pizza(client, new_category())

    r = _add(client, pid)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["is_cover"] is True
    detail = client.get(f"/api/admin/items/{pid}").json()
    assert detail["image_url"] == body["url"]
    assert [i["url"] for i in detail["images"]] == [body["url"]]


def test_second_upload_appends_not_cover(tmp_path, monkeypatch):
    monkeypatch.setenv("IMAGE_UPLOAD_DIR", str(tmp_path))
    client = admin_client("a9-item-second")
    pid = _pizza(client, new_category())
    first = _add(client, pid).json()
    second = _add(client, pid).json()
    assert second["is_cover"] is False
    detail = client.get(f"/api/admin/items/{pid}").json()
    assert detail["image_url"] == first["url"]  # cover unchanged
    assert len(detail["images"]) == 2


def test_set_cover_flips_and_rewrites_image_url(tmp_path, monkeypatch):
    monkeypatch.setenv("IMAGE_UPLOAD_DIR", str(tmp_path))
    client = admin_client("a9-item-cover")
    pid = _pizza(client, new_category())
    _add(client, pid)
    second = _add(client, pid).json()
    r = client.post(f"/api/admin/items/{pid}/images/{second['image_id']}/cover")
    assert r.status_code == 204
    assert client.get(f"/api/admin/items/{pid}").json()["image_url"] == second["url"]


def test_delete_cover_promotes_next(tmp_path, monkeypatch):
    monkeypatch.setenv("IMAGE_UPLOAD_DIR", str(tmp_path))
    client = admin_client("a9-item-del")
    pid = _pizza(client, new_category())
    first = _add(client, pid).json()
    second = _add(client, pid).json()
    r = client.delete(f"/api/admin/items/{pid}/images/{first['image_id']}")
    assert r.status_code == 204
    detail = client.get(f"/api/admin/items/{pid}").json()
    assert detail["image_url"] == second["url"]
    assert len(detail["images"]) == 1


def test_ninth_upload_rejected(tmp_path, monkeypatch):
    monkeypatch.setenv("IMAGE_UPLOAD_DIR", str(tmp_path))
    client = admin_client("a9-item-cap")
    pid = _pizza(client, new_category())
    for _ in range(8):
        assert _add(client, pid).status_code == 201
    r = _add(client, pid)
    assert r.status_code == 400
    assert client.get(f"/api/admin/items/{pid}").json()["images"].__len__() == 8


def test_delete_foreign_image_404(tmp_path, monkeypatch):
    monkeypatch.setenv("IMAGE_UPLOAD_DIR", str(tmp_path))
    client = admin_client("a9-item-foreign")
    cat = new_category()
    a = _pizza(client, cat, "A")
    b = _pizza(client, cat, "B")
    img = _add(client, a).json()
    r = client.delete(f"/api/admin/items/{b}/images/{img['image_id']}")
    assert r.status_code == 404


def test_bad_content_type_rejected(tmp_path, monkeypatch):
    monkeypatch.setenv("IMAGE_UPLOAD_DIR", str(tmp_path))
    client = admin_client("a9-item-badtype")
    pid = _pizza(client, new_category())
    r = client.post(
        f"/api/admin/items/{pid}/images",
        files={"image": ("a.png", b"x", "application/octet-stream")},
    )
    assert r.status_code == 400


def test_legacy_singular_upload_replaces_cover_never_appends(tmp_path, monkeypatch):
    monkeypatch.setenv("IMAGE_UPLOAD_DIR", str(tmp_path))
    client = admin_client("a9-item-legacy")
    pid = _pizza(client, new_category())
    for _ in range(3):
        r = client.post(f"/api/admin/items/{pid}/image", files={"image": PNG})
        assert r.status_code == 200, r.text
    detail = client.get(f"/api/admin/items/{pid}").json()
    assert len(detail["images"]) == 1  # replace, not append -> never hits the cap
    assert detail["image_url"] == detail["images"][0]["url"]
