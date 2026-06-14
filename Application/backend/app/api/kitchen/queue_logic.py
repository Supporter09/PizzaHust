"""Shared kitchen queue helpers.

Keeps the queue read path and kitchen mutations aligned:
- stale active orders auto-cancel after 24 hours
- the queue source stays the only ordering authority
"""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.cart_store import now_naive_utc
from app.domain.order_state import OrderTransitionError, transition
from app.infra.db.models import Order, OrderStatus, OrderTracking, TrackingNoteSource

KITCHEN_STALE_AFTER = timedelta(days=1)
KITCHEN_STALE_CANCEL_NOTE = "Auto-cancelled after 24 hours without kitchen action"
KITCHEN_ACTIVE_STATUSES = (OrderStatus.RECEIVED, OrderStatus.PREPARING)


def _stale_cutoff(now: datetime | None = None) -> datetime:
    base = now or now_naive_utc()
    return base - KITCHEN_STALE_AFTER


def cancel_stale_kitchen_orders(db: Session) -> int:
    """Cancel old active orders so they stop appearing in the queue."""
    cutoff = _stale_cutoff()
    rows = db.scalars(
        select(Order)
        .where(
            Order.current_status.in_(KITCHEN_ACTIVE_STATUSES),
            Order.created_at < cutoff,
        )
        .with_for_update()
    ).all()
    cancelled = 0
    for order in rows:
        try:
            new_status = OrderStatus(
                transition(order.current_status.value, OrderStatus.CANCELLED.value)
            )
        except OrderTransitionError:
            continue
        order.current_status = new_status
        db.add(
            OrderTracking(
                order_id=order.order_id,
                updated_by=None,
                status=new_status,
                note_source=TrackingNoteSource.SYSTEM,
                note=KITCHEN_STALE_CANCEL_NOTE,
            )
        )
        cancelled += 1
    if cancelled:
        db.flush()
    return cancelled
