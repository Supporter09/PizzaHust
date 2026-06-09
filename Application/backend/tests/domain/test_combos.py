from datetime import datetime

from app.domain.combos import (
    ComboStatus,
    combo_price_below_items,
    combo_savings_vnd,
    combo_status,
)

T0 = datetime(2026, 6, 1, 10, 0, 0)
START = datetime(2026, 6, 5, 0, 0, 0)
END = datetime(2026, 6, 10, 0, 0, 0)


def test_no_window_is_active():
    assert combo_status(None, None, T0) is ComboStatus.ACTIVE


def test_before_start_is_scheduled():
    assert combo_status(START, END, datetime(2026, 6, 4, 23, 59)) is ComboStatus.SCHEDULED


def test_after_end_is_expired():
    assert combo_status(START, END, datetime(2026, 6, 10, 0, 1)) is ComboStatus.EXPIRED


def test_within_window_is_active():
    assert combo_status(START, END, datetime(2026, 6, 7)) is ComboStatus.ACTIVE


def test_at_start_boundary_is_active():
    assert combo_status(START, END, START) is ComboStatus.ACTIVE


def test_at_end_boundary_is_active():
    assert combo_status(START, END, END) is ComboStatus.ACTIVE


def test_only_start_set_future_scheduled():
    assert combo_status(START, None, T0) is ComboStatus.SCHEDULED


def test_only_end_set_past_expired():
    assert combo_status(None, END, datetime(2026, 6, 11)) is ComboStatus.EXPIRED


def test_price_below_items_true_when_cheaper():
    assert combo_price_below_items(200_000, 255_000) is True


def test_price_below_items_false_when_equal_or_more():
    assert combo_price_below_items(255_000, 255_000) is False


def test_savings_positive_when_combo_cheaper():
    assert combo_savings_vnd(200_000, 255_000) == 55_000


def test_savings_zero_when_equal():
    assert combo_savings_vnd(255_000, 255_000) == 0


def test_savings_clamped_zero_when_overpriced():
    assert combo_savings_vnd(300_000, 255_000) == 0
