"""A category's option groups ARE its preset (Task 1 moved groups under a
Category via ``OptionGroup.category_id``). Task 3 exposes that preset read-only
at ``GET /api/admin/categories/{id}/option-groups`` (rich groups + options,
ordered by ``(sort_order, name)``) and removes the old per-category preset
table plus its GET/PUT ``/categories/{id}/preset`` routes.
"""

from __future__ import annotations

from tests.admin_test_utils import admin_client, new_category


def _make_group(client, category_id: int, name: str, *, sort_order: int = 0) -> int:
    r = client.post(
        "/api/admin/option-groups",
        json={
            "name": name,
            "category_id": category_id,
            "select_type": "single",
            "required": True,
            "sort_order": sort_order,
        },
    )
    assert r.status_code == 201, r.text
    return r.json()["group_id"]


def _make_option(client, group_id: int, name: str, *, sort_order: int = 0) -> int:
    r = client.post(
        f"/api/admin/option-groups/{group_id}/options",
        json={"name": name, "price_delta_vnd": 0, "sort_order": sort_order},
    )
    assert r.status_code == 201, r.text
    return r.json()["option_id"]


def test_category_option_groups_returns_owned_groups_with_options_ordered():
    client = admin_client("cat-preset-read")
    cat = new_category("Pizza")
    other = new_category("Drinks")

    # Two groups in `cat`: deliberately seed so (sort_order, name) ordering is
    # exercised — "Crust" sorts before "Size" at the same sort_order.
    g_size = _make_group(client, cat, "Size", sort_order=1)
    g_crust = _make_group(client, cat, "Crust", sort_order=1)
    # Options on Size out of insertion order so (sort_order, name) is tested.
    o_m = _make_option(client, g_size, "M", sort_order=2)
    o_l = _make_option(client, g_size, "L", sort_order=1)
    # A group belonging to ANOTHER category must not leak in.
    _make_group(client, other, "Ice", sort_order=0)

    r = client.get(f"/api/admin/categories/{cat}/option-groups")
    assert r.status_code == 200, r.text
    groups = r.json()

    # Only `cat`'s two groups, ordered by (sort_order, name): Crust before Size.
    assert [g["group_id"] for g in groups] == [g_crust, g_size]
    assert all(g["category_id"] == cat for g in groups)

    crust, size = groups
    assert crust["name"] == "Crust"
    assert crust["select_type"] == "single"
    assert crust["required"] is True
    assert crust["options"] == []

    # Rich option payload, ordered by (sort_order, name): L (1) before M (2).
    assert [o["option_id"] for o in size["options"]] == [o_l, o_m]
    first = size["options"][0]
    assert set(first) == {
        "option_id",
        "group_id",
        "name",
        "description",
        "price_delta_vnd",
        "sort_order",
    }
    assert first["name"] == "L"
    assert first["group_id"] == g_size
    # No per-dish enablement concept in the preset view.
    assert "enabled" not in first


def test_category_option_groups_unknown_category_404():
    client = admin_client("cat-preset-404")
    r = client.get("/api/admin/categories/999999/option-groups")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"


def test_old_preset_routes_are_gone():
    client = admin_client("cat-preset-removed")
    cat = new_category("Pizza")
    assert client.get(f"/api/admin/categories/{cat}/preset").status_code == 404
    assert (
        client.put(f"/api/admin/categories/{cat}/preset", json={"group_ids": []}).status_code == 404
    )
