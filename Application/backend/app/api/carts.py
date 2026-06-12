"""U5 — session-bound server cart (guest + customer)."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.cart import (
    CartQuoteOut,
    ComboPickIn,
    ComboQuoteLineIn,
    ComboSelectionIn,
    ItemQuoteLineIn,
    QuoteAddressIn,
    QuoteLoyaltyOut,
    resolve_combo_line,
    resolve_item_line,
)
from app.api.cart_store import ensure_cart, load_cart, touch_and_gc
from app.core.errors import APIError
from app.domain.cart_payload import canonical_payload
from app.domain.pricing import CartLine as PricingLine
from app.domain.pricing import PricingError, compute_order_total
from app.infra.auth.csrf import enforce_csrf
from app.infra.auth.session_state import ensure_csrf_token
from app.infra.config import Settings, get_settings_dependency
from app.infra.db.deps import get_db
from app.infra.db.models import Cart, CartLine, Combo, ComboItem, Option, OptionGroup, Product

router = APIRouter(prefix="/api/cart", tags=["cart"])


class CartLineNoteIn(BaseModel):
    quantity: int | None = Field(default=None, ge=1, le=99)
    note: str | None = Field(default=None, max_length=255)


class AddItemLineIn(ItemQuoteLineIn):
    note: str | None = Field(default=None, max_length=255)
    quantity: int = Field(ge=1, le=99)


class AddComboLineIn(ComboQuoteLineIn):
    quantity: int = Field(ge=1, le=99)


# quantity is capped here, not on the shared quote models — /api/cart/quote
# previews stay uncapped, only persisted cart lines are bounded.
AddLineIn = Annotated[AddItemLineIn | AddComboLineIn, Field(discriminator="kind")]


class CartLineOut(BaseModel):
    line_id: int
    kind: str
    quantity: int
    note: str | None
    payload: dict[str, Any]
    name: str
    image_url: str | None
    descriptor: str | None
    picks: list[dict[str, str | None]] | None
    unit_price_vnd: int | None
    line_total_vnd: int | None
    unavailable: bool


class CartOut(BaseModel):
    lines: list[CartLineOut]
    quote: CartQuoteOut
    csrf_token: str


class CheckoutQuoteIn(BaseModel):
    address: QuoteAddressIn | None = None
    redeem_points: int = Field(default=0, ge=0)


def _set_csrf_cookie(response: Response, settings: Settings, csrf_token: str) -> None:
    response.set_cookie(
        key=settings.csrf_cookie_name,
        value=csrf_token,
        max_age=settings.session_max_age_seconds,
        secure=settings.session_https_only,
        httponly=False,
        samesite=settings.session_same_site,
        path="/",
    )


def _zeroed_quote() -> CartQuoteOut:
    loyalty = QuoteLoyaltyOut(balance=0, redeemed=0, max_redeemable=0)
    return CartQuoteOut(
        subtotal_vnd=0,
        discount_combo_vnd=0,
        discount_loyalty_vnd=0,
        delivery_fee_vnd=0,
        total_vnd=0,
        loyalty=loyalty,
    )


def _option_descriptor(db: Session, product_id: int, option_ids: list[int]) -> str | None:
    if not option_ids:
        return None
    rows = db.execute(
        select(Option.name, OptionGroup.name, OptionGroup.sort_order, Option.sort_order)
        .join(OptionGroup, Option.group_id == OptionGroup.group_id)
        .where(Option.option_id.in_(option_ids))
        .order_by(OptionGroup.sort_order, OptionGroup.name, Option.sort_order, Option.name)
    ).all()
    if not rows:
        return None
    by_group: dict[str, list[str]] = {}
    group_order: list[str] = []
    for opt_name, group_name, _, _ in rows:
        if group_name not in by_group:
            by_group[group_name] = []
            group_order.append(group_name)
        by_group[group_name].append(opt_name)
    parts = [f"{g}: {', '.join(by_group[g])}" for g in group_order]
    return " · ".join(parts)


def _item_display(db: Session, payload: dict[str, Any]) -> tuple[str, str | None, str | None]:
    product = db.get(Product, payload["item_id"])
    if product is None:
        return "Unknown item", None, None
    descriptor = _option_descriptor(db, product.product_id, payload.get("option_ids", []))
    return product.name, product.image_url, descriptor


def _combo_picks_display(
    db: Session, payload: dict[str, Any]
) -> tuple[str, str | None, list[dict[str, str | None]]]:
    combo = db.scalar(
        select(Combo)
        .where(Combo.combo_id == payload["combo_id"])
        .options(selectinload(Combo.combo_items).selectinload(ComboItem.product))
    )
    if combo is None:
        return "Unknown combo", None, []
    selections_by_ci = {s["combo_item_id"]: s for s in payload.get("selections", [])}
    picks_out: list[dict[str, str | None]] = []
    for ci in sorted(combo.combo_items, key=lambda x: x.combo_item_id):
        if ci.product_id is not None and ci.product is not None:
            picks_out.append({"name": ci.product.name, "descriptor": None})
            continue
        sel = selections_by_ci.get(ci.combo_item_id)
        if sel is None:
            continue
        for pick in sel.get("picks", []):
            product = db.get(Product, pick["product_id"])
            if product is None:
                continue
            descriptor = _option_descriptor(db, product.product_id, pick.get("option_ids", []))
            picks_out.append({"name": product.name, "descriptor": descriptor})
    return combo.name, combo.image_url, picks_out


def _quote_line_from_row(db: Session, row: CartLine) -> ItemQuoteLineIn | ComboQuoteLineIn:
    p = row.payload
    if p["kind"] == "item":
        return ItemQuoteLineIn(
            kind="item",
            item_id=p["item_id"],
            option_ids=p.get("option_ids", []),
            quantity=row.quantity,
        )
    selections = [
        ComboSelectionIn(
            combo_item_id=s["combo_item_id"],
            picks=[
                ComboPickIn(product_id=pick["product_id"], option_ids=pick.get("option_ids", []))
                for pick in s["picks"]
            ],
        )
        for s in p["selections"]
    ]
    return ComboQuoteLineIn(
        kind="combo",
        combo_id=p["combo_id"],
        selections=selections,
        quantity=row.quantity,
    )


def quote_session_cart(
    db: Session,
    cart: Cart | None,
    address: QuoteAddressIn | None,
    redeem_points: int,
) -> CartQuoteOut:
    if cart is None or not cart.lines:
        raise APIError(
            code="VALIDATION_FAILED",
            message="Cart is empty.",
            status_code=400,
        )
    pricing_lines: list[PricingLine] = []
    combo_discount = 0
    any_available = False
    for row in cart.lines:
        quote_line = _quote_line_from_row(db, row)
        try:
            if isinstance(quote_line, ComboQuoteLineIn):
                pl, discount = resolve_combo_line(db, quote_line)
                pricing_lines.append(pl)
                combo_discount += discount
                any_available = True
            else:
                pricing_lines.append(resolve_item_line(db, quote_line))
                any_available = True
        except APIError:
            continue
    if not any_available:
        raise APIError(
            code="VALIDATION_FAILED",
            message="Cart is empty.",
            status_code=400,
        )
    district = address.administrative_unit if address else None
    try:
        quote = compute_order_total(
            lines=pricing_lines,
            address_district=district,
            combo_discount_vnd=combo_discount,
            redeem_points=redeem_points,
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


def _render_cart(
    db: Session,
    request: Request,
    response: Response,
    settings: Settings,
    *,
    preview_quote: bool = True,
) -> CartOut:
    cart = load_cart(db, request)
    pricing_lines: list[PricingLine] = []
    combo_discount = 0
    line_outs: list[CartLineOut] = []

    rows = cart.lines if cart is not None else []
    for row in rows:
        p = row.payload
        kind = p["kind"]
        unavailable = False
        unit_price: int | None = None
        line_total: int | None = None
        name = ""
        image_url: str | None = None
        descriptor: str | None = None
        picks: list[dict[str, str | None]] | None = None

        quote_line = _quote_line_from_row(db, row)
        try:
            if isinstance(quote_line, ComboQuoteLineIn):
                pl, discount = resolve_combo_line(db, quote_line)
                pricing_lines.append(pl)
                combo_discount += discount
                unit_price = pl.unit_price_vnd
                line_total = pl.unit_price_vnd * pl.quantity
                name, image_url, picks = _combo_picks_display(db, p)
            else:
                pl = resolve_item_line(db, quote_line)
                pricing_lines.append(pl)
                unit_price = pl.unit_price_vnd
                line_total = pl.unit_price_vnd * pl.quantity
                name, image_url, descriptor = _item_display(db, p)
        except APIError:
            unavailable = True
            if kind == "item":
                name, image_url, descriptor = _item_display(db, p)
            else:
                name, image_url, picks = _combo_picks_display(db, p)

        line_outs.append(
            CartLineOut(
                line_id=row.line_id,
                kind=kind,
                quantity=row.quantity,
                note=row.note,
                payload=p,
                name=name,
                image_url=image_url,
                descriptor=descriptor,
                picks=picks,
                unit_price_vnd=unit_price,
                line_total_vnd=line_total,
                unavailable=unavailable,
            )
        )

    if preview_quote:
        if pricing_lines:
            try:
                quote = compute_order_total(
                    lines=pricing_lines,
                    address_district=None,
                    combo_discount_vnd=combo_discount,
                    redeem_points=0,
                    current_points=0,
                )
                quote_out = CartQuoteOut(
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
            except PricingError:
                quote_out = _zeroed_quote()
        else:
            quote_out = _zeroed_quote()
    else:
        quote_out = _zeroed_quote()

    csrf_token = ensure_csrf_token(request)
    _set_csrf_cookie(response, settings, csrf_token)
    return CartOut(lines=line_outs, quote=quote_out, csrf_token=csrf_token)


def _line_in_session(cart: Cart, line_id: int) -> CartLine | None:
    for row in cart.lines:
        if row.line_id == line_id:
            return row
    return None


@router.get("", response_model=CartOut)
def get_cart(
    request: Request,
    response: Response,
    db: Session = Depends(get_db, scope="function"),
    settings: Settings = Depends(get_settings_dependency),
) -> CartOut:
    return _render_cart(db, request, response, settings)


@router.post("/lines", response_model=CartOut, dependencies=[Depends(enforce_csrf)])
def add_cart_line(
    body: AddLineIn,
    request: Request,
    response: Response,
    db: Session = Depends(get_db, scope="function"),
    settings: Settings = Depends(get_settings_dependency),
) -> CartOut:
    note: str | None = None
    if isinstance(body, AddItemLineIn):
        resolve_item_line(db, body)
        raw: dict[str, Any] = {
            "kind": "item",
            "item_id": body.item_id,
            "option_ids": body.option_ids,
        }
        note = body.note
        quantity = body.quantity
    else:
        resolve_combo_line(db, body)
        raw = {
            "kind": "combo",
            "combo_id": body.combo_id,
            "selections": [
                {
                    "combo_item_id": s.combo_item_id,
                    "picks": [
                        {"product_id": p.product_id, "option_ids": p.option_ids} for p in s.picks
                    ],
                }
                for s in body.selections
            ],
        }
        quantity = body.quantity

    cart = ensure_cart(db, request)
    stored = canonical_payload(raw)
    db.add(
        CartLine(
            cart_id=cart.cart_id,
            payload=stored,
            quantity=quantity,
            note=note,
        )
    )
    touch_and_gc(db, cart)
    db.commit()
    db.refresh(cart)
    return _render_cart(db, request, response, settings)


@router.patch("/lines/{line_id}", response_model=CartOut, dependencies=[Depends(enforce_csrf)])
def patch_cart_line(
    line_id: int,
    body: CartLineNoteIn,
    request: Request,
    response: Response,
    db: Session = Depends(get_db, scope="function"),
    settings: Settings = Depends(get_settings_dependency),
) -> CartOut:
    cart = load_cart(db, request)
    if cart is None:
        raise APIError(code="NOT_FOUND", message="Cart line not found.", status_code=404)
    row = _line_in_session(cart, line_id)
    if row is None:
        raise APIError(code="NOT_FOUND", message="Cart line not found.", status_code=404)
    note_provided = "note" in body.model_fields_set
    new_note = body.note or None  # "" clears too — NULL keeps the merge dedupe key single-valued
    if note_provided and new_note is not None and row.payload.get("kind") == "combo":
        raise APIError(
            code="VALIDATION_FAILED",
            message="Combo lines cannot have notes.",
            status_code=400,
        )
    if body.quantity is not None:
        row.quantity = body.quantity
    if note_provided:
        row.note = new_note
    touch_and_gc(db, cart)
    db.commit()
    db.refresh(cart)
    return _render_cart(db, request, response, settings)


@router.delete("/lines/{line_id}", response_model=CartOut, dependencies=[Depends(enforce_csrf)])
def delete_cart_line(
    line_id: int,
    request: Request,
    response: Response,
    db: Session = Depends(get_db, scope="function"),
    settings: Settings = Depends(get_settings_dependency),
) -> CartOut:
    cart = load_cart(db, request)
    if cart is None:
        raise APIError(code="NOT_FOUND", message="Cart line not found.", status_code=404)
    row = _line_in_session(cart, line_id)
    if row is None:
        raise APIError(code="NOT_FOUND", message="Cart line not found.", status_code=404)
    db.delete(row)
    touch_and_gc(db, cart)
    db.commit()
    db.refresh(cart)
    return _render_cart(db, request, response, settings)


@router.delete("", response_model=CartOut, dependencies=[Depends(enforce_csrf)])
def clear_cart(
    request: Request,
    response: Response,
    db: Session = Depends(get_db, scope="function"),
    settings: Settings = Depends(get_settings_dependency),
) -> CartOut:
    cart = load_cart(db, request)
    if cart is not None:
        for row in list(cart.lines):
            db.delete(row)
        touch_and_gc(db, cart)
        db.commit()
        db.refresh(cart)
    return _render_cart(db, request, response, settings)


@router.post("/checkout-quote", response_model=CartQuoteOut, dependencies=[Depends(enforce_csrf)])
def checkout_quote(
    body: CheckoutQuoteIn,
    request: Request,
    db: Session = Depends(get_db, scope="function"),
) -> CartQuoteOut:
    cart = load_cart(db, request)
    return quote_session_cart(db, cart, body.address, body.redeem_points)
