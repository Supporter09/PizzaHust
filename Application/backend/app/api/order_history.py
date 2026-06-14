"""U11 — the caller's own order history + reorder (separate from orders.py place/track)."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

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


def _top_level(order: Order) -> list[OrderItem]:
    return [it for it in order.items if it.parent_order_item_id is None]


def _line_name(item: OrderItem) -> str:
    if item.combo_id is not None:
        return item.combo.name if item.combo is not None else "Combo"
    return item.product.name if item.product is not None else "Item"


def _summary_line(item: OrderItem) -> str:
    text = f"{item.quantity}× {_line_name(item)}"
    if item.options:
        text += f" ({item.options[0].option_name})"
    return text


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
