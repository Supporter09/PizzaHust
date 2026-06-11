"""K1 View Incoming Orders, K2 Update Preparation Status, K3 Mark Ready for
Dispatch (which performs the T1 delivery handoff).

Readable by kitchen staff and admins. The queue is read from the orders table
(status in Received/Preparing) ordered oldest-first; the MySQL
kitchen_queue_view exists for richer priority scoring but is not portable to the
SQLite test database, so the queue ordering lives here.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.domain.order_state import OrderTransitionError, transition
from app.infra.auth import require_role
from app.infra.config import Settings, get_settings_dependency
from app.infra.db.deps import get_db
from app.infra.db.models import Order, OrderItem, OrderStatus, OrderTracking, User, UserRole
from app.infra.delivery import get_delivery_port
from app.infra.delivery.port import DeliveryError, DeliveryPort
from app.services.orders import dispatch_order

router = APIRouter(prefix="/api/kitchen", tags=["kitchen"])

require_kitchen = require_role(UserRole.KITCHEN, UserRole.ADMIN)

_QUEUE_STATUSES = (OrderStatus.RECEIVED, OrderStatus.PREPARING)


class QueueItemOut(BaseModel):
    name: str
    quantity: int
    notes: str | None


class QueueOrderOut(BaseModel):
    order_id: int
    order_code: str
    current_status: str
    created_at: datetime
    promised_at: datetime
    items: list[QueueItemOut]


class KitchenActionOut(BaseModel):
    order_id: int
    order_code: str
    current_status: str


def _item_name(item: OrderItem) -> str:
    if item.product is not None:
        return item.product.name
    if item.combo is not None:
        return item.combo.name
    return "Item"


@router.get("/queue", response_model=list[QueueOrderOut])
def kitchen_queue(
    db: Session = Depends(get_db, scope="function"),
    _staff: User = Depends(require_kitchen),
) -> list[QueueOrderOut]:
    orders = db.scalars(
        select(Order)
        .where(Order.current_status.in_(_QUEUE_STATUSES))
        .order_by(Order.created_at.asc())
        .options(
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.items).selectinload(OrderItem.combo),
        )
    ).all()
    return [
        QueueOrderOut(
            order_id=o.order_id,
            order_code=o.order_code,
            current_status=o.current_status.value,
            created_at=o.created_at,
            promised_at=o.promised_at,
            items=[
                QueueItemOut(name=_item_name(i), quantity=i.quantity, notes=i.notes)
                for i in o.items
            ],
        )
        for o in orders
    ]


def _advance(
    db: Session, order: Order, target: OrderStatus, actor_id: int | None, note: str
) -> OrderStatus:
    try:
        new_status = OrderStatus(transition(order.current_status.value, target.value))
    except OrderTransitionError:
        raise HTTPException(status_code=409, detail="CONFLICT") from None
    order.current_status = new_status
    db.add(
        OrderTracking(order_id=order.order_id, updated_by=actor_id, status=new_status, note=note)
    )
    return new_status


@router.post("/orders/{order_id}/accept", response_model=KitchenActionOut)
def accept_order(
    order_id: int,
    db: Session = Depends(get_db, scope="function"),
    staff: User = Depends(require_kitchen),
) -> KitchenActionOut:
    """K2: Received -> Preparing."""
    order = db.get(Order, order_id, with_for_update=True)
    if order is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    _advance(db, order, OrderStatus.PREPARING, staff.user_id, "Kitchen accepted")
    return KitchenActionOut(
        order_id=order.order_id,
        order_code=order.order_code,
        current_status=order.current_status.value,
    )


@router.post("/orders/{order_id}/ready", response_model=KitchenActionOut)
def mark_ready(
    order_id: int,
    db: Session = Depends(get_db, scope="function"),
    staff: User = Depends(require_kitchen),
    port: DeliveryPort = Depends(get_delivery_port),
    settings: Settings = Depends(get_settings_dependency),
) -> KitchenActionOut:
    """K3 + T1: Preparing -> ReadyForDispatch, then hand off to delivery.

    Success advances to Delivering with a stored reference. A provider failure
    parks the order in DispatchPending for an admin retry (no 5xx — the order is
    safely captured and the kitchen's job is done)."""
    order = db.get(Order, order_id, with_for_update=True)
    if order is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    _advance(db, order, OrderStatus.READY_FOR_DISPATCH, staff.user_id, "Marked ready for dispatch")
    try:
        dispatch_order(db, order=order, port=port, settings=settings, actor_id=staff.user_id)
    except DeliveryError:
        _advance(
            db,
            order,
            OrderStatus.DISPATCH_PENDING,
            staff.user_id,
            "Delivery handoff failed; awaiting admin retry",
        )
    return KitchenActionOut(
        order_id=order.order_id,
        order_code=order.order_code,
        current_status=order.current_status.value,
    )
