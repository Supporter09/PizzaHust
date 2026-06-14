from __future__ import annotations

from tests.admin_test_utils import admin_client, new_category

# Minimal byte payload; the route validates extension + size, not image content.
PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


def _make_pizza(client, category_id: int) -> int:
    return client.post(
        "/api/admin/items",
        json={"category_id": category_id, "name": "P", "base_price_vnd": 1},
    ).json()["product_id"]


def test_upload_png_sets_image_url_and_is_served(tmp_path, monkeypatch):
    monkeypatch.setenv("IMAGE_UPLOAD_DIR", str(tmp_path))
    client = admin_client("img-ok")
    pid = _make_pizza(client, new_category())

    r = client.post(
        f"/api/admin/items/{pid}/image",
        files={"image": ("logo.png", PNG_BYTES, "image/png")},
    )
    assert r.status_code == 200, r.text
    url = r.json()["image_url"]
    assert url.endswith(".png")

    # persisted on the product
    assert client.get(f"/api/admin/items/{pid}").json()["image_url"] == url
    # file written to the configured dir
    assert (tmp_path / url.rsplit("/", 1)[-1]).exists()
    # reachable via the StaticFiles mount
    served = client.get(url)
    assert served.status_code == 200
    assert served.content == PNG_BYTES


def test_upload_oversize_rejected(tmp_path, monkeypatch):
    monkeypatch.setenv("IMAGE_UPLOAD_DIR", str(tmp_path))
    monkeypatch.setenv("IMAGE_MAX_BYTES", "16")
    client = admin_client("img-big")
    pid = _make_pizza(client, new_category())

    r = client.post(
        f"/api/admin/items/{pid}/image",
        files={"image": ("big.png", b"x" * 64, "image/png")},
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_upload_disallowed_extension_rejected(tmp_path, monkeypatch):
    monkeypatch.setenv("IMAGE_UPLOAD_DIR", str(tmp_path))
    client = admin_client("img-ext")
    pid = _make_pizza(client, new_category())

    r = client.post(
        f"/api/admin/items/{pid}/image",
        files={"image": ("note.txt", b"hello", "text/plain")},
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"
