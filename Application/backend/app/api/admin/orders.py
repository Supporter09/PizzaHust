"""A5 – Monitor Orders (admin only). Also exposes retry for DispatchPending."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.order_state import OrderTransitionError, transition
from app.infra.auth import require_role
from app.infra.config import Settings, get_settings_dependency
from app.infra.db.deps import get_db
from app.infra.db.models import Order, OrderStatus, OrderTracking, User, UserRole
from app.infra.delivery import get_delivery_port
from app.infra.delivery.port import DeliveryError, DeliveryPort
from app.services.orders import dispatch_order

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


class OrderCancelIn(BaseModel):
    reason: str | None = None


@router.get("", response_model=list[OrderSummaryOut])
def list_orders(
    status: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db, scope="function"),
    _admin: User = Depends(require_admin),
) -> list[OrderSummaryOut]:
    stmt = select(Order)
    if status:
        try:
            s = OrderStatus(status)
        except ValueError:
            raise HTTPException(status_code=400, detail="VALIDATION_FAILED") from None
        stmt = stmt.where(Order.current_status == s)
    stmt = stmt.order_by(Order.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    orders = db.scalars(stmt).all()
    return [OrderSummaryOut.model_validate(o) for o in orders]


@router.get("/{order_id}", response_model=OrderSummaryOut)
def get_order(
    order_id: int,
    db: Session = Depends(get_db, scope="function"),
    _admin: User = Depends(require_admin),
) -> OrderSummaryOut:
    order: Order | None = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    return OrderSummaryOut.model_validate(order)


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
        dispatch_order(db, order=order, port=port, settings=settings, actor_id=admin.user_id)
    except DeliveryError as exc:
        raise HTTPException(status_code=502, detail="DELIVERY_UPSTREAM_ERROR") from exc
