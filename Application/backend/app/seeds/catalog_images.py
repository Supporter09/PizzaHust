"""Catalog seed images — maps each product/combo to bundled photos in ``./assets``.

Real photos sourced from Wikimedia Commons (credited in ``assets/CREDITS.md``). Every
product and combo gets a cover; the showcase pizza keeps a 3-image gallery so the
multi-image dish path stays exercised. Filenames are stable, so re-seeding is a no-op;
URLs are built from ``settings.image_base_url`` at seed time.
"""

from __future__ import annotations

import os
import shutil

import structlog
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.infra.config import Settings
from app.infra.db.models import Combo, ComboImage, Product, ProductImage

_ASSETS_DIR = os.path.join(os.path.dirname(__file__), "assets")

PRODUCT_IMAGES: dict[str, tuple[str, ...]] = {
    "Margherita Classic": (
        "seed-margherita-1.jpg",
        "seed-margherita-2.jpg",
        "seed-margherita-3.jpg",
    ),
    "Pepperoni Fire": ("seed-pepperoni.jpg",),
    "Four Cheese Royale": ("seed-four-cheese.jpg",),
    "BBQ Chicken Feast": ("seed-bbq-chicken.jpg",),
    "Hawaiian Sunset": ("seed-hawaiian.jpg",),
    "Spicy Meat Supreme": ("seed-meat-supreme.jpg",),
    "Garden Veggie": ("seed-veggie.jpg",),
    "Seafood Delight": ("seed-seafood.jpg",),
    "Garlic Bread (4pcs)": ("seed-garlic-bread.jpg",),
    "Chicken Wings (6pcs)": ("seed-chicken-wings.jpg",),
    "Truffle Fries": ("seed-fries.jpg",),
    "Coleslaw": ("seed-coleslaw.jpg",),
    "Cola": ("seed-cola.jpg",),
    "Orange Juice": ("seed-orange-juice.jpg",),
    "Mineral Water": ("seed-water.jpg",),
}
COMBO_IMAGES: dict[str, str] = {
    "Lunch Duo for 2": "seed-combo-lunch-duo.jpg",
    "Family Feast 4": "seed-combo-family-feast.jpg",
    "Pick-Any Feast": "seed-combo-pick-any.jpg",
}


def install_seed_blobs(settings: Settings, fnames: list[str]) -> None:
    """Copy bundled seed photos into the upload dir (best-effort).

    The upload dir is a writable volume in the container but may be absent or read-only
    when the seed runs on the host (unit tests), where the DB rows alone are what matter —
    a missing dir or source file must never fail the seed.
    """
    try:
        os.makedirs(settings.image_upload_dir, exist_ok=True)
        for fname in fnames:
            src = os.path.join(_ASSETS_DIR, fname)
            dest = os.path.join(settings.image_upload_dir, fname)
            if os.path.exists(dest) or not os.path.exists(src):
                continue
            shutil.copyfile(src, dest)
    except OSError:
        structlog.get_logger().warning(
            "seed_gallery_blobs_skipped", upload_dir=settings.image_upload_dir
        )


def seed_product_images(db: Session, base: str, product: Product, fnames: tuple[str, ...]) -> None:
    """Attach a cover (plus gallery) to a product, idempotently.

    No-op if the product already has images, so admin-uploaded galleries are never
    clobbered and re-seeding stays a no-op.
    """
    if not fnames:
        return
    if db.scalars(
        select(ProductImage).where(ProductImage.product_id == product.product_id)
    ).first():
        return
    for i, fname in enumerate(fnames):
        db.add(
            ProductImage(
                product_id=product.product_id,
                url=f"{base}/{fname}",
                sort_order=i,
                is_cover=(i == 0),
            )
        )
    product.image_url = f"{base}/{fnames[0]}"


def seed_combo_image(db: Session, base: str, combo: Combo, fname: str) -> None:
    """Attach a cover image to a combo, idempotently."""
    if db.scalars(select(ComboImage).where(ComboImage.combo_id == combo.combo_id)).first():
        return
    db.add(ComboImage(combo_id=combo.combo_id, url=f"{base}/{fname}", sort_order=0, is_cover=True))
    combo.image_url = f"{base}/{fname}"
