from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.infra.timezone import business_now, business_today, day_bounds


def test_day_bounds_converts_business_day_to_utc():
    # 2026-06-14 as an Asia/Ho_Chi_Minh (+07) calendar day spans
    # 2026-06-13 17:00 UTC .. 2026-06-14 17:00 UTC (naive UTC for DB comparison).
    start, end = day_bounds(date(2026, 6, 14), date(2026, 6, 14), "Asia/Ho_Chi_Minh")
    assert start == datetime(2026, 6, 13, 17, 0, 0)
    assert end == datetime(2026, 6, 14, 17, 0, 0)
    assert start.tzinfo is None and end.tzinfo is None


def test_day_bounds_multi_day_range():
    start, end = day_bounds(date(2026, 6, 10), date(2026, 6, 12), "Asia/Ho_Chi_Minh")
    assert start == datetime(2026, 6, 9, 17, 0, 0)
    assert end == datetime(2026, 6, 12, 17, 0, 0)


def test_day_bounds_utc_zone_is_identity():
    start, end = day_bounds(date(2026, 6, 14), date(2026, 6, 14), "UTC")
    assert start == datetime(2026, 6, 14, 0, 0, 0)
    assert end == datetime(2026, 6, 15, 0, 0, 0)


def test_business_now_returns_naive_utc_instant():
    n = business_now()
    assert n.tzinfo is None
    assert isinstance(n, datetime)
    _ = ZoneInfo("Asia/Ho_Chi_Minh")  # tzdata resolves


def test_business_today_is_a_date():
    assert isinstance(business_today("Asia/Ho_Chi_Minh"), date)
