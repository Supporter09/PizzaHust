from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from app.domain.loyalty import LoyaltyError, compute_redemption
from app.domain.service_area import is_inner_hanoi

DELIVERY_FEE_VND = 22_000


class PricingError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        super().__init__(message)


@dataclass(frozen=True)
class CartLine:
    unit_price_vnd: int
    quantity: int


@dataclass(frozen=True)
class OrderQuote:
    subtotal_vnd: int
    discount_combo_vnd: int
    discount_loyalty_vnd: int
    delivery_fee_vnd: int
    total_vnd: int
    loyalty_balance: int
    loyalty_redeemed: int
    loyalty_max_redeemable: int


def _line_subtotal(line: CartLine) -> int:
    if line.unit_price_vnd < 0 or line.quantity <= 0:
        raise PricingError("VALIDATION_FAILED", "Cart line prices must be positive.")
    return line.unit_price_vnd * line.quantity


def compute_unit_price(*, base_price_vnd: int, option_deltas_vnd: Sequence[int]) -> int:
    """Unit price for one item line: base price plus the sum of selected option deltas."""
    return base_price_vnd + sum(option_deltas_vnd)


def compute_order_total(
    *,
    lines: list[CartLine],
    address_district: str | None = None,
    combo_discount_vnd: int = 0,
    redeem_points: int = 0,
    current_points: int = 0,
) -> OrderQuote:
    if combo_discount_vnd < 0:
        raise PricingError("VALIDATION_FAILED", "Combo discount cannot be negative.")
    delivery_fee_vnd = 0
    if address_district is not None:
        if not is_inner_hanoi(address_district):
            raise PricingError("OUT_OF_SERVICE_AREA", "Delivery address is outside inner Hanoi.")
        delivery_fee_vnd = DELIVERY_FEE_VND

    subtotal_vnd = sum(_line_subtotal(line) for line in lines)
    discount_combo_vnd = min(combo_discount_vnd, subtotal_vnd)
    subtotal_after_combo_vnd = subtotal_vnd - discount_combo_vnd
    try:
        redemption = compute_redemption(
            requested_points=redeem_points,
            current_points=current_points,
            subtotal_after_combo_vnd=subtotal_after_combo_vnd,
        )
    except LoyaltyError as exc:
        raise PricingError(exc.code, str(exc)) from exc

    total_vnd = max(
        0,
        subtotal_after_combo_vnd - redemption.discount_vnd + delivery_fee_vnd,
    )
    return OrderQuote(
        subtotal_vnd=subtotal_vnd,
        discount_combo_vnd=discount_combo_vnd,
        discount_loyalty_vnd=redemption.discount_vnd,
        delivery_fee_vnd=delivery_fee_vnd,
        total_vnd=total_vnd,
        loyalty_balance=current_points,
        loyalty_redeemed=redemption.redeemed_points,
        loyalty_max_redeemable=redemption.max_redeemable_points,
    )
