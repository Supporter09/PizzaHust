from __future__ import annotations

from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.infra.auth import get_current_user
from app.infra.db.models import UserRole
from tests.admin_test_utils import admin_client
from tests.auth_test_utils import build_test_app

_VALID_SETTINGS = {
    "timezone": "Asia/Bangkok",
    "loyalty_accrual_rate": 5000,
    "loyalty_redeem_value_vnd": 2000,
    "loyalty_max_redeem_pct": 0.7,
}


def _customer_client(slug: str) -> TestClient:
    app = build_test_app(slug)
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(
        user_id=1, role=UserRole.CUSTOMER
    )
    return TestClient(app)


# --- guards -----------------------------------------------------------------


def test_settings_requires_auth() -> None:
    client = TestClient(build_test_app("settings-unauth"))
    assert client.put("/api/admin/settings", json=_VALID_SETTINGS).status_code == 401
    assert (
        client.put(
            "/api/admin/settings/ward-fees", json={"wards": [{"ward": "Hoan Kiem", "fee_vnd": 1}]}
        ).status_code
        == 401
    )


def test_settings_forbidden_for_customer() -> None:
    client = _customer_client("settings-customer")
    assert client.put("/api/admin/settings", json=_VALID_SETTINGS).status_code == 403
    assert (
        client.put(
            "/api/admin/settings/ward-fees", json={"wards": [{"ward": "Hoan Kiem", "fee_vnd": 1}]}
        ).status_code
        == 403
    )


# --- business settings ------------------------------------------------------


def test_get_settings_returns_defaults_when_unseeded() -> None:
    c = admin_client("settings-get-default")
    r = c.get("/api/admin/settings")
    assert r.status_code == 200, r.text
    assert r.json() == {
        "timezone": "Asia/Ho_Chi_Minh",
        "loyalty_accrual_rate": 10_000,
        "loyalty_redeem_value_vnd": 1_000,
        "loyalty_max_redeem_pct": 0.5,
    }


def test_put_settings_persists_and_get_reflects() -> None:
    c = admin_client("settings-put")
    r = c.put("/api/admin/settings", json=_VALID_SETTINGS)
    assert r.status_code == 200, r.text
    assert r.json() == _VALID_SETTINGS
    assert c.get("/api/admin/settings").json() == _VALID_SETTINGS


def test_put_settings_rejects_unknown_timezone() -> None:
    c = admin_client("settings-bad-tz")
    body = {**_VALID_SETTINGS, "timezone": "Mars/Olympus_Mons"}
    assert c.put("/api/admin/settings", json=body).status_code == 400


def test_put_settings_rejects_non_positive_accrual_rate() -> None:
    c = admin_client("settings-bad-accrual")
    body = {**_VALID_SETTINGS, "loyalty_accrual_rate": 0}
    assert c.put("/api/admin/settings", json=body).status_code == 400


def test_put_settings_rejects_non_positive_redeem_value() -> None:
    c = admin_client("settings-bad-redeem")
    body = {**_VALID_SETTINGS, "loyalty_redeem_value_vnd": 0}
    assert c.put("/api/admin/settings", json=body).status_code == 400


def test_put_settings_rejects_redeem_pct_above_one() -> None:
    c = admin_client("settings-pct-high")
    body = {**_VALID_SETTINGS, "loyalty_max_redeem_pct": 1.5}
    assert c.put("/api/admin/settings", json=body).status_code == 400


def test_put_settings_rejects_redeem_pct_zero() -> None:
    c = admin_client("settings-pct-zero")
    body = {**_VALID_SETTINGS, "loyalty_max_redeem_pct": 0}
    assert c.put("/api/admin/settings", json=body).status_code == 400


# --- ward fees --------------------------------------------------------------


def test_get_ward_fees_defaults_to_51_sorted_wards() -> None:
    c = admin_client("ward-get-default")
    r = c.get("/api/admin/settings/ward-fees")
    assert r.status_code == 200, r.text
    wards = r.json()["wards"]
    assert len(wards) == 51
    assert all(w["fee_vnd"] == 22_000 for w in wards)
    assert wards == sorted(wards, key=lambda w: w["ward"])


def test_put_ward_fees_replaces_set() -> None:
    c = admin_client("ward-put")
    body = {
        "wards": [{"ward": "Tay Ho", "fee_vnd": 30000}, {"ward": "Hoan Kiem", "fee_vnd": 15000}]
    }
    r = c.put("/api/admin/settings/ward-fees", json=body)
    assert r.status_code == 200, r.text
    # list_ward_fees returns sorted by ward_name
    assert r.json()["wards"] == [
        {"ward": "Hoan Kiem", "fee_vnd": 15000},
        {"ward": "Tay Ho", "fee_vnd": 30000},
    ]
    assert c.get("/api/admin/settings/ward-fees").json()["wards"] == [
        {"ward": "Hoan Kiem", "fee_vnd": 15000},
        {"ward": "Tay Ho", "fee_vnd": 30000},
    ]


def test_put_ward_fees_rejects_negative_fee() -> None:
    c = admin_client("ward-neg-fee")
    body = {"wards": [{"ward": "Hoan Kiem", "fee_vnd": -1}]}
    assert c.put("/api/admin/settings/ward-fees", json=body).status_code == 400


def test_put_ward_fees_rejects_empty_list() -> None:
    c = admin_client("ward-empty")
    assert c.put("/api/admin/settings/ward-fees", json={"wards": []}).status_code == 400


def test_put_ward_fees_rejects_duplicate_folded_ward() -> None:
    c = admin_client("ward-dup")
    body = {
        "wards": [
            {"ward": "Hoan Kiem", "fee_vnd": 15000},
            {"ward": "  hoan  kiem ", "fee_vnd": 16000},
        ]
    }
    r = c.put("/api/admin/settings/ward-fees", json=body)
    assert r.status_code == 409, r.text
    assert r.json()["error"]["code"] == "CONFLICT"


def test_put_ward_fees_rejects_blank_ward_name() -> None:
    c = admin_client("ward-blank")
    body = {"wards": [{"ward": "   ", "fee_vnd": 15000}]}
    assert c.put("/api/admin/settings/ward-fees", json=body).status_code == 400


def test_put_ward_fees_trims_ward_name() -> None:
    c = admin_client("ward-trim")
    body = {"wards": [{"ward": "  Hoan Kiem  ", "fee_vnd": 15000}]}
    r = c.put("/api/admin/settings/ward-fees", json=body)
    assert r.status_code == 200, r.text
    assert r.json()["wards"] == [{"ward": "Hoan Kiem", "fee_vnd": 15000}]
