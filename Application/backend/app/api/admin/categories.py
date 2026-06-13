"""A3 – Manage categories (admin only).

Categories carry ``sort_order`` (display order, edited via PATCH) and ``is_active``
(an inactive category can't receive new items — see api/admin/items). Delete is
guarded: a category still referenced by products cannot be removed (404 FK guard).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.admin.option_groups import GroupOut, OptionOut
from app.core.errors import APIError
from app.infra.auth import require_role
from app.infra.db.deps import get_db
from app.infra.db.models import Category, OptionGroup, Product, User, UserRole

router = APIRouter(prefix="/api/admin/categories", tags=["admin-categories"])
require_admin = require_role(UserRole.ADMIN)


class CategoryOut(BaseModel):
    category_id: int
    name: str
    description: str | None = None
    sort_order: int
    is_active: bool

    model_config = {"from_attributes": True}


class CategoryIn(BaseModel):
    name: str
    description: str | None = None
    sort_order: int = 0
    is_active: bool = True


class CategoryPatch(BaseModel):
    name: str | None = None
    description: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class CategoryOptionGroupOut(GroupOut):
    """A category's option group with its full option list. The category's groups
    ARE its preset, so there is no per-dish ``enabled`` concept here."""

    options: list[OptionOut] = []


def _name_taken(db: Session, name: str, exclude_id: int | None = None) -> bool:
    stmt = select(Category).where(Category.name == name)
    if exclude_id is not None:
        stmt = stmt.where(Category.category_id != exclude_id)
    return db.scalar(stmt) is not None


@router.get("", response_model=list[CategoryOut])
def list_categories(
    db: Session = Depends(get_db, scope="function"), _a: User = Depends(require_admin)
) -> list[CategoryOut]:
    stmt = select(Category).order_by(Category.sort_order, Category.category_id)
    return [CategoryOut.model_validate(c) for c in db.scalars(stmt).all()]


@router.post("", response_model=CategoryOut, status_code=201)
def create_category(
    body: CategoryIn,
    db: Session = Depends(get_db, scope="function"),
    _a: User = Depends(require_admin),
) -> CategoryOut:
    if _name_taken(db, body.name):
        raise APIError(
            code="CONFLICT", message="A category with this name already exists.", status_code=409
        )
    cat = Category(
        name=body.name,
        description=body.description,
        sort_order=body.sort_order,
        is_active=body.is_active,
    )
    db.add(cat)
    db.flush()
    return CategoryOut.model_validate(cat)


@router.get("/{category_id}", response_model=CategoryOut)
def get_category(
    category_id: int,
    db: Session = Depends(get_db, scope="function"),
    _a: User = Depends(require_admin),
) -> CategoryOut:
    cat = db.get(Category, category_id)
    if cat is None:
        raise APIError(code="NOT_FOUND", message="Category not found.", status_code=404)
    return CategoryOut.model_validate(cat)


@router.get("/{category_id}/option-groups", response_model=list[CategoryOptionGroupOut])
def category_option_groups(
    category_id: int,
    db: Session = Depends(get_db, scope="function"),
    _a: User = Depends(require_admin),
) -> list[CategoryOptionGroupOut]:
    """A category's option groups (its preset), each with its options, ordered by
    ``(sort_order, name)`` for both groups and options."""
    if db.get(Category, category_id) is None:
        raise APIError(code="NOT_FOUND", message="Category not found.", status_code=404)
    groups = db.scalars(
        select(OptionGroup)
        .where(OptionGroup.category_id == category_id)
        .order_by(OptionGroup.sort_order, OptionGroup.name)
    ).all()
    return [
        CategoryOptionGroupOut(
            **GroupOut.model_validate(g).model_dump(),
            options=[
                OptionOut.model_validate(o)
                for o in sorted(g.options, key=lambda o: (o.sort_order, o.name))
            ],
        )
        for g in groups
    ]


@router.patch("/{category_id}", response_model=CategoryOut)
def patch_category(
    category_id: int,
    body: CategoryPatch,
    db: Session = Depends(get_db, scope="function"),
    _a: User = Depends(require_admin),
) -> CategoryOut:
    cat = db.get(Category, category_id)
    if cat is None:
        raise APIError(code="NOT_FOUND", message="Category not found.", status_code=404)
    if body.name is not None and _name_taken(db, body.name, exclude_id=category_id):
        raise APIError(
            code="CONFLICT", message="A category with this name already exists.", status_code=409
        )
    for field in ("name", "description", "sort_order", "is_active"):
        if field in body.model_fields_set:
            setattr(cat, field, getattr(body, field))
    return CategoryOut.model_validate(cat)


@router.delete("/{category_id}", status_code=204)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db, scope="function"),
    _a: User = Depends(require_admin),
) -> None:
    cat = db.get(Category, category_id)
    if cat is None:
        raise APIError(code="NOT_FOUND", message="Category not found.", status_code=404)
    if db.scalar(select(Product.product_id).where(Product.category_id == category_id).limit(1)):
        raise APIError(
            code="CONFLICT",
            message="Category still has products; deactivate it instead.",
            status_code=409,
        )
    db.delete(cat)
