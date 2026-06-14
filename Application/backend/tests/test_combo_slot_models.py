"""A10: combo_items XOR constraint and combos.image_url at the model layer."""

from __future__ import annotations

import pytest
from sqlalchemy.exc import IntegrityError

from app.infra.db.models import Combo, ComboItem
from app.infra.db.session import create_session_factory
from tests.admin_test_utils import new_category, new_product
from tests.auth_test_utils import build_test_app


def _combo(db, name="C", image_url=None):
    c = Combo(name=name, combo_price_vnd=100_000, image_url=image_url)
    db.add(c)
    db.flush()
    return c


def test_slot_row_and_image_url_roundtrip():
    build_test_app("slot-models-ok")
    cat = new_category("Drinks")
    with create_session_factory()() as db:
        c = _combo(db, image_url="/images/x.png")
        db.add(ComboItem(combo_id=c.combo_id, category_id=cat, quantity=4))
        db.commit()
        db.refresh(c)
        assert c.image_url == "/images/x.png"
        assert c.combo_items[0].category_id == cat
        assert c.combo_items[0].product_id is None


def test_both_ids_rejected_by_check():
    build_test_app("slot-models-both")
    cat = new_category("Drinks")
    pid = new_product(cat, "Cola", base_price_vnd=15_000)
    with create_session_factory()() as db:
        c = _combo(db)
        db.add(ComboItem(combo_id=c.combo_id, product_id=pid, category_id=cat, quantity=1))
        with pytest.raises(IntegrityError):
            db.commit()


def test_neither_id_rejected_by_check():
    build_test_app("slot-models-neither")
    with create_session_factory()() as db:
        c = _combo(db)
        db.add(ComboItem(combo_id=c.combo_id, quantity=1))
        with pytest.raises(IntegrityError):
            db.commit()
