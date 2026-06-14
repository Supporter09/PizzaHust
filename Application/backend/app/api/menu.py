"""U1 – public menu browse (read-only, no auth).

Categories + active items for customers. Thin router that queries the session
directly, mirroring the admin routers (this codebase has no service layer).
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.images import ImageOut, image_outs
from app.core.errors import APIError
from app.infra.db.deps import get_db
from app.infra.db.models import Category, Option, OptionGroup, Product, ProductOption

router = APIRouter(prefix="/api", tags=["menu"])


class MenuCategoryOut(BaseModel):
    category_id: int
    name: str
    sort_order: int

    model_config = {"from_attributes": True}


class MenuItemOut(BaseModel):
    product_id: int
    category_id: int
    name: str
    base_price_vnd: int
    # True when an enabled option can change the price, so base_price is a "from" floor.
    has_price_options: bool
    image_url: str | None = None

    model_config = {"from_attributes": True}


class MenuOptionOut(BaseModel):
    option_id: int
    name: str
    description: str | None = None
    price_delta_vnd: int

    model_config = {"from_attributes": True}


class MenuOptionGroupOut(BaseModel):
    group_id: int
    name: str
    select_type: Literal["single", "multi"]
    required: bool
    options: list[MenuOptionOut]


class MenuItemDetailOut(BaseModel):
    product_id: int
    category_id: int
    name: str
    base_price_vnd: int
    image_url: str | None = None
    option_groups: list[MenuOptionGroupOut] = []
    images: list[ImageOut] = []

    model_config = {"from_attributes": True}


@router.get("/categories", response_model=list[MenuCategoryOut])
def list_categories(db: Session = Depends(get_db, scope="function")) -> list[MenuCategoryOut]:
    stmt = (
        select(Category)
        .where(Category.is_active.is_(True))
        .order_by(Category.sort_order, Category.name)
    )
    return [MenuCategoryOut.model_validate(c) for c in db.scalars(stmt).all()]


@router.get("/items", response_model=list[MenuItemOut])
def list_items(
    category: int | None = None, db: Session = Depends(get_db, scope="function")
) -> list[MenuItemOut]:
    stmt = select(Product).where(Product.is_active.is_(True))
    if category is not None:
        stmt = stmt.where(Product.category_id == category)
    stmt = stmt.order_by(Product.name)
    products = list(db.scalars(stmt).all())
    # Products whose enabled options can move the price — base price is then a floor.
    priced_pids = set(
        db.scalars(
            select(ProductOption.product_id)
            .join(Option, Option.option_id == ProductOption.option_id)
            .where(Option.price_delta_vnd != 0)
        ).all()
    )
    return [
        MenuItemOut(
            product_id=p.product_id,
            category_id=p.category_id,
            name=p.name,
            base_price_vnd=p.base_price_vnd,
            has_price_options=p.product_id in priced_pids,
            image_url=p.image_url,
        )
        for p in products
    ]


@router.get("/items/{product_id}", response_model=MenuItemDetailOut)
def get_item(product_id: int, db: Session = Depends(get_db, scope="function")) -> MenuItemDetailOut:
    product = db.scalar(
        select(Product).where(
            Product.product_id == product_id,
            Product.is_active.is_(True),
        )
    )
    if product is None:
        raise APIError(code="NOT_FOUND", message="Item not found.", status_code=404)

    rows = db.execute(
        select(Option, OptionGroup)
        .join(OptionGroup, Option.group_id == OptionGroup.group_id)
        .join(ProductOption, ProductOption.option_id == Option.option_id)
        .where(ProductOption.product_id == product_id)
        .order_by(OptionGroup.sort_order, OptionGroup.name, Option.sort_order, Option.name)
    ).all()

    groups: dict[int, MenuOptionGroupOut] = {}
    for option, group in rows:
        bucket = groups.get(group.group_id)
        if bucket is None:
            bucket = MenuOptionGroupOut(
                group_id=group.group_id,
                name=group.name,
                select_type=group.select_type,
                required=group.required,
                options=[],
            )
            groups[group.group_id] = bucket
        bucket.options.append(MenuOptionOut.model_validate(option))

    return MenuItemDetailOut(
        product_id=product.product_id,
        category_id=product.category_id,
        name=product.name,
        base_price_vnd=product.base_price_vnd,
        image_url=product.image_url,
        option_groups=list(groups.values()),
        images=image_outs(list(product.images)),
    )
