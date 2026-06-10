"""A8 – manage option groups and options (admin only).

Generic replacement for the fixed sizes/crusts/toppings routers. Order history
holds snapshots (order_item_options), so deletes need no reference guards.
Group delete cascades to its options and their product enablement rows.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.infra.auth import require_role
from app.infra.db.deps import get_db
from app.infra.db.models import Option, OptionGroup, Product, ProductOption, User, UserRole

router = APIRouter(prefix="/api/admin", tags=["admin-option-groups"])
require_admin = require_role(UserRole.ADMIN)


def _conflict(message: str) -> APIError:
    return APIError(code="CONFLICT", message=message, status_code=409)


def _not_found(message: str) -> APIError:
    return APIError(code="NOT_FOUND", message=message, status_code=404)


class GroupOut(BaseModel):
    group_id: int
    name: str
    select_type: Literal["single", "multi"]
    required: bool
    sort_order: int

    model_config = {"from_attributes": True}


class GroupIn(BaseModel):
    name: str
    select_type: Literal["single", "multi"] = "multi"
    required: bool = False
    sort_order: int = 0


class GroupPatch(BaseModel):
    name: str | None = None
    select_type: Literal["single", "multi"] | None = None
    required: bool | None = None
    sort_order: int | None = None


class OptionOut(BaseModel):
    option_id: int
    group_id: int
    name: str
    description: str | None = None
    price_delta_vnd: int
    sort_order: int

    model_config = {"from_attributes": True}


class OptionIn(BaseModel):
    name: str
    description: str | None = None
    price_delta_vnd: int = Field(default=0, ge=0)
    sort_order: int = 0


class OptionPatch(BaseModel):
    name: str | None = None
    description: str | None = None
    price_delta_vnd: int | None = Field(default=None, ge=0)
    sort_order: int | None = None


class ItemOptionOut(BaseModel):
    option_id: int
    name: str
    description: str | None = None
    price_delta_vnd: int
    sort_order: int
    enabled: bool


class ItemOptionGroupOut(BaseModel):
    group_id: int
    name: str
    select_type: Literal["single", "multi"]
    required: bool
    sort_order: int
    options: list[ItemOptionOut]


class ItemOptionsPut(BaseModel):
    option_ids: list[int]


def _require_product(db: Session, product_id: int) -> Product:
    p = db.get(Product, product_id)
    if p is None:
        raise _not_found("Item not found.")
    return p


@router.get("/option-groups", response_model=list[GroupOut])
def list_groups(
    db: Session = Depends(get_db, scope="function"), _a: User = Depends(require_admin)
) -> list[GroupOut]:
    rows = db.scalars(select(OptionGroup).order_by(OptionGroup.sort_order, OptionGroup.name)).all()
    return [GroupOut.model_validate(g) for g in rows]


@router.post("/option-groups", response_model=GroupOut, status_code=201)
def create_group(
    body: GroupIn,
    db: Session = Depends(get_db, scope="function"),
    _a: User = Depends(require_admin),
) -> GroupOut:
    if db.scalar(select(OptionGroup).where(OptionGroup.name == body.name)):
        raise _conflict("An option group with this name already exists.")
    g = OptionGroup(
        name=body.name,
        select_type=body.select_type,
        required=body.required,
        sort_order=body.sort_order,
    )
    db.add(g)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise _conflict("An option group with this name already exists.") from exc
    return GroupOut.model_validate(g)


@router.patch("/option-groups/{group_id}", response_model=GroupOut)
def patch_group(
    group_id: int,
    body: GroupPatch,
    db: Session = Depends(get_db, scope="function"),
    _a: User = Depends(require_admin),
) -> GroupOut:
    g = db.get(OptionGroup, group_id)
    if g is None:
        raise _not_found("Option group not found.")
    if body.name is not None:
        if db.scalar(
            select(OptionGroup).where(
                OptionGroup.name == body.name, OptionGroup.group_id != group_id
            )
        ):
            raise _conflict("An option group with this name already exists.")
        g.name = body.name
    if body.select_type is not None:
        g.select_type = body.select_type
    if body.required is not None:
        g.required = body.required
    if body.sort_order is not None:
        g.sort_order = body.sort_order
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise _conflict("An option group with this name already exists.") from exc
    return GroupOut.model_validate(g)


@router.delete("/option-groups/{group_id}", status_code=204)
def delete_group(
    group_id: int,
    db: Session = Depends(get_db, scope="function"),
    _a: User = Depends(require_admin),
) -> None:
    g = db.get(OptionGroup, group_id)
    if g is None:
        raise _not_found("Option group not found.")
    db.delete(g)
    db.flush()


@router.post("/option-groups/{group_id}/options", response_model=OptionOut, status_code=201)
def create_option(
    group_id: int,
    body: OptionIn,
    db: Session = Depends(get_db, scope="function"),
    _a: User = Depends(require_admin),
) -> OptionOut:
    if db.get(OptionGroup, group_id) is None:
        raise _not_found("Option group not found.")
    if db.scalar(select(Option).where(Option.group_id == group_id, Option.name == body.name)):
        raise _conflict("An option with this name already exists in this group.")
    o = Option(
        group_id=group_id,
        name=body.name,
        description=body.description,
        price_delta_vnd=body.price_delta_vnd,
        sort_order=body.sort_order,
    )
    db.add(o)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise _conflict("An option with this name already exists in this group.") from exc
    return OptionOut.model_validate(o)


@router.patch("/options/{option_id}", response_model=OptionOut)
def patch_option(
    option_id: int,
    body: OptionPatch,
    db: Session = Depends(get_db, scope="function"),
    _a: User = Depends(require_admin),
) -> OptionOut:
    o = db.get(Option, option_id)
    if o is None:
        raise _not_found("Option not found.")
    if body.name is not None:
        if db.scalar(
            select(Option).where(
                Option.group_id == o.group_id,
                Option.name == body.name,
                Option.option_id != option_id,
            )
        ):
            raise _conflict("An option with this name already exists in this group.")
        o.name = body.name
    if body.description is not None:
        o.description = body.description
    if body.price_delta_vnd is not None:
        o.price_delta_vnd = body.price_delta_vnd
    if body.sort_order is not None:
        o.sort_order = body.sort_order
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise _conflict("An option with this name already exists in this group.") from exc
    return OptionOut.model_validate(o)


@router.delete("/options/{option_id}", status_code=204)
def delete_option(
    option_id: int,
    db: Session = Depends(get_db, scope="function"),
    _a: User = Depends(require_admin),
) -> None:
    o = db.get(Option, option_id)
    if o is None:
        raise _not_found("Option not found.")
    db.delete(o)
    db.flush()


@router.get("/items/{product_id}/options", response_model=list[ItemOptionGroupOut])
def item_options(
    product_id: int,
    db: Session = Depends(get_db, scope="function"),
    _a: User = Depends(require_admin),
) -> list[ItemOptionGroupOut]:
    _require_product(db, product_id)
    enabled_ids = set(
        db.scalars(
            select(ProductOption.option_id).where(ProductOption.product_id == product_id)
        ).all()
    )
    groups = db.scalars(
        select(OptionGroup).order_by(OptionGroup.sort_order, OptionGroup.name)
    ).all()
    out: list[ItemOptionGroupOut] = []
    for g in groups:
        opts = sorted(g.options, key=lambda o: (o.sort_order, o.name))
        out.append(
            ItemOptionGroupOut(
                group_id=g.group_id,
                name=g.name,
                select_type=g.select_type,
                required=g.required,
                sort_order=g.sort_order,
                options=[
                    ItemOptionOut(
                        option_id=o.option_id,
                        name=o.name,
                        description=o.description,
                        price_delta_vnd=o.price_delta_vnd,
                        sort_order=o.sort_order,
                        enabled=o.option_id in enabled_ids,
                    )
                    for o in opts
                ],
            )
        )
    return out


@router.put("/items/{product_id}/options", response_model=list[ItemOptionGroupOut])
def replace_item_options(
    product_id: int,
    body: ItemOptionsPut,
    db: Session = Depends(get_db, scope="function"),
    _a: User = Depends(require_admin),
) -> list[ItemOptionGroupOut]:
    _require_product(db, product_id)
    wanted = list(dict.fromkeys(body.option_ids))
    if wanted:
        known = set(db.scalars(select(Option.option_id).where(Option.option_id.in_(wanted))).all())
        missing = [oid for oid in wanted if oid not in known]
        if missing:
            raise _not_found(f"Unknown option ids: {missing}.")
    db.execute(delete(ProductOption).where(ProductOption.product_id == product_id))
    for oid in wanted:
        db.add(ProductOption(product_id=product_id, option_id=oid))
    db.flush()
    return item_options(product_id, db, _a)
