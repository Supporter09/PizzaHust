from __future__ import annotations

from app.domain.options import SelectableOption, validate_option_selection


def _opts() -> list[SelectableOption]:
    return [
        SelectableOption(
            option_id=1, group_id=10, group_name="Size", select_type="single", required=True
        ),
        SelectableOption(
            option_id=2, group_id=10, group_name="Size", select_type="single", required=True
        ),
        SelectableOption(
            option_id=3, group_id=20, group_name="Toppings", select_type="multi", required=False
        ),
        SelectableOption(
            option_id=4, group_id=20, group_name="Toppings", select_type="multi", required=False
        ),
    ]


def test_valid_selection_returns_none():
    assert validate_option_selection(_opts(), [1, 3, 4]) is None


def test_unknown_option_id_rejected():
    err = validate_option_selection(_opts(), [1, 99])
    assert err is not None
    assert err.reason == "option_not_available"
    assert err.option_id == 99


def test_required_single_group_missing():
    err = validate_option_selection(_opts(), [3])
    assert err is not None
    assert err.reason == "required_group_missing"
    assert err.group_name == "Size"


def test_two_picks_in_single_group_rejected():
    err = validate_option_selection(_opts(), [1, 2])
    assert err is not None
    assert err.reason == "single_group_conflict"
    assert err.group_name == "Size"


def test_required_group_with_no_enabled_options_not_enforced():
    only_toppings = [o for o in _opts() if o.group_id == 20]
    assert validate_option_selection(only_toppings, [3]) is None


def test_empty_selection_ok_when_nothing_required():
    only_toppings = [o for o in _opts() if o.group_id == 20]
    assert validate_option_selection(only_toppings, []) is None
