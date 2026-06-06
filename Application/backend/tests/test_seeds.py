from __future__ import annotations

from sqlalchemy import func, select

from app.infra.db.models import Category, Order, Product
from app.infra.db.session import create_session_factory
from app.seeds.run import main as run_seeds
from tests.auth_test_utils import build_test_app


def _counts() -> dict[str, int]:
    with create_session_factory()() as db:
        return {
            "orders": db.scalar(select(func.count()).select_from(Order)) or 0,
            "products": db.scalar(select(func.count()).select_from(Product)) or 0,
            "categories": db.scalar(select(func.count()).select_from(Category)) or 0,
        }


def test_seed_is_idempotent_across_reruns():
    build_test_app("seed-idempotent")
    run_seeds()
    first = _counts()
    run_seeds()
    second = _counts()

    assert first == second  # re-seeding inserts nothing new
    assert first["orders"] >= 1  # demo orders were created
    assert first["categories"] >= 1
