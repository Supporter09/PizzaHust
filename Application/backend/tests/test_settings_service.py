from __future__ import annotations

from app.domain.loyalty import LOYALTY_ACCRUAL_RATE
from app.domain.pricing import DELIVERY_FEE_VND
from app.infra import settings_service as svc
from app.infra.db.session import create_session_factory
from tests.auth_test_utils import build_test_app


def test_defaults_when_unseeded():
    build_test_app("settings-defaults")
    with create_session_factory()() as db:
        s = svc.get_business_settings(db)
        assert s.timezone == "Asia/Ho_Chi_Minh"
        assert s.loyalty_accrual_rate == LOYALTY_ACCRUAL_RATE
        assert isinstance(s.loyalty_max_redeem_pct, float)  # service exposes float, not Decimal
        assert svc.get_ward_fees(db)["ba dinh"] == DELIVERY_FEE_VND  # folded key, default fee


def test_update_and_replace_roundtrip():
    build_test_app("settings-roundtrip")
    with create_session_factory()() as db:
        svc.update_business_settings(
            db,
            timezone="Asia/Bangkok",
            loyalty_accrual_rate=5000,
            loyalty_redeem_value_vnd=500,
            loyalty_max_redeem_pct=0.3,
        )
        svc.replace_ward_fees(db, [("Ha Dong", 30000), ("Son Tay", 40000)])
        db.commit()
        s = svc.get_business_settings(db)
        assert s.timezone == "Asia/Bangkok" and s.loyalty_accrual_rate == 5000
        assert svc.get_ward_fees(db) == {"ha dong": 30000, "son tay": 40000}


def test_list_ward_fees_returns_display_names_sorted():
    build_test_app("settings-listwards")
    with create_session_factory()() as db:
        svc.replace_ward_fees(db, [("Son Tay", 40000), ("Ha Dong", 30000)])
        db.commit()
        assert svc.list_ward_fees(db) == [("Ha Dong", 30000), ("Son Tay", 40000)]
