"""Bulk import endpoints for Admin catalog (A1·A2).

POST /api/admin/import/pizzas   – CSV with columns: name,category_name,base_price_vnd
POST /api/admin/import/toppings – CSV with columns: name,price_vnd

Both endpoints are idempotent: existing rows (matched by name) are updated,
new rows are inserted. Returns a summary of created / updated / skipped rows.
"""

from __future__ import annotations

import csv
import io
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.infra.auth import require_role
from app.infra.db.deps import get_db
from app.infra.db.models import Category, Product, Topping, User, UserRole

router = APIRouter(tags=["admin-import"])

require_admin = require_role(UserRole.ADMIN)

MAX_CSV_BYTES = 2 * 1024 * 1024  # 2 MB
MAX_ROWS = 500


class ImportSummary(BaseModel):
    created: int
    updated: int
    skipped: int
    errors: List[str]


def _read_csv(file: UploadFile, required_cols: set[str]) -> tuple[list[dict], str | None]:
    raw = file.file.read()
    if len(raw) > MAX_CSV_BYTES:
        return [], "FILE_TOO_LARGE"
    text = raw.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        return [], "EMPTY_FILE"
    fieldnames = {f.strip().lower() for f in reader.fieldnames if f}
    missing = required_cols - fieldnames
    if missing:
        return [], f"MISSING_COLUMNS:{','.join(sorted(missing))}"
    rows = []
    for i, row in enumerate(reader):
        if i >= MAX_ROWS:
            break
        rows.append({k.strip().lower(): (v or "").strip() for k, v in row.items()})
    return rows, None


# ─── Pizza import ──────────────────────────────────────────────────────────────

@router.post("/api/admin/import/pizzas", response_model=ImportSummary)
def import_pizzas(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> ImportSummary:
    """
    CSV format (UTF-8, with or without BOM):
        name,category_name,base_price_vnd
        Margherita Classic,Pizza,125000
        Pepperoni Fire,Pizza,145000
    """
    rows, err = _read_csv(file, {"name", "category_name", "base_price_vnd"})
    if err:
        raise HTTPException(status_code=400, detail=err)

    created = updated = skipped = 0
    errors: List[str] = []

    # Pre-load category map (name → id) — case-insensitive
    all_cats = db.scalars(select(Category)).all()
    cat_map = {c.name.lower(): c for c in all_cats}

    for i, row in enumerate(rows, start=2):  # row 1 = header
        name = row.get("name", "")
        cat_name = row.get("category_name", "")
        price_raw = row.get("base_price_vnd", "")

        if not name:
            errors.append(f"Row {i}: 'name' is empty – skipped")
            skipped += 1
            continue

        try:
            price = int(price_raw)
            if price <= 0:
                raise ValueError
        except (ValueError, TypeError):
            errors.append(f"Row {i}: invalid base_price_vnd '{price_raw}' – skipped")
            skipped += 1
            continue

        cat = cat_map.get(cat_name.lower())
        if cat is None:
            # Auto-create category on the fly so bulk import never fails silently
            cat = Category(name=cat_name or "Imported", description="Auto-created via CSV import")
            db.add(cat)
            db.flush()
            cat_map[cat_name.lower()] = cat

        existing = db.scalar(select(Product).where(Product.name == name))
        if existing is not None:
            existing.base_price_vnd = price
            existing.category_id = cat.category_id
            updated += 1
        else:
            db.add(Product(name=name, category_id=cat.category_id, base_price_vnd=price, is_pizza=True))
            created += 1

    db.flush()
    return ImportSummary(created=created, updated=updated, skipped=skipped, errors=errors)


# ─── Topping import ────────────────────────────────────────────────────────────

@router.post("/api/admin/import/toppings", response_model=ImportSummary)
def import_toppings(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> ImportSummary:
    """
    CSV format:
        name,price_vnd
        Extra Cheese,15000
        Jalapeño,10000
    """
    rows, err = _read_csv(file, {"name", "price_vnd"})
    if err:
        raise HTTPException(status_code=400, detail=err)

    created = updated = skipped = 0
    errors: List[str] = []

    for i, row in enumerate(rows, start=2):
        name = row.get("name", "")
        price_raw = row.get("price_vnd", "")

        if not name:
            errors.append(f"Row {i}: 'name' is empty – skipped")
            skipped += 1
            continue

        try:
            price = int(price_raw)
            if price < 0:
                raise ValueError
        except (ValueError, TypeError):
            errors.append(f"Row {i}: invalid price_vnd '{price_raw}' – skipped")
            skipped += 1
            continue

        existing = db.scalar(select(Topping).where(Topping.name == name))
        if existing is not None:
            existing.price_vnd = price
            updated += 1
        else:
            db.add(Topping(name=name, price_vnd=price))
            created += 1

    db.flush()
    return ImportSummary(created=created, updated=updated, skipped=skipped, errors=errors)
