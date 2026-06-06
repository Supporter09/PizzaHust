"""A4 – Manage combos (admin only).

Status ([Scheduled, Active, Expired]) is derived at read-time from the validity
window via app.domain.combos — there is no stored status and no scheduler. Price
is never rejected (A4 warn-and-override; the frontend warns). A combo must hold
at least 2 components and every component must be an existing, active product.
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, field_validator
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.domain.combos import ComboStatus, combo_status
from app.infra.auth import require_role
from app.infra.db.deps import get_db
from app.infra.db.models import Combo, ComboItem, Product, User, UserRole

router = APIRouter(prefix="/api/admin/combos", tags=["admin-combos"])
require_admin = require_role(UserRole.ADMIN)


def _now_utc_naive() -> datetime:
    # naive UTC to match the DateTime(timezone=False) columns; utcnow() is deprecated.
    return datetime.now(UTC).replace(tzinfo=None)


def _to_naive_utc(value: datetime | None) -> datetime | None:
    if value is not None and value.tzinfo is not None:
        return value.astimezone(UTC).replace(tzinfo=None)
    return value


class ComboItemIn(BaseModel):
    product_id: int
    quantity: int = 1


class ComboItemOut(BaseModel):
    product_id: int
    quantity: int
    name: str


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


def _validate_items(db: Session, items: list[ComboItemIn]) -> None:
    if len(items) < 2:
        raise APIError(
            code="VALIDATION_FAILED",
            message="A combo must contain at least 2 items.",
            status_code=400,
            details={"field": "items"},
        )
    for it in items:
        prod = db.get(Product, it.product_id)
        if prod is None or not prod.is_active:
            raise APIError(
                code="VALIDATION_FAILED",
                message="Every combo component must be an existing, active product.",
                status_code=400,
                details={"product_id": it.product_id},
            )


def _to_out(combo: Combo) -> ComboOut:
    status = combo_status(combo.validity_start, combo.validity_end, _now_utc_naive())
    items = [
        ComboItemOut(product_id=ci.product_id, quantity=ci.quantity, name=ci.product.name)
        for ci in combo.combo_items
    ]
    return ComboOut(
        combo_id=combo.combo_id,
        name=combo.name,
        description=combo.description,
        combo_price_vnd=combo.combo_price_vnd,
        target_group=combo.target_group,
        validity_start=combo.validity_start,
        validity_end=combo.validity_end,
        status=status,
        items=items,
    )


@router.get("", response_model=list[ComboOut])
def list_combos(db: Session = Depends(get_db), _a: User = Depends(require_admin)) -> list[ComboOut]:
    return [_to_out(c) for c in db.scalars(select(Combo).order_by(Combo.combo_id)).all()]


@router.post("", response_model=ComboOut, status_code=201)
def create_combo(
    body: ComboIn, db: Session = Depends(get_db), _a: User = Depends(require_admin)
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
        db.add(ComboItem(combo_id=combo.combo_id, product_id=it.product_id, quantity=it.quantity))
    db.flush()
    return _to_out(combo)


@router.get("/{combo_id}", response_model=ComboOut)
def get_combo(
    combo_id: int, db: Session = Depends(get_db), _a: User = Depends(require_admin)
) -> ComboOut:
    combo = db.get(Combo, combo_id)
    if combo is None:
        raise APIError(code="NOT_FOUND", message="Combo not found.", status_code=404)
    return _to_out(combo)


@router.patch("/{combo_id}", response_model=ComboOut)
def patch_combo(
    combo_id: int,
    body: ComboPatch,
    db: Session = Depends(get_db),
    _a: User = Depends(require_admin),
) -> ComboOut:
    combo = db.get(Combo, combo_id)
    if combo is None:
        raise APIError(code="NOT_FOUND", message="Combo not found.", status_code=404)

    start = body.validity_start if body.validity_start is not None else combo.validity_start
    end = body.validity_end if body.validity_end is not None else combo.validity_end
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
        val = getattr(body, field)
        if val is not None:
            setattr(combo, field, val)

    if body.items is not None:
        db.execute(delete(ComboItem).where(ComboItem.combo_id == combo_id))
        db.flush()
        for it in body.items:
            db.add(ComboItem(combo_id=combo_id, product_id=it.product_id, quantity=it.quantity))
        db.flush()
        db.refresh(combo)
    return _to_out(combo)


@router.delete("/{combo_id}", status_code=204)
def delete_combo(
    combo_id: int, db: Session = Depends(get_db), _a: User = Depends(require_admin)
) -> None:
    combo = db.get(Combo, combo_id)
    if combo is None:
        raise APIError(code="NOT_FOUND", message="Combo not found.", status_code=404)
    db.execute(delete(ComboItem).where(ComboItem.combo_id == combo_id))
    db.delete(combo)
