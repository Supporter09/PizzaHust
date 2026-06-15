from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.infra import settings_service
from app.infra.auth import get_current_user
from app.infra.db.deps import get_db
from app.infra.db.models import Order, OrderStatus, User

router = APIRouter(prefix="/api/loyalty", tags=["loyalty"])


class LoyaltyMeResponse(BaseModel):
    current_points: int
    pending_points: int
    total_points_earned: int
    redeemable_value_vnd: int


class LoyaltyHistoryRow(BaseModel):
    label: str
    date: datetime
    points_delta: int
    kind: Literal["earn", "redeem"]


@router.get("/me", response_model=LoyaltyMeResponse)
async def loyalty_me(
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> LoyaltyMeResponse:
    redeem_value = settings_service.get_business_settings(db).loyalty_redeem_value_vnd
    pending_points = db.scalar(
        select(func.sum(Order.loyalty_points_redeemed)).where(
            Order.user_id == user.user_id,
            Order.loyalty_points_redeemed > 0,
            Order.current_status.notin_(
                [OrderStatus.DELIVERED, OrderStatus.DELIVERY_FAILED, OrderStatus.CANCELLED]
            ),
        )
    )
    reserved = 0 if pending_points is None else int(pending_points)
    return LoyaltyMeResponse(
        current_points=user.current_points,
        pending_points=reserved,
        total_points_earned=user.total_points_earned,
        redeemable_value_vnd=user.current_points * redeem_value,
    )


@router.get("/me/history", response_model=list[LoyaltyHistoryRow])
async def loyalty_history(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[LoyaltyHistoryRow]:
    orders = db.scalars(
        select(Order)
        .where(Order.user_id == user.user_id)
        .order_by(Order.created_at.desc(), Order.order_id.desc())
    ).all()
    rows: list[LoyaltyHistoryRow] = []
    for o in orders:
        if o.loyalty_points_earned > 0 and o.current_status == OrderStatus.DELIVERED:
            rows.append(
                LoyaltyHistoryRow(
                    label=f"Order {o.order_code}",
                    date=o.created_at,
                    points_delta=o.loyalty_points_earned,
                    kind="earn",
                )
            )
        if o.loyalty_points_redeemed > 0:
            rows.append(
                LoyaltyHistoryRow(
                    label=f"Redeemed on {o.order_code}",
                    date=o.created_at,
                    points_delta=-o.loyalty_points_redeemed,
                    kind="redeem",
                )
            )
    return rows
