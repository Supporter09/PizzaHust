"""A1–A4 – Admin Catalog Management (pizzas, options, categories, combos).

Endpoints:
  A1  /api/admin/pizzas          – CRUD for pizza products + image upload
  A2  /api/admin/pizza-options   – sizes, crusts, toppings CRUD
      /api/admin/side-dishes     – side dish products CRUD
  A3  /api/admin/categories      – category ordering + active toggle
  A4  /api/admin/combos          – combo campaigns with component items
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.infra.auth import require_role
from app.infra.db.deps import get_db
from app.infra.db.models import (
    Category,
    Combo,
    ComboItem,
    PizzaCrust,
    PizzaSize,
    Product,
    Topping,
    User,
    UserRole,
)

router = APIRouter(tags=["admin-catalog"])

require_admin = require_role(UserRole.ADMIN)

# ─────────────────────────────────────────────────────────────────────────────
# Local image storage (upload to /static/images; served by frontend's /public
# or a static mount in production).
# ─────────────────────────────────────────────────────────────────────────────
UPLOAD_DIR = os.environ.get("IMAGE_UPLOAD_DIR", "/tmp/pizzahust_images")
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB

os.makedirs(UPLOAD_DIR, exist_ok=True)


def _save_image(file: UploadFile) -> str:
    """Persist uploaded image; return a relative URL path."""
    data = file.file.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="IMAGE_TOO_LARGE")
    ext = (file.filename or "image").rsplit(".", 1)[-1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    path = os.path.join(UPLOAD_DIR, filename)
    with open(path, "wb") as f:
        f.write(data)
    return f"/images/{filename}"


# ─────────────────────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────────────────────

class ProductOut(BaseModel):
    product_id: int
    category_id: int
    name: str
    base_price_vnd: int
    is_pizza: bool
    image_url: Optional[str] = None
    is_active: bool = True

    model_config = {"from_attributes": True}


class ProductIn(BaseModel):
    category_id: int
    name: str
    base_price_vnd: int


class CategoryOut(BaseModel):
    category_id: int
    name: str
    description: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True

    model_config = {"from_attributes": True}


class CategoryIn(BaseModel):
    name: str
    description: Optional[str] = None
    sort_order: int = 0


class CategoryOrderIn(BaseModel):
    """List of category_id in desired display order."""
    order: List[int]


class SizeOut(BaseModel):
    size_id: int
    name: str
    price_modifier_vnd: int

    model_config = {"from_attributes": True}


class SizeIn(BaseModel):
    name: str
    price_modifier_vnd: int = 0


class CrustOut(BaseModel):
    crust_id: int
    name: str

    model_config = {"from_attributes": True}


class CrustIn(BaseModel):
    name: str


class ToppingOut(BaseModel):
    topping_id: int
    name: str
    price_vnd: int

    model_config = {"from_attributes": True}


class ToppingIn(BaseModel):
    name: str
    price_vnd: int


class ComboItemIn(BaseModel):
    product_id: int
    quantity: int = 1


class ComboItemOut(BaseModel):
    combo_item_id: int
    product_id: int
    quantity: int
    product_name: str = ""

    model_config = {"from_attributes": True}


class ComboIn(BaseModel):
    name: str
    description: Optional[str] = None
    combo_price_vnd: int
    target_group: Optional[int] = None
    validity_start: Optional[datetime] = None
    validity_end: Optional[datetime] = None
    items: List[ComboItemIn] = []

    @model_validator(mode="after")
    def check_validity_window(self) -> "ComboIn":
        if self.validity_start and self.validity_end:
            if self.validity_end <= self.validity_start:
                raise ValueError("validity_end must be after validity_start")
        return self


class ComboOut(BaseModel):
    combo_id: int
    name: str
    description: Optional[str] = None
    combo_price_vnd: int
    target_group: Optional[int] = None
    validity_start: Optional[datetime] = None
    validity_end: Optional[datetime] = None
    items: List[ComboItemOut] = []

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# A1 – Pizzas
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/api/admin/pizzas", response_model=List[ProductOut])
def list_pizzas(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> List[ProductOut]:
    products = db.scalars(select(Product).where(Product.is_pizza == True).order_by(Product.product_id)).all()  # noqa: E712
    return [ProductOut.model_validate(p) for p in products]


@router.post("/api/admin/pizzas", response_model=ProductOut, status_code=201)
def create_pizza(
    name: str = Form(...),
    category_id: int = Form(...),
    base_price_vnd: int = Form(...),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> ProductOut:
    # Duplicate name check
    existing = db.scalar(select(Product).where(Product.name == name))
    if existing is not None:
        raise HTTPException(status_code=409, detail="DUPLICATE_NAME")

    image_url: Optional[str] = None
    if image and image.filename:
        image_url = _save_image(image)

    product = Product(
        category_id=category_id,
        name=name,
        base_price_vnd=base_price_vnd,
        is_pizza=True,
        image_url=image_url,
    )
    db.add(product)
    db.flush()
    return ProductOut.model_validate(product)


@router.put("/api/admin/pizzas/{product_id}", response_model=ProductOut)
def update_pizza(
    product_id: int,
    name: str = Form(...),
    category_id: int = Form(...),
    base_price_vnd: int = Form(...),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> ProductOut:
    product: Product | None = db.get(Product, product_id)
    if product is None or not product.is_pizza:
        raise HTTPException(status_code=404, detail="NOT_FOUND")

    # Duplicate name check (exclude self)
    dup = db.scalar(select(Product).where(Product.name == name, Product.product_id != product_id))
    if dup is not None:
        raise HTTPException(status_code=409, detail="DUPLICATE_NAME")

    product.name = name
    product.category_id = category_id
    product.base_price_vnd = base_price_vnd

    if image and image.filename:
        product.image_url = _save_image(image)

    return ProductOut.model_validate(product)


@router.post("/api/admin/pizzas/{product_id}/deactivate", status_code=204)
def deactivate_pizza(
    product_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> None:
    product: Product | None = db.get(Product, product_id)
    if product is None or not product.is_pizza:
        raise HTTPException(status_code=404, detail="NOT_FOUND")

    # Warn if pizza is in any combo (return 409 with extra info so UI can show warning)
    combos_with_pizza = db.scalars(
        select(Combo)
        .join(ComboItem, ComboItem.combo_id == Combo.combo_id)
        .where(ComboItem.product_id == product_id)
    ).all()
    if combos_with_pizza:
        combo_names = [c.name for c in combos_with_pizza]
        raise HTTPException(
            status_code=409,
            detail=f"PIZZA_IN_COMBOS:{','.join(combo_names)}",
        )

    product.is_active = False


# ─────────────────────────────────────────────────────────────────────────────
# A2 – Pizza Options (sizes, crusts, toppings) + Side Dishes
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/api/admin/pizza-sizes", response_model=List[SizeOut])
def list_sizes(db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> List[SizeOut]:
    return [SizeOut.model_validate(s) for s in db.scalars(select(PizzaSize).order_by(PizzaSize.size_id)).all()]


@router.post("/api/admin/pizza-sizes", response_model=SizeOut, status_code=201)
def create_size(body: SizeIn, db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> SizeOut:
    if db.scalar(select(PizzaSize).where(PizzaSize.name == body.name)):
        raise HTTPException(status_code=409, detail="DUPLICATE_NAME")
    s = PizzaSize(name=body.name, price_modifier_vnd=body.price_modifier_vnd)
    db.add(s)
    db.flush()
    return SizeOut.model_validate(s)


@router.put("/api/admin/pizza-sizes/{size_id}", response_model=SizeOut)
def update_size(size_id: int, body: SizeIn, db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> SizeOut:
    s: PizzaSize | None = db.get(PizzaSize, size_id)
    if s is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    s.name = body.name
    s.price_modifier_vnd = body.price_modifier_vnd
    return SizeOut.model_validate(s)


@router.delete("/api/admin/pizza-sizes/{size_id}", status_code=204)
def delete_size(size_id: int, db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> None:
    s: PizzaSize | None = db.get(PizzaSize, size_id)
    if s is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    db.delete(s)


@router.get("/api/admin/pizza-crusts", response_model=List[CrustOut])
def list_crusts(db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> List[CrustOut]:
    return [CrustOut.model_validate(c) for c in db.scalars(select(PizzaCrust).order_by(PizzaCrust.crust_id)).all()]


@router.post("/api/admin/pizza-crusts", response_model=CrustOut, status_code=201)
def create_crust(body: CrustIn, db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> CrustOut:
    if db.scalar(select(PizzaCrust).where(PizzaCrust.name == body.name)):
        raise HTTPException(status_code=409, detail="DUPLICATE_NAME")
    c = PizzaCrust(name=body.name)
    db.add(c)
    db.flush()
    return CrustOut.model_validate(c)


@router.put("/api/admin/pizza-crusts/{crust_id}", response_model=CrustOut)
def update_crust(crust_id: int, body: CrustIn, db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> CrustOut:
    c: PizzaCrust | None = db.get(PizzaCrust, crust_id)
    if c is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    c.name = body.name
    return CrustOut.model_validate(c)


@router.delete("/api/admin/pizza-crusts/{crust_id}", status_code=204)
def delete_crust(crust_id: int, db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> None:
    c: PizzaCrust | None = db.get(PizzaCrust, crust_id)
    if c is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    db.delete(c)


@router.get("/api/admin/toppings", response_model=List[ToppingOut])
def list_toppings(db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> List[ToppingOut]:
    return [ToppingOut.model_validate(t) for t in db.scalars(select(Topping).order_by(Topping.topping_id)).all()]


@router.post("/api/admin/toppings", response_model=ToppingOut, status_code=201)
def create_topping(body: ToppingIn, db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> ToppingOut:
    if db.scalar(select(Topping).where(Topping.name == body.name)):
        raise HTTPException(status_code=409, detail="DUPLICATE_NAME")
    t = Topping(name=body.name, price_vnd=body.price_vnd)
    db.add(t)
    db.flush()
    return ToppingOut.model_validate(t)


@router.put("/api/admin/toppings/{topping_id}", response_model=ToppingOut)
def update_topping(topping_id: int, body: ToppingIn, db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> ToppingOut:
    t: Topping | None = db.get(Topping, topping_id)
    if t is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    t.name = body.name
    t.price_vnd = body.price_vnd
    return ToppingOut.model_validate(t)


@router.delete("/api/admin/toppings/{topping_id}", status_code=204)
def delete_topping(topping_id: int, db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> None:
    t: Topping | None = db.get(Topping, topping_id)
    if t is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    db.delete(t)


# Side dishes – reuse Product model, is_pizza=False
@router.get("/api/admin/side-dishes", response_model=List[ProductOut])
def list_side_dishes(db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> List[ProductOut]:
    return [ProductOut.model_validate(p) for p in db.scalars(select(Product).where(Product.is_pizza == False).order_by(Product.product_id)).all()]  # noqa: E712


@router.post("/api/admin/side-dishes", response_model=ProductOut, status_code=201)
def create_side_dish(body: ProductIn, db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> ProductOut:
    if db.scalar(select(Product).where(Product.name == body.name)):
        raise HTTPException(status_code=409, detail="DUPLICATE_NAME")
    p = Product(category_id=body.category_id, name=body.name, base_price_vnd=body.base_price_vnd, is_pizza=False)
    db.add(p)
    db.flush()
    return ProductOut.model_validate(p)


@router.put("/api/admin/side-dishes/{product_id}", response_model=ProductOut)
def update_side_dish(product_id: int, body: ProductIn, db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> ProductOut:
    p: Product | None = db.get(Product, product_id)
    if p is None or p.is_pizza:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    dup = db.scalar(select(Product).where(Product.name == body.name, Product.product_id != product_id))
    if dup:
        raise HTTPException(status_code=409, detail="DUPLICATE_NAME")
    p.name = body.name
    p.category_id = body.category_id
    p.base_price_vnd = body.base_price_vnd
    return ProductOut.model_validate(p)


@router.delete("/api/admin/side-dishes/{product_id}", status_code=204)
def delete_side_dish(product_id: int, db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> None:
    p: Product | None = db.get(Product, product_id)
    if p is None or p.is_pizza:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    db.delete(p)


# ─────────────────────────────────────────────────────────────────────────────
# A3 – Menu Categories
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/api/admin/categories", response_model=List[CategoryOut])
def list_categories(db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> List[CategoryOut]:
    cats = db.scalars(select(Category).order_by(Category.category_id)).all()
    return [CategoryOut.model_validate(c) for c in cats]


@router.post("/api/admin/categories", response_model=CategoryOut, status_code=201)
def create_category(body: CategoryIn, db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> CategoryOut:
    if db.scalar(select(Category).where(Category.name == body.name)):
        raise HTTPException(status_code=409, detail="DUPLICATE_NAME")
    cat = Category(name=body.name, description=body.description)
    db.add(cat)
    db.flush()
    return CategoryOut.model_validate(cat)


@router.put("/api/admin/categories/{category_id}", response_model=CategoryOut)
def update_category(category_id: int, body: CategoryIn, db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> CategoryOut:
    cat: Category | None = db.get(Category, category_id)
    if cat is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    dup = db.scalar(select(Category).where(Category.name == body.name, Category.category_id != category_id))
    if dup:
        raise HTTPException(status_code=409, detail="DUPLICATE_NAME")
    cat.name = body.name
    cat.description = body.description
    return CategoryOut.model_validate(cat)


@router.post("/api/admin/categories/{category_id}/toggle-active", response_model=CategoryOut)
def toggle_category_active(category_id: int, db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> CategoryOut:
    cat: Category | None = db.get(Category, category_id)
    if cat is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    cat.is_active = not cat.is_active
    return CategoryOut.model_validate(cat)


@router.put("/api/admin/categories/reorder", status_code=204)
def reorder_categories(body: CategoryOrderIn, db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> None:
    """Set display order by providing category IDs in desired sequence."""
    for idx, cat_id in enumerate(body.order):
        cat: Category | None = db.get(Category, cat_id)
        if cat:
            cat.sort_order = idx


# ─────────────────────────────────────────────────────────────────────────────
# A4 – Combo Campaigns
# ─────────────────────────────────────────────────────────────────────────────

def _build_combo_out(combo: Combo, db: Session) -> ComboOut:
    items_out: List[ComboItemOut] = []
    for ci in combo.combo_items:
        product_name = ci.product.name if ci.product else ""
        items_out.append(
            ComboItemOut(
                combo_item_id=ci.combo_item_id,
                product_id=ci.product_id,
                quantity=ci.quantity,
                product_name=product_name,
            )
        )
    return ComboOut(
        combo_id=combo.combo_id,
        name=combo.name,
        description=combo.description,
        combo_price_vnd=combo.combo_price_vnd,
        target_group=combo.target_group,
        validity_start=combo.validity_start,
        validity_end=combo.validity_end,
        items=items_out,
    )


@router.get("/api/admin/combos", response_model=List[ComboOut])
def list_combos(db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> List[ComboOut]:
    combos = db.scalars(select(Combo).order_by(Combo.combo_id)).all()
    return [_build_combo_out(c, db) for c in combos]


@router.get("/api/admin/combos/{combo_id}", response_model=ComboOut)
def get_combo(combo_id: int, db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> ComboOut:
    combo: Combo | None = db.get(Combo, combo_id)
    if combo is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    return _build_combo_out(combo, db)


@router.post("/api/admin/combos", response_model=ComboOut, status_code=201)
def create_combo(body: ComboIn, db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> ComboOut:
    # Validate: combo_price <= sum of component item prices
    if body.items:
        total_items_price = 0
        for item_in in body.items:
            product: Product | None = db.get(Product, item_in.product_id)
            if product is None:
                raise HTTPException(status_code=400, detail=f"PRODUCT_NOT_FOUND:{item_in.product_id}")
            total_items_price += product.base_price_vnd * item_in.quantity

        if body.combo_price_vnd > total_items_price:
            raise HTTPException(
                status_code=400,
                detail=f"COMBO_PRICE_EXCEEDS_ITEMS:{total_items_price}",
            )

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

    for item_in in body.items:
        db.add(ComboItem(combo_id=combo.combo_id, product_id=item_in.product_id, quantity=item_in.quantity))
    db.flush()

    db.refresh(combo)
    return _build_combo_out(combo, db)


@router.put("/api/admin/combos/{combo_id}", response_model=ComboOut)
def update_combo(combo_id: int, body: ComboIn, db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> ComboOut:
    combo: Combo | None = db.get(Combo, combo_id)
    if combo is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")

    # Validate price vs items
    if body.items:
        total_items_price = 0
        for item_in in body.items:
            product: Product | None = db.get(Product, item_in.product_id)
            if product is None:
                raise HTTPException(status_code=400, detail=f"PRODUCT_NOT_FOUND:{item_in.product_id}")
            total_items_price += product.base_price_vnd * item_in.quantity

        if body.combo_price_vnd > total_items_price:
            raise HTTPException(
                status_code=400,
                detail=f"COMBO_PRICE_EXCEEDS_ITEMS:{total_items_price}",
            )

    combo.name = body.name
    combo.description = body.description
    combo.combo_price_vnd = body.combo_price_vnd
    combo.target_group = body.target_group
    combo.validity_start = body.validity_start
    combo.validity_end = body.validity_end

    # Replace combo items
    for ci in list(combo.combo_items):
        db.delete(ci)
    db.flush()

    for item_in in body.items:
        db.add(ComboItem(combo_id=combo.combo_id, product_id=item_in.product_id, quantity=item_in.quantity))
    db.flush()

    db.refresh(combo)
    return _build_combo_out(combo, db)


@router.delete("/api/admin/combos/{combo_id}", status_code=204)
def delete_combo(combo_id: int, db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> None:
    combo: Combo | None = db.get(Combo, combo_id)
    if combo is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    for ci in list(combo.combo_items):
        db.delete(ci)
    db.delete(combo)
