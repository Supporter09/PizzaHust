from __future__ import annotations

import pytest

from app.domain.loyalty import (
    INSUFFICIENT_LOYALTY_CODE,
    LOYALTY_ACCRUAL_RATE,
    LOYALTY_MAX_REDEEM_PCT,
    LOYALTY_REDEEM_VALUE_VND,
    LoyaltyError,
    compute_accrual_points,
    compute_redemption,
)


def test_loyalty_constants_match_product_contract() -> None:
    assert LOYALTY_ACCRUAL_RATE == 10_000
    assert LOYALTY_REDEEM_VALUE_VND == 1_000
    assert LOYALTY_MAX_REDEEM_PCT == 0.5


@pytest.mark.parametrize(
    ("subtotal_after_discount", "points"),
    [(0, 0), (9_999, 0), (10_000, 1), (125_000, 12)],
)
def test_compute_accrual_points_floor_divides_subtotal(
    subtotal_after_discount: int,
    points: int,
) -> None:
    assert compute_accrual_points(subtotal_after_discount) == points


def test_compute_redemption_over_cap_raises() -> None:
    # requested_points=100 > max_redeemable=40 (50% of 80_000 / 1_000) → must raise
    with pytest.raises(LoyaltyError) as exc_info:
        compute_redemption(
            requested_points=100,
            current_points=100,
            subtotal_after_combo_vnd=80_000,
        )

    assert exc_info.value.code == INSUFFICIENT_LOYALTY_CODE


def test_compute_redemption_uses_requested_points_when_under_cap() -> None:
    redemption = compute_redemption(
        requested_points=12,
        current_points=100,
        subtotal_after_combo_vnd=80_000,
    )

    assert redemption.redeemed_points == 12
    assert redemption.discount_vnd == 12_000
    assert redemption.max_redeemable_points == 40


def test_compute_redemption_rejects_more_than_balance() -> None:
    with pytest.raises(LoyaltyError) as exc_info:
        compute_redemption(
            requested_points=11,
            current_points=10,
            subtotal_after_combo_vnd=80_000,
        )

    assert exc_info.value.code == INSUFFICIENT_LOYALTY_CODE


def test_redemption_uses_injected_rates() -> None:
    # requested_points=100 > max_redeemable=30 (30% of 100_000 / 1_000) → must raise
    with pytest.raises(LoyaltyError) as exc_info:
        compute_redemption(
            requested_points=100,
            current_points=100,
            subtotal_after_combo_vnd=100_000,
            redeem_value_vnd=1_000,
            max_redeem_pct=0.3,
        )
    assert exc_info.value.code == INSUFFICIENT_LOYALTY_CODE


def test_accrual_uses_injected_rate() -> None:
    assert compute_accrual_points(100_000, accrual_rate=20_000) == 5
