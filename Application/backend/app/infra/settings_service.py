from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.domain.loyalty import (
    LOYALTY_ACCRUAL_RATE,
    LOYALTY_MAX_REDEEM_PCT,
    LOYALTY_REDEEM_VALUE_VND,
)
from app.domain.pricing import DELIVERY_FEE_VND
from app.domain.service_area import INNER_HANOI_WARDS, _fold
from app.infra.db.models import BusinessSettings, DeliveryWardFee

_DEFAULT_TIMEZONE = "Asia/Ho_Chi_Minh"


@dataclass(frozen=True)
class BusinessSettingsData:
    timezone: str
    loyalty_accrual_rate: int
    loyalty_redeem_value_vnd: int
    loyalty_max_redeem_pct: float


def get_business_settings(db: Session) -> BusinessSettingsData:
    row = db.get(BusinessSettings, 1)
    if row is None:
        return BusinessSettingsData(
            timezone=_DEFAULT_TIMEZONE,
            loyalty_accrual_rate=LOYALTY_ACCRUAL_RATE,
            loyalty_redeem_value_vnd=LOYALTY_REDEEM_VALUE_VND,
            loyalty_max_redeem_pct=float(LOYALTY_MAX_REDEEM_PCT),
        )
    return BusinessSettingsData(
        timezone=row.timezone,
        loyalty_accrual_rate=row.loyalty_accrual_rate,
        loyalty_redeem_value_vnd=row.loyalty_redeem_value_vnd,
        loyalty_max_redeem_pct=float(row.loyalty_max_redeem_pct),
    )


def update_business_settings(
    db: Session,
    *,
    timezone: str,
    loyalty_accrual_rate: int,
    loyalty_redeem_value_vnd: int,
    loyalty_max_redeem_pct: float,
) -> None:
    row = db.get(BusinessSettings, 1)
    if row is None:
        db.add(
            BusinessSettings(
                id=1,
                timezone=timezone,
                loyalty_accrual_rate=loyalty_accrual_rate,
                loyalty_redeem_value_vnd=loyalty_redeem_value_vnd,
                loyalty_max_redeem_pct=loyalty_max_redeem_pct,
            )
        )
    else:
        row.timezone = timezone
        row.loyalty_accrual_rate = loyalty_accrual_rate
        row.loyalty_redeem_value_vnd = loyalty_redeem_value_vnd
        row.loyalty_max_redeem_pct = loyalty_max_redeem_pct
    db.flush()


def get_ward_fees(db: Session) -> dict[str, int]:
    rows = db.query(DeliveryWardFee).all()
    if not rows:
        return {_fold(w): DELIVERY_FEE_VND for w in INNER_HANOI_WARDS}
    return {row.ward_normalized: row.fee_vnd for row in rows}


def list_ward_fees(db: Session) -> list[tuple[str, int]]:
    rows = db.query(DeliveryWardFee).order_by(DeliveryWardFee.ward_name).all()
    if not rows:
        return sorted((w, DELIVERY_FEE_VND) for w in INNER_HANOI_WARDS)
    return [(row.ward_name, row.fee_vnd) for row in rows]


# Caller must enforce a non-empty set; an empty replace leaves the table empty,
# which get_ward_fees/list_ward_fees then read back as the default ward set.
def replace_ward_fees(db: Session, items: list[tuple[str, int]]) -> None:
    db.query(DeliveryWardFee).delete(synchronize_session=False)
    for ward_name, fee_vnd in items:
        db.add(
            DeliveryWardFee(
                ward_name=ward_name,
                ward_normalized=_fold(ward_name),
                fee_vnd=fee_vnd,
            )
        )
    db.flush()
