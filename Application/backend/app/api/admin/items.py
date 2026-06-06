"""A1/A2 – Manage pizzas & side dishes (admin only).

Unified product surface: ``kind`` selects pizza vs side dish; ``is_pizza`` is
derived. Delete is a soft-deactivate so historical order_items never orphan.
"""

from __future__ import annotations

import os
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.infra.auth import require_role
from app.infra.config import get_settings
from app.infra.db.deps import get_db
from app.infra.db.models import Category, Combo, ComboItem, Product, User, UserRole

router = APIRouter(prefix="/api/admin/items", tags=["admin-items"])
require_admin = require_role(UserRole.ADMIN)

# A1 product images: extension allowlist only (no re-encoding/Pillow in MVP).
_ALLOWED_IMAGE_EXT = {"png", "jpg", "jpeg", "webp"}


class ItemOut(BaseModel):
    product_id: int
    category_id: int
    name: str
    base_price_vnd: int
    is_pizza: bool
    image_url: str | None = None
    is_active: bool = True

    model_config = {"from_attributes": True}


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


@router.get("", response_model=list[ItemOut])
def list_items(
    kind: Literal["pizza", "side"] | None = None,
    category_id: int | None = None,
    active: bool | None = None,
    db: Session = Depends(get_db),
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
    db: Session = Depends(get_db),
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
    return ItemOut.model_validate(p)


@router.get("/{product_id}", response_model=ItemOut)
def get_item(
    product_id: int,
    db: Session = Depends(get_db),
    _a: User = Depends(require_admin),
) -> ItemOut:
    p = db.get(Product, product_id)
    if p is None:
        raise APIError(code="NOT_FOUND", message="Item not found.", status_code=404)
    return ItemOut.model_validate(p)


@router.patch("/{product_id}", response_model=ItemOut)
def patch_item(
    product_id: int,
    body: ItemPatch,
    db: Session = Depends(get_db),
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
    db: Session = Depends(get_db),
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
    p.is_active = False


@router.post("/{product_id}/image")
def upload_item_image(
    product_id: int,
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    _a: User = Depends(require_admin),
) -> dict[str, str]:
    p = db.get(Product, product_id)
    if p is None:
        raise APIError(code="NOT_FOUND", message="Item not found.", status_code=404)
    settings = get_settings()
    ext = (image.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in _ALLOWED_IMAGE_EXT:
        raise APIError(
            code="VALIDATION_FAILED",
            message="Unsupported image type. Allowed: png, jpg, jpeg, webp.",
            status_code=400,
        )
    # Read at most max+1 bytes, then check — bounds memory regardless of upload size.
    data = image.file.read(settings.image_max_bytes + 1)
    if len(data) > settings.image_max_bytes:
        raise APIError(code="VALIDATION_FAILED", message="Image too large.", status_code=400)
    os.makedirs(settings.image_upload_dir, exist_ok=True)
    fname = f"{uuid.uuid4().hex}.{ext}"
    with open(os.path.join(settings.image_upload_dir, fname), "wb") as f:
        f.write(data)
    p.image_url = f"{settings.image_base_url}/{fname}"
    return {"image_url": p.image_url}
