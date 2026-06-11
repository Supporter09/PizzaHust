"""A10 – slot availability lookups (spec §1: one predicate, one definition).

A slot's category is available iff it exists, is active, and holds ≥1 active
product; the reference price is the cheapest active product. Returns None for
unavailable categories so callers can branch without re-querying.
"""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.infra.db.models import Category, Product


def slot_availability(db: Session, category_ids: Sequence[int]) -> dict[int, int | None]:
    """category_id -> min active base price, or None when the slot is
    unavailable (unknown, inactive, or empty category)."""
    out: dict[int, int | None] = {cid: None for cid in category_ids}
    if not out:
        return out
    rows = db.execute(
        select(Category.category_id, func.min(Product.base_price_vnd))
        .join(
            Product,
            (Product.category_id == Category.category_id) & Product.is_active.is_(True),
        )
        .where(Category.category_id.in_(out), Category.is_active.is_(True))
        .group_by(Category.category_id)
    ).all()
    for cid, min_price in rows:
        out[cid] = min_price
    return out
