from __future__ import annotations

from fastapi.testclient import TestClient

from app.domain.loyalty import (
    LOYALTY_ACCRUAL_RATE,
    LOYALTY_MAX_REDEEM_PCT,
    LOYALTY_REDEEM_VALUE_VND,
)
from app.domain.pricing import DELIVERY_FEE_VND
from app.domain.service_area import INNER_HANOI_WARDS
from tests.auth_test_utils import build_test_app


def test_delivery_config_exposes_fee_and_new_hanoi_wards() -> None:
    client = TestClient(build_test_app("config-delivery"))

    resp = client.get("/api/config/delivery")

    assert resp.status_code == 200
    body = resp.json()
    assert body["fee_vnd"] == DELIVERY_FEE_VND
    assert body["service_area"] == sorted(INNER_HANOI_WARDS)
    assert len(body["service_area"]) == 51


def test_loyalty_config_exposes_canonical_rules() -> None:
    client = TestClient(build_test_app("config-loyalty"))

    resp = client.get("/api/config/loyalty")

    assert resp.status_code == 200
    assert resp.json() == {
        "accrual_rate": LOYALTY_ACCRUAL_RATE,
        "redeem_value_vnd": LOYALTY_REDEEM_VALUE_VND,
        "max_redeem_pct": LOYALTY_MAX_REDEEM_PCT,
    }


def test_business_config_defaults_to_hanoi_timezone() -> None:
    client = TestClient(build_test_app("config-business"))

    resp = client.get("/api/config/business")

    assert resp.status_code == 200
    assert resp.json() == {"timezone": "Asia/Ho_Chi_Minh"}
