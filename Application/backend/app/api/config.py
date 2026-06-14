from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.domain.loyalty import (
    LOYALTY_ACCRUAL_RATE,
    LOYALTY_MAX_REDEEM_PCT,
    LOYALTY_REDEEM_VALUE_VND,
)
from app.domain.pricing import DELIVERY_FEE_VND
from app.domain.service_area import INNER_HANOI_WARDS
from app.infra import settings_service
from app.infra.db.deps import get_db

router = APIRouter(prefix="/api/config", tags=["config"])


class DeliveryConfigOut(BaseModel):
    fee_vnd: int
    service_area: list[str]


class LoyaltyConfigOut(BaseModel):
    accrual_rate: int
    redeem_value_vnd: int
    max_redeem_pct: float


class BusinessConfigOut(BaseModel):
    timezone: str


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


@router.get("/business", response_model=BusinessConfigOut)
def business_config(db: Session = Depends(get_db)) -> BusinessConfigOut:
    return BusinessConfigOut(timezone=settings_service.get_business_settings(db).timezone)
