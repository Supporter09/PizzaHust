from __future__ import annotations

from sqlalchemy import select

from app.infra.db.models import ComboImage, Product, ProductImage
from app.infra.db.session import create_session_factory
from tests.admin_test_utils import admin_client, new_category


def test_gallery_relationship_and_cascade_wiring():
    client = admin_client("a9-wiring")
    cat = new_category()
    pid = client.post(
        "/api/admin/items",
        json={"category_id": cat, "name": "Backfill", "base_price_vnd": 1, "kind": "pizza"},
    ).json()["product_id"]

    with create_session_factory()() as db:
        product = db.get(Product, pid)
        product.image_url = "/images/existing.png"
        db.add(
            ProductImage(product_id=pid, url="/images/existing.png", sort_order=0, is_cover=True)
        )
        db.commit()

    with create_session_factory()() as db:
        rows = db.scalars(select(ProductImage).where(ProductImage.product_id == pid)).all()
        assert [r.url for r in rows] == ["/images/existing.png"]
        assert rows[0].is_cover is True
        db.delete(db.get(Product, pid))
        db.commit()
    with create_session_factory()() as db:
        assert db.scalars(select(ProductImage).where(ProductImage.product_id == pid)).all() == []
        assert db.scalars(select(ComboImage)).all() == []
