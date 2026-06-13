"""A1/A2 – Manage pizzas & side dishes (admin only).

Unified product surface: ``kind`` selects pizza vs side dish; ``is_pizza`` is
derived. Delete is a soft-deactivate so historical order_items never orphan.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.api import images as images_mod
from app.api.images import ImageOut
from app.core.errors import APIError
from app.domain import gallery
from app.infra.auth import require_role
from app.infra.db.deps import get_db
from app.infra.db.models import (
    Category,
    CategoryPresetGroup,
    Combo,
    ComboItem,
    Option,
    OrderItem,
    Product,
    ProductImage,
    ProductOption,
    User,
    UserRole,
)

router = APIRouter(prefix="/api/admin/items", tags=["admin-items"])
require_admin = require_role(UserRole.ADMIN)


class ItemOut(BaseModel):
    product_id: int
    category_id: int
    name: str
    base_price_vnd: int
    is_pizza: bool
    image_url: str | None = None
    is_active: bool = True

    model_config = {"from_attributes": True}


class ItemDetailOut(ItemOut):
    images: list[ImageOut] = []


class ItemIn(BaseModel):
    category_id: int
    name: str
    base_price_vnd: int
    kind: Literal["pizza", "side"]


class ItemPatch(BaseModel):
    category_id: int | None = None
    name: str | None = None
    base_price_vnd: int | None = None
    is_active: bool | None = None


def _dup_name(db: Session, name: str, exclude_id: int | None = None) -> bool:
    stmt = select(Product).where(Product.name == name)
    if exclude_id is not None:
        stmt = stmt.where(Product.product_id != exclude_id)
    return db.scalar(stmt) is not None


def _require_active_category(db: Session, category_id: int) -> None:
    """A1: an item's category must exist and be active."""
    cat = db.get(Category, category_id)
    if cat is None or not cat.is_active:
        raise APIError(
            code="VALIDATION_FAILED",
            message="Category must exist and be active.",
            status_code=400,
            details={"field": "category_id"},
        )


def _apply_category_preset(db: Session, product: Product) -> None:
    """Seed per-dish option enablement from the category's preset (template at
    creation; a category with no preset is a no-op)."""
    preset_group_ids = db.scalars(
        select(CategoryPresetGroup.group_id).where(
            CategoryPresetGroup.category_id == product.category_id
        )
    ).all()
    if not preset_group_ids:
        return
    option_ids = db.scalars(
        select(Option.option_id).where(Option.group_id.in_(preset_group_ids))
    ).all()
    for oid in option_ids:
        db.add(ProductOption(product_id=product.product_id, option_id=oid))
    db.flush()


@router.get("", response_model=list[ItemOut])
def list_items(
    kind: Literal["pizza", "side"] | None = None,
    category_id: int | None = None,
    active: bool | None = None,
    db: Session = Depends(get_db, scope="function"),
    _a: User = Depends(require_admin),
) -> list[ItemOut]:
    stmt = select(Product)
    if kind is not None:
        stmt = stmt.where(Product.is_pizza.is_(kind == "pizza"))
    if category_id is not None:
        stmt = stmt.where(Product.category_id == category_id)
    if active is not None:
        stmt = stmt.where(Product.is_active.is_(active))
    return [ItemOut.model_validate(p) for p in db.scalars(stmt.order_by(Product.product_id)).all()]


@router.post("", response_model=ItemOut, status_code=201)
def create_item(
    body: ItemIn,
    db: Session = Depends(get_db, scope="function"),
    _a: User = Depends(require_admin),
) -> ItemOut:
    if _dup_name(db, body.name):
        raise APIError(
            code="CONFLICT", message="An item with this name already exists.", status_code=409
        )
    _require_active_category(db, body.category_id)
    p = Product(
        category_id=body.category_id,
        name=body.name,
        base_price_vnd=body.base_price_vnd,
        is_pizza=body.kind == "pizza",
    )
    db.add(p)
    db.flush()
    _apply_category_preset(db, p)
    return ItemOut.model_validate(p)


@router.get("/{product_id}", response_model=ItemDetailOut)
def get_item(
    product_id: int,
    db: Session = Depends(get_db, scope="function"),
    _a: User = Depends(require_admin),
) -> ItemDetailOut:
    p = db.get(Product, product_id)
    if p is None:
        raise APIError(code="NOT_FOUND", message="Item not found.", status_code=404)
    return ItemDetailOut(
        **ItemOut.model_validate(p).model_dump(),
        images=images_mod.image_outs(list(p.images)),
    )


@router.patch("/{product_id}", response_model=ItemOut)
def patch_item(
    product_id: int,
    body: ItemPatch,
    db: Session = Depends(get_db, scope="function"),
    _a: User = Depends(require_admin),
) -> ItemOut:
    p = db.get(Product, product_id)
    if p is None:
        raise APIError(code="NOT_FOUND", message="Item not found.", status_code=404)
    if body.name is not None and _dup_name(db, body.name, exclude_id=product_id):
        raise APIError(
            code="CONFLICT", message="An item with this name already exists.", status_code=409
        )
    if body.category_id is not None:
        _require_active_category(db, body.category_id)
    for field in ("category_id", "name", "base_price_vnd", "is_active"):
        val = getattr(body, field)
        if val is not None:
            setattr(p, field, val)
    return ItemOut.model_validate(p)


@router.delete("/{product_id}", status_code=204)
def delete_item(
    product_id: int,
    hard: bool = False,
    db: Session = Depends(get_db, scope="function"),
    _a: User = Depends(require_admin),
) -> None:
    p = db.get(Product, product_id)
    if p is None:
        raise APIError(code="NOT_FOUND", message="Item not found.", status_code=404)
    combos = db.scalars(
        select(Combo)
        .join(ComboItem, ComboItem.combo_id == Combo.combo_id)
        .where(ComboItem.product_id == product_id)
    ).all()
    if combos:
        raise APIError(
            code="CONFLICT",
            message="Item is used by combos and cannot be removed.",
            status_code=409,
            details={"combos": [c.name for c in combos]},
        )
    if not hard:
        p.is_active = False
        return
    # Hard delete: only safe when no order history references the product
    # (OrderItem.product_id is RESTRICT). Clean up product_options explicitly so
    # the result is identical under SQLite (tests) and MySQL FK cascades.
    if (
        db.scalar(
            select(OrderItem.order_item_id).where(OrderItem.product_id == product_id).limit(1)
        )
        is not None
    ):
        raise APIError(
            code="CONFLICT",
            message="Item appears in past orders and cannot be permanently deleted.",
            status_code=409,
        )
    db.execute(delete(ProductOption).where(ProductOption.product_id == product_id))
    db.delete(p)  # ORM cascade removes product_images


def _locked_product(db: Session, product_id: int) -> Product:
    p = db.scalar(select(Product).where(Product.product_id == product_id).with_for_update())
    if p is None:
        raise APIError(code="NOT_FOUND", message="Item not found.", status_code=404)
    return p


@router.post("/{product_id}/images", response_model=ImageOut, status_code=201)
def add_item_image(
    product_id: int,
    image: UploadFile = File(...),
    db: Session = Depends(get_db, scope="function"),
    _a: User = Depends(require_admin),
) -> ImageOut:
    product = _locked_product(db, product_id)
    before = images_mod.to_gallery(list(product.images))
    url = images_mod.save_blob(image)
    try:
        after, _ = gallery.add(before, url)
    except gallery.GalleryError as e:
        images_mod.remove_blob(url)
        raise APIError(code="VALIDATION_FAILED", message=str(e), status_code=400) from None
    inserted = images_mod.reconcile(
        db, image_model=ProductImage, owner=product, before=before, after=after
    )
    db.flush()
    row = inserted[0]
    return ImageOut(image_id=row.image_id, url=row.url, is_cover=row.is_cover)


@router.delete("/{product_id}/images/{image_id}", status_code=204)
def delete_item_image(
    product_id: int,
    image_id: int,
    db: Session = Depends(get_db, scope="function"),
    _a: User = Depends(require_admin),
) -> None:
    product = _locked_product(db, product_id)
    before = images_mod.to_gallery(list(product.images))
    if not any(i.image_id == image_id for i in before):
        raise APIError(code="NOT_FOUND", message="Image not found.", status_code=404)
    after, _ = gallery.remove(before, image_id)
    images_mod.reconcile(db, image_model=ProductImage, owner=product, before=before, after=after)


@router.post("/{product_id}/images/{image_id}/cover", status_code=204)
def set_item_cover(
    product_id: int,
    image_id: int,
    db: Session = Depends(get_db, scope="function"),
    _a: User = Depends(require_admin),
) -> None:
    product = _locked_product(db, product_id)
    before = images_mod.to_gallery(list(product.images))
    try:
        after, _ = gallery.set_cover(before, image_id)
    except gallery.GalleryError:
        raise APIError(code="NOT_FOUND", message="Image not found.", status_code=404) from None
    images_mod.reconcile(db, image_model=ProductImage, owner=product, before=before, after=after)


@router.post("/{product_id}/image")
def upload_item_image(
    product_id: int,
    image: UploadFile = File(...),
    db: Session = Depends(get_db, scope="function"),
    _a: User = Depends(require_admin),
) -> dict[str, str | None]:
    """Legacy single-image upload: replaces the cover in place (never appends)."""
    product = _locked_product(db, product_id)
    before = images_mod.to_gallery(list(product.images))
    url = images_mod.save_blob(image)
    after, cover = gallery.replace_cover(before, url)
    images_mod.reconcile(db, image_model=ProductImage, owner=product, before=before, after=after)
    return {"image_url": cover}
