"""T2 – Delivery webhook handler. HMAC-verified, idempotent."""

from __future__ import annotations

import hashlib
import hmac
import os
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.infra.db.deps import get_db
from app.infra.db.models import Order, OrderStatus, OrderTracking, WebhookEvent

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

DeliveryState = Literal["Accepted", "PickedUp", "Delivering", "Delivered", "Failed"]

_STATE_TO_ORDER_STATUS: dict[str, OrderStatus] = {
    "Accepted": OrderStatus.DELIVERING,
    "PickedUp": OrderStatus.DELIVERING,
    "Delivering": OrderStatus.DELIVERING,
    "Delivered": OrderStatus.DELIVERED,
    "Failed": OrderStatus.DELIVERY_FAILED,
}


class DeliveryEvent(BaseModel):
    reference: str
    state: DeliveryState
    event_id: str | None = None


def _verify_hmac(body: bytes, signature: str) -> bool:
    secret = os.environ.get("DELIVERY_WEBHOOK_SECRET", "")
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


@router.post("/delivery", status_code=status.HTTP_204_NO_CONTENT)
async def delivery_webhook(
    request: Request,
    x_signature: str = Header(..., alias="X-Signature"),
    db: Session = Depends(get_db),
) -> None:
    body = await request.body()

    if not _verify_hmac(body, x_signature):
        raise HTTPException(status_code=401, detail="UNAUTHENTICATED")

    event = DeliveryEvent.model_validate_json(body)

    event_key = event.event_id or f"{event.reference}:{event.state}"
    existing = db.scalar(select(WebhookEvent).where(WebhookEvent.event_id == event_key))
    if existing is not None:
        return

    db.add(WebhookEvent(event_id=event_key))

    order: Order | None = db.scalar(
        select(Order).where(Order.delivery_reference == event.reference)
    )
    if order is None:
        return

    new_status = _STATE_TO_ORDER_STATUS.get(event.state)
    if new_status is None:
        return

    if order.current_status in (OrderStatus.DELIVERED, OrderStatus.CANCELLED):
        return

    order.current_status = new_status
    db.add(OrderTracking(
        order_id=order.order_id,
        updated_by=None,
        status=new_status,
        note=f"delivery webhook: {event.state}",
    ))
