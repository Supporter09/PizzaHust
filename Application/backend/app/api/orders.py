"""U6 — place COD order from the session cart."""

from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from app.api.cart import (
    CartQuoteOut,
    ComboQuoteLineIn,
    ItemQuoteLineIn,
    QuoteAddressIn,
    QuoteLoyaltyOut,
    pick_option_snapshots,
    resolve_combo_line,
    resolve_item_line,
)
from app.api.cart_store import load_cart, now_naive_utc
from app.api.carts import _quote_line_from_row
from app.core.errors import APIError
from app.domain.combo_slots import pick_surcharge
from app.domain.loyalty import compute_accrual_points
from app.domain.order_code import generate_order_code
from app.domain.pricing import CartLine as PricingLine
from app.domain.pricing import PricingError, compute_order_total
from app.infra import settings_service
from app.infra.auth.csrf import enforce_csrf
from app.infra.auth.rate_limit import enforce_track_rate_limit
from app.infra.auth.session_state import read_session
from app.infra.config import Settings, get_settings_dependency
from app.infra.db.combo_queries import slot_availability
from app.infra.db.deps import get_db
from app.infra.db.models import (
    CartLine,
    Combo,
    ComboItem,
    Order,
    OrderItem,
    OrderItemOption,
    OrderStatus,
    OrderTracking,
    Product,
    User,
)

router = APIRouter(prefix="/api/orders", tags=["orders"])


class OrderAddressIn(BaseModel):
    administrative_unit: str
    street: str = Field(min_length=1, max_length=200)


class PlaceOrderIn(BaseModel):
    recipient_name: str = Field(min_length=1, max_length=100)
    recipient_phone: str = Field(pattern=r"^0(3|5|7|8|9)\d{8}$")
    address: OrderAddressIn
    delivery_note: str | None = Field(default=None, max_length=255)
    redeem_points: int = Field(default=0, ge=0)


class PlaceOrderOut(BaseModel):
    order_code: str
    total_vnd: int
    status: str
    promised_at: datetime


class TrackTimelineEntry(BaseModel):
    status: str
    at: datetime


class TrackOut(BaseModel):
    order_code: str
    status: str
    timeline: list[TrackTimelineEntry]
    recipient_first_name: str
    phone_last4: str
    address_masked: str
    delivery_note: str | None
    promised_at: datetime


def given_name(full_name: str) -> str:
    return full_name.strip().split()[-1] if full_name.strip() else ""


def mask_address(ward: str | None) -> str:
    return f"***, {ward}, Hà Nội" if ward else "***, Hà Nội"


def unique_order_code(db: Session) -> str:
    for _ in range(3):
        code = generate_order_code()
        if db.scalar(select(Order.order_id).where(Order.order_code == code)) is None:
            return code
    raise APIError(
        code="INTERNAL_ERROR",
        message="Could not allocate order code.",
        status_code=500,
    )


def _attach_api_line_id(exc: APIError, line_id: int) -> APIError:
    details = dict(exc.details or {})
    details["line_id"] = line_id
    return APIError(
        code=exc.code,
        message=exc.message,
        status_code=exc.status_code,
        details=details,
    )


def quote_cart_for_placement(
    db: Session,
    cart_lines: list[CartLine],
    address: QuoteAddressIn,
    redeem_points: int,
    current_points: int = 0,
) -> tuple[CartQuoteOut, list[PricingLine], int]:
    pricing_lines: list[PricingLine] = []
    combo_discount = 0
    for row in cart_lines:
        quote_line = _quote_line_from_row(db, row)
        try:
            if isinstance(quote_line, ComboQuoteLineIn):
                pl, discount = resolve_combo_line(db, quote_line)
                pricing_lines.append(pl)
                combo_discount += discount
            else:
                pricing_lines.append(resolve_item_line(db, quote_line))
        except APIError as exc:
            raise _attach_api_line_id(exc, row.line_id) from exc
    district = address.administrative_unit
    ward_fees = settings_service.get_ward_fees(db)
    s = settings_service.get_business_settings(db)
    try:
        quote = compute_order_total(
            lines=pricing_lines,
            address_district=district,
            combo_discount_vnd=combo_discount,
            redeem_points=redeem_points,
            current_points=current_points,
            ward_fees=ward_fees,
            redeem_value_vnd=s.loyalty_redeem_value_vnd,
            max_redeem_pct=s.loyalty_max_redeem_pct,
        )
    except PricingError as exc:
        status = 422 if exc.code in {"OUT_OF_SERVICE_AREA", "INSUFFICIENT_LOYALTY"} else 400
        raise APIError(code=exc.code, message=str(exc), status_code=status) from exc
    out = CartQuoteOut(
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
    return out, pricing_lines, combo_discount


def _persist_item_line(
    db: Session,
    order: Order,
    row: CartLine,
    quote_line: ItemQuoteLineIn,
    pricing: PricingLine,
) -> None:
    product = db.get(Product, quote_line.item_id)
    assert product is not None
    item = OrderItem(
        order_id=order.order_id,
        product_id=product.product_id,
        quantity=pricing.quantity,
        unit_price_vnd=pricing.unit_price_vnd,
        notes=row.note,
    )
    db.add(item)
    db.flush()
    for group_name, option_name, delta in pick_option_snapshots(db, product, quote_line.option_ids):
        db.add(
            OrderItemOption(
                order_item_id=item.order_item_id,
                group_name=group_name,
                option_name=option_name,
                price_delta_vnd=delta,
            )
        )


def _persist_combo_line(
    db: Session,
    order: Order,
    row: CartLine,
    quote_line: ComboQuoteLineIn,
) -> None:
    combo = db.scalar(
        select(Combo)
        .where(Combo.combo_id == quote_line.combo_id)
        .options(selectinload(Combo.combo_items).selectinload(ComboItem.product))
    )
    assert combo is not None
    rows = sorted(combo.combo_items, key=lambda ci: ci.combo_item_id)
    slots = [ci for ci in rows if ci.category_id is not None]
    availability = slot_availability(db, [ci.category_id for ci in slots])
    ref_by_component: dict[int, int] = {}
    for ci in slots:
        reference = availability[ci.category_id]
        assert reference is not None
        ref_by_component[ci.combo_item_id] = reference

    parent = OrderItem(
        order_id=order.order_id,
        combo_id=combo.combo_id,
        quantity=quote_line.quantity,
        unit_price_vnd=combo.combo_price_vnd,
        notes=row.note,
    )
    db.add(parent)
    db.flush()

    picks_by_sel = {s.combo_item_id: s.picks for s in quote_line.selections}
    for ci in rows:
        picks = picks_by_sel.get(ci.combo_item_id, [])
        for pick in picks:
            product = db.get(Product, pick.product_id)
            assert product is not None
            surcharge = 0
            if ci.combo_item_id in ref_by_component:
                surcharge = pick_surcharge(
                    product.base_price_vnd, ref_by_component[ci.combo_item_id]
                )
            snapshots = pick_option_snapshots(db, product, pick.option_ids)
            option_total = sum(s[2] for s in snapshots)
            child = OrderItem(
                order_id=order.order_id,
                product_id=product.product_id,
                parent_order_item_id=parent.order_item_id,
                quantity=quote_line.quantity,
                unit_price_vnd=surcharge + option_total,
                notes=None,
            )
            db.add(child)
            db.flush()
            for group_name, option_name, delta in snapshots:
                db.add(
                    OrderItemOption(
                        order_item_id=child.order_item_id,
                        group_name=group_name,
                        option_name=option_name,
                        price_delta_vnd=delta,
                    )
                )


@router.get(
    "/track/{code}",
    response_model=TrackOut,
    dependencies=[Depends(enforce_track_rate_limit)],
)
def track_order(code: str, db: Session = Depends(get_db, scope="function")) -> TrackOut:
    normalized = code.strip().upper()
    order = db.scalar(
        select(Order).where(Order.order_code == normalized).options(selectinload(Order.tracking))
    )
    if order is None:
        raise APIError(
            code="NOT_FOUND",
            message="Order not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    timeline_rows = sorted(order.tracking, key=lambda t: t.created_at)
    return TrackOut(
        order_code=order.order_code,
        status=order.current_status.value,
        timeline=[
            TrackTimelineEntry(status=row.status.value, at=row.created_at) for row in timeline_rows
        ],
        recipient_first_name=given_name(order.recipient_name),
        phone_last4=order.recipient_phone[-4:],
        address_masked=mask_address(order.delivery_ward),
        delivery_note=order.delivery_note,
        promised_at=order.promised_at,
    )


@router.post(
    "", response_model=PlaceOrderOut, status_code=201, dependencies=[Depends(enforce_csrf)]
)
def place_order(
    body: PlaceOrderIn,
    request: Request,
    db: Session = Depends(get_db, scope="function"),
    settings: Settings = Depends(get_settings_dependency),
) -> PlaceOrderOut:
    cart = load_cart(db, request)
    if cart is None or not cart.lines:
        raise APIError(
            code="VALIDATION_FAILED",
            message="Cart is empty.",
            status_code=400,
        )

    address = QuoteAddressIn(
        administrative_unit=body.address.administrative_unit,
        street=body.address.street,
    )
    quote, _, _ = quote_cart_for_placement(db, cart.lines, address, body.redeem_points)

    ward = body.address.administrative_unit
    street = body.address.street.strip()
    delivery_address = f"{street}, {ward}"
    promised_at = now_naive_utc() + timedelta(minutes=settings.order_promised_time_default_min)
    session = read_session(request)

    # Loyalty accrual: credit a logged-in customer for what they spent on goods
    # after discounts (subtotal minus combo and loyalty discounts, excluding the
    # delivery fee), at the admin-configured rate. Guests earn nothing.
    earned_points = 0
    if session.user_id is not None:
        accrual_base = quote.subtotal_vnd - quote.discount_combo_vnd - quote.discount_loyalty_vnd
        accrual_rate = settings_service.get_business_settings(db).loyalty_accrual_rate
        earned_points = compute_accrual_points(accrual_base, accrual_rate=accrual_rate)

    order = Order(
        order_code=unique_order_code(db),
        user_id=session.user_id,
        recipient_name=body.recipient_name,
        recipient_phone=body.recipient_phone,
        delivery_address=delivery_address,
        delivery_ward=ward,
        delivery_note=body.delivery_note,
        total_amount_vnd=quote.total_vnd,
        delivery_fee_vnd=quote.delivery_fee_vnd,
        promised_at=promised_at,
        current_status=OrderStatus.RECEIVED,
        loyalty_points_earned=earned_points,
    )
    db.add(order)
    db.flush()

    if earned_points:  # implies session.user_id is not None (set only in that branch)
        user = db.get(User, session.user_id)
        if user is not None:
            user.current_points += earned_points
            user.total_points_earned += earned_points

    for row in cart.lines:
        quote_line = _quote_line_from_row(db, row)
        if isinstance(quote_line, ComboQuoteLineIn):
            _persist_combo_line(db, order, row, quote_line)
        else:
            pl = resolve_item_line(db, quote_line)
            _persist_item_line(db, order, row, quote_line, pl)

    db.add(
        OrderTracking(
            order_id=order.order_id,
            status=OrderStatus.RECEIVED,
            updated_by=None,
        )
    )
    db.execute(delete(CartLine).where(CartLine.cart_id == cart.cart_id))
    db.commit()

    return PlaceOrderOut(
        order_code=order.order_code,
        total_vnd=order.total_amount_vnd,
        status=order.current_status.value,
        promised_at=order.promised_at,
    )
