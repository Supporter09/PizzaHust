"""U11 — the caller's own order history + reorder (separate from orders.py place/track)."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.orders import TrackTimelineEntry
from app.core.errors import APIError
from app.infra.auth.guards import get_current_user
from app.infra.db.deps import get_db
from app.infra.db.models import Order, OrderItem, User

router = APIRouter(prefix="/api/orders", tags=["orders"])


class MyOrderSummaryOut(BaseModel):
    order_code: str
    created_at: datetime
    status: str
    total_vnd: int
    item_summary: list[str]


class MyOrderLineOptionOut(BaseModel):
    group_name: str
    option_name: str
    price_delta_vnd: int


class MyOrderLineOut(BaseModel):
    name: str
    quantity: int
    unit_price_vnd: int
    line_total_vnd: int
    notes: str | None
    options: list[MyOrderLineOptionOut]
    picks: list[MyOrderLineOut] | None = None


class MyOrderDetailOut(BaseModel):
    order_code: str
    created_at: datetime
    status: str
    promised_at: datetime
    recipient_name: str
    recipient_phone: str
    delivery_address: str
    delivery_ward: str | None
    delivery_note: str | None
    subtotal_vnd: int
    savings_vnd: int
    discount_loyalty_vnd: int
    delivery_fee_vnd: int
    total_vnd: int
    loyalty_points_earned: int
    loyalty_redeemed: int
    lines: list[MyOrderLineOut]
    timeline: list[TrackTimelineEntry]


def _top_level(order: Order) -> list[OrderItem]:
    return [it for it in order.items if it.parent_order_item_id is None]


def _line_name(item: OrderItem) -> str:
    if item.combo_id is not None:
        return item.combo.name if item.combo is not None else "Combo"
    return item.product.name if item.product is not None else "Item"


def _summary_line(item: OrderItem) -> str:
    text = f"{item.quantity}× {_line_name(item)}"
    if item.options:
        text += f" ({item.options[0].option_name})"
    return text


def _line_total(item: OrderItem) -> int:
    option_delta = sum(o.price_delta_vnd for o in item.options)
    return (item.unit_price_vnd + option_delta) * item.quantity


def _line_to_out(item: OrderItem, children_by_parent: dict[int, list[OrderItem]]) -> MyOrderLineOut:
    picks = children_by_parent.get(item.order_item_id)
    return MyOrderLineOut(
        name=_line_name(item),
        quantity=item.quantity,
        unit_price_vnd=item.unit_price_vnd,
        line_total_vnd=_line_total(item),
        notes=item.notes,
        options=[
            MyOrderLineOptionOut(
                group_name=o.group_name,
                option_name=o.option_name,
                price_delta_vnd=o.price_delta_vnd,
            )
            for o in item.options
        ],
        picks=[_line_to_out(c, children_by_parent) for c in picks] if picks else None,
    )


def _load_owned_order(db: Session, user: User, order_code: str) -> Order:
    normalized = order_code.strip().upper()
    order = db.scalar(
        select(Order)
        .where(Order.order_code == normalized, Order.user_id == user.user_id)
        .options(
            selectinload(Order.items).options(
                selectinload(OrderItem.product),
                selectinload(OrderItem.combo),
                selectinload(OrderItem.options),
            ),
            selectinload(Order.tracking),
        )
    )
    if order is None:
        raise APIError(
            code="NOT_FOUND",
            message="Order not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    return order


def _order_breakdown(order: Order) -> tuple[int, int, int]:
    top = _top_level(order)
    subtotal_vnd = sum(_line_total(it) for it in top)
    savings_vnd = max(0, subtotal_vnd + order.delivery_fee_vnd - order.total_amount_vnd)
    discount_loyalty_vnd = max(
        0,
        subtotal_vnd - savings_vnd + order.delivery_fee_vnd - order.total_amount_vnd,
    )
    return subtotal_vnd, savings_vnd, discount_loyalty_vnd


@router.get("/me", response_model=list[MyOrderSummaryOut])
def list_my_orders(
    user: Annotated[User, Depends(get_current_user)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db, scope="function"),
) -> list[MyOrderSummaryOut]:
    stmt = (
        select(Order)
        .where(Order.user_id == user.user_id)
        .options(
            selectinload(Order.items).options(
                selectinload(OrderItem.product),
                selectinload(OrderItem.combo),
                selectinload(OrderItem.options),
            )
        )
        .order_by(Order.created_at.desc(), Order.order_id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    orders = db.scalars(stmt).all()
    return [
        MyOrderSummaryOut(
            order_code=o.order_code,
            created_at=o.created_at,
            status=o.current_status.value,
            total_vnd=o.total_amount_vnd,
            item_summary=[_summary_line(it) for it in _top_level(o)],
        )
        for o in orders
    ]


@router.get("/me/{order_code}", response_model=MyOrderDetailOut)
def get_my_order_detail(
    order_code: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db, scope="function"),
) -> MyOrderDetailOut:
    order = _load_owned_order(db, user, order_code)
    children_by_parent: dict[int, list[OrderItem]] = {}
    for it in order.items:
        if it.parent_order_item_id is not None:
            children_by_parent.setdefault(it.parent_order_item_id, []).append(it)
    for kids in children_by_parent.values():
        kids.sort(key=lambda c: c.order_item_id)

    subtotal_vnd, savings_vnd, discount_loyalty_vnd = _order_breakdown(order)
    timeline_rows = sorted(order.tracking, key=lambda t: t.created_at)

    return MyOrderDetailOut(
        order_code=order.order_code,
        created_at=order.created_at,
        status=order.current_status.value,
        promised_at=order.promised_at,
        recipient_name=order.recipient_name,
        recipient_phone=order.recipient_phone,
        delivery_address=order.delivery_address,
        delivery_ward=order.delivery_ward,
        delivery_note=order.delivery_note,
        subtotal_vnd=subtotal_vnd,
        savings_vnd=savings_vnd,
        discount_loyalty_vnd=discount_loyalty_vnd,
        delivery_fee_vnd=order.delivery_fee_vnd,
        total_vnd=order.total_amount_vnd,
        loyalty_points_earned=order.loyalty_points_earned,
        loyalty_redeemed=0,
        lines=[_line_to_out(it, children_by_parent) for it in _top_level(order)],
        timeline=[
            TrackTimelineEntry(status=row.status.value, at=row.created_at) for row in timeline_rows
        ],
    )
