"""U4 – public combo promotions (read-only, no auth).

Lists combos that are Active for the current time window (status derived via
app.domain.combos), with server-computed sum-of-parts and savings. Scheduling
windows and the derived status enum stay internal — only Active combos are
returned. Combos are not yet orderable; cart wiring is U5.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.images import ImageOut, image_outs
from app.core.errors import APIError
from app.domain.combos import ComboStatus, combo_savings_vnd, combo_status
from app.infra.db.combo_queries import slot_availability
from app.infra.db.deps import get_db
from app.infra.db.models import Combo, ComboItem, Product

router = APIRouter(prefix="/api", tags=["combos"])


def _now_utc_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class PublicComboItemOut(BaseModel):
    kind: Literal["product", "category"]
    product_id: int | None = None
    category_id: int | None = None
    name: str
    quantity: int
    image_url: str | None = None
    base_price_vnd: int | None = None
    from_price_vnd: int | None = None


class PublicComboOut(BaseModel):
    combo_id: int
    name: str
    description: str | None = None
    combo_price_vnd: int
    target_group: int | None = None
    image_url: str | None = None
    items_total_vnd: int
    savings_vnd: int
    items: list[PublicComboItemOut]


def _public_item(ci: ComboItem, availability: dict[int, int | None]) -> PublicComboItemOut:
    if ci.product_id is not None:
        return PublicComboItemOut(
            kind="product",
            product_id=ci.product_id,
            name=ci.product.name,
            quantity=ci.quantity,
            image_url=ci.product.image_url,
            base_price_vnd=ci.product.base_price_vnd,
        )
    assert ci.category_id is not None
    return PublicComboItemOut(
        kind="category",
        category_id=ci.category_id,
        name=f"{ci.category.name} — customer's choice",
        quantity=ci.quantity,
        from_price_vnd=availability[ci.category_id],
    )


@router.get("/combos", response_model=list[PublicComboOut])
def list_combos(db: Session = Depends(get_db, scope="function")) -> list[PublicComboOut]:
    now = _now_utc_naive()
    stmt = (
        select(Combo)
        .options(
            selectinload(Combo.combo_items).selectinload(ComboItem.product),
            selectinload(Combo.combo_items).selectinload(ComboItem.category),
        )
        .order_by(Combo.combo_id)
    )
    out: list[PublicComboOut] = []
    for combo in db.scalars(stmt).all():
        if combo_status(combo.validity_start, combo.validity_end, now) is not ComboStatus.ACTIVE:
            continue
        items = sorted(combo.combo_items, key=lambda ci: ci.combo_item_id)
        fixed = [ci for ci in items if ci.product_id is not None]
        slots = [ci for ci in items if ci.category_id is not None]
        if any(not ci.product.is_active for ci in fixed):
            continue
        availability = slot_availability(db, [ci.category_id for ci in slots])
        if any(availability[ci.category_id] is None for ci in slots):
            continue
        items_total = sum(ci.product.base_price_vnd * ci.quantity for ci in fixed) + sum(
            availability[ci.category_id] * ci.quantity for ci in slots
        )
        out.append(
            PublicComboOut(
                combo_id=combo.combo_id,
                name=combo.name,
                description=combo.description,
                combo_price_vnd=combo.combo_price_vnd,
                target_group=combo.target_group,
                image_url=combo.image_url,
                items_total_vnd=items_total,
                savings_vnd=combo_savings_vnd(combo.combo_price_vnd, items_total),
                items=[_public_item(ci, availability) for ci in items],
            )
        )
    return out


class ComboEligibleProductOut(BaseModel):
    product_id: int
    name: str
    image_url: str | None = None
    base_price_vnd: int
    surcharge_vnd: int


class ComboComponentOut(BaseModel):
    combo_item_id: int
    kind: Literal["product", "category"]
    name: str
    quantity: int
    product_id: int | None = None
    base_price_vnd: int | None = None
    category_id: int | None = None
    from_price_vnd: int | None = None
    eligible_products: list[ComboEligibleProductOut] | None = None


class PublicComboDetailOut(BaseModel):
    combo_id: int
    name: str
    description: str | None = None
    image_url: str | None = None
    combo_price_vnd: int
    items_total_vnd: int
    savings_vnd: int
    components: list[ComboComponentOut]
    images: list[ImageOut] = []


@router.get("/combos/{combo_id}", response_model=PublicComboDetailOut)
def get_combo_detail(
    combo_id: int, db: Session = Depends(get_db, scope="function")
) -> PublicComboDetailOut:
    not_found = APIError(code="NOT_FOUND", message="Combo not found.", status_code=404)
    combo = db.get(Combo, combo_id)
    if combo is None:
        raise not_found
    now = _now_utc_naive()
    if combo_status(combo.validity_start, combo.validity_end, now) is not ComboStatus.ACTIVE:
        raise not_found

    rows = sorted(combo.combo_items, key=lambda ci: ci.combo_item_id)
    fixed = [ci for ci in rows if ci.product_id is not None]
    slots = [ci for ci in rows if ci.category_id is not None]
    if any(not ci.product.is_active for ci in fixed):
        raise not_found
    availability = slot_availability(db, [ci.category_id for ci in slots])
    if any(availability[ci.category_id] is None for ci in slots):
        raise not_found

    components: list[ComboComponentOut] = []
    items_total = 0
    for ci in rows:
        if ci.product_id is not None:
            items_total += ci.product.base_price_vnd * ci.quantity
            components.append(
                ComboComponentOut(
                    combo_item_id=ci.combo_item_id,
                    kind="product",
                    name=ci.product.name,
                    quantity=ci.quantity,
                    product_id=ci.product_id,
                    base_price_vnd=ci.product.base_price_vnd,
                )
            )
            continue
        assert ci.category_id is not None
        reference = availability[ci.category_id]
        assert reference is not None
        items_total += reference * ci.quantity
        eligible = db.scalars(
            select(Product)
            .where(Product.category_id == ci.category_id, Product.is_active.is_(True))
            .order_by(Product.name)
        ).all()
        components.append(
            ComboComponentOut(
                combo_item_id=ci.combo_item_id,
                kind="category",
                name=f"{ci.category.name} — customer's choice",
                quantity=ci.quantity,
                category_id=ci.category_id,
                from_price_vnd=reference,
                eligible_products=[
                    ComboEligibleProductOut(
                        product_id=p.product_id,
                        name=p.name,
                        image_url=p.image_url,
                        base_price_vnd=p.base_price_vnd,
                        surcharge_vnd=p.base_price_vnd - reference,
                    )
                    for p in eligible
                ],
            )
        )

    return PublicComboDetailOut(
        combo_id=combo.combo_id,
        name=combo.name,
        description=combo.description,
        image_url=combo.image_url,
        combo_price_vnd=combo.combo_price_vnd,
        items_total_vnd=items_total,
        savings_vnd=combo_savings_vnd(combo.combo_price_vnd, items_total),
        components=components,
        images=image_outs(list(combo.images)),
    )
