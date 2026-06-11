"""U3/U5 – authoritative cart quote (public, non-mutating).

Resolves real prices from the catalog and runs the domain pricing pipeline.
The client never supplies money. Address is optional: absent => preview mode
(no delivery fee, no service-area check). Item and combo lines are supported.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.domain.pricing import CartLine, PricingError, compute_order_total
from app.infra.db.deps import get_db
from app.services.orders import resolve_line

router = APIRouter(prefix="/api/cart", tags=["cart"])


class QuoteAddressIn(BaseModel):
    administrative_unit: str
    street: str | None = None


class QuoteLineIn(BaseModel):
    kind: Literal["item", "combo"]
    item_id: int | None = None
    combo_id: int | None = None
    option_ids: list[int] = Field(default_factory=list)
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


def _resolve_line(db: Session, line: QuoteLineIn) -> CartLine:
    resolved = resolve_line(
        db,
        kind=line.kind,
        item_id=line.item_id,
        combo_id=line.combo_id,
        option_ids=line.option_ids,
        quantity=line.quantity,
    )
    return resolved.to_cart_line()


@router.post("/quote", response_model=CartQuoteOut)
def quote_cart(
    payload: CartQuoteIn, db: Session = Depends(get_db, scope="function")
) -> CartQuoteOut:
    lines = [_resolve_line(db, line) for line in payload.lines]
    district = payload.address.administrative_unit if payload.address else None
    try:
        quote = compute_order_total(
            lines=lines,
            address_district=district,
            redeem_points=payload.redeem_points,
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
