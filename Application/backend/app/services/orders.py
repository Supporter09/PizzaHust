"""Order services shared by the customer place-order flow (U6), the kitchen
dispatch step (K3/T1), and the admin retry (A5).

Routers own request/response shapes; this module owns the catalog resolution,
pricing, persistence, loyalty side effects, and the delivery handoff so those
rules live in exactly one place.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.domain.combos import ComboStatus, combo_status
from app.domain.loyalty import compute_accrual_points
from app.domain.options import SelectableOption, validate_option_selection
from app.domain.order_state import OrderTransitionError, transition
from app.domain.pricing import CartLine, PricingError, compute_order_total, compute_unit_price
from app.infra.config import Settings
from app.infra.db.models import (
    Combo,
    ComboItem,
    Option,
    OptionGroup,
    Order,
    OrderItem,
    OrderItemOption,
    OrderStatus,
    OrderTracking,
    Product,
    ProductOption,
    User,
)
from app.infra.delivery.port import DeliveryError, DeliveryPort, OrderForDispatch

# Crockford base32 without the ambiguous letters (I L O U): readable order codes
# a customer can phone in. 6 chars => ~10^9 space, far beyond demo volume.
_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
_PROMISE_MINUTES = 45


@dataclass(frozen=True)
class ResolvedOption:
    group_name: str
    option_name: str
    price_delta_vnd: int


@dataclass(frozen=True)
class ResolvedLine:
    kind: Literal["item", "combo"]
    product_id: int | None
    combo_id: int | None
    quantity: int
    unit_price_vnd: int
    display_name: str
    options: list[ResolvedOption]
    notes: str | None = None

    def to_cart_line(self) -> CartLine:
        return CartLine(unit_price_vnd=self.unit_price_vnd, quantity=self.quantity)


def _bad(message: str, **details: object) -> APIError:
    return APIError(
        code="VALIDATION_FAILED",
        message=message,
        status_code=400,
        details=details or None,
    )


def _resolve_item_line(
    db: Session,
    *,
    item_id: int | None,
    option_ids: list[int],
    quantity: int,
    notes: str | None,
) -> ResolvedLine:
    if item_id is None:
        raise _bad("item_id is required.")
    product = db.scalar(
        select(Product).where(Product.product_id == item_id, Product.is_active.is_(True))
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

    meta_by_id = {option.option_id: (option, group) for option, group in rows}
    chosen = [meta_by_id[oid] for oid in selected]
    # History snapshots are stored/read in (group.sort_order, option.sort_order)
    # order so a customer sees "Size: M, Topping: Beef" stably.
    chosen.sort(key=lambda pair: (pair[1].sort_order, pair[1].group_id, pair[0].sort_order, pair[0].option_id))
    options = [
        ResolvedOption(
            group_name=group.name,
            option_name=option.name,
            price_delta_vnd=option.price_delta_vnd,
        )
        for option, group in chosen
    ]
    unit = compute_unit_price(
        base_price_vnd=product.base_price_vnd,
        option_deltas_vnd=[o.price_delta_vnd for o in options],
    )
    return ResolvedLine(
        kind="item",
        product_id=product.product_id,
        combo_id=None,
        quantity=quantity,
        unit_price_vnd=unit,
        display_name=product.name,
        options=options,
        notes=notes,
    )


def _resolve_combo_line(
    db: Session,
    *,
    combo_id: int | None,
    quantity: int,
    notes: str | None,
    now: datetime,
) -> ResolvedLine:
    if combo_id is None:
        raise _bad("combo_id is required.")
    combo = db.get(Combo, combo_id)
    if combo is None:
        raise _bad("Unknown combo.")
    if combo_status(combo.validity_start, combo.validity_end, now) is not ComboStatus.ACTIVE:
        raise _bad("Combo is not currently available.", reason="combo_inactive")
    # A combo is only orderable if every component is still on the menu.
    components = db.execute(
        select(Product)
        .join(ComboItem, ComboItem.product_id == Product.product_id)
        .where(ComboItem.combo_id == combo.combo_id)
    ).scalars().all()
    if not components or any(not p.is_active for p in components):
        raise _bad("Combo contains an unavailable item.", reason="combo_inactive")
    return ResolvedLine(
        kind="combo",
        product_id=None,
        combo_id=combo.combo_id,
        quantity=quantity,
        unit_price_vnd=combo.combo_price_vnd,
        display_name=combo.name,
        options=[],
        notes=notes,
    )


def resolve_line(
    db: Session,
    *,
    kind: Literal["item", "combo"],
    item_id: int | None,
    combo_id: int | None,
    option_ids: list[int],
    quantity: int,
    notes: str | None = None,
    now: datetime | None = None,
) -> ResolvedLine:
    """Resolve one cart line against the live catalog: real prices, option
    validation, and combo availability. Raises APIError(VALIDATION_FAILED)."""
    if kind == "combo":
        return _resolve_combo_line(
            db, combo_id=combo_id, quantity=quantity, notes=notes, now=now or datetime.utcnow()
        )
    return _resolve_item_line(
        db, item_id=item_id, option_ids=option_ids, quantity=quantity, notes=notes
    )


def generate_order_code(db: Session) -> str:
    """A unique PIZZ-XXXXXX code (chosen format per the sprint plan)."""
    for _ in range(20):
        code = "PIZZ-" + "".join(secrets.choice(_CODE_ALPHABET) for _ in range(6))
        if db.scalar(select(Order.order_id).where(Order.order_code == code)) is None:
            return code
    raise APIError(
        code="INTERNAL",
        message="Could not allocate an order code.",
        status_code=500,
    )


@dataclass(frozen=True)
class PlacedOrder:
    order_id: int
    order_code: str
    current_status: str
    total_amount_vnd: int
    delivery_fee_vnd: int
    loyalty_redeemed: int


def place_order(
    db: Session,
    *,
    lines: list[ResolvedLine],
    recipient_name: str,
    recipient_phone: str,
    administrative_unit: str,
    street: str,
    delivery_note: str | None,
    redeem_points: int,
    user: User | None,
) -> PlacedOrder:
    """Persist a COD order from already-resolved lines. Enforces service area,
    runs the loyalty pipeline, deducts redeemed points, writes the audit trail."""
    current_points = user.current_points if user is not None else 0
    try:
        quote = compute_order_total(
            lines=[line.to_cart_line() for line in lines],
            address_district=administrative_unit,
            redeem_points=redeem_points,
            current_points=current_points,
        )
    except PricingError as exc:
        status_code = 422 if exc.code in {"OUT_OF_SERVICE_AREA", "INSUFFICIENT_LOYALTY"} else 400
        raise APIError(code=exc.code, message=str(exc), status_code=status_code) from exc

    now = datetime.utcnow()
    full_address = f"{street.strip()}, {administrative_unit.strip()}".strip(", ")
    order = Order(
        order_code=generate_order_code(db),
        user_id=user.user_id if user is not None else None,
        recipient_name=recipient_name.strip(),
        recipient_phone=recipient_phone.strip(),
        delivery_address=full_address,
        total_amount_vnd=quote.total_vnd,
        delivery_fee_vnd=quote.delivery_fee_vnd,
        payment_method="COD",
        current_status=OrderStatus.RECEIVED,
        promised_at=now + timedelta(minutes=_PROMISE_MINUTES),
        created_at=now,
    )
    db.add(order)
    db.flush()

    for line in lines:
        item = OrderItem(
            order_id=order.order_id,
            product_id=line.product_id,
            combo_id=line.combo_id,
            quantity=line.quantity,
            unit_price_vnd=line.unit_price_vnd,
            notes=line.notes,
        )
        db.add(item)
        db.flush()
        for opt in line.options:
            db.add(
                OrderItemOption(
                    order_item_id=item.order_item_id,
                    group_name=opt.group_name,
                    option_name=opt.option_name,
                    price_delta_vnd=opt.price_delta_vnd,
                )
            )

    db.add(
        OrderTracking(
            order_id=order.order_id,
            updated_by=user.user_id if user is not None else None,
            status=OrderStatus.RECEIVED,
            note="Order placed",
        )
    )

    if user is not None and quote.loyalty_redeemed > 0:
        # Points are spent at placement; accrual happens on Delivered.
        user.current_points = max(0, user.current_points - quote.loyalty_redeemed)

    return PlacedOrder(
        order_id=order.order_id,
        order_code=order.order_code,
        current_status=order.current_status.value,
        total_amount_vnd=order.total_amount_vnd,
        delivery_fee_vnd=order.delivery_fee_vnd,
        loyalty_redeemed=quote.loyalty_redeemed,
    )


def dispatch_order(
    db: Session,
    *,
    order: Order,
    port: DeliveryPort,
    settings: Settings,
    actor_id: int | None,
) -> None:
    """Hand a ReadyForDispatch/DispatchPending order to the delivery provider.

    Success: store the reference, advance to Delivering. Provider failure:
    raise DeliveryError with the order left where the caller can retry.
    The caller owns the status check + row lock and maps DeliveryError to 502.
    """
    ref = port.request(
        OrderForDispatch(
            order_code=order.order_code,
            recipient_name=order.recipient_name,
            recipient_phone=order.recipient_phone,
            address=order.delivery_address,
            cod_amount_vnd=order.total_amount_vnd,
            pickup_address=settings.delivery_pickup_address,
        )
    )
    order.delivery_reference = ref.reference
    new_status = OrderStatus(
        transition(order.current_status.value, OrderStatus.DELIVERING.value)
    )
    order.current_status = new_status
    db.add(
        OrderTracking(
            order_id=order.order_id,
            updated_by=actor_id,
            status=new_status,
            note=f"Dispatched to delivery: {ref.reference}",
        )
    )


def accrue_loyalty_on_delivered(db: Session, order: Order) -> None:
    """Credit points when an order is delivered. Idempotency is the caller's job
    (the webhook/state guard only fires this on the Delivering->Delivered edge)."""
    if order.user_id is None:
        return
    earned = compute_accrual_points(order.total_amount_vnd - order.delivery_fee_vnd)
    if earned <= 0:
        return
    user = db.get(User, order.user_id)
    if user is None:
        return
    user.current_points += earned
    user.total_points_earned += earned


__all__ = [
    "ResolvedLine",
    "ResolvedOption",
    "resolve_line",
    "generate_order_code",
    "place_order",
    "dispatch_order",
    "accrue_loyalty_on_delivered",
    "PlacedOrder",
    "DeliveryError",
]
