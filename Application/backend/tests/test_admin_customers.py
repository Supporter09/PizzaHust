from __future__ import annotations

from datetime import datetime, timedelta
from types import SimpleNamespace

from app.api.admin.customers import get_customer, list_customers, lock_customer, unlock_customer
from app.infra.auth import hash_password
from app.infra.db.models import MembershipTier, Order, OrderStatus, User, UserRole
from app.infra.db.session import create_session_factory
from tests.auth_test_utils import build_test_app


def _bootstrap(db_slug: str) -> None:
    build_test_app(db_slug)


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


def _add_order_with_status(
    user_id: int,
    code: str,
    *,
    total_amount_vnd: int,
    created_at: datetime,
    status: OrderStatus,
) -> None:
    with create_session_factory()() as db:
        db.add(
            Order(
                order_code=code,
                user_id=user_id,
                recipient_name="Mai Tran",
                recipient_phone="0901111111",
                delivery_address="1 Dai Co Viet",
                total_amount_vnd=total_amount_vnd,
                promised_at=created_at + timedelta(hours=1),
                created_at=created_at,
                current_status=status,
            )
        )
        db.commit()


def test_list_customers_searches_name_phone_and_email() -> None:
    _bootstrap("customers-search")
    _new_customer(full_name="Mai Tran", phone_number="0901111111", email="mai@example.test")
    _new_customer(full_name="Lan Nguyen", phone_number="0902222222", email="lan@example.test")
    admin = SimpleNamespace(user_id=1, role=UserRole.ADMIN)

    with create_session_factory()() as db:
        by_name = list_customers(q="Mai", page=1, page_size=20, db=db, _admin=admin)
        by_phone = list_customers(q="090222", page=1, page_size=20, db=db, _admin=admin)
        by_email = list_customers(q="mai@example", page=1, page_size=20, db=db, _admin=admin)

    assert [row.full_name for row in by_name] == ["Mai Tran"]
    assert [row.full_name for row in by_phone] == ["Lan Nguyen"]
    assert [row.full_name for row in by_email] == ["Mai Tran"]


def test_list_customers_supports_sort_and_filters() -> None:
    _bootstrap("customers-sort-filter")
    gold_user = _new_customer(
        full_name="Gold Top",
        phone_number="0903333333",
        email="gold@example.test",
        current_points=500,
        membership_tier=MembershipTier.GOLD,
    )
    silver_user = _new_customer(
        full_name="Silver Orders",
        phone_number="0904444444",
        email="silver@example.test",
        current_points=240,
        membership_tier=MembershipTier.SILVER,
    )
    locked_user = _new_customer(
        full_name="Locked Standard",
        phone_number="0905555555",
        email="locked@example.test",
        current_points=50,
        membership_tier=MembershipTier.STANDARD,
    )
    with create_session_factory()() as db:
        locked = db.get(User, locked_user)
        assert locked is not None
        locked.is_locked = True
        db.commit()
    _add_order(gold_user, "PIZZ-GOLD01")
    _add_order(silver_user, "PIZZ-SILV01")
    _add_order(silver_user, "PIZZ-SILV02")
    _add_order(silver_user, "PIZZ-SILV03")
    admin = SimpleNamespace(user_id=1, role=UserRole.ADMIN)

    with create_session_factory()() as db:
        ranked = list_customers(
            sort_by="orders",
            sort_dir="desc",
            page=1,
            page_size=20,
            db=db,
            _admin=admin,
        )
        gold_only = list_customers(
            tier=MembershipTier.GOLD,
            page=1,
            page_size=20,
            db=db,
            _admin=admin,
        )
        locked_only = list_customers(
            locked=True,
            page=1,
            page_size=20,
            db=db,
            _admin=admin,
        )

    assert ranked[0].full_name == "Silver Orders"
    assert [row.full_name for row in gold_only] == ["Gold Top"]
    assert [row.full_name for row in locked_only] == ["Locked Standard"]


def test_customer_detail_includes_history_stats_and_loyalty() -> None:
    _bootstrap("customers-detail")
    user_id = _new_customer(current_points=450, membership_tier=MembershipTier.GOLD)
    _add_order_with_status(
        user_id,
        "PIZZ-CUST001",
        total_amount_vnd=180_000,
        created_at=datetime(2026, 6, 9, 10, 0, 0),
        status=OrderStatus.DELIVERED,
    )
    _add_order_with_status(
        user_id,
        "PIZZ-CUST002",
        total_amount_vnd=240_000,
        created_at=datetime(2026, 6, 10, 10, 0, 0),
        status=OrderStatus.DELIVERED,
    )
    _add_order_with_status(
        user_id,
        "PIZZ-CUST003",
        total_amount_vnd=90_000,
        created_at=datetime(2026, 6, 11, 10, 0, 0),
        status=OrderStatus.CANCELLED,
    )
    admin = SimpleNamespace(user_id=1, role=UserRole.ADMIN)

    with create_session_factory()() as db:
        payload = get_customer(user_id, db=db, _admin=admin)

    assert payload.current_points == 450
    assert payload.membership_tier == "gold"
    assert payload.order_count == 3
    assert payload.stats.delivered_orders == 2
    assert payload.stats.total_spend_vnd == 420_000
    assert payload.loyalty.current_balance_value_vnd == 450_000
    assert len(payload.recent_orders) == 3
    assert payload.recent_orders[0].order_code == "PIZZ-CUST003"
    assert len(payload.top_orders) == 2
    assert payload.top_orders[0].order_code == "PIZZ-CUST002"
    assert payload.benefits[0].startswith("Current balance can offset up to")


def test_customer_detail_missing_customer_returns_404() -> None:
    _bootstrap("customers-missing")
    admin = SimpleNamespace(user_id=1, role=UserRole.ADMIN)

    with create_session_factory()() as db:
        try:
            get_customer(999999, db=db, _admin=admin)
        except Exception as exc:  # noqa: BLE001
            assert getattr(exc, "status_code", None) == 404
        else:  # pragma: no cover - defensive
            raise AssertionError("expected NOT_FOUND")


def test_lock_and_unlock_customer_updates_state() -> None:
    _bootstrap("customers-lock")
    user_id = _new_customer()
    admin = SimpleNamespace(user_id=1, role=UserRole.ADMIN)

    with create_session_factory()() as db:
        lock_customer(user_id, body=SimpleNamespace(reason="risk"), db=db, _admin=admin)
        locked = db.get(User, user_id)
        assert locked is not None and locked.is_locked is True
        unlock_customer(user_id, db=db, _admin=admin)
        unlocked = db.get(User, user_id)
        assert unlocked is not None and unlocked.is_locked is False


def test_list_customers_includes_delivered_spend_and_join_date() -> None:
    _bootstrap("customers-spend-join")
    user_id = _new_customer()
    _add_order_with_status(
        user_id,
        "PIZZ-SPEND01",
        total_amount_vnd=180_000,
        created_at=datetime(2026, 6, 9, 10, 0, 0),
        status=OrderStatus.DELIVERED,
    )
    _add_order_with_status(
        user_id,
        "PIZZ-SPEND02",
        total_amount_vnd=240_000,
        created_at=datetime(2026, 6, 10, 10, 0, 0),
        status=OrderStatus.DELIVERED,
    )
    _add_order_with_status(
        user_id,
        "PIZZ-SPEND03",
        total_amount_vnd=90_000,
        created_at=datetime(2026, 6, 11, 10, 0, 0),
        status=OrderStatus.CANCELLED,
    )
    admin = SimpleNamespace(user_id=1, role=UserRole.ADMIN)

    with create_session_factory()() as db:
        rows = list_customers(page=1, page_size=20, db=db, _admin=admin)

    assert len(rows) == 1
    assert rows[0].total_spend_vnd == 420_000
    assert rows[0].created_at is not None
