"""A2 – Manage pizza options: sizes, crusts, toppings (admin only).

Each delete is guarded against its own reference column in historical order data
(sizes ← order_items.size_id, crusts ← order_items.crust_id, toppings ←
order_item_toppings.topping_id) so a hard delete never orphans an order.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.infra.auth import require_role
from app.infra.db.deps import get_db
from app.infra.db.models import (
    OrderItem,
    OrderItemTopping,
    PizzaCrust,
    PizzaSize,
    Topping,
    User,
    UserRole,
)

router = APIRouter(prefix="/api/admin", tags=["admin-options"])
require_admin = require_role(UserRole.ADMIN)


def _conflict(message: str) -> APIError:
    return APIError(code="CONFLICT", message=message, status_code=409)


def _not_found(message: str) -> APIError:
    return APIError(code="NOT_FOUND", message=message, status_code=404)


# ── Sizes ──────────────────────────────────────────────────────────────────


class SizeOut(BaseModel):
    size_id: int
    name: str
    price_modifier_vnd: int

    model_config = {"from_attributes": True}


class SizeIn(BaseModel):
    name: str
    price_modifier_vnd: int = 0


class SizePatch(BaseModel):
    name: str | None = None
    price_modifier_vnd: int | None = None


@router.get("/sizes", response_model=list[SizeOut])
def list_sizes(db: Session = Depends(get_db), _a: User = Depends(require_admin)) -> list[SizeOut]:
    rows = db.scalars(select(PizzaSize).order_by(PizzaSize.size_id)).all()
    return [SizeOut.model_validate(s) for s in rows]


@router.post("/sizes", response_model=SizeOut, status_code=201)
def create_size(
    body: SizeIn, db: Session = Depends(get_db), _a: User = Depends(require_admin)
) -> SizeOut:
    if db.scalar(select(PizzaSize).where(PizzaSize.name == body.name)):
        raise _conflict("A size with this name already exists.")
    s = PizzaSize(name=body.name, price_modifier_vnd=body.price_modifier_vnd)
    db.add(s)
    db.flush()
    return SizeOut.model_validate(s)


@router.patch("/sizes/{size_id}", response_model=SizeOut)
def patch_size(
    size_id: int,
    body: SizePatch,
    db: Session = Depends(get_db),
    _a: User = Depends(require_admin),
) -> SizeOut:
    s = db.get(PizzaSize, size_id)
    if s is None:
        raise _not_found("Size not found.")
    if body.name is not None:
        if db.scalar(
            select(PizzaSize).where(PizzaSize.name == body.name, PizzaSize.size_id != size_id)
        ):
            raise _conflict("A size with this name already exists.")
        s.name = body.name
    if body.price_modifier_vnd is not None:
        s.price_modifier_vnd = body.price_modifier_vnd
    return SizeOut.model_validate(s)


@router.delete("/sizes/{size_id}", status_code=204)
def delete_size(
    size_id: int, db: Session = Depends(get_db), _a: User = Depends(require_admin)
) -> None:
    s = db.get(PizzaSize, size_id)
    if s is None:
        raise _not_found("Size not found.")
    if db.scalar(select(OrderItem.order_item_id).where(OrderItem.size_id == size_id).limit(1)):
        raise _conflict("Size is used by existing orders and cannot be removed.")
    db.delete(s)


# ── Crusts ─────────────────────────────────────────────────────────────────


class CrustOut(BaseModel):
    crust_id: int
    name: str

    model_config = {"from_attributes": True}


class CrustIn(BaseModel):
    name: str


class CrustPatch(BaseModel):
    name: str | None = None


@router.get("/crusts", response_model=list[CrustOut])
def list_crusts(db: Session = Depends(get_db), _a: User = Depends(require_admin)) -> list[CrustOut]:
    rows = db.scalars(select(PizzaCrust).order_by(PizzaCrust.crust_id)).all()
    return [CrustOut.model_validate(c) for c in rows]


@router.post("/crusts", response_model=CrustOut, status_code=201)
def create_crust(
    body: CrustIn, db: Session = Depends(get_db), _a: User = Depends(require_admin)
) -> CrustOut:
    if db.scalar(select(PizzaCrust).where(PizzaCrust.name == body.name)):
        raise _conflict("A crust with this name already exists.")
    c = PizzaCrust(name=body.name)
    db.add(c)
    db.flush()
    return CrustOut.model_validate(c)


@router.patch("/crusts/{crust_id}", response_model=CrustOut)
def patch_crust(
    crust_id: int,
    body: CrustPatch,
    db: Session = Depends(get_db),
    _a: User = Depends(require_admin),
) -> CrustOut:
    c = db.get(PizzaCrust, crust_id)
    if c is None:
        raise _not_found("Crust not found.")
    if body.name is not None:
        if db.scalar(
            select(PizzaCrust).where(PizzaCrust.name == body.name, PizzaCrust.crust_id != crust_id)
        ):
            raise _conflict("A crust with this name already exists.")
        c.name = body.name
    return CrustOut.model_validate(c)


@router.delete("/crusts/{crust_id}", status_code=204)
def delete_crust(
    crust_id: int, db: Session = Depends(get_db), _a: User = Depends(require_admin)
) -> None:
    c = db.get(PizzaCrust, crust_id)
    if c is None:
        raise _not_found("Crust not found.")
    if db.scalar(select(OrderItem.order_item_id).where(OrderItem.crust_id == crust_id).limit(1)):
        raise _conflict("Crust is used by existing orders and cannot be removed.")
    db.delete(c)


# ── Toppings ───────────────────────────────────────────────────────────────


class ToppingOut(BaseModel):
    topping_id: int
    name: str
    price_vnd: int

    model_config = {"from_attributes": True}


class ToppingIn(BaseModel):
    name: str
    price_vnd: int


class ToppingPatch(BaseModel):
    name: str | None = None
    price_vnd: int | None = None


@router.get("/toppings", response_model=list[ToppingOut])
def list_toppings(
    db: Session = Depends(get_db), _a: User = Depends(require_admin)
) -> list[ToppingOut]:
    rows = db.scalars(select(Topping).order_by(Topping.topping_id)).all()
    return [ToppingOut.model_validate(t) for t in rows]


@router.post("/toppings", response_model=ToppingOut, status_code=201)
def create_topping(
    body: ToppingIn, db: Session = Depends(get_db), _a: User = Depends(require_admin)
) -> ToppingOut:
    if db.scalar(select(Topping).where(Topping.name == body.name)):
        raise _conflict("A topping with this name already exists.")
    t = Topping(name=body.name, price_vnd=body.price_vnd)
    db.add(t)
    db.flush()
    return ToppingOut.model_validate(t)


@router.patch("/toppings/{topping_id}", response_model=ToppingOut)
def patch_topping(
    topping_id: int,
    body: ToppingPatch,
    db: Session = Depends(get_db),
    _a: User = Depends(require_admin),
) -> ToppingOut:
    t = db.get(Topping, topping_id)
    if t is None:
        raise _not_found("Topping not found.")
    if body.name is not None:
        if db.scalar(
            select(Topping).where(Topping.name == body.name, Topping.topping_id != topping_id)
        ):
            raise _conflict("A topping with this name already exists.")
        t.name = body.name
    if body.price_vnd is not None:
        t.price_vnd = body.price_vnd
    return ToppingOut.model_validate(t)


@router.delete("/toppings/{topping_id}", status_code=204)
def delete_topping(
    topping_id: int, db: Session = Depends(get_db), _a: User = Depends(require_admin)
) -> None:
    t = db.get(Topping, topping_id)
    if t is None:
        raise _not_found("Topping not found.")
    if db.scalar(
        select(OrderItemTopping.id).where(OrderItemTopping.topping_id == topping_id).limit(1)
    ):
        raise _conflict("Topping is used by existing orders and cannot be removed.")
    db.delete(t)
