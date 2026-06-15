from __future__ import annotations

from sqlalchemy.orm import Session

from app.infra.db.models import Order, User


def release_reserved_points(db: Session, order: Order) -> None:
    """Return points reserved at placement to the customer's balance.

    Called when an order leaves the redemption flow without consuming the points
    (Cancelled or Delivery-Failed). Idempotent: zeroes the stored amount so a
    second call - or a later re-trigger - is a no-op. Guest orders hold nothing.
    """
    if order.user_id is None or not order.loyalty_points_redeemed:
        return
    user = db.get(User, order.user_id)
    if user is not None:
        user.current_points += order.loyalty_points_redeemed
    order.loyalty_points_redeemed = 0
