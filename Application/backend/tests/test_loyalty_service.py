from __future__ import annotations

from app.infra.auth import hash_password
from app.infra.db.models import Order, OrderStatus, User, UserRole
from app.infra.db.session import create_session_factory
from app.infra.loyalty_service import release_reserved_points
from tests.auth_test_utils import build_test_app


def _seed_user_and_order(redeemed: int, *, with_user: bool = True) -> tuple[int | None, int]:
    from datetime import datetime

    with create_session_factory()() as db:
        uid = None
        if with_user:
            user = User(
                full_name="R",
                phone_number="0901230000",
                password_hash=hash_password("x12345678"),
                role=UserRole.CUSTOMER,
                current_points=30,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            uid = user.user_id
        order = Order(
            order_code="PIZZ-REL001",
            user_id=uid,
            recipient_name="R",
            recipient_phone="0901230000",
            delivery_address="1 St",
            total_amount_vnd=100_000,
            promised_at=datetime(2026, 1, 1, 12, 0, 0),
            current_status=OrderStatus.DELIVERING,
            loyalty_points_redeemed=redeemed,
        )
        db.add(order)
        db.commit()
        db.refresh(order)
        return uid, order.order_id


def test_release_credits_balance_and_zeroes():
    build_test_app("rel-credit")
    uid, oid = _seed_user_and_order(20)
    with create_session_factory()() as db:
        order = db.get(Order, oid)
        release_reserved_points(db, order)
        db.commit()
    with create_session_factory()() as db:
        assert db.get(User, uid).current_points == 50  # 30 + 20
        assert db.get(Order, oid).loyalty_points_redeemed == 0


def test_release_is_idempotent():
    build_test_app("rel-idem")
    uid, oid = _seed_user_and_order(20)
    with create_session_factory()() as db:
        order = db.get(Order, oid)
        release_reserved_points(db, order)
        release_reserved_points(db, order)  # second call: no-op
        db.commit()
    with create_session_factory()() as db:
        assert db.get(User, uid).current_points == 50


def test_release_noop_for_guest_order():
    build_test_app("rel-guest")
    _, oid = _seed_user_and_order(20, with_user=False)
    with create_session_factory()() as db:
        order = db.get(Order, oid)
        release_reserved_points(db, order)  # must not raise
        db.commit()
        assert db.get(Order, oid).loyalty_points_redeemed == 20  # unchanged


def test_release_does_not_credit_from_stale_order_object():
    build_test_app("rel-stale")
    uid, oid = _seed_user_and_order(20)
    with create_session_factory()() as stale_db:
        stale_order = stale_db.get(Order, oid)
        with create_session_factory()() as other_db:
            other_order = other_db.get(Order, oid)
            other_order.loyalty_points_redeemed = 0
            other_db.commit()
        release_reserved_points(stale_db, stale_order)
        stale_db.commit()
    with create_session_factory()() as db:
        assert db.get(User, uid).current_points == 30
        assert db.get(Order, oid).loyalty_points_redeemed == 0
