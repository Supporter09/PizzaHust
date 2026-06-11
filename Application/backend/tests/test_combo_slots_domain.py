"""A10 domain: slot reference prices, pick surcharges, combo line pricing."""

from __future__ import annotations

import pytest

from app.domain.combo_slots import (
    ComboLinePricing,
    combo_line_pricing,
    pick_surcharge,
    slot_reference_price,
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
