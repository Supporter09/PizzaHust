from __future__ import annotations

from sqlalchemy.orm import Session

from app.infra.db.models import Order, User


def release_reserved_points(db: Session, order: Order) -> None:
    """Return points reserved at placement to the customer's balance.

    Called when an order leaves the redemption flow without consuming the points
    (Cancelled or Delivery-Failed). Idempotent: zeroes the stored amount so a
    second call - or a later re-trigger - is a no-op. Guest orders hold nothing.
    """
    locked = db.get(Order, order.order_id, with_for_update=True)
    if locked is None:
        return
    db.refresh(locked)
    if locked.user_id is None or not locked.loyalty_points_redeemed:
        return
    amount = locked.loyalty_points_redeemed
    user = db.get(User, locked.user_id, with_for_update=True)
    if user is not None:
        user.current_points += amount
    locked.loyalty_points_redeemed = 0
    db.flush()
