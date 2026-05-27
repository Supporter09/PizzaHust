from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db_session
from app.infra.db.models import Category, Combo, PizzaCrust, PizzaSize, Product

router = APIRouter(tags=["menu"])


class MenuOptionResponse(BaseModel):
    value: str
    label: str
    price_delta_vnd: int


class MenuItemResponse(BaseModel):
    id: str
    slug: str
    name: str
    description: str
    category: str
    price_vnd: int
    image_url: str
    badge: str | None = None
    sizes: list[MenuOptionResponse]
    crusts: list[MenuOptionResponse]


DEFAULT_IMAGE = (
    "https://images.unsplash.com/photo-1513104890138-7c749659a591"
    "?auto=format&fit=crop&w=1280&q=80"
)


CATEGORY_IMAGES: dict[str, str] = {
    "pizza": (
        "https://images.unsplash.com/photo-1513104890138-7c749659a591"
        "?auto=format&fit=crop&w=1280&q=80"
    ),
    "combo": (
        "https://images.unsplash.com/photo-1514326640560-7d063ef2aed5"
        "?auto=format&fit=crop&w=1280&q=80"
    ),
    "drink": (
        "https://images.unsplash.com/photo-1544145945-f90425340c7e"
        "?auto=format&fit=crop&w=1280&q=80"
    ),
    "beverage": (
        "https://images.unsplash.com/photo-1544145945-f90425340c7e"
        "?auto=format&fit=crop&w=1280&q=80"
    ),
    "side": (
        "https://images.unsplash.com/photo-1562967914-608f82629710"
        "?auto=format&fit=crop&w=1280&q=80"
    ),
}


def choose_image(category_name: str) -> str:
    lowered = category_name.lower()
    for keyword, image in CATEGORY_IMAGES.items():
        if keyword in lowered:
            return image
    return DEFAULT_IMAGE


@router.get("/items", response_model=list[MenuItemResponse], summary="List Menu Items")
@router.get(
    "/api/items",
    response_model=list[MenuItemResponse],
    include_in_schema=False,
)
def list_items(session: Session = Depends(get_db_session)) -> list[MenuItemResponse]:
    product_rows = session.execute(
        select(Product, Category)
        .join(Category, Product.category_id == Category.category_id)
        .order_by(Product.product_id.asc())
    ).all()
    combos = session.execute(select(Combo).order_by(Combo.combo_id.asc())).scalars().all()
    sizes = session.execute(select(PizzaSize).order_by(PizzaSize.size_id.asc())).scalars().all()
    crusts = session.execute(select(PizzaCrust).order_by(PizzaCrust.crust_id.asc())).scalars().all()

    pizza_sizes = [
        MenuOptionResponse(
            value=str(size.size_id),
            label=size.name,
            price_delta_vnd=size.price_modifier_vnd,
        )
        for size in sizes
    ]
    pizza_crusts = [
        MenuOptionResponse(
            value=str(crust.crust_id),
            label=crust.name,
            price_delta_vnd=0,
        )
        for crust in crusts
    ]

    items: list[MenuItemResponse] = []
    for product, category in product_rows:
        category_name = category.name
        product_slug = f"product-{product.product_id}"
        description = category.description or f"{product.name} in {category_name}."
        items.append(
            MenuItemResponse(
                id=f"product-{product.product_id}",
                slug=product_slug,
                name=product.name,
                description=description,
                category=category_name,
                price_vnd=product.base_price_vnd,
                image_url=choose_image(category_name),
                sizes=pizza_sizes if product.is_pizza else [],
                crusts=pizza_crusts if product.is_pizza else [],
            )
        )

    for combo in combos:
        combo_slug = f"combo-{combo.combo_id}"
        description = combo.description or f"Combo for {combo.target_people or 'group'}."
        items.append(
            MenuItemResponse(
                id=f"combo-{combo.combo_id}",
                slug=combo_slug,
                name=combo.name,
                description=description,
                category="Combo",
                price_vnd=combo.combo_price_vnd,
                image_url=choose_image("combo"),
                badge="Hot" if combo.target_people else None,
                sizes=[],
                crusts=[],
            )
        )

    return items
