"""Canonical form for stored cart-line payloads.

Merge dedupe and any payload comparison operate on this form only —
raw JSON equality misses reordered/duplicated option ids.
"""

from __future__ import annotations

from typing import Any


def _canonical_option_ids(option_ids: list[int]) -> list[int]:
    return sorted(set(option_ids))


def canonical_payload(payload: dict[str, Any]) -> dict[str, Any]:
    if payload["kind"] == "item":
        return {
            "kind": "item",
            "item_id": payload["item_id"],
            "option_ids": _canonical_option_ids(payload.get("option_ids", [])),
        }
    selections = []
    for sel in payload["selections"]:
        picks = [
            {
                "product_id": pick["product_id"],
                "option_ids": _canonical_option_ids(pick.get("option_ids", [])),
            }
            for pick in sel["picks"]
        ]
        picks.sort(key=lambda p: (p["product_id"], p["option_ids"]))
        selections.append({"combo_item_id": sel["combo_item_id"], "picks": picks})
    selections.sort(key=lambda s: s["combo_item_id"])
    return {"kind": "combo", "combo_id": payload["combo_id"], "selections": selections}
