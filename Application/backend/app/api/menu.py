"""U1 – public menu browse (read-only, no auth).

Categories + active items for customers. Thin router that queries the session
directly, mirroring the admin routers (this codebase has no service layer).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.infra.db.deps import get_db
from app.infra.db.models import Category, PizzaCrust, PizzaSize, Product, Topping

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
    is_pizza: bool
    image_url: str | None = None

    model_config = {"from_attributes": True}


class MenuSizeOut(BaseModel):
    size_id: int
    name: str
    price_modifier_vnd: int

    model_config = {"from_attributes": True}


class MenuCrustOut(BaseModel):
    crust_id: int
    name: str

    model_config = {"from_attributes": True}


class MenuToppingOut(BaseModel):
    topping_id: int
    name: str
    price_vnd: int

    model_config = {"from_attributes": True}


class MenuItemDetailOut(BaseModel):
    product_id: int
    category_id: int
    name: str
    base_price_vnd: int
    is_pizza: bool
    image_url: str | None = None
    sizes: list[MenuSizeOut] = []
    crusts: list[MenuCrustOut] = []
    toppings: list[MenuToppingOut] = []

    model_config = {"from_attributes": True}


@router.get("/categories", response_model=list[MenuCategoryOut])
def list_categories(db: Session = Depends(get_db)) -> list[MenuCategoryOut]:
    stmt = (
        select(Category)
        .where(Category.is_active.is_(True))
        .order_by(Category.sort_order, Category.name)
    )
    return [MenuCategoryOut.model_validate(c) for c in db.scalars(stmt).all()]


@router.get("/items", response_model=list[MenuItemOut])
def list_items(category: int | None = None, db: Session = Depends(get_db)) -> list[MenuItemOut]:
    stmt = select(Product).where(Product.is_active.is_(True))
    if category is not None:
        stmt = stmt.where(Product.category_id == category)
    stmt = stmt.order_by(Product.name)
    return [MenuItemOut.model_validate(p) for p in db.scalars(stmt).all()]


@router.get("/items/{product_id}", response_model=MenuItemDetailOut)
def get_item(product_id: int, db: Session = Depends(get_db)) -> MenuItemDetailOut:
    product = db.scalar(
        select(Product).where(
            Product.product_id == product_id,
            Product.is_active.is_(True),
        )
    )
    if product is None:
        raise APIError(code="NOT_FOUND", message="Item not found.", status_code=404)

    sizes: list[MenuSizeOut] = []
    crusts: list[MenuCrustOut] = []
    toppings: list[MenuToppingOut] = []
    if product.is_pizza:
        sizes = [
            MenuSizeOut.model_validate(s)
            for s in db.scalars(
                select(PizzaSize).order_by(PizzaSize.price_modifier_vnd, PizzaSize.name)
            ).all()
        ]
        crusts = [
            MenuCrustOut.model_validate(c)
            for c in db.scalars(select(PizzaCrust).order_by(PizzaCrust.crust_id)).all()
        ]
        toppings = [
            MenuToppingOut.model_validate(t)
            for t in db.scalars(select(Topping).order_by(Topping.name)).all()
        ]

    return MenuItemDetailOut(
        product_id=product.product_id,
        category_id=product.category_id,
        name=product.name,
        base_price_vnd=product.base_price_vnd,
        is_pizza=product.is_pizza,
        image_url=product.image_url,
        sizes=sizes,
        crusts=crusts,
        toppings=toppings,
    )
