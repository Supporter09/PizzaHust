from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.domain.loyalty import (
    LOYALTY_ACCRUAL_RATE,
    LOYALTY_MAX_REDEEM_PCT,
    LOYALTY_REDEEM_VALUE_VND,
)
from app.domain.pricing import DELIVERY_FEE_VND
from app.domain.service_area import INNER_HANOI_WARDS

router = APIRouter(prefix="/api/config", tags=["config"])


class DeliveryConfigOut(BaseModel):
    fee_vnd: int
    service_area: list[str]


class LoyaltyConfigOut(BaseModel):
    accrual_rate: int
    redeem_value_vnd: int
    max_redeem_pct: float


@router.get("/delivery", response_model=DeliveryConfigOut)
def delivery_config() -> DeliveryConfigOut:
    return DeliveryConfigOut(
        fee_vnd=DELIVERY_FEE_VND,
        service_area=sorted(INNER_HANOI_WARDS),
    )


@router.get("/loyalty", response_model=LoyaltyConfigOut)
def loyalty_config() -> LoyaltyConfigOut:
    return LoyaltyConfigOut(
        accrual_rate=LOYALTY_ACCRUAL_RATE,
        redeem_value_vnd=LOYALTY_REDEEM_VALUE_VND,
        max_redeem_pct=LOYALTY_MAX_REDEEM_PCT,
    )
