from __future__ import annotations

import pytest

from app.domain.pricing import (
    DELIVERY_FEE_VND,
    CartLine,
    OrderQuote,
    PricingError,
    compute_order_total,
    compute_unit_price,
)


def test_compute_unit_price_base_only():
    assert compute_unit_price(base_price_vnd=125_000, option_deltas_vnd=[]) == 125_000


def test_compute_unit_price_sums_deltas():
    assert (
        compute_unit_price(base_price_vnd=125_000, option_deltas_vnd=[30_000, 15_000, 20_000])
        == 190_000
    )


def test_delivery_fee_matches_product_contract() -> None:
    assert DELIVERY_FEE_VND == 22_000


def test_compute_order_total_applies_pipeline_order() -> None:
    quote = compute_order_total(
        lines=[
            CartLine(unit_price_vnd=120_000, quantity=1),
            CartLine(unit_price_vnd=50_000, quantity=2),
        ],
        address_district="Ba Đình",
        combo_discount_vnd=30_000,
        redeem_points=10,
        current_points=50,
    )

    assert quote == OrderQuote(
        subtotal_vnd=220_000,
        discount_combo_vnd=30_000,
        discount_loyalty_vnd=10_000,
        delivery_fee_vnd=22_000,
        total_vnd=202_000,
        loyalty_balance=50,
        loyalty_redeemed=10,
        loyalty_max_redeemable=95,
    )


def test_compute_order_total_caps_loyalty_to_half_after_combo_subtotal() -> None:
    quote = compute_order_total(
        lines=[CartLine(unit_price_vnd=100_000, quantity=1)],
        address_district="Hoàn Kiếm",
        redeem_points=100,
        current_points=100,
    )

    assert quote.discount_loyalty_vnd == 50_000
    assert quote.loyalty_redeemed == 50
    assert quote.total_vnd == 72_000


def test_compute_order_total_rejects_out_of_service_area() -> None:
    with pytest.raises(PricingError) as exc_info:
        compute_order_total(
            lines=[CartLine(unit_price_vnd=100_000, quantity=1)],
            address_district="Thu Duc",
        )

    assert exc_info.value.code == "OUT_OF_SERVICE_AREA"


def test_compute_order_total_rejects_negative_line_values() -> None:
    with pytest.raises(PricingError):
        compute_order_total(
            lines=[CartLine(unit_price_vnd=-1, quantity=1)],
            address_district="Ba Đình",
        )


def test_compute_order_total_preview_mode_no_address() -> None:
    quote = compute_order_total(
        lines=[CartLine(unit_price_vnd=100_000, quantity=1)],
        address_district=None,
    )
    assert quote.delivery_fee_vnd == 0
    assert quote.total_vnd == 100_000
    assert quote.subtotal_vnd == 100_000


def test_compute_order_total_default_address_is_preview() -> None:
    # Called with no address kwarg at all -> preview, no service-area error.
    quote = compute_order_total(lines=[CartLine(unit_price_vnd=50_000, quantity=2)])
    assert quote.delivery_fee_vnd == 0
    assert quote.total_vnd == 100_000
