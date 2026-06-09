"""U3 – authoritative cart quote (public, non-mutating).

Resolves real prices from the catalog and runs the domain pricing pipeline.
The client never supplies money. Address is optional: absent => preview mode
(no delivery fee, no service-area check). Combo lines are deferred (U4/U5).
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.domain.pricing import (
    CartLine,
    PricingError,
    compute_order_total,
    compute_pizza_unit_price,
)
from app.infra.db.deps import get_db
from app.infra.db.models import PizzaCrust, PizzaSize, Product, Topping

router = APIRouter(prefix="/api/cart", tags=["cart"])


class QuoteAddressIn(BaseModel):
    administrative_unit: str
    street: str | None = None


class QuoteLineIn(BaseModel):
    kind: Literal["pizza", "side", "combo"]
    item_id: int | None = None
    combo_id: int | None = None
    size: str | None = None
    crust: str | None = None
    topping_ids: list[int] = Field(default_factory=list)
    quantity: int = Field(ge=1)


class CartQuoteIn(BaseModel):
    lines: list[QuoteLineIn] = Field(min_length=1)
    address: QuoteAddressIn | None = None
    redeem_points: int = Field(default=0, ge=0)


class QuoteLoyaltyOut(BaseModel):
    balance: int
    redeemed: int
    max_redeemable: int


class CartQuoteOut(BaseModel):
    subtotal_vnd: int
    discount_combo_vnd: int
    discount_loyalty_vnd: int
    delivery_fee_vnd: int
    total_vnd: int
    loyalty: QuoteLoyaltyOut


def _bad(message: str) -> APIError:
    return APIError(code="VALIDATION_FAILED", message=message, status_code=400)


def _resolve_line(db: Session, line: QuoteLineIn) -> CartLine:
    if line.kind == "combo":
        raise _bad("Combo lines are not supported yet.")
    if line.item_id is None:
        raise _bad("item_id is required.")
    product = db.scalar(
        select(Product).where(Product.product_id == line.item_id, Product.is_active.is_(True))
    )
    if product is None:
        raise _bad("Unknown or inactive product.")

    if line.kind == "pizza":
        if not product.is_pizza:
            raise _bad("Product is not a pizza.")
        size_modifier = 0
        if line.size is not None:
            size = db.scalar(select(PizzaSize).where(PizzaSize.name == line.size))
            if size is None:
                raise _bad("Unknown size.")
            size_modifier = size.price_modifier_vnd
        if line.crust is not None:
            # Crust has no price modifier in the schema; validate existence only.
            crust = db.scalar(select(PizzaCrust).where(PizzaCrust.name == line.crust))
            if crust is None:
                raise _bad("Unknown crust.")
        topping_prices: list[int] = []
        for tid in line.topping_ids:
            topping = db.scalar(select(Topping).where(Topping.topping_id == tid))
            if topping is None:
                raise _bad("Unknown topping.")
            topping_prices.append(topping.price_vnd)
        unit = compute_pizza_unit_price(
            base_price_vnd=product.base_price_vnd,
            size_modifier_vnd=size_modifier,
            topping_prices_vnd=topping_prices,
        )
        return CartLine(unit_price_vnd=unit, quantity=line.quantity)

    # kind == "side"
    if product.is_pizza:
        raise _bad("Product is a pizza, not a side.")
    if line.size or line.crust or line.topping_ids:
        raise _bad("Side items do not take size, crust, or toppings.")
    return CartLine(unit_price_vnd=product.base_price_vnd, quantity=line.quantity)


@router.post("/quote", response_model=CartQuoteOut)
def quote_cart(payload: CartQuoteIn, db: Session = Depends(get_db)) -> CartQuoteOut:
    lines = [_resolve_line(db, line) for line in payload.lines]
    district = payload.address.administrative_unit if payload.address else None
    try:
        quote = compute_order_total(
            lines=lines,
            address_district=district,
            redeem_points=payload.redeem_points,
            # Loyalty balance arrives in U13/U14; until then current_points=0, so any
            # redeem_points > 0 raises INSUFFICIENT_LOYALTY (422).
            current_points=0,
        )
    except PricingError as exc:
        status = 422 if exc.code in {"OUT_OF_SERVICE_AREA", "INSUFFICIENT_LOYALTY"} else 400
        raise APIError(code=exc.code, message=str(exc), status_code=status) from exc

    return CartQuoteOut(
        subtotal_vnd=quote.subtotal_vnd,
        discount_combo_vnd=quote.discount_combo_vnd,
        discount_loyalty_vnd=quote.discount_loyalty_vnd,
        delivery_fee_vnd=quote.delivery_fee_vnd,
        total_vnd=quote.total_vnd,
        loyalty=QuoteLoyaltyOut(
            balance=quote.loyalty_balance,
            redeemed=quote.loyalty_redeemed,
            max_redeemable=quote.loyalty_max_redeemable,
        ),
    )
