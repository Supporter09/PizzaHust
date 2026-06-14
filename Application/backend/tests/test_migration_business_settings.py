from sqlalchemy import inspect

from app.infra.db.models import BusinessSettings, DeliveryWardFee
from app.infra.db.session import create_session_factory
from tests.auth_test_utils import build_test_app


def test_models_define_settings_tables():
    assert BusinessSettings.__tablename__ == "business_settings"
    assert DeliveryWardFee.__tablename__ == "delivery_ward_fees"


def test_settings_tables_create_and_roundtrip():
    build_test_app("settings-models")
    with create_session_factory()() as db:
        db.add(
            BusinessSettings(
                id=1,
                timezone="Asia/Ho_Chi_Minh",
                loyalty_accrual_rate=10_000,
                loyalty_redeem_value_vnd=1_000,
                loyalty_max_redeem_pct=0.5,
            )
        )
        db.add(DeliveryWardFee(ward_name="Ba Dinh", ward_normalized="ba dinh", fee_vnd=22_000))
        db.commit()
        assert db.get(BusinessSettings, 1).timezone == "Asia/Ho_Chi_Minh"
        cols = {c["name"] for c in inspect(db.bind).get_columns("delivery_ward_fees")}
        assert {"ward_name", "ward_normalized", "fee_vnd"} <= cols
