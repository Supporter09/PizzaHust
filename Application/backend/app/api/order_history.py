"""U11 — the caller's own order history + reorder (separate from orders.py place/track)."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

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


class MyOrderLineOut(BaseModel):
    kind: Literal["item", "combo"]
    display_name: str
    quantity: int
    line_total_vnd: int
    options: list[str]
    note: str | None
    children: list[MyOrderLineOut]


MyOrderLineOut.model_rebuild()


class MyOrderDetailOut(BaseModel):
    order_code: str
    created_at: datetime
    status: str
    recipient_name: str
    delivery_address: str
    delivery_note: str | None
    promised_at: datetime
    lines: list[MyOrderLineOut]
    subtotal_vnd: int
    delivery_fee_vnd: int
    savings_vnd: int
    total_vnd: int
    timeline: list[TrackTimelineEntry]


def _top_level(order: Order) -> list[OrderItem]:
    return [it for it in order.items if it.parent_order_item_id is None]


def _line_kind(item: OrderItem) -> Literal["item", "combo"]:
    return "combo" if item.combo_id is not None else "item"


def _display_name(item: OrderItem) -> str:
    if item.combo_id is not None:
        return item.combo.name if item.combo is not None else "Combo"
    return item.product.name if item.product is not None else "Item"


def _summary_line(item: OrderItem) -> str:
    text = f"{item.quantity}× {_display_name(item)}"
    if item.options:
        text += f" ({item.options[0].option_name})"
    return text


def _line_total(item: OrderItem) -> int:
    option_delta = sum(o.price_delta_vnd for o in item.options)
    return (item.unit_price_vnd + option_delta) * item.quantity


def _option_labels(item: OrderItem) -> list[str]:
    return [f"{o.group_name}: {o.option_name}" for o in item.options]


def _line_to_out(item: OrderItem, children_by_parent: dict[int, list[OrderItem]]) -> MyOrderLineOut:
    kids = children_by_parent.get(item.order_item_id, [])
    kids.sort(key=lambda c: c.order_item_id)
    return MyOrderLineOut(
        kind=_line_kind(item),
        display_name=_display_name(item),
        quantity=item.quantity,
        line_total_vnd=_line_total(item),
        options=_option_labels(item),
        note=item.notes,
        children=[_line_to_out(c, children_by_parent) for c in kids],
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


def _order_subtotal_and_savings(order: Order) -> tuple[int, int]:
    top = _top_level(order)
    subtotal_vnd = sum(_line_total(it) for it in top)
    savings_vnd = max(0, subtotal_vnd + order.delivery_fee_vnd - order.total_amount_vnd)
    return subtotal_vnd, savings_vnd


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

    subtotal_vnd, savings_vnd = _order_subtotal_and_savings(order)
    timeline_rows = sorted(order.tracking, key=lambda t: t.created_at)

    return MyOrderDetailOut(
        order_code=order.order_code,
        created_at=order.created_at,
        status=order.current_status.value,
        recipient_name=order.recipient_name,
        delivery_address=order.delivery_address,
        delivery_note=order.delivery_note,
        promised_at=order.promised_at,
        lines=[_line_to_out(it, children_by_parent) for it in _top_level(order)],
        subtotal_vnd=subtotal_vnd,
        delivery_fee_vnd=order.delivery_fee_vnd,
        savings_vnd=savings_vnd,
        total_vnd=order.total_amount_vnd,
        timeline=[
            TrackTimelineEntry(status=row.status.value, at=row.created_at) for row in timeline_rows
        ],
    )
