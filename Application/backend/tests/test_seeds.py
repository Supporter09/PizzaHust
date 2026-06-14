from __future__ import annotations

from decimal import Decimal

from sqlalchemy import func, select

from app.domain.service_area import INNER_HANOI_WARDS, _fold
from app.infra.db.models import (
    BusinessSettings,
    Category,
    DeliveryWardFee,
    Option,
    OptionGroup,
    Order,
    Product,
    ProductOption,
)
from app.infra.db.session import create_session_factory
from app.seeds.run import main as run_seeds
from tests.auth_test_utils import build_test_app


def _counts() -> dict[str, int]:
    with create_session_factory()() as db:
        return {
            "orders": db.scalar(select(func.count()).select_from(Order)) or 0,
            "products": db.scalar(select(func.count()).select_from(Product)) or 0,
            "categories": db.scalar(select(func.count()).select_from(Category)) or 0,
            "option_groups": db.scalar(select(func.count()).select_from(OptionGroup)) or 0,
            "options": db.scalar(select(func.count()).select_from(Option)) or 0,
        }


def test_seed_is_idempotent_across_reruns():
    build_test_app("seed-idempotent")
    run_seeds()
    first = _counts()
    run_seeds()
    second = _counts()

    assert first == second
    assert first["orders"] >= 1
    assert first["categories"] >= 1
    assert first["option_groups"] == 3
    assert first["options"] == 15


def test_every_seeded_pizza_has_all_options_enabled():
    build_test_app("seed-pizza-opts")
    run_seeds()
    with create_session_factory()() as db:
        pizza_cat = db.scalar(select(Category).where(Category.name == "Pizza"))
        assert pizza_cat is not None, "seed did not produce a Pizza category"
        pizzas = db.scalars(
            select(Product).where(Product.category_id == pizza_cat.category_id)
        ).all()
        assert pizzas, "seed produced no pizzas to check options against"
        option_count = db.scalar(select(func.count()).select_from(Option)) or 0
        for p in pizzas:
            enabled = db.scalar(
                select(func.count())
                .select_from(ProductOption)
                .where(ProductOption.product_id == p.product_id)
            )
            assert enabled == option_count


def test_option_groups_owned_by_pizza_category():
    """Size, Crust, Toppings must be scoped to Pizza; Side Dishes/Drinks own none."""
    build_test_app("seed-cat-ownership")
    run_seeds()
    with create_session_factory()() as db:
        pizza_cat = db.scalar(select(Category).where(Category.name == "Pizza"))
        side_cat = db.scalar(select(Category).where(Category.name == "Side Dishes"))
        drinks_cat = db.scalar(select(Category).where(Category.name == "Drinks"))

        assert pizza_cat is not None
        assert side_cat is not None
        assert drinks_cat is not None

        pizza_groups = db.scalars(
            select(OptionGroup).where(OptionGroup.category_id == pizza_cat.category_id)
        ).all()
        group_names = {g.name for g in pizza_groups}
        assert group_names == {"Size", "Crust", "Toppings"}, (
            f"expected {{Size, Crust, Toppings}}, got {group_names}"
        )

        for g in pizza_groups:
            assert g.category_id == pizza_cat.category_id

        side_count = db.scalar(
            select(func.count())
            .select_from(OptionGroup)
            .where(OptionGroup.category_id == side_cat.category_id)
        )
        assert side_count == 0, f"Side Dishes should own no groups, got {side_count}"

        drinks_count = db.scalar(
            select(func.count())
            .select_from(OptionGroup)
            .where(OptionGroup.category_id == drinks_cat.category_id)
        )
        assert drinks_count == 0, f"Drinks should own no groups, got {drinks_count}"


def test_option_group_options_and_attributes():
    """Size has S/M/L; groups have the expected select_type and required flag."""
    build_test_app("seed-group-attrs")
    run_seeds()
    with create_session_factory()() as db:
        pizza_cat = db.scalar(select(Category).where(Category.name == "Pizza"))
        assert pizza_cat is not None

        g_size = db.scalar(
            select(OptionGroup).where(
                OptionGroup.category_id == pizza_cat.category_id,
                OptionGroup.name == "Size",
            )
        )
        g_crust = db.scalar(
            select(OptionGroup).where(
                OptionGroup.category_id == pizza_cat.category_id,
                OptionGroup.name == "Crust",
            )
        )
        g_top = db.scalar(
            select(OptionGroup).where(
                OptionGroup.category_id == pizza_cat.category_id,
                OptionGroup.name == "Toppings",
            )
        )

        assert g_size is not None
        assert g_size.select_type == "single"
        assert g_size.required is True

        assert g_crust is not None
        assert g_crust.select_type == "single"
        assert g_crust.required is True

        assert g_top is not None
        assert g_top.select_type == "multi"
        assert g_top.required is False

        size_options = db.scalars(select(Option).where(Option.group_id == g_size.group_id)).all()
        size_names = {o.name for o in size_options}
        assert size_names == {"S", "M", "L"}, f"Size options mismatch: {size_names}"


def test_option_groups_idempotent_no_duplicates_after_second_run():
    """Running seeds twice must not create duplicate groups or alter their attributes."""
    build_test_app("seed-group-idem")
    run_seeds()

    with create_session_factory()() as db:
        pizza_cat = db.scalar(select(Category).where(Category.name == "Pizza"))
        assert pizza_cat is not None
        pizza_cat_id = pizza_cat.category_id
        count_after_first = db.scalar(
            select(func.count())
            .select_from(OptionGroup)
            .where(OptionGroup.category_id == pizza_cat_id)
        )

    run_seeds()

    with create_session_factory()() as db:
        count_after_second = db.scalar(
            select(func.count())
            .select_from(OptionGroup)
            .where(OptionGroup.category_id == pizza_cat_id)
        )
        assert count_after_second == count_after_first == 3, (
            f"expected 3 groups after both runs, got {count_after_first} / {count_after_second}"
        )

        g_size = db.scalar(
            select(OptionGroup).where(
                OptionGroup.category_id == pizza_cat_id,
                OptionGroup.name == "Size",
            )
        )
        assert g_size is not None
        assert g_size.select_type == "single"
        assert g_size.required is True


def test_seed_business_settings_singleton():
    """Seed must create exactly one BusinessSettings row with the correct defaults."""
    build_test_app("seed-biz-settings")
    run_seeds()

    with create_session_factory()() as db:
        row = db.get(BusinessSettings, 1)
        assert row is not None
        assert row.id == 1
        assert row.timezone == "Asia/Ho_Chi_Minh"
        assert row.loyalty_accrual_rate == 10_000
        assert row.loyalty_redeem_value_vnd == 1_000
        assert row.loyalty_max_redeem_pct == Decimal("0.5")

    # Second run must not error and must not change the row count (still 1).
    run_seeds()

    with create_session_factory()() as db:
        count = db.scalar(select(func.count()).select_from(BusinessSettings))
        assert count == 1


def test_seed_delivery_ward_fees():
    """Seed must create one DeliveryWardFee row per INNER_HANOI_WARDS entry."""
    build_test_app("seed-ward-fees")
    run_seeds()

    expected_count = len(INNER_HANOI_WARDS)

    with create_session_factory()() as db:
        rows = db.scalars(select(DeliveryWardFee)).all()
        assert len(rows) == expected_count

        normalized_in_db = {r.ward_normalized for r in rows}
        expected_normalized = {_fold(w) for w in INNER_HANOI_WARDS}
        assert normalized_in_db == expected_normalized

        for row in rows:
            assert row.fee_vnd == 22_000
            assert row.ward_normalized == _fold(row.ward_name)

    # Second run must not duplicate rows.
    run_seeds()

    with create_session_factory()() as db:
        count = db.scalar(select(func.count()).select_from(DeliveryWardFee))
        assert count == expected_count
