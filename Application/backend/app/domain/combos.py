from __future__ import annotations

from datetime import datetime
from enum import StrEnum


class ComboStatus(StrEnum):
    SCHEDULED = "Scheduled"
    ACTIVE = "Active"
    EXPIRED = "Expired"


def combo_status(
    validity_start: datetime | None,
    validity_end: datetime | None,
    now: datetime,
) -> ComboStatus:
    """Derive a combo's lifecycle state from its validity window (naive UTC)."""
    if validity_start is not None and now < validity_start:
        return ComboStatus.SCHEDULED
    if validity_end is not None and now > validity_end:
        return ComboStatus.EXPIRED
    return ComboStatus.ACTIVE


def combo_price_below_items(combo_price_vnd: int, items_total_vnd: int) -> bool:
    """Advisory only: True if the bundle is cheaper than its parts. Never used to reject."""
    return combo_price_vnd < items_total_vnd
