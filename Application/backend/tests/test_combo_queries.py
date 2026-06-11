"""A10: slot availability = active category with ≥1 active product."""

from __future__ import annotations

from app.infra.db.combo_queries import slot_availability
from app.infra.db.session import create_session_factory
from tests.admin_test_utils import new_category, new_product
from tests.auth_test_utils import build_test_app


def test_slot_availability_min_price_and_unavailable_modes():
    build_test_app("slot-queries")
    ok_cat = new_category("Drinks")
    new_product(ok_cat, "Cola", base_price_vnd=15_000, is_pizza=False)
    new_product(ok_cat, "Juice", base_price_vnd=25_000, is_pizza=False)
    new_product(ok_cat, "Gone", base_price_vnd=5_000, is_pizza=False, is_active=False)
    inactive_cat = new_category("Hidden", is_active=False)
    new_product(inactive_cat, "X", base_price_vnd=10_000, is_pizza=False)
    empty_cat = new_category("Empty")

    with create_session_factory()() as db:
        out = slot_availability(db, [ok_cat, inactive_cat, empty_cat, 9999])
    assert out[ok_cat] == 15_000
    assert out[inactive_cat] is None
    assert out[empty_cat] is None
    assert out[9999] is None
