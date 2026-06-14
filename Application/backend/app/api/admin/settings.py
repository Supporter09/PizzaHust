"""A13 – admin write endpoints for business settings and per-ward delivery fees.

Read side lives in app/api/config.py. These routes upsert the two settings
tables via app.infra.settings_service, which falls back to constant defaults
when unseeded. Business logic stays in domain/service modules; routers stay
thin: validate -> service -> DTO.
"""

from __future__ import annotations

from zoneinfo import available_timezones

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.domain.service_area import _fold
from app.infra import settings_service
from app.infra.auth import require_role
from app.infra.db.deps import get_db
from app.infra.db.models import User, UserRole

router = APIRouter(prefix="/api/admin", tags=["admin-settings"])
require_admin = require_role(UserRole.ADMIN)


def _conflict(message: str) -> APIError:
    return APIError(code="CONFLICT", message=message, status_code=409)


class SettingsIn(BaseModel):
    timezone: str
    loyalty_accrual_rate: int = Field(gt=0)
    loyalty_redeem_value_vnd: int = Field(gt=0)
    loyalty_max_redeem_pct: float = Field(gt=0, le=1)

    @field_validator("timezone")
    @classmethod
    def _valid_tz(cls, v: str) -> str:
        if v not in available_timezones():
            raise ValueError("Unknown IANA timezone")
        return v


class SettingsOut(BaseModel):
    timezone: str
    loyalty_accrual_rate: int
    loyalty_redeem_value_vnd: int
    loyalty_max_redeem_pct: float


class WardFeeIn(BaseModel):
    ward: str = Field(min_length=1)
    fee_vnd: int = Field(ge=0)


class WardFeesIn(BaseModel):
    wards: list[WardFeeIn] = Field(min_length=1)


class WardFeeOut(BaseModel):
    ward: str
    fee_vnd: int


class WardFeesOut(BaseModel):
    wards: list[WardFeeOut]


def _settings_out(data: settings_service.BusinessSettingsData) -> SettingsOut:
    return SettingsOut(
        timezone=data.timezone,
        loyalty_accrual_rate=data.loyalty_accrual_rate,
        loyalty_redeem_value_vnd=data.loyalty_redeem_value_vnd,
        loyalty_max_redeem_pct=data.loyalty_max_redeem_pct,
    )


def _ward_fees_out(db: Session) -> WardFeesOut:
    rows = settings_service.list_ward_fees(db)
    return WardFeesOut(wards=[WardFeeOut(ward=name, fee_vnd=fee) for name, fee in rows])


@router.get("/settings", response_model=SettingsOut)
def get_settings(
    db: Session = Depends(get_db),
    _a: User = Depends(require_admin),
) -> SettingsOut:
    return _settings_out(settings_service.get_business_settings(db))


@router.put("/settings", response_model=SettingsOut)
def put_settings(
    body: SettingsIn,
    db: Session = Depends(get_db),
    _a: User = Depends(require_admin),
) -> SettingsOut:
    settings_service.update_business_settings(
        db,
        timezone=body.timezone,
        loyalty_accrual_rate=body.loyalty_accrual_rate,
        loyalty_redeem_value_vnd=body.loyalty_redeem_value_vnd,
        loyalty_max_redeem_pct=body.loyalty_max_redeem_pct,
    )
    db.commit()
    return _settings_out(settings_service.get_business_settings(db))


@router.get("/settings/ward-fees", response_model=WardFeesOut)
def get_ward_fees(
    db: Session = Depends(get_db),
    _a: User = Depends(require_admin),
) -> WardFeesOut:
    return _ward_fees_out(db)


@router.put("/settings/ward-fees", response_model=WardFeesOut)
def put_ward_fees(
    body: WardFeesIn,
    db: Session = Depends(get_db),
    _a: User = Depends(require_admin),
) -> WardFeesOut:
    # replace_ward_fees does not dedup; two wards whose folded form collides
    # would violate the ward_normalized UNIQUE constraint, so reject here.
    seen: set[str] = set()
    for w in body.wards:
        key = _fold(w.ward)
        if key in seen:
            raise _conflict(f"Duplicate ward: {w.ward}")
        seen.add(key)
    settings_service.replace_ward_fees(db, [(w.ward, w.fee_vnd) for w in body.wards])
    db.commit()
    return _ward_fees_out(db)
