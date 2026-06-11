"""U6 Place COD Order, U7 Track Order, U11 Order History.

Place-order accepts guests and logged-in customers (loyalty only applies to the
latter). Track is public and rate-limited. History requires authentication.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Request, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import APIError
from app.infra.auth.rate_limit import InMemoryRateLimiter
from app.infra.auth.session_state import read_session
from app.infra.db.deps import get_db
from app.infra.db.models import Order, OrderItem, User
from app.services.orders import place_order, resolve_line

router = APIRouter(prefix="/api/orders", tags=["orders"])

_VN_PHONE = re.compile(r"^(0|\+84)\d{9}$")
# Public endpoint; keep a ceiling so it can't be scraped, but loose enough for
# a customer refreshing their tracking page and for e2e.
_track_limiter = InMemoryRateLimiter(limit=30, window_seconds=60)


def get_optional_user(request: Request, db: Session = Depends(get_db, scope="function")) -> User | None:
    """Current user if a valid session cookie is present, else None. A locked
    account is rejected just like on any authenticated route."""
    user_id = read_session(request).user_id
    if user_id is None:
        return None
    user = db.scalar(select(User).where(User.user_id == user_id))
    if user is None:
        return None
    if user.is_locked:
        raise APIError(code="FORBIDDEN", message="This account is locked.", status_code=403)
    return user


# ── request / response models ──────────────────────────────────────────────


class OrderLineIn(BaseModel):
    kind: Literal["item", "combo"]
    item_id: int | None = None
    combo_id: int | None = None
    option_ids: list[int] = Field(default_factory=list)
    quantity: int = Field(ge=1, le=50)
    notes: str | None = Field(default=None, max_length=255)


class OrderAddressIn(BaseModel):
    administrative_unit: str = Field(min_length=1, max_length=120)
    street: str = Field(min_length=1, max_length=200)


class PlaceOrderIn(BaseModel):
    lines: list[OrderLineIn] = Field(min_length=1)
    recipient_name: str = Field(min_length=2, max_length=100)
    recipient_phone: str = Field(min_length=8, max_length=15)
    address: OrderAddressIn
    delivery_note: str | None = Field(default=None, max_length=255)
    redeem_points: int = Field(default=0, ge=0)

    @field_validator("recipient_phone")
    @classmethod
    def _valid_vn_phone(cls, v: str) -> str:
        v = v.strip()
        if not _VN_PHONE.match(v):
            raise ValueError("recipient_phone must be a valid Vietnamese number")
        return v


class PlaceOrderOut(BaseModel):
    order_id: int
    order_code: str
    current_status: str
    total_amount_vnd: int
    delivery_fee_vnd: int
    loyalty_redeemed: int


class TrackOptionOut(BaseModel):
    group_name: str
    option_name: str


class TrackItemOut(BaseModel):
    name: str
    quantity: int
    unit_price_vnd: int
    options: list[TrackOptionOut]


class TrackEventOut(BaseModel):
    status: str
    created_at: datetime
    note: str | None


class TrackOrderOut(BaseModel):
    order_code: str
    current_status: str
    recipient_name: str
    delivery_address: str
    total_amount_vnd: int
    delivery_fee_vnd: int
    created_at: datetime
    promised_at: datetime
    items: list[TrackItemOut]
    timeline: list[TrackEventOut]


class HistoryOrderOut(BaseModel):
    order_id: int
    order_code: str
    current_status: str
    total_amount_vnd: int
    created_at: datetime
    items: list[TrackItemOut]


# ── helpers ─────────────────────────────────────────────────────────────────


def _item_display_name(item: OrderItem) -> str:
    if item.product is not None:
        return item.product.name
    if item.combo is not None:
        return item.combo.name
    return "Item"


def _items_out(items: list[OrderItem]) -> list[TrackItemOut]:
    out: list[TrackItemOut] = []
    for item in items:
        opts = sorted(item.options, key=lambda o: o.id)
        out.append(
            TrackItemOut(
                name=_item_display_name(item),
                quantity=item.quantity,
                unit_price_vnd=item.unit_price_vnd,
                options=[
                    TrackOptionOut(group_name=o.group_name, option_name=o.option_name)
                    for o in opts
                ],
            )
        )
    return out


# ── routes ───────────────────────────────────────────────────────────────────


@router.post("", response_model=PlaceOrderOut, status_code=status.HTTP_201_CREATED)
def create_order(
    payload: PlaceOrderIn,
    db: Session = Depends(get_db, scope="function"),
    user: User | None = Depends(get_optional_user),
) -> PlaceOrderOut:
    now = datetime.utcnow()
    resolved = [
        resolve_line(
            db,
            kind=line.kind,
            item_id=line.item_id,
            combo_id=line.combo_id,
            option_ids=line.option_ids,
            quantity=line.quantity,
            notes=line.notes,
            now=now,
        )
        for line in payload.lines
    ]
    placed = place_order(
        db,
        lines=resolved,
        recipient_name=payload.recipient_name,
        recipient_phone=payload.recipient_phone,
        administrative_unit=payload.address.administrative_unit,
        street=payload.address.street,
        delivery_note=payload.delivery_note,
        redeem_points=payload.redeem_points,
        user=user,
    )
    return PlaceOrderOut(
        order_id=placed.order_id,
        order_code=placed.order_code,
        current_status=placed.current_status,
        total_amount_vnd=placed.total_amount_vnd,
        delivery_fee_vnd=placed.delivery_fee_vnd,
        loyalty_redeemed=placed.loyalty_redeemed,
    )


@router.get("/me", response_model=list[HistoryOrderOut])
def my_orders(
    db: Session = Depends(get_db, scope="function"),
    user: User | None = Depends(get_optional_user),
) -> list[HistoryOrderOut]:
    if user is None:
        raise APIError(code="UNAUTHENTICATED", message="You must log in first.", status_code=401)
    orders = db.scalars(
        select(Order)
        .where(Order.user_id == user.user_id)
        .order_by(Order.created_at.desc())
        .options(
            selectinload(Order.items).selectinload(OrderItem.options),
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.items).selectinload(OrderItem.combo),
        )
    ).all()
    return [
        HistoryOrderOut(
            order_id=o.order_id,
            order_code=o.order_code,
            current_status=o.current_status.value,
            total_amount_vnd=o.total_amount_vnd,
            created_at=o.created_at,
            items=_items_out(list(o.items)),
        )
        for o in orders
    ]


@router.get("/track/{order_code}", response_model=TrackOrderOut)
def track_order(
    order_code: str,
    request: Request,
    db: Session = Depends(get_db, scope="function"),
) -> TrackOrderOut:
    ip = request.client.host if request.client else "unknown"
    if not _track_limiter.allow(f"track:{ip}"):
        raise APIError(
            code="RATE_LIMITED",
            message="Too many requests. Please try again later.",
            status_code=429,
        )
    order = db.scalar(
        select(Order)
        .where(Order.order_code == order_code)
        .options(
            selectinload(Order.items).selectinload(OrderItem.options),
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.items).selectinload(OrderItem.combo),
            selectinload(Order.tracking),
        )
    )
    if order is None:
        raise APIError(code="NOT_FOUND", message="Order not found.", status_code=404)
    timeline = sorted(order.tracking, key=lambda t: (t.created_at, t.tracking_id))
    return TrackOrderOut(
        order_code=order.order_code,
        current_status=order.current_status.value,
        recipient_name=order.recipient_name,
        delivery_address=order.delivery_address,
        total_amount_vnd=order.total_amount_vnd,
        delivery_fee_vnd=order.delivery_fee_vnd,
        created_at=order.created_at,
        promised_at=order.promised_at,
        items=_items_out(list(order.items)),
        timeline=[
            TrackEventOut(status=t.status.value, created_at=t.created_at, note=t.note)
            for t in timeline
        ],
    )
