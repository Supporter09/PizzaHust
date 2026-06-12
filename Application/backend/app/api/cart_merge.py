"""Login-time guest→account cart merge (U5/D2)."""

from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.cart_store import now_naive_utc
from app.infra.db.models import Cart, CartLine


def _line_key(line: CartLine) -> tuple[str, str | None]:
    return (
        json.dumps(line.payload, sort_keys=True, separators=(",", ":")),
        line.note,
    )


def merge_guest_cart_into_account(
    db: Session, guest_cart_id: int | None, user_id: int
) -> int | None:
    """Returns the surviving cart_id (or None). Caller commits."""
    guest = (
        db.scalar(
            select(Cart)
            .where(Cart.cart_id == guest_cart_id, Cart.user_id.is_(None))
            .options(selectinload(Cart.lines))
        )
        if guest_cart_id is not None
        else None
    )
    account = db.scalar(
        select(Cart).where(Cart.user_id == user_id).options(selectinload(Cart.lines))
    )
    if guest is None:
        return account.cart_id if account else None
    if account is None:
        guest.user_id = user_id
        guest.touched_at = now_naive_utc()
        return guest.cart_id
    existing = {_line_key(line): line for line in account.lines}
    for line in guest.lines:
        key = _line_key(line)
        if key in existing:
            existing[key].quantity += line.quantity
        else:
            account.lines.append(
                CartLine(payload=line.payload, quantity=line.quantity, note=line.note)
            )
    account.touched_at = now_naive_utc()
    db.delete(guest)
    return account.cart_id
