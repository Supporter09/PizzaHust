"""A10 domain: slot reference prices, pick surcharges, combo line pricing."""

from __future__ import annotations

import pytest

from app.domain.combo_slots import (
    ComboComponentDef,
    ComboLinePricing,
    ComboSelectionError,
    SelectionPicks,
    combo_line_pricing,
    pick_surcharge,
    slot_reference_price,
    validate_combo_selections,
)
from app.domain.pricing import PricingError


def test_reference_price_is_min():
    assert slot_reference_price([130_000, 120_000, 150_000]) == 120_000


def test_reference_price_single():
    assert slot_reference_price([99_000]) == 99_000


def test_surcharge_above_reference():
    assert pick_surcharge(130_000, 120_000) == 10_000


def test_surcharge_never_negative():
    assert pick_surcharge(100_000, 120_000) == 0


def test_line_pricing_saves():
    p = combo_line_pricing(
        combo_price_vnd=150_000,
        reference_total_vnd=200_000,
        surcharges_vnd=[10_000, 0],
        option_deltas_vnd=[15_000],
    )
    assert p == ComboLinePricing(
        line_full_value_vnd=225_000,
        line_charged_vnd=175_000,
        discount_vnd=50_000,
    )


def test_line_pricing_overpriced_combo_no_negative_discount():
    p = combo_line_pricing(
        combo_price_vnd=300_000,
        reference_total_vnd=200_000,
        surcharges_vnd=[],
        option_deltas_vnd=[],
    )
    assert p.discount_vnd == 0
    assert p.line_charged_vnd == 300_000
    assert p.line_full_value_vnd == 200_000


@pytest.mark.parametrize(
    "kwargs",
    [
        {
            "combo_price_vnd": -1,
            "reference_total_vnd": 0,
            "surcharges_vnd": [],
            "option_deltas_vnd": [],
        },
        {
            "combo_price_vnd": 0,
            "reference_total_vnd": -1,
            "surcharges_vnd": [],
            "option_deltas_vnd": [],
        },
        {
            "combo_price_vnd": 0,
            "reference_total_vnd": 0,
            "surcharges_vnd": [-1],
            "option_deltas_vnd": [],
        },
        {
            "combo_price_vnd": 0,
            "reference_total_vnd": 0,
            "surcharges_vnd": [],
            "option_deltas_vnd": [-1],
        },
    ],
)
def test_line_pricing_rejects_negative_inputs(kwargs):
    with pytest.raises(PricingError):
        combo_line_pricing(**kwargs)


FIXED = ComboComponentDef(
    combo_item_id=1, quantity=1, fixed_product_id=9, eligible_product_ids=None
)
SLOT = ComboComponentDef(
    combo_item_id=2, quantity=2, fixed_product_id=None, eligible_product_ids=frozenset({3, 5})
)


def _sel(component_id, *pids):
    return SelectionPicks(combo_item_id=component_id, product_ids=list(pids))


def test_selections_happy_path():
    err = validate_combo_selections([FIXED, SLOT], [_sel(1, 9), _sel(2, 3, 5)])
    assert err is None


def test_selections_slot_may_repeat_product():
    assert validate_combo_selections([SLOT], [_sel(2, 3, 3)]) is None


def test_selection_missing_component():
    err = validate_combo_selections([FIXED, SLOT], [_sel(1, 9)])
    assert err == ComboSelectionError(reason="component_selection_missing", combo_item_id=2)


def test_selection_unknown_component():
    err = validate_combo_selections([FIXED], [_sel(1, 9), _sel(99, 3)])
    assert err == ComboSelectionError(reason="component_selection_missing", combo_item_id=99)


def test_selection_duplicate_component():
    err = validate_combo_selections([FIXED], [_sel(1, 9), _sel(1, 9)])
    assert err == ComboSelectionError(reason="component_selection_missing", combo_item_id=1)


def test_pick_count_mismatch():
    err = validate_combo_selections([SLOT], [_sel(2, 3)])
    assert err == ComboSelectionError(reason="pick_count_mismatch", combo_item_id=2)


def test_pick_outside_slot_category():
    err = validate_combo_selections([SLOT], [_sel(2, 3, 77)])
    assert err == ComboSelectionError(
        reason="product_not_in_slot_category", combo_item_id=2, product_id=77
    )


def test_fixed_component_product_mismatch():
    err = validate_combo_selections([FIXED], [_sel(1, 3)])
    assert err == ComboSelectionError(
        reason="product_mismatch_fixed_component", combo_item_id=1, product_id=3
    )
