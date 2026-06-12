"""U3 – authoritative cart quote (public, non-mutating).

Resolves real prices from the catalog and runs the domain pricing pipeline.
The client never supplies money. Address is optional: absent => preview mode
(no delivery fee, no service-area check). Combo lines use A10 resolved pricing.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import APIError
from app.domain.combo_slots import (
    ComboComponentDef,
    SelectionPicks,
    combo_line_pricing,
    pick_surcharge,
    validate_combo_selections,
)
from app.domain.combos import ComboStatus, combo_status
from app.domain.options import SelectableOption, validate_option_selection
from app.domain.pricing import (
    CartLine,
    PricingError,
    compute_order_total,
    compute_unit_price,
)
from app.infra.db.combo_queries import slot_availability
from app.infra.db.deps import get_db
from app.infra.db.models import Combo, ComboItem, Option, OptionGroup, Product, ProductOption

router = APIRouter(prefix="/api/cart", tags=["cart"])


class QuoteAddressIn(BaseModel):
    administrative_unit: str
    street: str | None = None


class ItemQuoteLineIn(BaseModel):
    kind: Literal["item"]
    item_id: int
    option_ids: list[int] = Field(default_factory=list)
    quantity: int = Field(ge=1)

    model_config = {"extra": "forbid"}


class ComboPickIn(BaseModel):
    product_id: int
    option_ids: list[int] = Field(default_factory=list)

    model_config = {"extra": "forbid"}


class ComboSelectionIn(BaseModel):
    combo_item_id: int
    picks: list[ComboPickIn]

    model_config = {"extra": "forbid"}


class ComboQuoteLineIn(BaseModel):
    kind: Literal["combo"]
    combo_id: int
    selections: list[ComboSelectionIn]
    quantity: int = Field(ge=1)

    model_config = {"extra": "forbid"}


QuoteLineIn = Annotated[ItemQuoteLineIn | ComboQuoteLineIn, Field(discriminator="kind")]


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


def _selection_error(err) -> APIError:
    details: dict[str, object] = {"reason": err.reason}
    if err.combo_item_id is not None:
        details["combo_item_id"] = err.combo_item_id
    if err.product_id is not None:
        details["product_id"] = err.product_id
    return APIError(
        code="VALIDATION_FAILED",
        message="Invalid combo selection.",
        status_code=400,
        details=details,
    )


def _combo_not_active() -> APIError:
    return APIError(
        code="VALIDATION_FAILED",
        message="Combo is not available.",
        status_code=400,
        details={"reason": "combo_not_active"},
    )


def pick_option_deltas(db: Session, product: Product, option_ids: list[int]) -> list[int]:
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
    selected = list(dict.fromkeys(option_ids))
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
    return [deltas_by_id[oid] for oid in selected]


def pick_option_snapshots(
    db: Session, product: Product, option_ids: list[int]
) -> list[tuple[str, str, int]]:
    rows = db.execute(
        select(Option, OptionGroup)
        .join(OptionGroup, Option.group_id == OptionGroup.group_id)
        .join(ProductOption, ProductOption.option_id == Option.option_id)
        .where(ProductOption.product_id == product.product_id)
        .order_by(OptionGroup.sort_order, Option.sort_order)
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
    name_by_id = {option.option_id: (group.name, option.name) for option, group in rows}
    selected = list(dict.fromkeys(option_ids))
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
    return [(name_by_id[oid][0], name_by_id[oid][1], deltas_by_id[oid]) for oid in selected]


def resolve_item_line(db: Session, line: ItemQuoteLineIn) -> CartLine:
    product = db.scalar(
        select(Product).where(Product.product_id == line.item_id, Product.is_active.is_(True))
    )
    if product is None:
        raise _bad("Unknown or inactive product.")

    deltas = pick_option_deltas(db, product, line.option_ids)
    unit = compute_unit_price(base_price_vnd=product.base_price_vnd, option_deltas_vnd=deltas)
    return CartLine(unit_price_vnd=unit, quantity=line.quantity)


def resolve_combo_line(db: Session, line: ComboQuoteLineIn) -> tuple[CartLine, int]:
    """Returns (CartLine for the order-total pipeline, combo discount for this line)."""
    combo = db.scalar(
        select(Combo)
        .where(Combo.combo_id == line.combo_id)
        .options(
            selectinload(Combo.combo_items).selectinload(ComboItem.product),
        )
    )
    now = datetime.now(UTC).replace(tzinfo=None)
    status = combo_status(combo.validity_start, combo.validity_end, now) if combo else None
    if combo is None or status is not ComboStatus.ACTIVE:
        raise _combo_not_active()

    rows = sorted(combo.combo_items, key=lambda ci: ci.combo_item_id)
    fixed = [ci for ci in rows if ci.product_id is not None]
    slots = [ci for ci in rows if ci.category_id is not None]
    if any(not ci.product.is_active for ci in fixed):
        raise _combo_not_active()
    availability = slot_availability(db, [ci.category_id for ci in slots])
    if any(availability[ci.category_id] is None for ci in slots):
        raise _combo_not_active()

    eligible_by_category: dict[int, frozenset[int]] = {}
    for ci in slots:
        ids = db.scalars(
            select(Product.product_id).where(
                Product.category_id == ci.category_id, Product.is_active.is_(True)
            )
        ).all()
        eligible_by_category[ci.category_id] = frozenset(ids)

    components = [
        ComboComponentDef(
            combo_item_id=ci.combo_item_id,
            quantity=ci.quantity,
            fixed_product_id=ci.product_id,
            eligible_product_ids=(
                eligible_by_category[ci.category_id] if ci.category_id is not None else None
            ),
        )
        for ci in rows
    ]
    selections = [
        SelectionPicks(combo_item_id=s.combo_item_id, product_ids=[p.product_id for p in s.picks])
        for s in line.selections
    ]
    err = validate_combo_selections(components, selections)
    if err is not None:
        raise _selection_error(err)

    ref_by_component: dict[int, int] = {}
    for ci in slots:
        reference = availability[ci.category_id]
        assert reference is not None
        ref_by_component[ci.combo_item_id] = reference
    reference_total = sum(ci.product.base_price_vnd * ci.quantity for ci in fixed) + sum(
        ref_by_component[ci.combo_item_id] * ci.quantity for ci in slots
    )

    surcharges: list[int] = []
    option_deltas: list[int] = []
    for sel in line.selections:
        for pick in sel.picks:
            product = db.get(Product, pick.product_id)
            assert product is not None
            if sel.combo_item_id in ref_by_component:
                surcharges.append(
                    pick_surcharge(product.base_price_vnd, ref_by_component[sel.combo_item_id])
                )
            option_deltas.extend(pick_option_deltas(db, product, pick.option_ids))

    pricing = combo_line_pricing(
        combo_price_vnd=combo.combo_price_vnd,
        reference_total_vnd=reference_total,
        surcharges_vnd=surcharges,
        option_deltas_vnd=option_deltas,
    )
    unit = pricing.line_charged_vnd + pricing.discount_vnd
    discount = pricing.discount_vnd * line.quantity
    return CartLine(unit_price_vnd=unit, quantity=line.quantity), discount


@router.post("/quote", response_model=CartQuoteOut)
def quote_cart(
    payload: CartQuoteIn, db: Session = Depends(get_db, scope="function")
) -> CartQuoteOut:
    lines: list[CartLine] = []
    combo_discount = 0
    for line in payload.lines:
        if isinstance(line, ComboQuoteLineIn):
            cart_line, discount = resolve_combo_line(db, line)
            lines.append(cart_line)
            combo_discount += discount
        else:
            lines.append(resolve_item_line(db, line))
    district = payload.address.administrative_unit if payload.address else None
    try:
        quote = compute_order_total(
            lines=lines,
            address_district=district,
            combo_discount_vnd=combo_discount,
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
