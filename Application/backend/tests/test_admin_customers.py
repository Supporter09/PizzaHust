from __future__ import annotations

from datetime import datetime

from app.infra.auth import hash_password
from app.infra.db.models import MembershipTier, Order, OrderStatus, User, UserRole
from app.infra.db.session import create_session_factory
from tests.admin_test_utils import admin_client


def _new_customer(
    *,
    full_name: str = "Mai Tran",
    phone_number: str = "0901111111",
    email: str | None = "mai@example.test",
    address: str | None = "1 Dai Co Viet",
    current_points: int = 120,
    membership_tier: MembershipTier = MembershipTier.SILVER,
) -> int:
    with create_session_factory()() as db:
        user = User(
            full_name=full_name,
            phone_number=phone_number,
            email=email,
            address=address,
            password_hash=hash_password("customerpass123"),
            role=UserRole.CUSTOMER,
            current_points=current_points,
            membership_tier=membership_tier,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user.user_id


def _add_order(user_id: int, code: str) -> None:
    with create_session_factory()() as db:
        db.add(
            Order(
                order_code=code,
                user_id=user_id,
                recipient_name="Mai Tran",
                recipient_phone="0901111111",
                delivery_address="1 Dai Co Viet",
                total_amount_vnd=180_000,
                promised_at=datetime(2026, 1, 1, 12, 0, 0),
                current_status=OrderStatus.DELIVERED,
            )
        )
        db.commit()


def test_list_customers_searches_name_phone_and_email() -> None:
    client = admin_client("customers-search")
    _new_customer(full_name="Mai Tran", phone_number="0901111111", email="mai@example.test")
    _new_customer(full_name="Lan Nguyen", phone_number="0902222222", email="lan@example.test")

    by_name = client.get("/api/admin/customers?q=Mai")
    by_phone = client.get("/api/admin/customers?q=090222")
    by_email = client.get("/api/admin/customers?q=mai@example")

    assert [row["full_name"] for row in by_name.json()] == ["Mai Tran"]
    assert [row["full_name"] for row in by_phone.json()] == ["Lan Nguyen"]
    assert [row["full_name"] for row in by_email.json()] == ["Mai Tran"]


def test_customer_detail_includes_loyalty_and_order_count() -> None:
    client = admin_client("customers-detail")
    user_id = _new_customer(current_points=450, membership_tier=MembershipTier.GOLD)
    _add_order(user_id, "PIZZ-CUST001")
    _add_order(user_id, "PIZZ-CUST002")

    resp = client.get(f"/api/admin/customers/{user_id}")

    assert resp.status_code == 200, resp.text
    assert resp.json()["current_points"] == 450
    assert resp.json()["membership_tier"] == "gold"
    assert resp.json()["order_count"] == 2


def test_customer_detail_missing_customer_returns_404() -> None:
    client = admin_client("customers-missing")

    resp = client.get("/api/admin/customers/999999")

    assert resp.status_code == 404


def test_lock_and_unlock_customer_updates_state() -> None:
    client = admin_client("customers-lock")
    user_id = _new_customer()

    lock = client.post(f"/api/admin/customers/{user_id}/lock", json={"reason": "risk"})
    locked = client.get(f"/api/admin/customers/{user_id}")
    unlock = client.post(f"/api/admin/customers/{user_id}/unlock")
    unlocked = client.get(f"/api/admin/customers/{user_id}")

    assert lock.status_code == 204, lock.text
    assert locked.json()["is_locked"] is True
    assert unlock.status_code == 204, unlock.text
    assert unlocked.json()["is_locked"] is False
