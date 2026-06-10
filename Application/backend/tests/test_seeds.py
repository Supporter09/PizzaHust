from __future__ import annotations

import os

import pytest
from sqlalchemy import func, select

from app.infra.db.models import Category, Option, OptionGroup, Order, Product, ProductOption
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


@pytest.fixture(autouse=True)
def _seed_passwords(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ADMIN_SEED_PASSWORD", os.environ.get("ADMIN_SEED_PASSWORD", "admin123"))
    monkeypatch.setenv(
        "KITCHEN_SEED_PASSWORD", os.environ.get("KITCHEN_SEED_PASSWORD", "kitchen123")
    )


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
        pizzas = db.scalars(select(Product).where(Product.is_pizza.is_(True))).all()
        option_count = db.scalar(select(func.count()).select_from(Option)) or 0
        for p in pizzas:
            enabled = db.scalar(
                select(func.count())
                .select_from(ProductOption)
                .where(ProductOption.product_id == p.product_id)
            )
            assert enabled == option_count
