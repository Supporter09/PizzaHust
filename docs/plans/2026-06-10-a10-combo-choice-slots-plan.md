# A10 Combo Choice-Slots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Combos gain category choice-slots ("any 2 pizzas") next to fixed components, with admin picker UI, public slot-aware APIs, and cart-quote pricing of resolved combos.

**Architecture:** Widen `combo_items` (nullable `product_id` XOR new `category_id`), derive slot reference prices (min active base price per category) at read time, price picks as combo price + surcharges + option deltas. Domain stays pure (`app/domain/combo_slots.py`); routers compose it with A8 option validation. Admin UI splits into card-grid list + dedicated editor with a component picker.

**Tech Stack:** FastAPI + SQLAlchemy 2 + Alembic + MySQL 8 (SQLite in tests), Next.js 16 App Router + TS strict, Playwright.

**Spec:** `docs/plans/2026-06-10-a10-combo-choice-slots-design.md` — read it first. Branch: `a10-combo-choice-slots`.

**Environment:** backend commands run from `Application/backend` with `.venv` active and `.env` loaded the way `verify.sh` does:

```bash
cd Application/backend && source .venv/bin/activate
set -a; source ../.env; set +a
export DATABASE_URL="mysql+pymysql://pizza:pizza@127.0.0.1:${MYSQL_HOST_PORT:-33306}/pizzahust"
```

Frontend commands run from `Application/frontend`.

---

### Task 1: Domain — reference price, surcharge, line pricing

**Files:**
- Create: `Application/backend/app/domain/combo_slots.py`
- Test: `Application/backend/tests/test_combo_slots_domain.py`

- [ ] **Step 1: Write failing tests**

```python
"""A10 domain: slot reference prices, pick surcharges, combo line pricing."""

from __future__ import annotations

import pytest

from app.domain.combo_slots import (
    ComboLinePricing,
    combo_line_pricing,
    pick_surcharge,
    slot_reference_price,
)
from app.domain.pricing import PricingError


def test_reference_price_is_min():
    assert slot_reference_price([130_000, 120_000, 150_000]) == 120_000


def test_reference_price_single():
    assert slot_reference_price([99_000]) == 99_000


def test_surcharge_above_reference():
    assert pick_surcharge(130_000, 120_000) == 10_000


def test_surcharge_never_negative():
    # A cheaper-than-reference pick (race: cheapest product deactivated between
    # reads) charges no surcharge, never a credit.
    assert pick_surcharge(100_000, 120_000) == 0


def test_line_pricing_saves():
    # reference total 200k, surcharges 10k, deltas 15k; combo price 150k
    p = combo_line_pricing(
        combo_price_vnd=150_000,
        reference_total_vnd=200_000,
        surcharges_vnd=[10_000, 0],
        option_deltas_vnd=[15_000],
    )
    assert p == ComboLinePricing(
        line_full_value_vnd=225_000,  # 200k + 10k + 15k
        line_charged_vnd=175_000,  # 150k + 10k + 15k
        discount_vnd=50_000,  # full - charged
    )


def test_line_pricing_overpriced_combo_no_negative_discount():
    # combo price above reference total: discount clamps to 0; charged > full.
    p = combo_line_pricing(
        combo_price_vnd=300_000,
        reference_total_vnd=200_000,
        surcharges_vnd=[],
        option_deltas_vnd=[],
    )
    assert p.discount_vnd == 0
    assert p.line_charged_vnd == 300_000
    assert p.line_full_value_vnd == 200_000


@pytest.mark.parametrize(
    "kwargs",
    [
        {"combo_price_vnd": -1, "reference_total_vnd": 0, "surcharges_vnd": [], "option_deltas_vnd": []},
        {"combo_price_vnd": 0, "reference_total_vnd": -1, "surcharges_vnd": [], "option_deltas_vnd": []},
        {"combo_price_vnd": 0, "reference_total_vnd": 0, "surcharges_vnd": [-1], "option_deltas_vnd": []},
        {"combo_price_vnd": 0, "reference_total_vnd": 0, "surcharges_vnd": [], "option_deltas_vnd": [-1]},
    ],
)
def test_line_pricing_rejects_negative_inputs(kwargs):
    with pytest.raises(PricingError):
        combo_line_pricing(**kwargs)
```

- [ ] **Step 2: Run to verify failure**

Run: `pytest -q tests/test_combo_slots_domain.py`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.domain.combo_slots'`

- [ ] **Step 3: Implement**

```python
"""A10 – combo choice-slot rules (pure, no IO).

A slot is a combo component holding a category instead of a product. Its
reference price is the minimum active base price in that category; a pick
costing more pays the difference (never less than zero). Option deltas ride
on top via the A8 pipeline. See docs/plans/2026-06-10-a10-combo-choice-slots-design.md.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from app.domain.pricing import PricingError


def slot_reference_price(active_base_prices_vnd: Sequence[int]) -> int:
    """Cheapest active product in the slot's category. Caller guarantees the
    sequence is non-empty (an empty slot makes the combo unpurchasable)."""
    return min(active_base_prices_vnd)


def pick_surcharge(base_price_vnd: int, reference_vnd: int) -> int:
    """What a pick adds above the slot's reference. Clamped at 0."""
    return max(0, base_price_vnd - reference_vnd)


@dataclass(frozen=True)
class ComboLinePricing:
    line_full_value_vnd: int
    line_charged_vnd: int
    discount_vnd: int


def combo_line_pricing(
    *,
    combo_price_vnd: int,
    reference_total_vnd: int,
    surcharges_vnd: Sequence[int],
    option_deltas_vnd: Sequence[int],
) -> ComboLinePricing:
    """Value/charge/discount for one configured combo unit.

    full    = reference_total + surcharges + deltas
    charged = combo_price     + surcharges + deltas
    discount = max(0, full - charged)  — an over-priced combo shows no savings;
    the quote's subtotal accumulates charged + discount so the total always
    charges `charged` (see spec §2.4).
    """
    inputs = [combo_price_vnd, reference_total_vnd, *surcharges_vnd, *option_deltas_vnd]
    if any(v < 0 for v in inputs):
        raise PricingError("VALIDATION_FAILED", "Price inputs must be non-negative.")
    extras = sum(surcharges_vnd) + sum(option_deltas_vnd)
    full = reference_total_vnd + extras
    charged = combo_price_vnd + extras
    return ComboLinePricing(
        line_full_value_vnd=full,
        line_charged_vnd=charged,
        discount_vnd=max(0, full - charged),
    )
```

- [ ] **Step 4: Run to verify pass**

Run: `pytest -q tests/test_combo_slots_domain.py && mypy app/domain && ruff check app tests && ruff format app tests`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add app/domain/combo_slots.py tests/test_combo_slots_domain.py
git commit -m "feat(A10): slot reference/surcharge/line-pricing domain rules"
```

---

### Task 2: Domain — structural selection validation

**Files:**
- Modify: `Application/backend/app/domain/combo_slots.py` (append)
- Test: `Application/backend/tests/test_combo_slots_domain.py` (append)

- [ ] **Step 1: Append failing tests**

```python
from app.domain.combo_slots import (  # noqa: E402  (merge into the existing import block)
    ComboComponentDef,
    ComboSelectionError,
    SelectionPicks,
    validate_combo_selections,
)

FIXED = ComboComponentDef(combo_item_id=1, quantity=1, fixed_product_id=9, eligible_product_ids=None)
SLOT = ComboComponentDef(
    combo_item_id=2, quantity=2, fixed_product_id=None, eligible_product_ids=frozenset({3, 5})
)


def _sel(component_id, *pids):
    return SelectionPicks(combo_item_id=component_id, product_ids=list(pids))


def test_selections_happy_path():
    err = validate_combo_selections([FIXED, SLOT], [_sel(1, 9), _sel(2, 3, 5)])
    assert err is None


def test_selections_slot_may_repeat_product():
    assert validate_combo_selections([SLOT], [_sel(2, 3, 3)]) is None


def test_selection_missing_component():
    err = validate_combo_selections([FIXED, SLOT], [_sel(1, 9)])
    assert err == ComboSelectionError(reason="component_selection_missing", combo_item_id=2)


def test_selection_unknown_component():
    err = validate_combo_selections([FIXED], [_sel(1, 9), _sel(99, 3)])
    assert err == ComboSelectionError(reason="component_selection_missing", combo_item_id=99)


def test_selection_duplicate_component():
    err = validate_combo_selections([FIXED], [_sel(1, 9), _sel(1, 9)])
    assert err == ComboSelectionError(reason="component_selection_missing", combo_item_id=1)


def test_pick_count_mismatch():
    err = validate_combo_selections([SLOT], [_sel(2, 3)])
    assert err == ComboSelectionError(reason="pick_count_mismatch", combo_item_id=2)


def test_pick_outside_slot_category():
    err = validate_combo_selections([SLOT], [_sel(2, 3, 77)])
    assert err == ComboSelectionError(
        reason="product_not_in_slot_category", combo_item_id=2, product_id=77
    )


def test_fixed_component_product_mismatch():
    err = validate_combo_selections([FIXED], [_sel(1, 3)])
    assert err == ComboSelectionError(
        reason="product_mismatch_fixed_component", combo_item_id=1, product_id=3
    )
```

- [ ] **Step 2: Run to verify failure**

Run: `pytest -q tests/test_combo_slots_domain.py`
Expected: FAIL — `ImportError: cannot import name 'ComboComponentDef'`

- [ ] **Step 3: Append implementation to `combo_slots.py`**

```python
@dataclass(frozen=True)
class ComboComponentDef:
    """One combo component as the validator sees it. Exactly one of
    fixed_product_id / eligible_product_ids is set (mirrors the DB CHECK);
    eligible_product_ids holds the slot category's ACTIVE products."""

    combo_item_id: int
    quantity: int
    fixed_product_id: int | None
    eligible_product_ids: frozenset[int] | None


@dataclass(frozen=True)
class SelectionPicks:
    combo_item_id: int
    product_ids: list[int]


@dataclass(frozen=True)
class ComboSelectionError:
    reason: str
    combo_item_id: int | None = None
    product_id: int | None = None


def validate_combo_selections(
    components: Sequence[ComboComponentDef],
    selections: Sequence[SelectionPicks],
) -> ComboSelectionError | None:
    """Structural checks for one combo unit: every component selected exactly
    once, pick counts match quantities, picks belong to the component. Option
    validation per pick is the caller's job (A8 validate_option_selection)."""
    by_component: dict[int, SelectionPicks] = {}
    known = {c.combo_item_id for c in components}
    for sel in selections:
        if sel.combo_item_id not in known or sel.combo_item_id in by_component:
            return ComboSelectionError(
                reason="component_selection_missing", combo_item_id=sel.combo_item_id
            )
        by_component[sel.combo_item_id] = sel

    for comp in components:
        sel = by_component.get(comp.combo_item_id)
        if sel is None:
            return ComboSelectionError(
                reason="component_selection_missing", combo_item_id=comp.combo_item_id
            )
        if len(sel.product_ids) != comp.quantity:
            return ComboSelectionError(
                reason="pick_count_mismatch", combo_item_id=comp.combo_item_id
            )
        for pid in sel.product_ids:
            if comp.fixed_product_id is not None:
                if pid != comp.fixed_product_id:
                    return ComboSelectionError(
                        reason="product_mismatch_fixed_component",
                        combo_item_id=comp.combo_item_id,
                        product_id=pid,
                    )
            elif comp.eligible_product_ids is None or pid not in comp.eligible_product_ids:
                return ComboSelectionError(
                    reason="product_not_in_slot_category",
                    combo_item_id=comp.combo_item_id,
                    product_id=pid,
                )
    return None
```

- [ ] **Step 4: Run to verify pass**

Run: `pytest -q tests/test_combo_slots_domain.py && mypy app/domain && ruff check app tests && ruff format app tests`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add app/domain/combo_slots.py tests/test_combo_slots_domain.py
git commit -m "feat(A10): structural combo-selection validation with closed reasons"
```

---

### Task 3: Models + migration 0006

**Files:**
- Modify: `Application/backend/app/infra/db/models.py` (Combo + ComboItem)
- Create: `Application/backend/app/infra/db/migrations/versions/0006_combo_choice_slots.py`
- Test: `Application/backend/tests/test_combo_slot_models.py`

- [ ] **Step 1: Write failing test**

```python
"""A10: combo_items XOR constraint and combos.image_url at the model layer."""

from __future__ import annotations

import pytest
from sqlalchemy.exc import IntegrityError

from app.infra.db.models import Combo, ComboItem
from app.infra.db.session import create_session_factory
from tests.admin_test_utils import new_category, new_product
from tests.auth_test_utils import build_test_app


def _combo(db, name="C", image_url=None):
    c = Combo(name=name, combo_price_vnd=100_000, image_url=image_url)
    db.add(c)
    db.flush()
    return c


def test_slot_row_and_image_url_roundtrip():
    build_test_app("slot-models-ok")
    cat = new_category("Drinks")
    with create_session_factory()() as db:
        c = _combo(db, image_url="/images/x.png")
        db.add(ComboItem(combo_id=c.combo_id, category_id=cat, quantity=4))
        db.commit()
        db.refresh(c)
        assert c.image_url == "/images/x.png"
        assert c.combo_items[0].category_id == cat
        assert c.combo_items[0].product_id is None


def test_both_ids_rejected_by_check():
    build_test_app("slot-models-both")
    cat = new_category("Drinks")
    pid = new_product(cat, "Cola", base_price_vnd=15_000, is_pizza=False)
    with create_session_factory()() as db:
        c = _combo(db)
        db.add(ComboItem(combo_id=c.combo_id, product_id=pid, category_id=cat, quantity=1))
        with pytest.raises(IntegrityError):
            db.commit()


def test_neither_id_rejected_by_check():
    build_test_app("slot-models-neither")
    with create_session_factory()() as db:
        c = _combo(db)
        db.add(ComboItem(combo_id=c.combo_id, quantity=1))
        with pytest.raises(IntegrityError):
            db.commit()
```

- [ ] **Step 2: Run to verify failure**

Run: `pytest -q tests/test_combo_slot_models.py`
Expected: FAIL — `TypeError: 'image_url' is an invalid keyword argument for Combo` (and/or NOT NULL failure on product_id)

- [ ] **Step 3: Update models**

In `models.py`, class `Combo`: add after `target_group`:

```python
    image_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
```

Replace class `ComboItem` with:

```python
class ComboItem(Base):
    """Fixed component (product_id) XOR choice slot (category_id). A slot means
    "any active product from this category × quantity"; see domain/combo_slots."""

    __tablename__ = "combo_items"
    __table_args__ = (
        CheckConstraint(
            "(product_id IS NULL) != (category_id IS NULL)",
            name="ck_combo_items_kind",
        ),
    )

    combo_item_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    combo_id: Mapped[int] = mapped_column(ForeignKey("combos.combo_id"), nullable=False)
    product_id: Mapped[int | None] = mapped_column(
        ForeignKey("products.product_id"), nullable=True
    )
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.category_id"), nullable=True
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")

    combo: Mapped[Combo] = relationship(back_populates="combo_items")
    product: Mapped[Product | None] = relationship(back_populates="combo_items")
    category: Mapped[Category | None] = relationship()
```

Note: `Product.combo_items` relationship already exists; `Mapped[Product | None]` only changes typing. SQLite enforces CHECKs natively; MySQL 8.4 enforces them too.

- [ ] **Step 4: Run to verify pass**

Run: `pytest -q tests/test_combo_slot_models.py`
Expected: PASS

- [ ] **Step 5: Write migration**

`0006_combo_choice_slots.py`:

```python
"""A10 – combo choice slots: combo_items.category_id (XOR product_id) + combos.image_url.

No data transform: every existing row keeps product_id set and satisfies the
new CHECK. Downgrade assumes no slot rows exist (drops category_id and
restores NOT NULL); run it only before any slot combo is created.

Revision ID: 0006_combo_choice_slots
Revises: 0005_generic_options
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0006_combo_choice_slots"
down_revision = "0005_generic_options"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("combos", sa.Column("image_url", sa.String(255), nullable=True))
    op.alter_column("combo_items", "product_id", existing_type=sa.Integer(), nullable=True)
    op.add_column("combo_items", sa.Column("category_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_combo_items_category_id",
        "combo_items",
        "categories",
        ["category_id"],
        ["category_id"],
    )
    op.create_check_constraint(
        "ck_combo_items_kind",
        "combo_items",
        "(product_id IS NULL) != (category_id IS NULL)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_combo_items_kind", "combo_items", type_="check")
    op.drop_constraint("fk_combo_items_category_id", "combo_items", type_="foreignkey")
    op.drop_column("combo_items", "category_id")
    op.alter_column("combo_items", "product_id", existing_type=sa.Integer(), nullable=False)
    op.drop_column("combos", "image_url")
```

- [ ] **Step 6: Apply against compose MySQL and verify**

```bash
alembic upgrade head
python - <<'EOF'
from sqlalchemy import create_engine, inspect
import os
e = create_engine(os.environ["DATABASE_URL"])
cols = {c["name"] for c in inspect(e).get_columns("combo_items")}
assert "category_id" in cols, cols
cols = {c["name"] for c in inspect(e).get_columns("combos")}
assert "image_url" in cols, cols
print("migration ok")
EOF
```

Expected: `migration ok`

- [ ] **Step 7: Full backend tests + commit**

Run: `pytest -q && ruff check app tests && ruff format app tests`
Expected: all pass (existing combo tests unaffected — fixed rows still valid)

```bash
git add app/infra/db/models.py app/infra/db/migrations/versions/0006_combo_choice_slots.py tests/test_combo_slot_models.py
git commit -m "feat(A10): combo_items choice-slot columns and combos.image_url (migration 0006)"
```

---

### Task 4: Shared slot availability query

**Files:**
- Create: `Application/backend/app/infra/db/combo_queries.py`
- Test: `Application/backend/tests/test_combo_queries.py`

Used by admin validation, both public endpoints, and the cart resolver — one
definition of "available slot" (spec §1).

- [ ] **Step 1: Write failing test**

```python
"""A10: slot availability = active category with ≥1 active product."""

from __future__ import annotations

from app.infra.db.combo_queries import slot_availability
from app.infra.db.session import create_session_factory
from tests.admin_test_utils import new_category, new_product
from tests.auth_test_utils import build_test_app


def test_slot_availability_min_price_and_unavailable_modes():
    build_test_app("slot-queries")
    ok_cat = new_category("Drinks")
    new_product(ok_cat, "Cola", base_price_vnd=15_000, is_pizza=False)
    new_product(ok_cat, "Juice", base_price_vnd=25_000, is_pizza=False)
    new_product(ok_cat, "Gone", base_price_vnd=5_000, is_pizza=False, is_active=False)
    inactive_cat = new_category("Hidden", is_active=False)
    new_product(inactive_cat, "X", base_price_vnd=10_000, is_pizza=False)
    empty_cat = new_category("Empty")

    with create_session_factory()() as db:
        out = slot_availability(db, [ok_cat, inactive_cat, empty_cat, 9999])
    assert out[ok_cat] == 15_000  # inactive product excluded from the min
    assert out[inactive_cat] is None
    assert out[empty_cat] is None
    assert out[9999] is None
```

- [ ] **Step 2: Run to verify failure**

Run: `pytest -q tests/test_combo_queries.py`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement**

```python
"""A10 – slot availability lookups (spec §1: one predicate, one definition).

A slot's category is available iff it exists, is active, and holds ≥1 active
product; the reference price is the cheapest active product. Returns None for
unavailable categories so callers can branch without re-querying.
"""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.infra.db.models import Category, Product


def slot_availability(db: Session, category_ids: Sequence[int]) -> dict[int, int | None]:
    """category_id -> min active base price, or None when the slot is
    unavailable (unknown, inactive, or empty category)."""
    out: dict[int, int | None] = {cid: None for cid in category_ids}
    if not out:
        return out
    rows = db.execute(
        select(Category.category_id, func.min(Product.base_price_vnd))
        .join(
            Product,
            (Product.category_id == Category.category_id) & Product.is_active.is_(True),
        )
        .where(Category.category_id.in_(out), Category.is_active.is_(True))
        .group_by(Category.category_id)
    ).all()
    for cid, min_price in rows:
        out[cid] = min_price
    return out
```

- [ ] **Step 4: Run to verify pass**

Run: `pytest -q tests/test_combo_queries.py && ruff check app tests && ruff format app tests && lint-imports`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add app/infra/db/combo_queries.py tests/test_combo_queries.py
git commit -m "feat(A10): shared slot-availability query (active category, min active price)"
```

---

### Task 5: Admin combos router — slots, kinds, sum-quantity rule

**Files:**
- Modify: `Application/backend/app/api/admin/combos.py`
- Test: `Application/backend/tests/test_admin_combos.py` (append) and update two existing tests

- [ ] **Step 1: Append failing tests**

```python
from tests.admin_test_utils import new_category  # add to existing import


def _slot(category_id, qty=1):
    return {"kind": "category", "category_id": category_id, "quantity": qty}


def _fixed(product_id, qty=1):
    return {"kind": "product", "product_id": product_id, "quantity": qty}


def test_create_combo_with_slot_returns_kind_and_from_price():
    client = admin_client("combo-slot-create")
    cat = new_category("Drinks2")
    new_product(cat, "Cola", base_price_vnd=15_000, is_pizza=False)
    new_product(cat, "Juice", base_price_vnd=25_000, is_pizza=False)
    p1, p2 = _two_pizzas()
    r = _post(client, items=[_fixed(p1), _fixed(p2), _slot(cat, qty=2)])
    assert r.status_code == 201, r.text
    items = r.json()["items"]
    slot = next(i for i in items if i["kind"] == "category")
    assert slot["category_id"] == cat
    assert slot["from_price_vnd"] == 15_000
    assert slot["name"] == "Drinks2 — customer's choice"
    fixed = next(i for i in items if i["kind"] == "product")
    assert fixed["from_price_vnd"] is None


def test_slot_only_combo_with_quantity_two_is_valid():
    # sum(quantity) >= 2 — a single slot row x2 passes.
    client = admin_client("combo-slot-sumqty")
    cat = new_category("Pizzas2")
    new_product(cat, "Pz", base_price_vnd=100_000)
    r = _post(client, items=[_slot(cat, qty=2)])
    assert r.status_code == 201, r.text


def test_single_unit_combo_rejected_by_sum_quantity():
    client = admin_client("combo-one-unit")
    cat = new_category("Pizzas3")
    new_product(cat, "Pz", base_price_vnd=100_000)
    r = _post(client, items=[_slot(cat, qty=1)])
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_slot_unknown_category_unavailable():
    client = admin_client("combo-slot-unknown")
    p1, p2 = _two_pizzas()
    r = _post(client, items=[_fixed(p1), _slot(99_999)])
    assert r.status_code == 400
    assert r.json()["error"]["details"]["reason"] == "slot_category_unavailable"


def test_slot_inactive_category_unavailable():
    client = admin_client("combo-slot-inactive")
    cat = new_category("Hidden2", is_active=False)
    new_product(cat, "X", base_price_vnd=10_000)
    p1, p2 = _two_pizzas()
    r = _post(client, items=[_fixed(p1), _slot(cat)])
    assert r.status_code == 400
    assert r.json()["error"]["details"]["reason"] == "slot_category_unavailable"


def test_slot_empty_category_unavailable():
    client = admin_client("combo-slot-empty")
    cat = new_category("Empty2")
    p1, p2 = _two_pizzas()
    r = _post(client, items=[_fixed(p1), _slot(cat)])
    assert r.status_code == 400
    assert r.json()["error"]["details"]["reason"] == "slot_category_unavailable"


def test_item_kind_id_mismatch_is_schema_error():
    client = admin_client("combo-kind-mismatch")
    r = _post(client, items=[{"kind": "category", "product_id": 1, "quantity": 2}])
    assert r.status_code == 400
    body = r.json()["error"]
    assert body["code"] == "VALIDATION_FAILED"
    assert "errors" in body["details"]  # pydantic, not a closed reason


def test_patch_replaces_with_slot():
    client = admin_client("combo-patch-slot")
    p1, p2 = _two_pizzas()
    combo_id = _post(client, items=[_fixed(p1), _fixed(p2)]).json()["combo_id"]
    cat = new_category("Sides2")
    new_product(cat, "Fries", base_price_vnd=35_000, is_pizza=False)
    r = client.patch(f"/api/admin/combos/{combo_id}", json={"items": [_fixed(p1), _slot(cat, 2)]})
    assert r.status_code == 200, r.text
    kinds = sorted(i["kind"] for i in r.json()["items"])
    assert kinds == ["category", "product"]
```

Also update the two existing helpers/tests that now hit the new schema:
- `_items(*product_ids)` → `return [{"kind": "product", "product_id": pid, "quantity": 1} for pid in product_ids]`
- `test_single_item_combo_rejected` stays valid (one product × qty 1 → sum 1 < 2).

- [ ] **Step 2: Run to verify failure**

Run: `pytest -q tests/test_admin_combos.py`
Expected: new tests FAIL (422/400 schema errors, missing kind handling)

- [ ] **Step 3: Implement router changes**

In `app/api/admin/combos.py` — replace `ComboItemIn`/`ComboItemOut` and `_validate_items`/`_to_out`:

```python
from typing import Annotated, Literal  # extend existing imports

from pydantic import BaseModel, Field, field_validator  # Field added

from app.infra.db.combo_queries import slot_availability  # new import
from app.infra.db.models import Category  # extend models import


class ProductComboItemIn(BaseModel):
    kind: Literal["product"]
    product_id: int
    quantity: int = Field(default=1, ge=1)

    model_config = {"extra": "forbid"}


class CategoryComboItemIn(BaseModel):
    kind: Literal["category"]
    category_id: int
    quantity: int = Field(default=1, ge=1)

    model_config = {"extra": "forbid"}


ComboItemIn = Annotated[ProductComboItemIn | CategoryComboItemIn, Field(discriminator="kind")]


class ComboItemOut(BaseModel):
    kind: Literal["product", "category"]
    product_id: int | None = None
    category_id: int | None = None
    quantity: int
    name: str
    from_price_vnd: int | None = None
```

`ComboIn.items` / `ComboPatch.items` keep their names but the element type is
now `ComboItemIn` (the union). `ComboOut` gains `image_url: str | None = None`.

```python
def _validate_items(db: Session, items: list[ProductComboItemIn | CategoryComboItemIn]) -> None:
    if sum(it.quantity for it in items) < 2:
        raise APIError(
            code="VALIDATION_FAILED",
            message="A combo must contain at least 2 component items.",
            status_code=400,
            details={"field": "items"},
        )
    slot_ids = [it.category_id for it in items if isinstance(it, CategoryComboItemIn)]
    availability = slot_availability(db, slot_ids)
    for it in items:
        if isinstance(it, ProductComboItemIn):
            prod = db.get(Product, it.product_id)
            if prod is None or not prod.is_active:
                raise APIError(
                    code="VALIDATION_FAILED",
                    message="Every combo component must be an existing, active product.",
                    status_code=400,
                    details={"product_id": it.product_id},
                )
        elif availability[it.category_id] is None:
            raise APIError(
                code="VALIDATION_FAILED",
                message="Slot category must be active and contain an active product.",
                status_code=400,
                details={"reason": "slot_category_unavailable", "category_id": it.category_id},
            )
```

(`quantity >= 1` moved into the schema via `Field(ge=1)` — delete the manual loop check.)

```python
def _to_out(db: Session, combo: Combo) -> ComboOut:
    status = combo_status(combo.validity_start, combo.validity_end, _now_utc_naive())
    rows = sorted(combo.combo_items, key=lambda ci: ci.combo_item_id)
    slot_ids = [ci.category_id for ci in rows if ci.category_id is not None]
    availability = slot_availability(db, slot_ids)
    items: list[ComboItemOut] = []
    for ci in rows:
        if ci.product_id is not None:
            items.append(
                ComboItemOut(
                    kind="product",
                    product_id=ci.product_id,
                    quantity=ci.quantity,
                    name=ci.product.name,
                )
            )
        else:
            assert ci.category_id is not None  # DB CHECK
            items.append(
                ComboItemOut(
                    kind="category",
                    category_id=ci.category_id,
                    quantity=ci.quantity,
                    name=f"{ci.category.name} — customer's choice",
                    from_price_vnd=availability[ci.category_id],
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
        status=status,
        image_url=combo.image_url,
        items=items,
    )
```

All `_to_out(combo)` call sites become `_to_out(db, combo)`. Row creation in
`create_combo`/`patch_combo` becomes:

```python
    for it in body.items:
        db.add(
            ComboItem(
                combo_id=combo.combo_id,
                product_id=it.product_id if isinstance(it, ProductComboItemIn) else None,
                category_id=it.category_id if isinstance(it, CategoryComboItemIn) else None,
                quantity=it.quantity,
            )
        )
```

- [ ] **Step 4: Run to verify pass**

Run: `pytest -q tests/test_admin_combos.py && pytest -q && ruff check app tests && ruff format app tests && mypy app/domain && lint-imports`
Expected: all pass (other suites touching combos may need the `kind` field — fix any `{"product_id": ...}` literals the run surfaces, e.g. in `tests/smoke`)

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/combos.py tests/test_admin_combos.py
git commit -m "feat(A10): admin combos accept category choice-slots (kind union, sum-qty rule)"
```

---

### Task 6: Admin combo image upload/clear

**Files:**
- Modify: `Application/backend/app/api/admin/combos.py` (append endpoints)
- Test: `Application/backend/tests/test_admin_combo_image.py`

- [ ] **Step 1: Write failing tests**

```python
"""A10: combo image upload mirrors the item-image endpoint; DELETE clears."""

from __future__ import annotations

import io

from tests.admin_test_utils import admin_client, new_category, new_combo_with_items, new_product


def _combo(slug):
    client = admin_client(slug)
    cat = new_category("Pizza")
    p1 = new_product(cat, "Pz1")
    p2 = new_product(cat, "Pz2")
    return client, new_combo_with_items("ImgCombo", [p1, p2])


def test_upload_returns_image_url_and_persists():
    client, combo_id = _combo("combo-img-up")
    r = client.post(
        f"/api/admin/combos/{combo_id}/image",
        files={"image": ("x.png", io.BytesIO(b"\x89PNG fake"), "image/png")},
    )
    assert r.status_code == 200, r.text
    url = r.json()["image_url"]
    assert url.endswith(".png")
    assert client.get(f"/api/admin/combos/{combo_id}").json()["image_url"] == url


def test_upload_rejects_bad_extension():
    client, combo_id = _combo("combo-img-ext")
    r = client.post(
        f"/api/admin/combos/{combo_id}/image",
        files={"image": ("x.gif", io.BytesIO(b"gif"), "image/gif")},
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_delete_clears_image():
    client, combo_id = _combo("combo-img-del")
    client.post(
        f"/api/admin/combos/{combo_id}/image",
        files={"image": ("x.png", io.BytesIO(b"\x89PNG fake"), "image/png")},
    )
    r = client.delete(f"/api/admin/combos/{combo_id}/image")
    assert r.status_code == 204
    assert client.get(f"/api/admin/combos/{combo_id}").json()["image_url"] is None


def test_upload_unknown_combo_404():
    client, _ = _combo("combo-img-404")
    r = client.post(
        "/api/admin/combos/999999/image",
        files={"image": ("x.png", io.BytesIO(b"\x89PNG fake"), "image/png")},
    )
    assert r.status_code == 404
```

- [ ] **Step 2: Run to verify failure**

Run: `pytest -q tests/test_admin_combo_image.py`
Expected: FAIL — 405/404 (routes missing)

- [ ] **Step 3: Implement (mirror `items.py:175-202` exactly, swap Product→Combo)**

```python
import os  # extend imports
import uuid

from fastapi import File, UploadFile

from app.infra.config import get_settings

_ALLOWED_IMAGE_EXT = {"png", "jpg", "jpeg", "webp"}


@router.post("/{combo_id}/image")
def upload_combo_image(
    combo_id: int,
    image: UploadFile = File(...),
    db: Session = Depends(get_db, scope="function"),
    _a: User = Depends(require_admin),
) -> dict[str, str]:
    combo = db.get(Combo, combo_id)
    if combo is None:
        raise APIError(code="NOT_FOUND", message="Combo not found.", status_code=404)
    settings = get_settings()
    ext = (image.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in _ALLOWED_IMAGE_EXT:
        raise APIError(
            code="VALIDATION_FAILED",
            message="Unsupported image type. Allowed: png, jpg, jpeg, webp.",
            status_code=400,
        )
    data = image.file.read(settings.image_max_bytes + 1)
    if len(data) > settings.image_max_bytes:
        raise APIError(code="VALIDATION_FAILED", message="Image too large.", status_code=400)
    os.makedirs(settings.image_upload_dir, exist_ok=True)
    fname = f"{uuid.uuid4().hex}.{ext}"
    with open(os.path.join(settings.image_upload_dir, fname), "wb") as f:
        f.write(data)
    combo.image_url = f"{settings.image_base_url}/{fname}"
    return {"image_url": combo.image_url}


@router.delete("/{combo_id}/image", status_code=204)
def delete_combo_image(
    combo_id: int,
    db: Session = Depends(get_db, scope="function"),
    _a: User = Depends(require_admin),
) -> None:
    combo = db.get(Combo, combo_id)
    if combo is None:
        raise APIError(code="NOT_FOUND", message="Combo not found.", status_code=404)
    combo.image_url = None
```

- [ ] **Step 4: Run to verify pass**

Run: `pytest -q tests/test_admin_combo_image.py && ruff check app tests && ruff format app tests`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/combos.py tests/test_admin_combo_image.py
git commit -m "feat(A10): combo image upload/clear endpoints"
```

---

### Task 7: Public combos list — slot items

**Files:**
- Modify: `Application/backend/app/api/combos.py`
- Test: `Application/backend/tests/test_public_combos.py` (append; adjust existing item-shape assertions to the new fields)

- [ ] **Step 1: Append failing tests**

```python
from tests.admin_test_utils import (  # extend existing imports as needed
    new_category,
    new_combo_with_items,
    new_product,
)
from app.infra.db.models import Category, Combo, ComboItem
from app.infra.db.session import create_session_factory


def _add_slot(combo_id: int, category_id: int, qty: int) -> None:
    with create_session_factory()() as db:
        db.add(ComboItem(combo_id=combo_id, category_id=category_id, quantity=qty))
        db.commit()


def test_list_shows_slot_with_from_price_and_reference_total():
    app = build_test_app("public-slot-list")
    cat_p = new_category("Pizza")
    p1 = new_product(cat_p, "Pz1", base_price_vnd=100_000)
    cat_d = new_category("Drinks")
    new_product(cat_d, "Cola", base_price_vnd=15_000, is_pizza=False)
    new_product(cat_d, "Juice", base_price_vnd=25_000, is_pizza=False)
    combo_id = new_combo_with_items("SlotCombo", [p1], price_vnd=120_000)
    _add_slot(combo_id, cat_d, qty=2)

    body = TestClient(app).get("/api/combos").json()
    combo = next(c for c in body if c["combo_id"] == combo_id)
    slot = next(i for i in combo["items"] if i["kind"] == "category")
    assert slot["from_price_vnd"] == 15_000
    assert slot["name"] == "Drinks — customer's choice"
    # items_total = fixed 100k + slot 2 x 15k reference
    assert combo["items_total_vnd"] == 130_000
    assert combo["savings_vnd"] == 10_000


def test_combo_skipped_when_slot_category_emptied():
    app = build_test_app("public-slot-empty")
    cat_p = new_category("Pizza")
    p1 = new_product(cat_p, "Pz1")
    p2 = new_product(cat_p, "Pz2")
    cat_d = new_category("Drinks")
    new_product(cat_d, "Cola", base_price_vnd=15_000, is_pizza=False, is_active=False)
    combo_id = new_combo_with_items("DeadSlot", [p1, p2])
    _add_slot(combo_id, cat_d, qty=1)
    body = TestClient(app).get("/api/combos").json()
    assert all(c["combo_id"] != combo_id for c in body)


def test_combo_skipped_when_slot_category_deactivated():
    app = build_test_app("public-slot-inactive-cat")
    cat_p = new_category("Pizza")
    p1 = new_product(cat_p, "Pz1")
    p2 = new_product(cat_p, "Pz2")
    cat_d = new_category("Drinks", is_active=False)
    new_product(cat_d, "Cola", base_price_vnd=15_000, is_pizza=False)
    combo_id = new_combo_with_items("InactiveCatSlot", [p1, p2])
    _add_slot(combo_id, cat_d, qty=1)
    body = TestClient(app).get("/api/combos").json()
    assert all(c["combo_id"] != combo_id for c in body)
```

- [ ] **Step 2: Run to verify failure**

Run: `pytest -q tests/test_public_combos.py`
Expected: new tests FAIL

- [ ] **Step 3: Implement**

Replace `PublicComboItemOut` and the loop body in `app/api/combos.py`:

```python
from typing import Literal  # new import

from app.infra.db.combo_queries import slot_availability  # new import


class PublicComboItemOut(BaseModel):
    kind: Literal["product", "category"]
    product_id: int | None = None
    category_id: int | None = None
    name: str
    quantity: int
    image_url: str | None = None
    base_price_vnd: int | None = None  # fixed components only
    from_price_vnd: int | None = None  # slots only
```

`PublicComboOut` gains `image_url: str | None = None`.

Loop body (inside `list_combos`, after the status check):

```python
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
```

With module-level helper:

```python
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
    assert ci.category_id is not None  # DB CHECK
    return PublicComboItemOut(
        kind="category",
        category_id=ci.category_id,
        name=f"{ci.category.name} — customer's choice",
        quantity=ci.quantity,
        from_price_vnd=availability[ci.category_id],
    )
```

Add `selectinload(Combo.combo_items).selectinload(ComboItem.category)` to the
existing query options. mypy note: guard the slot sum with the availability
check above it (values are non-None after the `continue`); if mypy strict
complains use `cast(int, availability[ci.category_id])`.

- [ ] **Step 4: Run, fix stale assertions, verify pass**

Run: `pytest -q tests/test_public_combos.py && pytest -q`
Expected: PASS after updating any existing assertions that read the old flat item shape.

- [ ] **Step 5: Commit**

```bash
git add app/api/combos.py tests/test_public_combos.py
git commit -m "feat(A10): public combos list exposes choice slots with reference prices"
```

---

### Task 8: Public combo detail endpoint

**Files:**
- Modify: `Application/backend/app/api/combos.py` (append)
- Test: `Application/backend/tests/test_public_combo_detail.py`

- [ ] **Step 1: Write failing tests**

```python
"""A10: GET /api/combos/{id} — customizer data source (spec §2.3)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.infra.db.models import Combo, ComboItem
from app.infra.db.session import create_session_factory
from tests.admin_test_utils import new_category, new_combo_with_items, new_product
from tests.auth_test_utils import build_test_app


def _slot_combo(slug):
    app = build_test_app(slug)
    cat_p = new_category("Pizza")
    pz1 = new_product(cat_p, "Margherita", base_price_vnd=120_000)
    pz2 = new_product(cat_p, "Pepperoni", base_price_vnd=130_000)
    new_product(cat_p, "Ghost", base_price_vnd=90_000, is_active=False)
    cat_s = new_category("Sides")
    bread = new_product(cat_s, "Garlic Bread", base_price_vnd=45_000, is_pizza=False)
    combo_id = new_combo_with_items("Feast", [bread], price_vnd=250_000)
    with create_session_factory()() as db:
        db.add(ComboItem(combo_id=combo_id, category_id=cat_p, quantity=2))
        db.commit()
    return app, combo_id, {"pz1": pz1, "pz2": pz2, "bread": bread, "cat_p": cat_p}


def test_detail_components_eligible_products_and_surcharges():
    app, combo_id, ids = _slot_combo("detail-happy")
    r = TestClient(app).get(f"/api/combos/{combo_id}")
    assert r.status_code == 200, r.text
    body = r.json()
    # components ordered by combo_item_id: fixed bread first (created first)
    fixed, slot = body["components"]
    assert fixed["kind"] == "product"
    assert fixed["product_id"] == ids["bread"]
    assert fixed["base_price_vnd"] == 45_000
    assert slot["kind"] == "category"
    assert slot["from_price_vnd"] == 120_000
    eligible = slot["eligible_products"]
    assert [p["product_id"] for p in eligible] == [ids["pz1"], ids["pz2"]]  # name asc, active only
    assert eligible[0]["surcharge_vnd"] == 0
    assert eligible[1]["surcharge_vnd"] == 10_000
    # items_total = 45k + 2 x 120k = 285k; savings vs 250k = 35k
    assert body["items_total_vnd"] == 285_000
    assert body["savings_vnd"] == 35_000


def test_detail_404_when_not_active():
    app, combo_id, _ = _slot_combo("detail-expired")
    past = datetime.now(UTC).replace(tzinfo=None) - timedelta(days=1)
    with create_session_factory()() as db:
        combo = db.get(Combo, combo_id)
        combo.validity_end = past
        db.commit()
    assert TestClient(app).get(f"/api/combos/{combo_id}").status_code == 404


def test_detail_404_when_unknown():
    app, _, _ = _slot_combo("detail-unknown")
    assert TestClient(app).get("/api/combos/999999").status_code == 404
```

- [ ] **Step 2: Run to verify failure**

Run: `pytest -q tests/test_public_combo_detail.py`
Expected: FAIL — 404 missing route → 405/validation noise on the happy path

- [ ] **Step 3: Implement (append to `app/api/combos.py`)**

```python
from app.core.errors import APIError  # new import
from app.infra.db.models import Product  # extend models import


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
    base_price_vnd: int | None = None  # fixed only
    category_id: int | None = None
    from_price_vnd: int | None = None  # slots only
    eligible_products: list[ComboEligibleProductOut] | None = None  # slots only


class PublicComboDetailOut(BaseModel):
    combo_id: int
    name: str
    description: str | None = None
    image_url: str | None = None
    combo_price_vnd: int
    items_total_vnd: int
    savings_vnd: int
    components: list[ComboComponentOut]


@router.get("/combos/{combo_id}", response_model=PublicComboDetailOut)
def get_combo_detail(
    combo_id: int, db: Session = Depends(get_db, scope="function")
) -> PublicComboDetailOut:
    not_found = APIError(code="NOT_FOUND", message="Combo not found.", status_code=404)
    combo = db.get(Combo, combo_id)
    if combo is None:
        raise not_found
    if combo_status(combo.validity_start, combo.validity_end, _now_utc_naive()) is not ComboStatus.ACTIVE:
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
        assert ci.category_id is not None  # DB CHECK
        reference = availability[ci.category_id]
        assert reference is not None  # guarded above
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
    )
```

(`surcharge_vnd = base - reference` is ≥ 0 here because reference is the min
of this exact set.)

- [ ] **Step 4: Run to verify pass**

Run: `pytest -q tests/test_public_combo_detail.py && pytest -q && ruff check app tests && ruff format app tests && lint-imports`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add app/api/combos.py tests/test_public_combo_detail.py
git commit -m "feat(A10): public combo detail with eligible products and surcharges"
```

---

### Task 9: Cart quote — combo lines

**Files:**
- Modify: `Application/backend/app/api/cart.py`
- Test: `Application/backend/tests/test_cart_quote_combo.py`; delete `test_quote_combo_still_rejected` from `tests/test_cart_quote.py`

- [ ] **Step 1: Write failing tests**

```python
"""A10: cart quote prices resolved combo lines (spec §2.4)."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.infra.db.models import ComboItem
from app.infra.db.session import create_session_factory
from tests.admin_test_utils import (
    enable_option,
    new_category,
    new_combo_with_items,
    new_option,
    new_option_group,
    new_product,
)
from tests.auth_test_utils import build_test_app


def _fixture(slug):
    """Combo 250k = fixed Garlic Bread 45k + slot 2x Pizza (ref 120k).
    Pepperoni costs 130k (+10k surcharge). Margherita has a 15k topping."""
    app = build_test_app(slug)
    cat_p = new_category("Pizza")
    marg = new_product(cat_p, "Margherita", base_price_vnd=120_000)
    pep = new_product(cat_p, "Pepperoni", base_price_vnd=130_000)
    cat_s = new_category("Sides")
    bread = new_product(cat_s, "Garlic Bread", base_price_vnd=45_000, is_pizza=False)
    g_top = new_option_group("Toppings", select_type="multi", required=False)
    cheese = new_option(g_top, "Extra Cheese", price_delta_vnd=15_000)
    enable_option(marg, cheese)
    combo_id = new_combo_with_items("Feast", [bread], price_vnd=250_000)
    with create_session_factory()() as db:
        db.add(ComboItem(combo_id=combo_id, category_id=cat_p, quantity=2))
        db.commit()
        rows = db.scalars(select(ComboItem).where(ComboItem.combo_id == combo_id)).all()
        fixed_id = next(r.combo_item_id for r in rows if r.product_id is not None)
        slot_id = next(r.combo_item_id for r in rows if r.category_id is not None)
    return app, {
        "combo": combo_id, "fixed": fixed_id, "slot": slot_id,
        "marg": marg, "pep": pep, "bread": bread, "cheese": cheese,
    }


def _combo_line(ids, picks_slot, picks_fixed=None, quantity=1):
    return {
        "kind": "combo",
        "combo_id": ids["combo"],
        "quantity": quantity,
        "selections": [
            {"combo_item_id": ids["fixed"],
             "picks": picks_fixed or [{"product_id": ids["bread"], "option_ids": []}]},
            {"combo_item_id": ids["slot"], "picks": picks_slot},
        ],
    }


def _quote(app, lines):
    return TestClient(app).post("/api/cart/quote", json={"lines": lines})


def test_combo_quote_happy_path_pricing():
    app, ids = _fixture("cartc-happy")
    line = _combo_line(
        ids,
        picks_slot=[
            {"product_id": ids["marg"], "option_ids": [ids["cheese"]]},
            {"product_id": ids["pep"], "option_ids": []},
        ],
    )
    r = _quote(app, [line])
    assert r.status_code == 200, r.text
    body = r.json()
    # reference total = 45k + 2x120k = 285k; surcharge 10k (pep); deltas 15k
    # full = 310k, charged = 250k + 25k = 275k, discount = 35k
    assert body["subtotal_vnd"] == 310_000
    assert body["discount_combo_vnd"] == 35_000
    assert body["total_vnd"] == 275_000


def test_combo_quote_quantity_multiplies():
    app, ids = _fixture("cartc-qty")
    line = _combo_line(
        ids,
        picks_slot=[
            {"product_id": ids["marg"], "option_ids": []},
            {"product_id": ids["marg"], "option_ids": []},
        ],
        quantity=2,
    )
    r = _quote(app, [line])
    assert r.status_code == 200, r.text
    body = r.json()
    # per unit: full 285k, charged 250k, discount 35k
    assert body["subtotal_vnd"] == 570_000
    assert body["discount_combo_vnd"] == 70_000
    assert body["total_vnd"] == 500_000


def test_combo_quote_duplicate_pick_options_deduped():
    app, ids = _fixture("cartc-dedupe")
    line = _combo_line(
        ids,
        picks_slot=[
            {"product_id": ids["marg"], "option_ids": [ids["cheese"], ids["cheese"]]},
            {"product_id": ids["pep"], "option_ids": []},
        ],
    )
    r = _quote(app, [line])
    assert r.status_code == 200, r.text
    assert r.json()["total_vnd"] == 275_000  # cheese counted once


def test_combo_quote_option_not_enabled_uses_a8_reason():
    app, ids = _fixture("cartc-opt")
    line = _combo_line(
        ids,
        picks_slot=[
            {"product_id": ids["pep"], "option_ids": [ids["cheese"]]},  # enabled on marg only
            {"product_id": ids["marg"], "option_ids": []},
        ],
    )
    r = _quote(app, [line])
    assert r.status_code == 400
    assert r.json()["error"]["details"]["reason"] == "option_not_available"


def test_combo_quote_unknown_combo():
    app, ids = _fixture("cartc-unknown")
    line = _combo_line(ids, picks_slot=[
        {"product_id": ids["marg"], "option_ids": []},
        {"product_id": ids["marg"], "option_ids": []},
    ])
    line["combo_id"] = 999_999
    r = _quote(app, [line])
    assert r.status_code == 400
    assert r.json()["error"]["details"]["reason"] == "combo_not_active"


def test_combo_quote_pick_count_mismatch():
    app, ids = _fixture("cartc-count")
    line = _combo_line(ids, picks_slot=[{"product_id": ids["marg"], "option_ids": []}])
    r = _quote(app, [line])
    assert r.status_code == 400
    body = r.json()["error"]["details"]
    assert body["reason"] == "pick_count_mismatch"
    assert body["combo_item_id"] == ids["slot"]


def test_combo_quote_pick_outside_category():
    app, ids = _fixture("cartc-outside")
    line = _combo_line(ids, picks_slot=[
        {"product_id": ids["bread"], "option_ids": []},  # bread is Sides, slot is Pizza
        {"product_id": ids["marg"], "option_ids": []},
    ])
    r = _quote(app, [line])
    assert r.status_code == 400
    assert r.json()["error"]["details"]["reason"] == "product_not_in_slot_category"


def test_combo_quote_fixed_component_mismatch():
    app, ids = _fixture("cartc-fixedmm")
    line = _combo_line(
        ids,
        picks_slot=[
            {"product_id": ids["marg"], "option_ids": []},
            {"product_id": ids["marg"], "option_ids": []},
        ],
        picks_fixed=[{"product_id": ids["marg"], "option_ids": []}],
    )
    r = _quote(app, [line])
    assert r.status_code == 400
    assert r.json()["error"]["details"]["reason"] == "product_mismatch_fixed_component"


def test_combo_quote_missing_selection():
    app, ids = _fixture("cartc-missing")
    line = _combo_line(ids, picks_slot=[
        {"product_id": ids["marg"], "option_ids": []},
        {"product_id": ids["marg"], "option_ids": []},
    ])
    line["selections"] = line["selections"][1:]  # drop the fixed component
    r = _quote(app, [line])
    assert r.status_code == 400
    assert r.json()["error"]["details"]["reason"] == "component_selection_missing"


def test_item_line_with_combo_fields_is_schema_error():
    app, ids = _fixture("cartc-schema")
    r = _quote(app, [{"kind": "item", "item_id": ids["marg"], "quantity": 1, "selections": []}])
    assert r.status_code == 400
    assert "errors" in r.json()["error"]["details"]
```

- [ ] **Step 2: Run to verify failure**

Run: `pytest -q tests/test_cart_quote_combo.py`
Expected: FAIL — combo lines rejected ("Combo lines are not supported yet")

- [ ] **Step 3: Implement in `app/api/cart.py`**

Replace `QuoteLineIn` with a discriminated union and add the combo resolver:

```python
from typing import Annotated, Literal

from app.domain.combo_slots import (
    ComboComponentDef,
    SelectionPicks,
    combo_line_pricing,
    pick_surcharge,
    validate_combo_selections,
)
from app.domain.combos import ComboStatus, combo_status
from app.infra.db.combo_queries import slot_availability
from app.infra.db.models import Combo  # extend models import

from datetime import UTC, datetime


class ItemQuoteLineIn(BaseModel):
    kind: Literal["item"]
    item_id: int
    option_ids: list[int] = Field(default_factory=list)
    quantity: int = Field(ge=1)

    model_config = {"extra": "forbid"}


class ComboPickIn(BaseModel):
    product_id: int
    option_ids: list[int] = Field(default_factory=list)

    model_config = {"extra": "forbid"}


class ComboSelectionIn(BaseModel):
    combo_item_id: int
    picks: list[ComboPickIn]

    model_config = {"extra": "forbid"}


class ComboQuoteLineIn(BaseModel):
    kind: Literal["combo"]
    combo_id: int
    selections: list[ComboSelectionIn]
    quantity: int = Field(ge=1)

    model_config = {"extra": "forbid"}


QuoteLineIn = Annotated[ItemQuoteLineIn | ComboQuoteLineIn, Field(discriminator="kind")]
```

`CartQuoteIn.lines: list[QuoteLineIn]` keeps its shape. `_resolve_line`'s
combo branch and item branch split; the quote handler accumulates the combo
discount:

```python
def _selection_error(err) -> APIError:
    details: dict[str, object] = {"reason": err.reason}
    if err.combo_item_id is not None:
        details["combo_item_id"] = err.combo_item_id
    if err.product_id is not None:
        details["product_id"] = err.product_id
    return APIError(
        code="VALIDATION_FAILED",
        message="Invalid combo selection.",
        status_code=400,
        details=details,
    )


def _combo_not_active() -> APIError:
    return APIError(
        code="VALIDATION_FAILED",
        message="Combo is not available.",
        status_code=400,
        details={"reason": "combo_not_active"},
    )


def _resolve_combo_line(db: Session, line: ComboQuoteLineIn) -> tuple[CartLine, int]:
    """Returns (CartLine for the order-total pipeline, combo discount for this line)."""
    combo = db.get(Combo, line.combo_id)
    now = datetime.now(UTC).replace(tzinfo=None)
    if combo is None or combo_status(combo.validity_start, combo.validity_end, now) is not ComboStatus.ACTIVE:
        raise _combo_not_active()

    rows = sorted(combo.combo_items, key=lambda ci: ci.combo_item_id)
    fixed = [ci for ci in rows if ci.product_id is not None]
    slots = [ci for ci in rows if ci.category_id is not None]
    if any(not ci.product.is_active for ci in fixed):
        raise _combo_not_active()
    availability = slot_availability(db, [ci.category_id for ci in slots])
    if any(availability[ci.category_id] is None for ci in slots):
        raise _combo_not_active()

    eligible_by_category: dict[int, frozenset[int]] = {}
    for ci in slots:
        ids = db.scalars(
            select(Product.product_id).where(
                Product.category_id == ci.category_id, Product.is_active.is_(True)
            )
        ).all()
        eligible_by_category[ci.category_id] = frozenset(ids)

    components = [
        ComboComponentDef(
            combo_item_id=ci.combo_item_id,
            quantity=ci.quantity,
            fixed_product_id=ci.product_id,
            eligible_product_ids=(
                eligible_by_category[ci.category_id] if ci.category_id is not None else None
            ),
        )
        for ci in rows
    ]
    selections = [
        SelectionPicks(combo_item_id=s.combo_item_id, product_ids=[p.product_id for p in s.picks])
        for s in line.selections
    ]
    err = validate_combo_selections(components, selections)
    if err is not None:
        raise _selection_error(err)

    ref_by_component: dict[int, int] = {}
    for ci in slots:
        reference = availability[ci.category_id]
        assert reference is not None  # guarded by the continue/raise above
        ref_by_component[ci.combo_item_id] = reference
    reference_total = sum(ci.product.base_price_vnd * ci.quantity for ci in fixed) + sum(
        ref_by_component[ci.combo_item_id] * ci.quantity for ci in slots
    )

    surcharges: list[int] = []
    option_deltas: list[int] = []
    for sel in line.selections:
        for pick in sel.picks:
            product = db.get(Product, pick.product_id)
            assert product is not None  # validated above
            if sel.combo_item_id in ref_by_component:  # slot pick → surcharge
                surcharges.append(
                    pick_surcharge(product.base_price_vnd, ref_by_component[sel.combo_item_id])
                )
            option_deltas.extend(_pick_option_deltas(db, product, pick.option_ids))

    pricing = combo_line_pricing(
        combo_price_vnd=combo.combo_price_vnd,
        reference_total_vnd=reference_total,
        surcharges_vnd=surcharges,
        option_deltas_vnd=option_deltas,
    )
    unit = pricing.line_charged_vnd + pricing.discount_vnd  # spec §2.4 subtotal rule
    return CartLine(unit_price_vnd=unit, quantity=line.quantity), pricing.discount_vnd * line.quantity
```

(Surcharges are PER PICK; `reference_total` is PER COMPONENT × quantity — do
not double-count.)

`_pick_option_deltas` extracts the existing per-product option logic so item
lines and combo picks share it:

```python
def _pick_option_deltas(db: Session, product: Product, option_ids: list[int]) -> list[int]:
    rows = db.execute(
        select(Option, OptionGroup)
        .join(OptionGroup, Option.group_id == OptionGroup.group_id)
        .join(ProductOption, ProductOption.option_id == Option.option_id)
        .where(ProductOption.product_id == product.product_id)
    ).all()
    available = [
        SelectableOption(
            option_id=option.option_id,
            group_id=group.group_id,
            group_name=group.name,
            select_type=group.select_type,
            required=group.required,
        )
        for option, group in rows
    ]
    deltas_by_id = {option.option_id: option.price_delta_vnd for option, _ in rows}
    selected = list(dict.fromkeys(option_ids))
    err = validate_option_selection(available, selected)
    if err is not None:
        details: dict[str, object] = {"reason": err.reason}
        if err.group_name is not None:
            details["group_name"] = err.group_name
        if err.option_id is not None:
            details["option_id"] = err.option_id
        raise APIError(
            code="VALIDATION_FAILED",
            message="Invalid option selection.",
            status_code=400,
            details=details,
        )
    return [deltas_by_id[oid] for oid in selected]
```

Refactor `_resolve_line` (item branch) to call `_pick_option_deltas` instead of
its inline copy, then:

```python
@router.post("/quote", response_model=CartQuoteOut)
def quote_cart(
    payload: CartQuoteIn, db: Session = Depends(get_db, scope="function")
) -> CartQuoteOut:
    lines: list[CartLine] = []
    combo_discount = 0
    for line in payload.lines:
        if isinstance(line, ComboQuoteLineIn):
            cart_line, discount = _resolve_combo_line(db, line)
            lines.append(cart_line)
            combo_discount += discount
        else:
            lines.append(_resolve_item_line(db, line))
    ...
        quote = compute_order_total(
            lines=lines,
            address_district=district,
            combo_discount_vnd=combo_discount,
            redeem_points=payload.redeem_points,
            current_points=0,
        )
```

(rename the old `_resolve_line` → `_resolve_item_line`, drop its combo guard.)

- [ ] **Step 4: Run to verify pass**

Run: `pytest -q tests/test_cart_quote_combo.py && pytest -q tests/test_cart_quote.py && pytest -q && ruff check app tests && ruff format app tests && mypy app/domain && lint-imports`
Expected: all pass (after deleting `test_quote_combo_still_rejected`)

- [ ] **Step 5: Commit**

```bash
git add app/api/cart.py tests/test_cart_quote_combo.py tests/test_cart_quote.py
git commit -m "feat(A10): cart quote prices resolved combo lines (surcharge + options + discount)"
```

---

### Task 10: Seeds — drinks + Pick-Any Feast

**Files:**
- Modify: `Application/backend/app/seeds/run.py`

- [ ] **Step 1: Add drink products and the slot combo**

Seeds already create the "Drinks" category but no drink products — without
them an "any Drink" slot is unavailable. After the `side_products` block:

```python
    cat_drinks = db.scalar(select(Category).where(Category.name == "Drinks"))
    drinks = [("Cola", 15_000), ("Orange Juice", 25_000), ("Mineral Water", 10_000)]
    for name, price in drinks:
        _upsert_product(
            db, name, category_id=cat_drinks.category_id, base_price_vnd=price, is_pizza=False
        )
```

After the existing `combo2` block, add the slot combo (idempotent by name):

```python
    combo3 = db.scalar(select(Combo).where(Combo.name == "Pick-Any Feast"))
    if combo3 is None:
        combo3 = Combo(
            name="Pick-Any Feast",
            description="Two pizzas of your choice, garlic bread, and two drinks.",
            combo_price_vnd=320_000,
            validity_start=now - timedelta(days=1),
            validity_end=now + timedelta(days=365),
        )
        db.add(combo3)
        db.flush()
        db.add(
            ComboItem(combo_id=combo3.combo_id, category_id=cat_pizza.category_id, quantity=2)
        )
        db.add(
            ComboItem(
                combo_id=combo3.combo_id, product_id=side_products[0].product_id, quantity=1
            )
        )
        db.add(
            ComboItem(combo_id=combo3.combo_id, category_id=cat_drinks.category_id, quantity=2)
        )
```

(match the surrounding code's `timedelta` import/usage from combos 1–2; pick
`combo_price_vnd` below cheapest-parts total so the savings badge shows:
2×120k + 45k + 2×10k = 305k reference… adjust price to `280_000` if the
cheapest seeded pizza is 120k and cheapest side is 45k — compute from actual
seed values at implementation time and assert in the next step.)

- [ ] **Step 2: Run seeds twice against compose MySQL (idempotency) and verify**

```bash
python -m app.seeds.run && python -m app.seeds.run
python - <<'EOF'
from sqlalchemy import create_engine, text
import os
e = create_engine(os.environ["DATABASE_URL"])
with e.connect() as c:
    rows = c.execute(text(
        "SELECT category_id, product_id, quantity FROM combo_items ci "
        "JOIN combos cb ON cb.combo_id = ci.combo_id WHERE cb.name='Pick-Any Feast'"
    )).all()
    assert len(rows) == 3, rows
    slots = [r for r in rows if r[0] is not None]
    assert len(slots) == 2, rows
    print("seed ok", rows)
EOF
```

Expected: `seed ok` with 3 rows, 2 slots. Then hit `GET http://localhost:8000/api/combos` (backend running) and confirm Pick-Any Feast appears with positive `savings_vnd`.

- [ ] **Step 3: Commit**

```bash
git add app/seeds/run.py
git commit -m "feat(A10): seed drink products and the Pick-Any Feast slot combo"
```

---

### Task 11: Contracts — OpenAPI, types, CONTRACTS.md

**Files:**
- Regenerate: `Application/openapi.json`, `Application/frontend/lib/api/types.ts`
- Modify: `Application/CONTRACTS.md`

- [ ] **Step 1: Regenerate (cwd-qualified)**

```bash
cd Application/backend && python -m app.tools.dump_openapi > ../openapi.json
cd ../frontend && npm run gen:types
npx tsc --noEmit || true   # expect errors in combos UI — fixed in Tasks 12–13
```

- [ ] **Step 2: Update CONTRACTS.md**

- Admin combos rows: `POST/PATCH` body items are kind-discriminated
  (`{kind:"product",product_id,quantity}` | `{kind:"category",category_id,quantity}`);
  min rule `sum(quantity) ≥ 2`; reason `slot_category_unavailable`; new rows
  `POST /api/admin/combos/{id}/image` → `{image_url}` and
  `DELETE /api/admin/combos/{id}/image` → 204.
- Public rows: `GET /api/combos` item shape with `kind`/`from_price_vnd`/
  `image_url`; new `GET /api/combos/{combo_id}` detail row (components +
  `eligible_products` + `surcharge_vnd`; 404 unless Active & purchasable).
- Cart quote: combo line shape (selections/picks), closed reason table
  (`combo_not_active`, `component_selection_missing`, `pick_count_mismatch`,
  `product_not_in_slot_category`, `product_mismatch_fixed_component`),
  schema-vs-semantic note (`details.errors` vs `details.reason`),
  discount semantics (`subtotal` counts full value; `discount_combo_vnd` = savings).
- A10 scope bullet: slots are category-based; reference price = min active
  base price; surcharge above reference; order persistence excluded (U6).

- [ ] **Step 3: Commit**

```bash
git add Application/openapi.json Application/frontend/lib/api/types.ts Application/CONTRACTS.md
git commit -m "chore(A10): regenerate contracts for combo choice-slots"
```

---

### Task 12: Frontend — admin combos card grid + API surface

**Files:**
- Create: `Application/frontend/lib/api/admin-combos.ts`
- Rewrite: `Application/frontend/app/admin/combos/page.tsx`
- Test: `Application/frontend/lib/format-combo-component.test.ts` + `lib/format-combo-component.ts`

- [ ] **Step 1: Write failing unit test for the shared label helper**

```typescript
import { describe, expect, it } from "vitest";

import { formatComboComponent } from "./format-combo-component";

describe("formatComboComponent", () => {
  it("renders fixed components as qty x name", () => {
    expect(
      formatComboComponent({ kind: "product", name: "Garlic Bread", quantity: 1 }),
    ).toBe("1× Garlic Bread");
  });

  it("keeps the customer's-choice suffix for slots", () => {
    expect(
      formatComboComponent({ kind: "category", name: "Pizzas — customer's choice", quantity: 2 }),
    ).toBe("2× Pizzas — customer's choice");
  });
});
```

Run: `npx vitest run lib/format-combo-component.test.ts` → FAIL (module missing)

- [ ] **Step 2: Implement helper**

```typescript
export interface ComboComponentLabel {
  kind: "product" | "category";
  name: string;
  quantity: number;
}

/** "2× Pizzas — customer's choice" — server provides the suffix in `name`. */
export function formatComboComponent(c: ComboComponentLabel): string {
  return `${c.quantity}× ${c.name}`;
}
```

Run: `npx vitest run lib/format-combo-component.test.ts` → PASS

- [ ] **Step 3: API surface (`lib/api/admin-combos.ts`, pattern: `admin-options.ts`)**

```typescript
import { apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

export type AdminCombo = components["schemas"]["ComboOut"];
export type AdminComboIn = components["schemas"]["ComboIn"];
export type AdminComboPatch = components["schemas"]["ComboPatch"];
export type AdminComboItemIn = AdminComboIn["items"][number];

export const listCombos = () => apiFetch<AdminCombo[]>("/admin/combos");

export const getCombo = (id: number) => apiFetch<AdminCombo>(`/admin/combos/${id}`);

export const createCombo = (body: AdminComboIn) =>
  apiFetch<AdminCombo>("/admin/combos", { method: "POST", body: JSON.stringify(body) });

export const patchCombo = (id: number, body: AdminComboPatch) =>
  apiFetch<AdminCombo>(`/admin/combos/${id}`, { method: "PATCH", body: JSON.stringify(body) });

export const deleteCombo = (id: number) =>
  apiFetch<void>(`/admin/combos/${id}`, { method: "DELETE" });

export const uploadComboImage = (id: number, file: File) => {
  const fd = new FormData();
  fd.append("image", file);
  return apiFetch<{ image_url: string }>(`/admin/combos/${id}/image`, {
    method: "POST",
    body: fd,
  });
};

export const deleteComboImage = (id: number) =>
  apiFetch<void>(`/admin/combos/${id}/image`, { method: "DELETE" });
```

- [ ] **Step 4: Rewrite `/admin/combos` as a card grid**

Replace the form-first page with (key structure — match existing admin page
styling conventions: `rounded-xl border border-line bg-card`, `text-muted`,
Breadcrumb, loading skeleton, error+retry):

```tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { listCombos, type AdminCombo } from "@/lib/api/admin-combos";
import { formatComboComponent } from "@/lib/format-combo-component";
import Breadcrumb from "@/components/admin/Breadcrumb";
import { ApiClientError } from "@/lib/api/client";

const STATUS_STYLE: Record<string, string> = {
  Active: "bg-success-subtle text-success",
  Scheduled: "bg-info-subtle text-info",
  Expired: "bg-surface-hover text-muted",
};

export default function AdminCombosPage() {
  const [combos, setCombos] = useState<AdminCombo[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    listCombos()
      .then(setCombos)
      .catch((e) => setError(e instanceof ApiClientError ? e.message : String(e)));
  }, []);
  useEffect(load, [load]);

  return (
    <div>
      <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Combos" }]} />
      <h1 className="mb-6 text-2xl font-semibold text-fg">Combos</h1>
      {error && (
        <div className="mb-4 rounded-md border border-danger bg-danger-subtle px-3 py-2 text-sm">
          {error}{" "}
          <button onClick={load} className="underline">
            Retry
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/admin/combos/new"
          className="flex min-h-44 items-center justify-center rounded-xl border-2 border-dashed border-line text-muted hover:border-brand hover:text-brand-fg"
        >
          + Create New Combo
        </Link>
        {(combos ?? []).map((c) => (
          <Link
            key={c.combo_id}
            href={`/admin/combos/${c.combo_id}`}
            className="overflow-hidden rounded-xl border border-line bg-card hover:border-brand"
          >
            {c.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.image_url} alt="" className="aspect-[16/6] w-full object-cover" />
            ) : (
              <div className="aspect-[16/6] w-full bg-surface-hover" />
            )}
            <div className="p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-fg">{c.name}</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[c.status] ?? ""}`}
                >
                  {c.status}
                </span>
              </div>
              <ul className="mt-2 space-y-0.5 text-sm text-muted">
                {c.items.map((it, i) => (
                  <li key={i}>{formatComboComponent(it)}</li>
                ))}
              </ul>
              <p className="mt-3 font-medium text-fg">
                {c.combo_price_vnd.toLocaleString("vi-VN")}₫
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

(If existing pages format VND through a shared helper — search
`toLocaleString` under `Application/frontend` first and reuse it.)

- [ ] **Step 5: Verify + commit**

Run: `npx tsc --noEmit && npx eslint . && npx vitest run --exclude 'tests/e2e/**'`
Expected: pass (editor pages come next; this page must not import them)

```bash
git add lib/api/admin-combos.ts lib/format-combo-component.ts lib/format-combo-component.test.ts app/admin/combos/page.tsx
git commit -m "feat(A10): admin combos card grid and typed API surface"
```

---

### Task 13: Frontend — combo editor with component picker

**Files:**
- Create: `Application/frontend/components/admin/combo-editor.tsx`
- Create: `Application/frontend/components/admin/combo-component-picker.tsx`
- Create: `Application/frontend/app/admin/combos/[id]/page.tsx`
- Create: `Application/frontend/app/admin/combos/new/page.tsx`

Keep each file under 300 lines; the picker and editor are separate components.

- [ ] **Step 1: Component picker**

`combo-component-picker.tsx` — props: `onAdd(item: AdminComboItemIn, label: string, unitPrice: number)`, `onClose()`. Fetches `/admin/categories` and `/admin/items` once on mount; builds special entries (active categories having ≥1 active item, `from = min(base_price_vnd)`) then the active-dish list; one search input filters both by name.

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";
import type { AdminComboItemIn } from "@/lib/api/admin-combos";

type Category = components["schemas"]["CategoryOut"];
type Item = components["schemas"]["AdminItemOut"];

interface PickerProps {
  onAdd: (item: AdminComboItemIn, label: string, unitPrice: number) => void;
  onClose: () => void;
}

export default function ComboComponentPicker({ onAdd, onClose }: PickerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    apiFetch<Category[]>("/admin/categories").then(setCategories);
    apiFetch<Item[]>("/admin/items").then(setItems);
  }, []);

  const activeItems = useMemo(() => items.filter((i) => i.is_active), [items]);
  const slotEntries = useMemo(
    () =>
      categories
        .filter((c) => c.is_active)
        .map((c) => {
          const prices = activeItems
            .filter((i) => i.category_id === c.category_id)
            .map((i) => i.base_price_vnd);
          return prices.length
            ? { category: c, from: Math.min(...prices) }
            : null;
        })
        .filter((e): e is { category: Category; from: number } => e !== null),
    [categories, activeItems],
  );

  const needle = q.trim().toLowerCase();
  const matches = (name: string) => !needle || name.toLowerCase().includes(needle);

  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search dishes or categories…"
          aria-label="Search components"
          className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm"
        />
        <button onClick={onClose} className="text-sm text-muted hover:text-fg">
          Cancel
        </button>
      </div>
      <ul className="mt-2 max-h-64 overflow-y-auto text-sm">
        {slotEntries
          .filter((e) => matches(e.category.name))
          .map((e) => (
            <li key={`cat-${e.category.category_id}`}>
              <button
                className="flex w-full justify-between rounded-lg px-2 py-2 text-left hover:bg-surface-hover"
                onClick={() =>
                  onAdd(
                    { kind: "category", category_id: e.category.category_id, quantity: 1 },
                    `${e.category.name} — customer's choice`,
                    e.from,
                  )
                }
              >
                <span className="font-medium">Any {e.category.name} — customer&apos;s choice</span>
                <span className="text-muted">from {e.from.toLocaleString("vi-VN")}₫</span>
              </button>
            </li>
          ))}
        {activeItems
          .filter((i) => matches(i.name))
          .map((i) => (
            <li key={`item-${i.product_id}`}>
              <button
                className="flex w-full justify-between rounded-lg px-2 py-2 text-left hover:bg-surface-hover"
                onClick={() =>
                  onAdd(
                    { kind: "product", product_id: i.product_id, quantity: 1 },
                    i.name,
                    i.base_price_vnd,
                  )
                }
              >
                <span>{i.name}</span>
                <span className="text-muted">{i.base_price_vnd.toLocaleString("vi-VN")}₫</span>
              </button>
            </li>
          ))}
      </ul>
    </div>
  );
}
```

(Verify the actual schema names `CategoryOut` / `AdminItemOut` in
`lib/api/types.ts` after Task 11's regen and adjust imports — the admin
categories and items routers define them.)

- [ ] **Step 2: Editor component**

`combo-editor.tsx` — props `{ comboId: number | null }` (null = create). State: `name`, `description`, `comboPrice`, `validityStart`, `validityEnd`, `imageUrl`, `rows: EditorRow[]` where

```typescript
interface EditorRow {
  item: AdminComboItemIn;
  label: string;
  unitPrice: number; // base price (fixed) or from-price (slot) for the pricing panel
}
```

Behaviors (all server-authoritative on save; client mirrors for display only):
- Load on mount when `comboId` set: `getCombo(id)` → map `items` to rows
  (`unitPrice` = `from_price_vnd` ?? fetch not needed — `ComboItemOut` carries
  `from_price_vnd` for slots; for fixed rows fetch `/admin/items` once to
  resolve base prices, same call the picker makes).
- Components panel: each row shows label, − / qty / + stepper buttons
  (`aria-label="Decrease quantity"` / `"Increase quantity"`), Remove button.
- "Add Component" button toggles `ComboComponentPicker`; `onAdd` appends a row
  (or increments quantity when the same product/category row already exists).
- Pricing panel: `componentsTotal = Σ unitPrice × quantity`; savings =
  `componentsTotal − comboPrice` shown when > 0; when `comboPrice >
  componentsTotal` render the warning text from `admin-combo-edit.html`
  ("This combo costs more than its components bought separately…") and hide
  savings.
- Image: file input → `uploadComboImage` (immediately on selection, requires
  saved combo: hide the upload control in create mode until first save);
  Remove button → `deleteComboImage`.
- Save: `sum(quantity) >= 2` gate client-side (disable button + hint);
  create → `createCombo({...})` then `router.replace(`/admin/combos/${id}`)`;
  edit → `patchCombo`. `validity_*` sent as ISO strings or null. Map
  `ApiClientError` message into an inline error banner.
- Delete combo: inline confirm (two-step button, no `window.confirm`), then
  `deleteCombo` and `router.push("/admin/combos")`.

- [ ] **Step 3: Pages**

`app/admin/combos/[id]/page.tsx`:

```tsx
"use client";

import { use } from "react";

import ComboEditor from "@/components/admin/combo-editor";

export default function EditComboPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ComboEditor comboId={Number(id)} />;
}
```

`app/admin/combos/new/page.tsx`:

```tsx
"use client";

import ComboEditor from "@/components/admin/combo-editor";

export default function NewComboPage() {
  return <ComboEditor comboId={null} />;
}
```

(Match the `params` handling used by `app/admin/items/[id]/page.tsx` — if that
page receives `params` synchronously, copy its exact signature instead.)

- [ ] **Step 4: Verify + commit**

Run: `npx tsc --noEmit && npx eslint . && npx vitest run --exclude 'tests/e2e/**' && npm run build`
Expected: all pass

```bash
git add components/admin/combo-editor.tsx components/admin/combo-component-picker.tsx "app/admin/combos/[id]/page.tsx" app/admin/combos/new/page.tsx
git commit -m "feat(A10): admin combo editor with component picker and pricing panel"
```

---

### Task 14: e2e — admin builds a slot combo

**Files:**
- Create: `Application/frontend/tests/e2e/admin-combo-editor.spec.ts`

- [ ] **Step 1: Write the spec (hermetic, A8 pattern)**

```typescript
import { test, expect, type Page } from "@playwright/test";

import { E2E_ADMIN_PASSWORD, E2E_ADMIN_PHONE, E2E_API_URL, E2E_BASE_URL } from "./env";

async function loginAsAdmin(page: Page) {
  const res = await page.request.post(`${E2E_API_URL}/api/auth/login`, {
    data: { phone_number: E2E_ADMIN_PHONE, password: E2E_ADMIN_PASSWORD },
  });
  expect(res.ok(), "admin seed login should succeed against a seeded stack").toBeTruthy();
}

test.describe("A10 – Admin combo editor", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("combos list shows seeded slot combo with savings badge", async ({ page }) => {
    await page.goto(`${E2E_BASE_URL}/admin/combos`);
    const card = page.getByRole("link", { name: /Pick-Any Feast/ });
    await expect(card).toBeVisible();
    await expect(card.getByText(/customer's choice/)).toBeVisible();
  });

  test("creates a combo with a choice slot via the picker and deletes it", async ({ page }) => {
    const name = `E2E Slot Combo ${Date.now()}`;
    let comboId: number | null = null;
    try {
      await page.goto(`${E2E_BASE_URL}/admin/combos/new`);
      await page.getByLabel("Combo name").fill(name);
      await page.getByLabel("Combo price").fill("200000");

      await page.getByRole("button", { name: "Add Component" }).click();
      await page.getByRole("button", { name: /Any Pizza — customer's choice/ }).click();
      // bump the slot to 2 units to satisfy sum(quantity) >= 2
      await page.getByRole("button", { name: "Increase quantity" }).click();

      await page.getByRole("button", { name: "Save Combo" }).click();
      await expect(page).toHaveURL(/\/admin\/combos\/\d+$/);
      comboId = Number(page.url().split("/").pop());

      // savings line visible: 200k < 2 x cheapest pizza
      await expect(page.getByText(/Customer saves/)).toBeVisible();
    } finally {
      if (comboId) {
        await page.request.delete(`${E2E_API_URL}/api/admin/combos/${comboId}`);
      } else {
        // combo may exist even if a later assertion failed — find by name
        const res = await page.request.get(`${E2E_API_URL}/api/admin/combos`);
        if (res.ok()) {
          const all = await res.json();
          const mine = all.find((c: { name: string }) => c.name === name);
          if (mine) await page.request.delete(`${E2E_API_URL}/api/admin/combos/${mine.combo_id}`);
        }
      }
    }
  });
});
```

Editor inputs must carry the labels the spec uses: `Combo name`, `Combo price`
(via `<label htmlFor>`), buttons `Add Component`, `Save Combo`,
`Increase quantity`. Adjust the spec or the editor so they agree — labels in
Task 13 win.

- [ ] **Step 2: Run against the compose stack**

```bash
cd Application && docker compose up -d --build backend frontend
cd backend && source .venv/bin/activate && set -a; source ../.env; set +a
export DATABASE_URL="mysql+pymysql://pizza:pizza@127.0.0.1:${MYSQL_HOST_PORT:-33306}/pizzahust"
alembic upgrade head && python -m app.seeds.run
cd ../frontend && npx playwright test tests/e2e/admin-combo-editor.spec.ts
```

Expected: both tests pass

- [ ] **Step 3: Full e2e suite**

Run: `npx playwright test`
Expected: pass (pre-existing skips allowed)

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/admin-combo-editor.spec.ts
git commit -m "test(A10): admin combo editor e2e (slot via picker, hermetic cleanup)"
```

---

### Task 15: Gate + bookkeeping

**Files:**
- Modify: `Application/feature_list.json`, `Application/progress.md`, `Application/session-handoff.md`

- [ ] **Step 1: Full gate**

```bash
cd Application && ./verify.sh
```

Expected: `=== VERIFY OK ===`, exit 0. Fix anything it flags before continuing.

- [ ] **Step 2: Record evidence**

- `feature_list.json`: A10 → `"status": "done"`, evidence
  `"verify.sh green at <commit>, <ISO timestamp>"`.
- `progress.md`: dated A10 block (what shipped, key decisions, migration 0006).
- `session-handoff.md`: A10 done; next = U15 Customize Combo (depends U4+A8+A10,
  all done — rides `GET /api/combos/{id}` + cart combo lines + A8
  `OptionGroupSelector`/`composeLineText`); note U6 order-schema follow-up
  (spec §1: `order_items` XOR cannot hold resolved picks).

- [ ] **Step 3: Commit**

```bash
git add ../feature_list.json ../progress.md ../session-handoff.md
git commit -m "chore(A10): record completion evidence and handoff to U15"
```

- [ ] **Step 4: Push and open PR**

```bash
git push -u origin a10-combo-choice-slots
gh pr create --title "feat(A10): combo choice-slots and component picker" --body-file <(cat <<'EOF'
## Summary
Combos gain category choice-slots alongside fixed components: widened combo_items (product XOR category + CHECK), slot reference pricing (min active base price), admin card grid + dedicated editor with component picker, public slot-aware list + new detail endpoint, cart quote pricing of resolved combos (surcharges + option deltas + combo discount), combo images, seeds, e2e.

Spec: docs/plans/2026-06-10-a10-combo-choice-slots-design.md

## Verification
./verify.sh green at <commit> (backend tests, vitest, Playwright).

## Notes
- Order persistence of resolved picks is U6 (order_items XOR product_or_combo needs extension — spec §1).
- discount_combo_vnd is now non-zero for combo lines; item lines unchanged.
EOF
)
```

---

## Self-review (done at planning time)

- **Spec coverage:** §1 → Tasks 3–4; §2.1 → Tasks 5–6; §2.2 → Task 7; §2.3 →
  Task 8; §2.4 → Task 9; §2.5 → Task 11; §3 → Tasks 1–2; §4 → Tasks 12–13;
  §5 → Task 10; §6 → tests in every task + Tasks 14–15. No gaps.
- **Placeholders:** none — every code step carries full code; the two
  "verify-name-at-implementation-time" notes (schema type names after regen,
  `params` signature) are verification instructions, not deferred work.
- **Type consistency:** `ComboComponentDef`/`SelectionPicks`/
  `ComboSelectionError`/`combo_line_pricing` names match across Tasks 1, 2, 9;
  `slot_availability` matches across Tasks 4–9; `AdminComboItemIn` matches
  Tasks 12–13; e2e labels pinned to Task 13's editor.
