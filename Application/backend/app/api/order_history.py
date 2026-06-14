"""U11 — the caller's own order history + reorder (separate from orders.py place/track)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request, Response, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.cart import ComboPickIn, ComboSelectionIn
from app.api.cart_store import ensure_cart, touch_and_gc
from app.api.carts import (
    AddComboLineIn,
    AddItemLineIn,
    AddLineIn,
    CartOut,
    _render_cart,
    append_line_to_cart,
)
from app.api.orders import TrackTimelineEntry
from app.core.errors import APIError
from app.domain.combos import ComboStatus, combo_status
from app.infra.auth.csrf import enforce_csrf
from app.infra.auth.guards import get_current_user
from app.infra.config import Settings, get_settings_dependency
from app.infra.db.deps import get_db
from app.infra.db.models import (
    Combo,
    Option,
    OptionGroup,
    Order,
    OrderItem,
    Product,
    ProductOption,
    User,
)

router = APIRouter(prefix="/api/orders", tags=["orders"])


class MyOrderSummaryOut(BaseModel):
    order_code: str
    created_at: datetime
    status: str
    total_vnd: int
    item_summary: list[str]


class MyOrderLineOut(BaseModel):
    kind: Literal["item", "combo"]
    display_name: str
    quantity: int
    line_total_vnd: int
    options: list[str]
    note: str | None
    children: list[MyOrderLineOut]


MyOrderLineOut.model_rebuild()


class MyOrderDetailOut(BaseModel):
    order_code: str
    created_at: datetime
    status: str
    recipient_name: str
    delivery_address: str
    delivery_note: str | None
    promised_at: datetime
    lines: list[MyOrderLineOut]
    subtotal_vnd: int
    delivery_fee_vnd: int
    savings_vnd: int
    total_vnd: int
    timeline: list[TrackTimelineEntry]


UnavailableReason = Literal[
    "item_unavailable",
    "option_changed",
    "combo_unavailable",
    "combo_changed",
]


class UnavailableLineOut(BaseModel):
    description: str
    reason: UnavailableReason


class ReorderResultOut(BaseModel):
    cart: CartOut
    added_count: int
    unavailable: list[UnavailableLineOut]


def _top_level(order: Order) -> list[OrderItem]:
    return [it for it in order.items if it.parent_order_item_id is None]


def _line_kind(item: OrderItem) -> Literal["item", "combo"]:
    return "combo" if item.combo_id is not None else "item"


def _display_name(item: OrderItem) -> str:
    if item.combo_id is not None:
        return item.combo.name if item.combo is not None else "Combo"
    return item.product.name if item.product is not None else "Item"


def _summary_line(item: OrderItem) -> str:
    text = f"{item.quantity}× {_display_name(item)}"
    if item.options:
        text += f" ({item.options[0].option_name})"
    return text


def _children_by_parent(order: Order) -> dict[int, list[OrderItem]]:
    out: dict[int, list[OrderItem]] = {}
    for it in order.items:
        if it.parent_order_item_id is not None:
            out.setdefault(it.parent_order_item_id, []).append(it)
    return out


def _line_total(item: OrderItem, children_by_parent: dict[int, list[OrderItem]]) -> int:
    total = item.unit_price_vnd * item.quantity
    for child in children_by_parent.get(item.order_item_id, []):
        total += _line_total(child, children_by_parent)
    return total


def _option_labels(item: OrderItem) -> list[str]:
    return [f"{o.group_name}: {o.option_name}" for o in item.options]


def _line_to_out(item: OrderItem, children_by_parent: dict[int, list[OrderItem]]) -> MyOrderLineOut:
    kids = children_by_parent.get(item.order_item_id, [])
    kids.sort(key=lambda c: c.order_item_id)
    return MyOrderLineOut(
        kind=_line_kind(item),
        display_name=_display_name(item),
        quantity=item.quantity,
        line_total_vnd=_line_total(item, children_by_parent),
        options=_option_labels(item),
        note=item.notes,
        children=[_line_to_out(c, children_by_parent) for c in kids],
    )


def _load_owned_order(
    db: Session,
    user: User,
    order_code: str,
    *,
    for_reorder: bool = False,
) -> Order:
    normalized = order_code.strip().upper()
    combo_load = selectinload(OrderItem.combo)
    if for_reorder:
        combo_load = selectinload(OrderItem.combo).selectinload(Combo.combo_items)
    order = db.scalar(
        select(Order)
        .where(Order.order_code == normalized, Order.user_id == user.user_id)
        .options(
            selectinload(Order.items).options(
                selectinload(OrderItem.product),
                combo_load,
                selectinload(OrderItem.options),
            ),
            selectinload(Order.tracking),
        )
    )
    if order is None:
        raise APIError(
            code="NOT_FOUND",
            message="Order not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    return order


def _order_subtotal_and_savings(order: Order) -> tuple[int, int]:
    children_by_parent = _children_by_parent(order)
    top = _top_level(order)
    subtotal_vnd = sum(_line_total(it, children_by_parent) for it in top)
    savings_vnd = max(0, subtotal_vnd + order.delivery_fee_vnd - order.total_amount_vnd)
    return subtotal_vnd, savings_vnd


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


@router.get("/me/{order_code}", response_model=MyOrderDetailOut)
def get_my_order_detail(
    order_code: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db, scope="function"),
) -> MyOrderDetailOut:
    order = _load_owned_order(db, user, order_code)
    children_by_parent = _children_by_parent(order)

    subtotal_vnd, savings_vnd = _order_subtotal_and_savings(order)
    timeline_rows = sorted(order.tracking, key=lambda t: t.created_at)

    return MyOrderDetailOut(
        order_code=order.order_code,
        created_at=order.created_at,
        status=order.current_status.value,
        recipient_name=order.recipient_name,
        delivery_address=order.delivery_address,
        delivery_note=order.delivery_note,
        promised_at=order.promised_at,
        lines=[_line_to_out(it, children_by_parent) for it in _top_level(order)],
        subtotal_vnd=subtotal_vnd,
        delivery_fee_vnd=order.delivery_fee_vnd,
        savings_vnd=savings_vnd,
        total_vnd=order.total_amount_vnd,
        timeline=[
            TrackTimelineEntry(status=row.status.value, at=row.created_at) for row in timeline_rows
        ],
    )


def _recover_option_ids(db: Session, product_id: int, item: OrderItem) -> list[int] | None:
    rows = db.execute(
        select(Option.option_id, Option.name, OptionGroup.name)
        .join(OptionGroup, Option.group_id == OptionGroup.group_id)
        .join(ProductOption, ProductOption.option_id == Option.option_id)
        .where(ProductOption.product_id == product_id)
    ).all()
    by_key = {(group_name, opt_name): oid for oid, opt_name, group_name in rows}
    out: list[int] = []
    for snap in sorted(item.options, key=lambda o: o.id):
        key = (snap.group_name, snap.option_name)
        oid = by_key.get(key)
        if oid is None:
            return None
        out.append(oid)
    return out


def _combo_selections(
    db: Session,
    combo: Combo,
    children: list[OrderItem],
) -> list[ComboSelectionIn] | None:
    if combo.combo_items is None:
        return None
    components = sorted(combo.combo_items, key=lambda ci: ci.combo_item_id)
    remaining = list(children)
    selections: list[ComboSelectionIn] = []

    for ci in components:
        if ci.product_id is not None:
            pool = [c for c in remaining if c.product_id == ci.product_id]
        elif ci.category_id is not None:
            eligible = set(
                db.scalars(
                    select(Product.product_id).where(
                        Product.category_id == ci.category_id,
                        Product.is_active.is_(True),
                    )
                ).all()
            )
            pool = [c for c in remaining if c.product_id in eligible]
        else:
            return None

        if len(pool) < ci.quantity:
            return None
        picked = pool[: ci.quantity]
        for c in picked:
            remaining.remove(c)

        picks: list[ComboPickIn] = []
        for child in picked:
            if child.product_id is None:
                return None
            option_ids = _recover_option_ids(db, child.product_id, child)
            if option_ids is None and child.options:
                return None
            picks.append(
                ComboPickIn(product_id=child.product_id, option_ids=option_ids or [])
            )
        selections.append(ComboSelectionIn(combo_item_id=ci.combo_item_id, picks=picks))

    if remaining:
        return None
    return selections


def _unavailable_description(item: OrderItem) -> str:
    return _summary_line(item)


def _candidate_for_line(
    db: Session,
    item: OrderItem,
    children_by_parent: dict[int, list[OrderItem]],
) -> tuple[AddLineIn | None, UnavailableLineOut | None]:
    if item.combo_id is not None:
        combo = item.combo
        if combo is None:
            return None, UnavailableLineOut(
                description=_unavailable_description(item),
                reason="combo_unavailable",
            )
        now = datetime.now(UTC).replace(tzinfo=None)
        status = combo_status(combo.validity_start, combo.validity_end, now)
        if status is not ComboStatus.ACTIVE:
            return None, UnavailableLineOut(
                description=_unavailable_description(item),
                reason="combo_unavailable",
            )
        kids = children_by_parent.get(item.order_item_id, [])
        kids.sort(key=lambda c: c.order_item_id)
        selections = _combo_selections(db, combo, kids)
        if selections is None:
            return None, UnavailableLineOut(
                description=_unavailable_description(item),
                reason="combo_changed",
            )
        return (
            AddComboLineIn(
                kind="combo",
                combo_id=combo.combo_id,
                quantity=item.quantity,
                selections=selections,
            ),
            None,
        )

    if item.product_id is None:
        return None, UnavailableLineOut(
            description=_unavailable_description(item),
            reason="item_unavailable",
        )
    product = db.get(Product, item.product_id)
    if product is None or not product.is_active:
        return None, UnavailableLineOut(
            description=_unavailable_description(item),
            reason="item_unavailable",
        )
    option_ids = _recover_option_ids(db, product.product_id, item)
    if option_ids is None:
        return None, UnavailableLineOut(
            description=_unavailable_description(item),
            reason="option_changed",
        )
    return (
        AddItemLineIn(
            kind="item",
            item_id=product.product_id,
            option_ids=option_ids,
            quantity=item.quantity,
            note=item.notes,
        ),
        None,
    )


@router.post(
    "/me/{order_code}/reorder",
    response_model=ReorderResultOut,
    dependencies=[Depends(enforce_csrf)],
)
def reorder_my_order(
    order_code: str,
    request: Request,
    response: Response,
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db, scope="function"),
    settings: Settings = Depends(get_settings_dependency),
) -> ReorderResultOut:
    order = _load_owned_order(db, user, order_code, for_reorder=True)
    children_by_parent = _children_by_parent(order)
    unavailable: list[UnavailableLineOut] = []
    added_count = 0
    cart = ensure_cart(db, request)

    for line in _top_level(order):
        body, skip = _candidate_for_line(db, line, children_by_parent)
        if skip is not None:
            unavailable.append(skip)
            continue
        assert body is not None
        try:
            append_line_to_cart(db, cart, body)
            added_count += 1
        except APIError:
            reason: UnavailableReason = (
                "combo_changed" if isinstance(body, AddComboLineIn) else "option_changed"
            )
            unavailable.append(
                UnavailableLineOut(
                    description=_unavailable_description(line),
                    reason=reason,
                )
            )

    touch_and_gc(db, cart)
    db.commit()
    db.refresh(cart)
    cart_out = _render_cart(db, request, response, settings)
    return ReorderResultOut(cart=cart_out, added_count=added_count, unavailable=unavailable)
