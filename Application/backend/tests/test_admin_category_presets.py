from __future__ import annotations

from app.infra.db.models import CategoryPresetGroup
from app.infra.db.session import create_session_factory
from tests.admin_test_utils import admin_client, new_category, new_option_group
from tests.auth_test_utils import build_test_app


def test_category_preset_group_table_roundtrips():
    build_test_app("cat-preset-groups")
    cat = new_category("Pizza")
    gid = new_option_group("Size", select_type="single", required=True)
    with create_session_factory()() as db:
        db.add(CategoryPresetGroup(category_id=cat, group_id=gid, sort_order=0))
        db.commit()
    with create_session_factory()() as db:
        row = db.get(CategoryPresetGroup, (cat, gid))
        assert row is not None
        assert row.sort_order == 0


def test_put_then_get_preset_roundtrips_in_order():
    client = admin_client("preset-roundtrip")
    cat = new_category("Pizza")
    g_size = new_option_group("Size", select_type="single", required=True, sort_order=1)
    g_crust = new_option_group("Crust", select_type="single", required=True, sort_order=2)

    r = client.put(f"/api/admin/categories/{cat}/preset", json={"group_ids": [g_size, g_crust]})
    assert r.status_code == 200, r.text
    assert [g["group_id"] for g in r.json()] == [g_size, g_crust]

    got = client.get(f"/api/admin/categories/{cat}/preset")
    assert [g["group_id"] for g in got.json()] == [g_size, g_crust]


def test_put_preset_unknown_group_404():
    client = admin_client("preset-unknown")
    cat = new_category("Pizza")
    r = client.put(f"/api/admin/categories/{cat}/preset", json={"group_ids": [9999]})
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"


def test_put_empty_clears_preset():
    client = admin_client("preset-clear")
    cat = new_category("Pizza")
    gid = new_option_group("Size", select_type="single", required=True)
    client.put(f"/api/admin/categories/{cat}/preset", json={"group_ids": [gid]})
    r = client.put(f"/api/admin/categories/{cat}/preset", json={"group_ids": []})
    assert r.status_code == 200
    assert client.get(f"/api/admin/categories/{cat}/preset").json() == []


def test_preset_on_unknown_category_404():
    client = admin_client("preset-no-cat")
    assert client.get("/api/admin/categories/9999/preset").status_code == 404
