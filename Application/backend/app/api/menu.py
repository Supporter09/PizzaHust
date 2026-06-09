"""U1 – public menu browse (read-only, no auth).

Categories + active items for customers. Thin router that queries the session
directly, mirroring the admin routers (this codebase has no service layer).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.infra.db.deps import get_db
from app.infra.db.models import Category, Product

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
