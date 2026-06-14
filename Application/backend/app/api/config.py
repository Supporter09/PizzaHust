from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.infra import settings_service
from app.infra.db.deps import get_db

router = APIRouter(prefix="/api/config", tags=["config"])


class WardFeeOut(BaseModel):
    ward: str
    fee_vnd: int


class DeliveryConfigOut(BaseModel):
    ward_fees: list[WardFeeOut]
    service_area: list[str]


class LoyaltyConfigOut(BaseModel):
    accrual_rate: int
    redeem_value_vnd: int
    max_redeem_pct: float


class BusinessConfigOut(BaseModel):
    timezone: str


@router.get("/delivery", response_model=DeliveryConfigOut)
def delivery_config(db: Session = Depends(get_db)) -> DeliveryConfigOut:
    pairs = settings_service.list_ward_fees(db)
    return DeliveryConfigOut(
        ward_fees=[WardFeeOut(ward=name, fee_vnd=fee) for name, fee in pairs],
        service_area=[name for name, _ in pairs],
    )


@router.get("/loyalty", response_model=LoyaltyConfigOut)
def loyalty_config(db: Session = Depends(get_db)) -> LoyaltyConfigOut:
    s = settings_service.get_business_settings(db)
    return LoyaltyConfigOut(
        accrual_rate=s.loyalty_accrual_rate,
        redeem_value_vnd=s.loyalty_redeem_value_vnd,
        max_redeem_pct=s.loyalty_max_redeem_pct,
    )


@router.get("/business", response_model=BusinessConfigOut)
def business_config(db: Session = Depends(get_db)) -> BusinessConfigOut:
    return BusinessConfigOut(timezone=settings_service.get_business_settings(db).timezone)
