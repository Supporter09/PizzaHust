"""Session-bound cart access: claim resolution, touch + opportunistic GC."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import Request
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from app.infra.auth.session_state import read_cart_id, read_session, set_cart_id
from app.infra.db.models import Cart

GUEST_CART_TTL = timedelta(days=7)


def now_naive_utc() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def load_cart(db: Session, request: Request) -> Cart | None:
    """Resolve the session's cart: user cart wins for authenticated sessions."""
    session = read_session(request)
    if session.user_id is not None:
        return db.scalar(
            select(Cart).where(Cart.user_id == session.user_id).options(selectinload(Cart.lines))
        )
    cart_id = read_cart_id(request)
    if cart_id is None:
        return None
    return db.scalar(
        select(Cart)
        .where(Cart.cart_id == cart_id, Cart.user_id.is_(None))
        .options(selectinload(Cart.lines))
    )


def ensure_cart(db: Session, request: Request) -> Cart:
    """Writes only: create the cart row (and session claim) on first use."""
    cart = load_cart(db, request)
    if cart is None:
        session = read_session(request)
        cart = Cart(user_id=session.user_id, touched_at=now_naive_utc())
        db.add(cart)
        db.flush()
        if session.user_id is None:
            set_cart_id(request, cart.cart_id)
    return cart


def touch_and_gc(db: Session, cart: Cart) -> None:
    """Bump touched_at, then sweep dormant guest carts — never the current one."""
    cart.touched_at = now_naive_utc()
    db.execute(
        delete(Cart).where(
            Cart.user_id.is_(None),
            Cart.touched_at < now_naive_utc() - GUEST_CART_TTL,
            Cart.cart_id != cart.cart_id,
        )
    )
