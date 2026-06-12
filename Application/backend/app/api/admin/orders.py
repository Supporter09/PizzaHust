"""A5 – Monitor Orders (admin only). Also exposes retry for DispatchPending."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.domain.order_state import OrderTransitionError, transition
from app.infra.auth import require_role
from app.infra.config import Settings, get_settings_dependency
from app.infra.db.deps import get_db
from app.infra.db.models import (
    Order,
    OrderItem,
    OrderStatus,
    OrderTracking,
    TrackingNoteSource,
    User,
    UserRole,
)
from app.infra.delivery import get_delivery_port
from app.infra.delivery.port import DeliveryError, DeliveryPort, OrderForDispatch

router = APIRouter(prefix="/api/admin/orders", tags=["admin-orders"])

require_admin = require_role(UserRole.ADMIN)


class OrderSummaryOut(BaseModel):
    order_id: int
    order_code: str
    current_status: str
    recipient_name: str
    recipient_phone: str
    delivery_address: str
    total_amount_vnd: int
    created_at: datetime
    user_id: int | None

    model_config = {"from_attributes": True}


class OrderItemOptionOut(BaseModel):
    id: int
    group_name: str
    option_name: str
    price_delta_vnd: int


class OrderItemOut(BaseModel):
    order_item_id: int
    product_id: int | None
    combo_id: int | None
    display_name: str
    quantity: int
    unit_price_vnd: int
    notes: str | None
    options: list[OrderItemOptionOut]


class OrderTrackingOut(BaseModel):
    tracking_id: int
    status: str
    note_source: str
    created_at: datetime
    note: str | None
    updated_by: int | None


class OrderDetailOut(OrderSummaryOut):
    promised_at: datetime
    payment_method: str
    delivery_fee_vnd: int
    delivery_reference: str | None
    items: list[OrderItemOut]
    tracking: list[OrderTrackingOut]


class OrderCancelIn(BaseModel):
    reason: str | None = None


def _date_window(from_date: date | None, to_date: date | None) -> tuple[datetime, datetime]:
    start = from_date or to_date or datetime.now().date()
    end = to_date or from_date or start
    if start > end:
        raise HTTPException(status_code=400, detail="VALIDATION_FAILED")
    return (
        datetime.combine(start, time.min),
        datetime.combine(end + timedelta(days=1), time.min),
    )


def _summary_payload(order: Order) -> dict[str, object]:
    return {
        "order_id": order.order_id,
        "order_code": order.order_code,
        "current_status": order.current_status.value,
        "recipient_name": order.recipient_name,
        "recipient_phone": order.recipient_phone,
        "delivery_address": order.delivery_address,
        "total_amount_vnd": order.total_amount_vnd,
        "created_at": order.created_at,
        "user_id": order.user_id,
    }


def _item_display_name(item: OrderItem) -> str:
    if item.combo is not None:
        return item.combo.name
    if item.product is not None:
        return item.product.name
    return "Unknown item"


def _item_options(item: OrderItem) -> list[OrderItemOptionOut]:
    return [
        OrderItemOptionOut(
            id=option.id,
            group_name=option.group_name,
            option_name=option.option_name,
            price_delta_vnd=option.price_delta_vnd,
        )
        for option in item.options
    ]


def _order_detail_payload(order: Order) -> OrderDetailOut:
    items = [
        OrderItemOut(
            order_item_id=item.order_item_id,
            product_id=item.product_id,
            combo_id=item.combo_id,
            display_name=_item_display_name(item),
            quantity=item.quantity,
            unit_price_vnd=item.unit_price_vnd,
            notes=item.notes,
            options=_item_options(item),
        )
        for item in order.items
    ]
    tracking = [
        OrderTrackingOut(
            tracking_id=event.tracking_id,
            status=event.status.value,
            note_source=event.note_source.value,
            created_at=event.created_at,
            note=event.note,
            updated_by=event.updated_by,
        )
        for event in sorted(order.tracking, key=lambda row: row.created_at)
    ]
    return OrderDetailOut(
        **_summary_payload(order),
        promised_at=order.promised_at,
        payment_method=order.payment_method,
        delivery_fee_vnd=order.delivery_fee_vnd,
        delivery_reference=order.delivery_reference,
        items=items,
        tracking=tracking,
    )


@router.get("", response_model=list[OrderSummaryOut])
def list_orders(
    status: str | None = None,
    from_date: date | None = Query(default=None, alias="from"),
    to_date: date | None = Query(default=None, alias="to"),
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db, scope="function"),
    _admin: User = Depends(require_admin),
) -> list[OrderSummaryOut]:
    start_dt, end_dt = _date_window(from_date, to_date)
    stmt = select(Order).where(Order.created_at >= start_dt, Order.created_at < end_dt)
    if status:
        try:
            s = OrderStatus(status)
        except ValueError:
            raise HTTPException(status_code=400, detail="VALIDATION_FAILED") from None
        stmt = stmt.where(Order.current_status == s)
    stmt = stmt.order_by(Order.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    orders = db.scalars(stmt).all()
    return [OrderSummaryOut.model_validate(_summary_payload(order)) for order in orders]


@router.get("/{order_id}", response_model=OrderDetailOut)
def get_order(
    order_id: int,
    db: Session = Depends(get_db, scope="function"),
    _admin: User = Depends(require_admin),
) -> OrderDetailOut:
    order: Order | None = db.scalar(
        select(Order)
        .where(Order.order_id == order_id)
        .options(
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.items).selectinload(OrderItem.combo),
            selectinload(Order.items).selectinload(OrderItem.options),
            selectinload(Order.tracking),
        )
    )
    if order is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    return _order_detail_payload(order)


@router.post("/{order_id}/cancel", status_code=204)
def cancel_order(
    order_id: int,
    body: OrderCancelIn,
    db: Session = Depends(get_db, scope="function"),
    admin: User = Depends(require_admin),
) -> None:
    order: Order | None = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    try:
        new_status = OrderStatus(
            transition(order.current_status.value, OrderStatus.CANCELLED.value)
        )
    except OrderTransitionError:
        raise HTTPException(status_code=409, detail="CONFLICT") from None
    order.current_status = new_status
    db.add(
        OrderTracking(
            order_id=order.order_id,
            updated_by=admin.user_id,
            status=new_status,
            note_source=TrackingNoteSource.SYSTEM,
            note=body.reason,
        )
    )


@router.post("/{order_id}/retry-dispatch", status_code=204)
def retry_dispatch(
    order_id: int,
    db: Session = Depends(get_db, scope="function"),
    admin: User = Depends(require_admin),
    port: DeliveryPort = Depends(get_delivery_port),
    settings: Settings = Depends(get_settings_dependency),
) -> None:
    """Hand a DispatchPending order to the delivery provider.

    On success: store the reference and advance to Delivering. On provider
    failure: leave the order in DispatchPending so the admin can retry, and 502.
    """
    # Lock the row so two concurrent retries can't both pass the status check and
    # double-dispatch: the second blocks here, then sees Delivering and 409s.
    order: Order | None = db.get(Order, order_id, with_for_update=True)
    if order is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    if order.current_status != OrderStatus.DISPATCH_PENDING:
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
    except DeliveryError as exc:
        raise HTTPException(status_code=502, detail="DELIVERY_UPSTREAM_ERROR") from exc
    order.delivery_reference = ref.reference
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
            updated_by=admin.user_id,
            status=new_status,
            note_source=TrackingNoteSource.TRANSPORT,
            note=f"Dispatched to delivery: {ref.reference}",
        )
    )
