from __future__ import annotations

from dataclasses import dataclass

LOYALTY_ACCRUAL_RATE = 10_000
LOYALTY_REDEEM_VALUE_VND = 1_000
LOYALTY_MAX_REDEEM_PCT = 0.5
INSUFFICIENT_LOYALTY_CODE = "INSUFFICIENT_LOYALTY"


class LoyaltyError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        super().__init__(message)


@dataclass(frozen=True)
class LoyaltyRedemption:
    redeemed_points: int
    discount_vnd: int
    max_redeemable_points: int


def compute_accrual_points(subtotal_after_discount_vnd: int) -> int:
    if subtotal_after_discount_vnd <= 0:
        return 0
    return subtotal_after_discount_vnd // LOYALTY_ACCRUAL_RATE


def compute_redemption(
    *,
    requested_points: int,
    current_points: int,
    subtotal_after_combo_vnd: int,
) -> LoyaltyRedemption:
    if requested_points < 0 or current_points < 0 or subtotal_after_combo_vnd < 0:
        raise LoyaltyError(INSUFFICIENT_LOYALTY_CODE, "Loyalty values cannot be negative.")
    if requested_points > current_points:
        raise LoyaltyError(
            INSUFFICIENT_LOYALTY_CODE,
            "Redeemed points exceed the customer balance.",
        )

    max_discount_vnd = int(subtotal_after_combo_vnd * LOYALTY_MAX_REDEEM_PCT)
    max_redeemable_points = max_discount_vnd // LOYALTY_REDEEM_VALUE_VND
    redeemed_points = min(requested_points, max_redeemable_points)
    return LoyaltyRedemption(
        redeemed_points=redeemed_points,
        discount_vnd=redeemed_points * LOYALTY_REDEEM_VALUE_VND,
        max_redeemable_points=max_redeemable_points,
    )
