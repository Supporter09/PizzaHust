"""A1 – CSV bulk import for pizzas/side dishes (admin only).

Upsert by name (re-import is idempotent). An unknown ``category_name`` is reported
as a per-row error and the row is skipped — categories are NEVER auto-created.
"""

from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.infra.auth import require_role
from app.infra.config import get_settings
from app.infra.db.deps import get_db
from app.infra.db.models import Category, Product, User, UserRole

router = APIRouter(prefix="/api/admin/import", tags=["admin-import"])
require_admin = require_role(UserRole.ADMIN)

_TRUE_VALUES = {"1", "true", "yes", "y"}
_FALSE_VALUES = {"0", "false", "no", "n"}


class ImportSummary(BaseModel):
    created: int
    updated: int
    skipped: int
    errors: list[str]


def _read_rows(file: UploadFile) -> list[dict[str, str]]:
    settings = get_settings()
    raw = file.file.read(settings.csv_import_max_bytes + 1)
    if len(raw) > settings.csv_import_max_bytes:
        raise APIError(code="VALIDATION_FAILED", message="CSV file too large.", status_code=400)
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise APIError(
            code="VALIDATION_FAILED", message="CSV must be UTF-8 encoded.", status_code=400
        ) from exc
    return list(csv.DictReader(io.StringIO(text)))


def _parse_int(value: str | None) -> int | None:
    if value is None:
        return None
    try:
        return int(value.strip())
    except ValueError:
        return None


@router.post("/pizzas", response_model=ImportSummary)
def import_pizzas(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _a: User = Depends(require_admin),
) -> ImportSummary:
    rows = _read_rows(file)
    cat_by_name = {c.name.lower(): c for c in db.scalars(select(Category)).all()}
    created = updated = skipped = 0
    errors: list[str] = []

    for i, row in enumerate(rows, start=1):
        name = (row.get("name") or "").strip()
        category_name = (row.get("category_name") or "").strip()
        price = _parse_int(row.get("base_price_vnd"))
        raw_is_pizza = (row.get("is_pizza") or "true").strip().lower()

        if not name:
            errors.append(f"Row {i}: missing name — skipped")
            skipped += 1
            continue
        cat = cat_by_name.get(category_name.lower())
        if cat is None or not cat.is_active:
            errors.append(f"Row {i}: unknown or inactive category '{category_name}' — skipped")
            skipped += 1
            continue
        if price is None:
            errors.append(f"Row {i}: invalid base_price_vnd for '{name}' — skipped")
            skipped += 1
            continue
        if raw_is_pizza in _TRUE_VALUES:
            is_pizza = True
        elif raw_is_pizza in _FALSE_VALUES:
            is_pizza = False
        else:
            errors.append(f"Row {i}: invalid is_pizza value for '{name}' — skipped")
            skipped += 1
            continue

        existing = db.scalar(select(Product).where(Product.name == name))
        if existing is None:
            db.add(
                Product(
                    name=name,
                    category_id=cat.category_id,
                    base_price_vnd=price,
                    is_pizza=is_pizza,
                )
            )
            created += 1
        else:
            existing.category_id = cat.category_id
            existing.base_price_vnd = price
            existing.is_pizza = is_pizza
            updated += 1

    db.flush()
    return ImportSummary(created=created, updated=updated, skipped=skipped, errors=errors)
