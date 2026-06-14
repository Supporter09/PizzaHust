from __future__ import annotations

from fastapi.testclient import TestClient

from app.domain.loyalty import (
    LOYALTY_ACCRUAL_RATE,
    LOYALTY_MAX_REDEEM_PCT,
    LOYALTY_REDEEM_VALUE_VND,
)
from app.domain.service_area import INNER_HANOI_WARDS
from app.infra import settings_service
from app.infra.db.session import create_session_factory
from tests.auth_test_utils import build_test_app


def test_delivery_config_exposes_per_ward_fees_and_hanoi_wards() -> None:
    client = TestClient(build_test_app("config-delivery"))

    resp = client.get("/api/config/delivery")

    assert resp.status_code == 200
    body = resp.json()
    assert "fee_vnd" not in body
    ward_fees = body["ward_fees"]
    assert len(ward_fees) == 51
    assert all(wf["fee_vnd"] == 22_000 for wf in ward_fees)
    assert ward_fees == sorted(ward_fees, key=lambda wf: wf["ward"])
    assert body["service_area"] == [wf["ward"] for wf in ward_fees]
    assert body["service_area"] == sorted(INNER_HANOI_WARDS)


def test_loyalty_config_exposes_canonical_rules() -> None:
    client = TestClient(build_test_app("config-loyalty"))

    resp = client.get("/api/config/loyalty")

    assert resp.status_code == 200
    assert resp.json() == {
        "accrual_rate": LOYALTY_ACCRUAL_RATE,
        "redeem_value_vnd": LOYALTY_REDEEM_VALUE_VND,
        "max_redeem_pct": LOYALTY_MAX_REDEEM_PCT,
    }


def test_config_endpoints_reflect_edited_store_values() -> None:
    app = build_test_app("config-edited")
    with create_session_factory()() as db:
        settings_service.replace_ward_fees(db, [("Hoan Kiem", 15000), ("Tay Ho", 30000)])
        settings_service.update_business_settings(
            db,
            timezone="Asia/Bangkok",
            loyalty_accrual_rate=5000,
            loyalty_redeem_value_vnd=2000,
            loyalty_max_redeem_pct=0.7,
        )
        db.commit()

    client = TestClient(app)

    delivery = client.get("/api/config/delivery")
    assert delivery.status_code == 200
    assert delivery.json()["ward_fees"] == [
        {"ward": "Hoan Kiem", "fee_vnd": 15000},
        {"ward": "Tay Ho", "fee_vnd": 30000},
    ]
    assert delivery.json()["service_area"] == ["Hoan Kiem", "Tay Ho"]

    loyalty = client.get("/api/config/loyalty")
    assert loyalty.status_code == 200
    assert loyalty.json() == {
        "accrual_rate": 5000,
        "redeem_value_vnd": 2000,
        "max_redeem_pct": 0.7,
    }


def test_business_config_defaults_to_hanoi_timezone() -> None:
    client = TestClient(build_test_app("config-business"))

    resp = client.get("/api/config/business")

    assert resp.status_code == 200
    assert resp.json() == {"timezone": "Asia/Ho_Chi_Minh"}
