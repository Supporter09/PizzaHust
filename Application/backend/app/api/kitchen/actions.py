"""K2/K3/K4 – Kitchen order actions (kitchen only).

The mutations the read-only orders.py queue lacks: Accept (Received→Preparing),
Mark Ready for Dispatch (Preparing→ReadyForDispatch, requesting a courier via the
delivery port; on provider failure → DispatchPending for admin retry), and
Confirm Pickup (ReadyForDispatch→Delivering, the manual fallback for the courier
scan, attributed to the kitchen actor). Status changes go only through
order_state.transition(). Mirrors the admin cancel/retry-dispatch verbs
(role-guard, row-lock, OrderTracking audit row).
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.api.kitchen.queue_logic import cancel_stale_kitchen_orders
from app.domain.order_state import OrderTransitionError, transition
from app.infra.auth import require_role
from app.infra.config import Settings, get_settings_dependency
from app.infra.db.deps import get_db
from app.infra.db.models import (
    Order,
    OrderStatus,
    OrderTracking,
    TrackingNoteSource,
    User,
    UserRole,
)
from app.infra.delivery import get_delivery_port
from app.infra.delivery.port import DeliveryError, DeliveryPort, OrderForDispatch

router = APIRouter(prefix="/api/kitchen/orders", tags=["kitchen-orders"])

require_kitchen = require_role(UserRole.KITCHEN)


class MarkReadyOut(BaseModel):
    status: Literal["ReadyForDispatch", "DispatchPending"]


class KitchenNoteIn(BaseModel):
    note: str = Field(min_length=1, max_length=255)

    @field_validator("note")
    @classmethod
    def _strip_note(cls, value: str) -> str:
        note = value.strip()
        if not note:
            raise ValueError("Note must not be blank")
        return note


@router.post("/{order_id}/accept", status_code=204)
def accept_order(
    order_id: int,
    db: Session = Depends(get_db, scope="function"),
    kitchen: User = Depends(require_kitchen),
) -> None:
    cancel_stale_kitchen_orders(db)
    order: Order | None = db.get(Order, order_id, with_for_update=True)
    if order is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    if order.current_status != OrderStatus.RECEIVED:
        raise HTTPException(status_code=409, detail="CONFLICT")
    try:
        new_status = OrderStatus(
            transition(order.current_status.value, OrderStatus.PREPARING.value)
        )
    except OrderTransitionError:
        raise HTTPException(status_code=409, detail="CONFLICT") from None
    order.current_status = new_status
    db.add(
        OrderTracking(
            order_id=order.order_id,
            updated_by=kitchen.user_id,
            status=new_status,
            note_source=TrackingNoteSource.KITCHEN,
            note="Accepted by kitchen",
        )
    )


@router.post("/{order_id}/notes", status_code=204)
def add_note(
    order_id: int,
    body: KitchenNoteIn,
    db: Session = Depends(get_db, scope="function"),
    kitchen: User = Depends(require_kitchen),
) -> None:
    cancel_stale_kitchen_orders(db)
    order: Order | None = db.get(Order, order_id, with_for_update=True)
    if order is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    if order.current_status in {
        OrderStatus.DELIVERED,
        OrderStatus.CANCELLED,
        OrderStatus.DELIVERY_FAILED,
    }:
        raise HTTPException(status_code=409, detail="CONFLICT")
    db.add(
        OrderTracking(
            order_id=order.order_id,
            updated_by=kitchen.user_id,
            status=order.current_status,
            note_source=TrackingNoteSource.KITCHEN,
            note=body.note,
        )
    )


@router.post("/{order_id}/mark-ready", response_model=MarkReadyOut)
def mark_ready(
    order_id: int,
    db: Session = Depends(get_db, scope="function"),
    kitchen: User = Depends(require_kitchen),
    port: DeliveryPort = Depends(get_delivery_port),
    settings: Settings = Depends(get_settings_dependency),
) -> MarkReadyOut:
    cancel_stale_kitchen_orders(db)
    order: Order | None = db.get(Order, order_id, with_for_update=True)
    if order is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    if order.current_status != OrderStatus.PREPARING:
        raise HTTPException(status_code=409, detail="CONFLICT")
    try:
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
    except DeliveryError:
        # Hand off to admin: persist Preparing→DispatchPending (do NOT re-raise,
        # which would roll back via get_db). Card leaves the kitchen queue; A5
        # retry-dispatch picks it up. This is the producer that makes
        # DispatchPending reachable.
        pending = OrderStatus(
            transition(order.current_status.value, OrderStatus.DISPATCH_PENDING.value)
        )
        order.current_status = pending
        db.add(
            OrderTracking(
                order_id=order.order_id,
                updated_by=kitchen.user_id,
                status=pending,
                note_source=TrackingNoteSource.TRANSPORT,
                note="Dispatch request failed — pending admin retry",
            )
        )
        return MarkReadyOut(status="DispatchPending")
    order.delivery_reference = ref.reference
    new_status = OrderStatus(
        transition(order.current_status.value, OrderStatus.READY_FOR_DISPATCH.value)
    )
    order.current_status = new_status
    db.add(
        OrderTracking(
            order_id=order.order_id,
            updated_by=kitchen.user_id,
            status=new_status,
            note_source=TrackingNoteSource.TRANSPORT,
            note=f"Dispatch requested: {ref.reference}",
        )
    )
    return MarkReadyOut(status="ReadyForDispatch")


@router.post("/{order_id}/pickup", status_code=204)
def confirm_pickup(
    order_id: int,
    db: Session = Depends(get_db, scope="function"),
    kitchen: User = Depends(require_kitchen),
) -> None:
    """K4 — manual Confirm Pickup fallback: ReadyForDispatch → Delivering,
    attributed to the kitchen actor. No delivery-port call (the courier scan T2
    is the path that's unavailable). Mirrors the accept verb's shape."""
    order: Order | None = db.get(Order, order_id, with_for_update=True)
    if order is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    if order.current_status != OrderStatus.READY_FOR_DISPATCH:
        raise HTTPException(status_code=409, detail="CONFLICT")
    try:
        new_status = OrderStatus(
            transition(order.current_status.value, OrderStatus.DELIVERING.value)
        )
    except OrderTransitionError:
        raise HTTPException(status_code=409, detail="CONFLICT") from None
    order.current_status = new_status
    db.add(
        OrderTracking(
            order_id=order.order_id,
            updated_by=kitchen.user_id,
            status=new_status,
            note_source=TrackingNoteSource.KITCHEN,
            note="Pickup confirmed by kitchen",
        )
    )
