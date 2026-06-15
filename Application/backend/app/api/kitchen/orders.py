"""K1 – View Incoming Orders (kitchen only). Read-only queue.

Ordering comes from kitchen_queue_view.priority_score (SQL single source of
truth). The queue read path also opportunistically auto-cancels stale active
orders so they stop lingering past one day. Combo parents nest their child prep
items. No mutations — those are K2/K3/K4.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.orm import Session, selectinload

from app.api.kitchen.queue_logic import cancel_stale_kitchen_orders
from app.api.serialization import UtcDateTime
from app.infra.auth import require_role
from app.infra.db.deps import get_db
from app.infra.db.models import Order, OrderItem, User, UserRole

router = APIRouter(prefix="/api/kitchen/orders", tags=["kitchen-orders"])

require_kitchen = require_role(UserRole.KITCHEN)


class KitchenItemOptionOut(BaseModel):
    group_name: str
    option_name: str


class KitchenItemOut(BaseModel):
    display_name: str
    quantity: int
    options: list[KitchenItemOptionOut]
    note: str | None
    children: list[KitchenItemOut]


class KitchenTrackingOut(BaseModel):
    tracking_id: int
    status: str
    note_source: str
    created_at: UtcDateTime
    note: str | None
    updated_by: int | None


class KitchenTicketOut(BaseModel):
    order_id: int
    order_code: str
    status: str
    created_at: UtcDateTime
    promised_at: UtcDateTime
    priority_score: int
    delivery_note: str | None
    tracking: list[KitchenTrackingOut]
    items: list[KitchenItemOut]


KitchenItemOut.model_rebuild()
KitchenTrackingOut.model_rebuild()
KitchenTicketOut.model_rebuild()

_QUEUE_SQL = text(
    """
    SELECT order_id, priority_score
    FROM kitchen_queue_view
    ORDER BY priority_score DESC, created_at ASC
    """
)


def _display_name(item: OrderItem) -> str:
    if item.combo is not None:
        return item.combo.name
    if item.product is not None:
        return item.product.name
    return "Unknown item"


def _options(item: OrderItem) -> list[KitchenItemOptionOut]:
    return [
        KitchenItemOptionOut(group_name=o.group_name, option_name=o.option_name)
        for o in item.options
    ]


def _item_out(item: OrderItem, children: list[OrderItem]) -> KitchenItemOut:
    return KitchenItemOut(
        display_name=_display_name(item),
        quantity=item.quantity,
        options=_options(item),
        note=item.notes,
        children=[_item_out(child, []) for child in children],
    )


def _ticket(order: Order, priority_score: int) -> KitchenTicketOut:
    children_by_parent: dict[int, list[OrderItem]] = {}
    for it in order.items:
        if it.parent_order_item_id is not None:
            children_by_parent.setdefault(it.parent_order_item_id, []).append(it)
    top_level = [it for it in order.items if it.parent_order_item_id is None]
    return KitchenTicketOut(
        order_id=order.order_id,
        order_code=order.order_code,
        status=order.current_status.value,
        created_at=order.created_at,
        promised_at=order.promised_at,
        priority_score=priority_score,
        delivery_note=order.delivery_note,
        tracking=[
            KitchenTrackingOut(
                tracking_id=event.tracking_id,
                status=event.status.value,
                note_source=event.note_source.value,
                created_at=event.created_at,
                note=event.note,
                updated_by=event.updated_by,
            )
            for event in sorted(order.tracking, key=lambda row: row.created_at)
            if event.note is not None
        ],
        items=[_item_out(it, children_by_parent.get(it.order_item_id, [])) for it in top_level],
    )


@router.get("", response_model=list[KitchenTicketOut])
def list_incoming_orders(
    db: Session = Depends(get_db, scope="function"),
    _kitchen: User = Depends(require_kitchen),
) -> list[KitchenTicketOut]:
    cancel_stale_kitchen_orders(db)
    rows = db.execute(_QUEUE_SQL).all()
    score_by_id = {row.order_id: int(row.priority_score) for row in rows}
    ordered_ids = [row.order_id for row in rows]
    if not ordered_ids:
        return []
    orders = db.scalars(
        select(Order)
        .where(Order.order_id.in_(ordered_ids))
        .options(
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.items).selectinload(OrderItem.combo),
            selectinload(Order.items).selectinload(OrderItem.options),
            selectinload(Order.tracking),
        )
    ).all()
    by_id = {order.order_id: order for order in orders}
    tickets: list[KitchenTicketOut] = []
    for order_id in ordered_ids:  # preserve the view's priority order
        order = by_id.get(order_id)
        if order is not None:
            tickets.append(_ticket(order, score_by_id[order_id]))
    return tickets
