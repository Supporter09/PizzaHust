"""A10: combo image upload mirrors the item-image endpoint; DELETE clears."""

from __future__ import annotations

import io

from tests.admin_test_utils import admin_client, new_category, new_combo_with_items, new_product


def _combo(slug):
    client = admin_client(slug)
    cat = new_category("Pizza")
    p1 = new_product(cat, "Pz1")
    p2 = new_product(cat, "Pz2")
    return client, new_combo_with_items("ImgCombo", [p1, p2])


def test_upload_returns_image_url_and_persists(tmp_path, monkeypatch):
    monkeypatch.setenv("IMAGE_UPLOAD_DIR", str(tmp_path))
    client, combo_id = _combo("combo-img-up")
    r = client.post(
        f"/api/admin/combos/{combo_id}/image",
        files={"image": ("x.png", io.BytesIO(b"\x89PNG fake"), "image/png")},
    )
    assert r.status_code == 200, r.text
    url = r.json()["image_url"]
    assert url.endswith(".png")
    assert client.get(f"/api/admin/combos/{combo_id}").json()["image_url"] == url


def test_upload_rejects_bad_extension():
    client, combo_id = _combo("combo-img-ext")
    r = client.post(
        f"/api/admin/combos/{combo_id}/image",
        files={"image": ("x.gif", io.BytesIO(b"gif"), "image/gif")},
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_delete_clears_image(tmp_path, monkeypatch):
    monkeypatch.setenv("IMAGE_UPLOAD_DIR", str(tmp_path))
    client, combo_id = _combo("combo-img-del")
    client.post(
        f"/api/admin/combos/{combo_id}/image",
        files={"image": ("x.png", io.BytesIO(b"\x89PNG fake"), "image/png")},
    )
    r = client.delete(f"/api/admin/combos/{combo_id}/image")
    assert r.status_code == 204
    assert client.get(f"/api/admin/combos/{combo_id}").json()["image_url"] is None


def test_upload_unknown_combo_404():
    client, _ = _combo("combo-img-404")
    r = client.post(
        "/api/admin/combos/999999/image",
        files={"image": ("x.png", io.BytesIO(b"\x89PNG fake"), "image/png")},
    )
    assert r.status_code == 404
