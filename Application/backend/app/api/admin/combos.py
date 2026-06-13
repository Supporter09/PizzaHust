"""A4 – Manage combos (admin only).

Status ([Scheduled, Active, Expired]) is derived at read-time from the validity
window via app.domain.combos — there is no stored status and no scheduler. Price
is never rejected (A4 warn-and-override; the frontend warns). A combo must hold
at least 2 component units (sum of quantities) and every fixed component must be
an existing, active product; choice-slots reference an active category with ≥
one active product.
"""

from __future__ import annotations

import os
import uuid
from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.api.images import (  # noqa: F401
    ImageOut,
    image_outs,
    reconcile,
    remove_blob,
    save_blob,
    to_gallery,
)
from app.core.errors import APIError
from app.domain.combos import ComboStatus, combo_savings_vnd, combo_status
from app.infra.auth import require_role
from app.infra.config import get_settings
from app.infra.db.combo_queries import slot_availability
from app.infra.db.deps import get_db
from app.infra.db.models import Combo, ComboItem, Product, User, UserRole

router = APIRouter(prefix="/api/admin/combos", tags=["admin-combos"])
require_admin = require_role(UserRole.ADMIN)

_ALLOWED_IMAGE_EXT = {"png", "jpg", "jpeg", "webp"}


def _now_utc_naive() -> datetime:
    # naive UTC to match the DateTime(timezone=False) columns; utcnow() is deprecated.
    return datetime.now(UTC).replace(tzinfo=None)


def _to_naive_utc(value: datetime | None) -> datetime | None:
    if value is not None and value.tzinfo is not None:
        return value.astimezone(UTC).replace(tzinfo=None)
    return value


class ProductComboItemIn(BaseModel):
    kind: Literal["product"]
    product_id: int
    quantity: int = Field(default=1, ge=1)

    model_config = {"extra": "forbid"}


class CategoryComboItemIn(BaseModel):
    kind: Literal["category"]
    category_id: int
    quantity: int = Field(default=1, ge=1)

    model_config = {"extra": "forbid"}


ComboItemIn = Annotated[ProductComboItemIn | CategoryComboItemIn, Field(discriminator="kind")]


class ComboItemOut(BaseModel):
    kind: Literal["product", "category"]
    product_id: int | None = None
    category_id: int | None = None
    quantity: int
    name: str
    from_price_vnd: int | None = None


class ComboIn(BaseModel):
    name: str
    description: str | None = None
    combo_price_vnd: int
    target_group: int | None = None
    validity_start: datetime | None = None
    validity_end: datetime | None = None
    items: list[ComboItemIn] = []

    @field_validator("validity_start", "validity_end")
    @classmethod
    def _naive(cls, v: datetime | None) -> datetime | None:
        return _to_naive_utc(v)


class ComboPatch(BaseModel):
    name: str | None = None
    description: str | None = None
    combo_price_vnd: int | None = None
    target_group: int | None = None
    validity_start: datetime | None = None
    validity_end: datetime | None = None
    items: list[ComboItemIn] | None = None

    @field_validator("validity_start", "validity_end")
    @classmethod
    def _naive(cls, v: datetime | None) -> datetime | None:
        return _to_naive_utc(v)


class ComboOut(BaseModel):
    combo_id: int
    name: str
    description: str | None
    combo_price_vnd: int
    target_group: int | None
    validity_start: datetime | None
    validity_end: datetime | None
    status: ComboStatus
    image_url: str | None = None
    items_total_vnd: int | None = None
    savings_vnd: int | None = None
    items: list[ComboItemOut]


def _validate_range(start: datetime | None, end: datetime | None) -> None:
    # Equality is allowed, consistent with the DB CHECK (<=) and the
    # end-boundary-active domain rule.
    if start is not None and end is not None and end < start:
        raise APIError(
            code="VALIDATION_FAILED",
            message="validity_end must be on or after validity_start.",
            status_code=400,
            details={"field": "validity_end"},
        )


def _validate_items(db: Session, items: list[ProductComboItemIn | CategoryComboItemIn]) -> None:
    if sum(it.quantity for it in items) < 2:
        raise APIError(
            code="VALIDATION_FAILED",
            message="A combo must contain at least 2 component items.",
            status_code=400,
            details={"field": "items"},
        )
    slot_ids = [it.category_id for it in items if isinstance(it, CategoryComboItemIn)]
    availability = slot_availability(db, slot_ids)
    for it in items:
        if isinstance(it, ProductComboItemIn):
            prod = db.get(Product, it.product_id)
            if prod is None or not prod.is_active:
                raise APIError(
                    code="VALIDATION_FAILED",
                    message="Every combo component must be an existing, active product.",
                    status_code=400,
                    details={"product_id": it.product_id},
                )
        elif availability[it.category_id] is None:
            raise APIError(
                code="VALIDATION_FAILED",
                message="Slot category must be active and contain an active product.",
                status_code=400,
                details={"reason": "slot_category_unavailable", "category_id": it.category_id},
            )


def _to_out(db: Session, combo: Combo) -> ComboOut:
    status = combo_status(combo.validity_start, combo.validity_end, _now_utc_naive())
    rows = sorted(combo.combo_items, key=lambda ci: ci.combo_item_id)
    slot_ids = [ci.category_id for ci in rows if ci.category_id is not None]
    availability = slot_availability(db, slot_ids)
    items: list[ComboItemOut] = []
    for ci in rows:
        if ci.product_id is not None:
            items.append(
                ComboItemOut(
                    kind="product",
                    product_id=ci.product_id,
                    quantity=ci.quantity,
                    name=ci.product.name,
                )
            )
        else:
            assert ci.category_id is not None
            items.append(
                ComboItemOut(
                    kind="category",
                    category_id=ci.category_id,
                    quantity=ci.quantity,
                    name=f"{ci.category.name} — customer's choice",
                    from_price_vnd=availability[ci.category_id],
                )
            )
    items_total: int | None = 0
    for ci in rows:
        if ci.product_id is not None:
            items_total += ci.product.base_price_vnd * ci.quantity
        elif availability[ci.category_id] is None:
            items_total = None
            break
        else:
            items_total += availability[ci.category_id] * ci.quantity
    return ComboOut(
        combo_id=combo.combo_id,
        name=combo.name,
        description=combo.description,
        combo_price_vnd=combo.combo_price_vnd,
        target_group=combo.target_group,
        validity_start=combo.validity_start,
        validity_end=combo.validity_end,
        status=status,
        image_url=combo.image_url,
        items_total_vnd=items_total,
        savings_vnd=(
            combo_savings_vnd(combo.combo_price_vnd, items_total)
            if items_total is not None
            else None
        ),
        items=items,
    )


@router.get("", response_model=list[ComboOut])
def list_combos(
    db: Session = Depends(get_db, scope="function"), _a: User = Depends(require_admin)
) -> list[ComboOut]:
    return [_to_out(db, c) for c in db.scalars(select(Combo).order_by(Combo.combo_id)).all()]


@router.post("", response_model=ComboOut, status_code=201)
def create_combo(
    body: ComboIn,
    db: Session = Depends(get_db, scope="function"),
    _a: User = Depends(require_admin),
) -> ComboOut:
    _validate_range(body.validity_start, body.validity_end)
    _validate_items(db, body.items)
    combo = Combo(
        name=body.name,
        description=body.description,
        combo_price_vnd=body.combo_price_vnd,
        target_group=body.target_group,
        validity_start=body.validity_start,
        validity_end=body.validity_end,
    )
    db.add(combo)
    db.flush()
    for it in body.items:
        db.add(
            ComboItem(
                combo_id=combo.combo_id,
                product_id=it.product_id if isinstance(it, ProductComboItemIn) else None,
                category_id=it.category_id if isinstance(it, CategoryComboItemIn) else None,
                quantity=it.quantity,
            )
        )
    db.flush()
    return _to_out(db, combo)


@router.get("/{combo_id}", response_model=ComboOut)
def get_combo(
    combo_id: int,
    db: Session = Depends(get_db, scope="function"),
    _a: User = Depends(require_admin),
) -> ComboOut:
    combo = db.get(Combo, combo_id)
    if combo is None:
        raise APIError(code="NOT_FOUND", message="Combo not found.", status_code=404)
    return _to_out(db, combo)


@router.patch("/{combo_id}", response_model=ComboOut)
def patch_combo(
    combo_id: int,
    body: ComboPatch,
    db: Session = Depends(get_db, scope="function"),
    _a: User = Depends(require_admin),
) -> ComboOut:
    combo = db.get(Combo, combo_id)
    if combo is None:
        raise APIError(code="NOT_FOUND", message="Combo not found.", status_code=404)

    start = (
        body.validity_start if "validity_start" in body.model_fields_set else combo.validity_start
    )
    end = body.validity_end if "validity_end" in body.model_fields_set else combo.validity_end
    _validate_range(start, end)
    if body.items is not None:
        _validate_items(db, body.items)

    for field in (
        "name",
        "description",
        "combo_price_vnd",
        "target_group",
        "validity_start",
        "validity_end",
    ):
        if field in body.model_fields_set:
            setattr(combo, field, getattr(body, field))

    if body.items is not None:
        db.execute(delete(ComboItem).where(ComboItem.combo_id == combo_id))
        db.flush()
        for it in body.items:
            db.add(
                ComboItem(
                    combo_id=combo_id,
                    product_id=it.product_id if isinstance(it, ProductComboItemIn) else None,
                    category_id=it.category_id if isinstance(it, CategoryComboItemIn) else None,
                    quantity=it.quantity,
                )
            )
        db.flush()
        db.refresh(combo)
    return _to_out(db, combo)


@router.delete("/{combo_id}", status_code=204)
def delete_combo(
    combo_id: int,
    db: Session = Depends(get_db, scope="function"),
    _a: User = Depends(require_admin),
) -> None:
    combo = db.get(Combo, combo_id)
    if combo is None:
        raise APIError(code="NOT_FOUND", message="Combo not found.", status_code=404)
    remove_blob(combo.image_url)
    db.execute(delete(ComboItem).where(ComboItem.combo_id == combo_id))
    db.delete(combo)


@router.post("/{combo_id}/image")
def upload_combo_image(
    combo_id: int,
    image: UploadFile = File(...),
    db: Session = Depends(get_db, scope="function"),
    _a: User = Depends(require_admin),
) -> dict[str, str]:
    combo = db.get(Combo, combo_id)
    if combo is None:
        raise APIError(code="NOT_FOUND", message="Combo not found.", status_code=404)
    settings = get_settings()
    ext = (image.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in _ALLOWED_IMAGE_EXT:
        raise APIError(
            code="VALIDATION_FAILED",
            message="Unsupported image type. Allowed: png, jpg, jpeg, webp.",
            status_code=400,
        )
    data = image.file.read(settings.image_max_bytes + 1)
    if len(data) > settings.image_max_bytes:
        raise APIError(code="VALIDATION_FAILED", message="Image too large.", status_code=400)
    os.makedirs(settings.image_upload_dir, exist_ok=True)
    fname = f"{uuid.uuid4().hex}.{ext}"
    with open(os.path.join(settings.image_upload_dir, fname), "wb") as f:
        f.write(data)
    remove_blob(combo.image_url)  # after the new blob is safely written
    combo.image_url = f"{settings.image_base_url}/{fname}"
    return {"image_url": combo.image_url}


@router.delete("/{combo_id}/image", status_code=204)
def delete_combo_image(
    combo_id: int,
    db: Session = Depends(get_db, scope="function"),
    _a: User = Depends(require_admin),
) -> None:
    combo = db.get(Combo, combo_id)
    if combo is None:
        raise APIError(code="NOT_FOUND", message="Combo not found.", status_code=404)
    remove_blob(combo.image_url)
    combo.image_url = None
