from __future__ import annotations

from app.infra.db.models import CategoryPresetGroup
from app.infra.db.session import create_session_factory
from tests.admin_test_utils import new_category, new_option_group
from tests.auth_test_utils import build_test_app


def test_category_preset_group_table_roundtrips():
    build_test_app("cat-preset-groups")
    cat = new_category("Pizza")
    gid = new_option_group("Size", select_type="single", required=True)
    with create_session_factory()() as db:
        db.add(CategoryPresetGroup(category_id=cat, group_id=gid, sort_order=0))
        db.commit()
    with create_session_factory()() as db:
        row = db.get(CategoryPresetGroup, (cat, gid))
        assert row is not None
        assert row.sort_order == 0
