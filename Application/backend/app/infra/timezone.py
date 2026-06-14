"""Business-timezone helpers. Timestamps are stored naive UTC; these convert a
business-tz calendar day into naive-UTC bounds for filtering, and return the
current instant/date in the business timezone. Pure (no IO) so callers pass the
tz string in."""

from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo


def _to_naive_utc(value: datetime) -> datetime:
    return value.astimezone(UTC).replace(tzinfo=None)


def business_now() -> datetime:
    """Current instant as naive UTC (comparable to DateTime(timezone=False) cols)."""
    return datetime.now(UTC).replace(tzinfo=None)


def business_today(tz: str) -> date:
    """The calendar date 'now' falls on in the business timezone."""
    return datetime.now(ZoneInfo(tz)).date()


def day_bounds(start: date, end: date, tz: str) -> tuple[datetime, datetime]:
    """Inclusive [start, end] business-tz calendar days -> naive-UTC [start, end+1day)."""
    zone = ZoneInfo(tz)
    start_local = datetime.combine(start, time.min, tzinfo=zone)
    end_local = datetime.combine(end + timedelta(days=1), time.min, tzinfo=zone)
    return _to_naive_utc(start_local), _to_naive_utc(end_local)
