from __future__ import annotations

from app.domain.cart_payload import canonical_payload


def test_item_option_ids_sorted_and_deduped():
    p = canonical_payload({"kind": "item", "item_id": 5, "option_ids": [9, 2, 9, 7]})
    assert p == {"kind": "item", "item_id": 5, "option_ids": [2, 7, 9]}


def test_combo_selections_and_picks_sorted():
    p = canonical_payload(
        {
            "kind": "combo",
            "combo_id": 1,
            "selections": [
                {
                    "combo_item_id": 11,
                    "picks": [
                        {"product_id": 6, "option_ids": [4, 1]},
                        {"product_id": 5, "option_ids": []},
                    ],
                },
                {"combo_item_id": 10, "picks": [{"product_id": 8, "option_ids": [3, 3]}]},
            ],
        }
    )
    assert [s["combo_item_id"] for s in p["selections"]] == [10, 11]
    sel11 = p["selections"][1]
    assert [pk["product_id"] for pk in sel11["picks"]] == [5, 6]
    assert p["selections"][0]["picks"][0]["option_ids"] == [3]


def test_logically_identical_payloads_collapse_to_same_form():
    a = canonical_payload({"kind": "item", "item_id": 5, "option_ids": [2, 7]})
    b = canonical_payload({"kind": "item", "item_id": 5, "option_ids": [7, 2, 2]})
    assert a == b