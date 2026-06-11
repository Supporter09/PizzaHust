"""A10 – combo choice-slot rules (pure, no IO).

A slot is a combo component holding a category instead of a product. Its
reference price is the minimum active base price in that category; a pick
costing more pays the difference (never less than zero). Option deltas ride
on top via the A8 pipeline. See docs/plans/2026-06-10-a10-combo-choice-slots-design.md.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from app.domain.pricing import PricingError


def slot_reference_price(active_base_prices_vnd: Sequence[int]) -> int:
    """Cheapest active product in the slot's category. Caller guarantees the
    sequence is non-empty (an empty slot makes the combo unpurchasable)."""
    return min(active_base_prices_vnd)


def pick_surcharge(base_price_vnd: int, reference_vnd: int) -> int:
    """What a pick adds above the slot's reference. Clamped at 0."""
    return max(0, base_price_vnd - reference_vnd)


@dataclass(frozen=True)
class ComboLinePricing:
    line_full_value_vnd: int
    line_charged_vnd: int
    discount_vnd: int


def combo_line_pricing(
    *,
    combo_price_vnd: int,
    reference_total_vnd: int,
    surcharges_vnd: Sequence[int],
    option_deltas_vnd: Sequence[int],
) -> ComboLinePricing:
    """Value/charge/discount for one configured combo unit.

    full    = reference_total + surcharges + deltas
    charged = combo_price     + surcharges + deltas
    discount = max(0, full - charged)  — an over-priced combo shows no savings;
    the quote's subtotal accumulates charged + discount so the total always
    charges `charged` (see spec §2.4).
    """
    inputs = [combo_price_vnd, reference_total_vnd, *surcharges_vnd, *option_deltas_vnd]
    if any(v < 0 for v in inputs):
        raise PricingError("VALIDATION_FAILED", "Price inputs must be non-negative.")
    extras = sum(surcharges_vnd) + sum(option_deltas_vnd)
    full = reference_total_vnd + extras
    charged = combo_price_vnd + extras
    return ComboLinePricing(
        line_full_value_vnd=full,
        line_charged_vnd=charged,
        discount_vnd=max(0, full - charged),
    )


@dataclass(frozen=True)
class ComboComponentDef:
    """One combo component as the validator sees it. Exactly one of
    fixed_product_id / eligible_product_ids is set (mirrors the DB CHECK);
    eligible_product_ids holds the slot category's ACTIVE products."""

    combo_item_id: int
    quantity: int
    fixed_product_id: int | None
    eligible_product_ids: frozenset[int] | None


@dataclass(frozen=True)
class SelectionPicks:
    combo_item_id: int
    product_ids: list[int]


@dataclass(frozen=True)
class ComboSelectionError:
    reason: str
    combo_item_id: int | None = None
    product_id: int | None = None


def validate_combo_selections(
    components: Sequence[ComboComponentDef],
    selections: Sequence[SelectionPicks],
) -> ComboSelectionError | None:
    """Structural checks for one combo unit: every component selected exactly
    once, pick counts match quantities, picks belong to the component. Option
    validation per pick is the caller's job (A8 validate_option_selection)."""
    by_component: dict[int, SelectionPicks] = {}
    known = {c.combo_item_id for c in components}
    for sel in selections:
        if sel.combo_item_id not in known or sel.combo_item_id in by_component:
            return ComboSelectionError(
                reason="component_selection_missing", combo_item_id=sel.combo_item_id
            )
        by_component[sel.combo_item_id] = sel

    for comp in components:
        pick = by_component.get(comp.combo_item_id)
        if pick is None:
            return ComboSelectionError(
                reason="component_selection_missing", combo_item_id=comp.combo_item_id
            )
        if len(pick.product_ids) != comp.quantity:
            return ComboSelectionError(
                reason="pick_count_mismatch", combo_item_id=comp.combo_item_id
            )
        for pid in pick.product_ids:
            if comp.fixed_product_id is not None:
                if pid != comp.fixed_product_id:
                    return ComboSelectionError(
                        reason="product_mismatch_fixed_component",
                        combo_item_id=comp.combo_item_id,
                        product_id=pid,
                    )
            elif comp.eligible_product_ids is None or pid not in comp.eligible_product_ids:
                return ComboSelectionError(
                    reason="product_not_in_slot_category",
                    combo_item_id=comp.combo_item_id,
                    product_id=pid,
                )
    return None
