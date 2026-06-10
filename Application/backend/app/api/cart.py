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
from app.domain.options import SelectableOption, validate_option_selection
from app.domain.pricing import (
    CartLine,
    PricingError,
    compute_order_total,
    compute_unit_price,
)
from app.infra.db.deps import get_db
from app.infra.db.models import Option, OptionGroup, Product, ProductOption

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

    rows = db.execute(
        select(Option, OptionGroup)
        .join(OptionGroup, Option.group_id == OptionGroup.group_id)
        .join(ProductOption, ProductOption.option_id == Option.option_id)
        .where(ProductOption.product_id == product.product_id)
    ).all()
    available = [
        SelectableOption(
            option_id=option.option_id,
            group_id=group.group_id,
            group_name=group.name,
            select_type=group.select_type,
            required=group.required,
        )
        for option, group in rows
    ]
    deltas_by_id = {option.option_id: option.price_delta_vnd for option, _ in rows}

    selected = list(dict.fromkeys(line.option_ids))
    err = validate_option_selection(available, selected)
    if err is not None:
        details: dict[str, object] = {"reason": err.reason}
        if err.group_name is not None:
            details["group_name"] = err.group_name
        if err.option_id is not None:
            details["option_id"] = err.option_id
        raise APIError(
            code="VALIDATION_FAILED",
            message="Invalid option selection.",
            status_code=400,
            details=details,
        )

    unit = compute_unit_price(
        base_price_vnd=product.base_price_vnd,
        option_deltas_vnd=[deltas_by_id[oid] for oid in selected],
    )
    return CartLine(unit_price_vnd=unit, quantity=line.quantity)


@router.post("/quote", response_model=CartQuoteOut)
def quote_cart(payload: CartQuoteIn, db: Session = Depends(get_db)) -> CartQuoteOut:
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