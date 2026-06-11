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
