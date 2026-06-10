# A8 — Generic Options Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fixed `pizza_sizes`/`pizza_crusts`/`toppings` with admin-defined option groups + options (deltas shared, enablement per-dish), reworking cart pricing, the U3 customizer, and the admin dish editor.

**Architecture:** Global `option_groups`→`options` catalog, `product_options` per-dish enablement join, `order_item_options` snapshots (no FK to options). One clean-cut Alembic revision migrates data and drops old tables. Routers stay thin; group-rule validation and unit pricing live in `app/domain/`. Spec: `docs/plans/2026-06-10-a8-generic-options-design.md`.

**Tech Stack:** FastAPI + SQLAlchemy 2 + Alembic + MySQL 8 · Next.js 16 App Router + Tailwind 4 + openapi-typescript types · pytest / Vitest / Playwright.

**Branch:** `a8-generic-options`. All backend commands run from `Application/backend` with `.venv` active (`source .venv/bin/activate`); backend tests use per-test SQLite built from `Base.metadata` (migrations not involved). Frontend commands from `Application/frontend`.

**Task ordering keeps the suite green at every commit:** additive first (domain, models, new routers), then consumer rewrites, then removal of the old model, then migration/contracts/frontend.

---

### Task 1: Domain — `compute_unit_price` + `validate_option_selection`

**Files:**
- Modify: `Application/backend/app/domain/pricing.py`
- Create: `Application/backend/app/domain/options.py`
- Test: `Application/backend/tests/domain/test_pricing.py` (append)
- Create: `Application/backend/tests/domain/test_options.py`

- [ ] **Step 1: Write failing tests for `compute_unit_price`**

Append to `tests/domain/test_pricing.py`:

```python
from app.domain.pricing import compute_unit_price


def test_compute_unit_price_base_only():
    assert compute_unit_price(base_price_vnd=125_000, option_deltas_vnd=[]) == 125_000


def test_compute_unit_price_sums_deltas():
    assert (
        compute_unit_price(base_price_vnd=125_000, option_deltas_vnd=[30_000, 15_000, 20_000])
        == 190_000
    )
```

- [ ] **Step 2: Run to verify failure**

Run: `pytest tests/domain/test_pricing.py -q`
Expected: FAIL — `ImportError: cannot import name 'compute_unit_price'`

- [ ] **Step 3: Implement in `domain/pricing.py`**

Add (keep `compute_pizza_unit_price` for now — removed in Task 6):

```python
def compute_unit_price(*, base_price_vnd: int, option_deltas_vnd: Sequence[int]) -> int:
    """Unit price for one item line: base price plus the sum of selected option deltas."""
    return base_price_vnd + sum(option_deltas_vnd)
```

(`Sequence` is already imported in this module for the existing helpers; if not, add `from collections.abc import Sequence`.)

- [ ] **Step 4: Write failing tests for `validate_option_selection`**

Create `tests/domain/test_options.py`:

```python
from __future__ import annotations

from app.domain.options import SelectableOption, validate_option_selection


def _opts() -> list[SelectableOption]:
    return [
        SelectableOption(option_id=1, group_id=10, group_name="Size", select_type="single", required=True),
        SelectableOption(option_id=2, group_id=10, group_name="Size", select_type="single", required=True),
        SelectableOption(option_id=3, group_id=20, group_name="Toppings", select_type="multi", required=False),
        SelectableOption(option_id=4, group_id=20, group_name="Toppings", select_type="multi", required=False),
    ]


def test_valid_selection_returns_none():
    assert validate_option_selection(_opts(), [1, 3, 4]) is None


def test_unknown_option_id_rejected():
    err = validate_option_selection(_opts(), [1, 99])
    assert err is not None
    assert err.reason == "option_not_available"
    assert err.option_id == 99


def test_required_single_group_missing():
    err = validate_option_selection(_opts(), [3])
    assert err is not None
    assert err.reason == "required_group_missing"
    assert err.group_name == "Size"


def test_two_picks_in_single_group_rejected():
    err = validate_option_selection(_opts(), [1, 2])
    assert err is not None
    assert err.reason == "single_group_conflict"
    assert err.group_name == "Size"


def test_required_group_with_no_enabled_options_not_enforced():
    # A required group absent from the available set (no enabled options for this
    # dish) must not block the selection.
    only_toppings = [o for o in _opts() if o.group_id == 20]
    assert validate_option_selection(only_toppings, [3]) is None


def test_empty_selection_ok_when_nothing_required():
    only_toppings = [o for o in _opts() if o.group_id == 20]
    assert validate_option_selection(only_toppings, []) is None
```

- [ ] **Step 5: Run to verify failure**

Run: `pytest tests/domain/test_options.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.domain.options'`

- [ ] **Step 6: Implement `domain/options.py`**

```python
"""A8 – option-selection rules for the generic options model.

Pure domain logic: given the options available to a dish (already filtered to
the dish's enabled set) and the customer's selected ids, enforce group rules.
Callers dedupe ids before calling.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass


@dataclass(frozen=True)
class SelectableOption:
    option_id: int
    group_id: int
    group_name: str
    select_type: str  # "single" | "multi"
    required: bool


@dataclass(frozen=True)
class OptionSelectionError:
    reason: str  # option_not_available | required_group_missing | single_group_conflict
    group_name: str | None = None
    option_id: int | None = None


def validate_option_selection(
    available: Sequence[SelectableOption], selected_ids: Sequence[int]
) -> OptionSelectionError | None:
    by_id = {o.option_id: o for o in available}

    for oid in selected_ids:
        if oid not in by_id:
            return OptionSelectionError(reason="option_not_available", option_id=oid)

    picks_per_group: dict[int, int] = {}
    for oid in selected_ids:
        gid = by_id[oid].group_id
        picks_per_group[gid] = picks_per_group.get(gid, 0) + 1

    groups: dict[int, SelectableOption] = {}
    for o in available:
        groups.setdefault(o.group_id, o)

    for gid, sample in groups.items():
        picked = picks_per_group.get(gid, 0)
        if sample.select_type == "single" and picked > 1:
            return OptionSelectionError(reason="single_group_conflict", group_name=sample.group_name)
        if sample.required and picked == 0:
            return OptionSelectionError(reason="required_group_missing", group_name=sample.group_name)

    return None
```

- [ ] **Step 7: Run domain tests + gates**

Run: `pytest tests/domain -q && mypy app/domain && ruff check app/domain tests/domain`
Expected: all PASS

- [ ] **Step 8: Commit**

```bash
git add app/domain/options.py app/domain/pricing.py tests/domain/test_options.py tests/domain/test_pricing.py
git commit -m "feat(A8): option-selection domain rules and generic unit pricing"
```

---

### Task 2: Models — OptionGroup, Option, ProductOption, OrderItemOption (additive)

**Files:**
- Modify: `Application/backend/app/infra/db/models.py`

- [ ] **Step 1: Add the four models**

Insert after `Topping` (style mirrors existing models; old models stay until Task 7):

```python
class OptionGroup(Base):
    __tablename__ = "option_groups"

    group_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    select_type: Mapped[str] = mapped_column(
        Enum("single", "multi", name="option_select_type"),
        nullable=False,
        default="multi",
        server_default="multi",
    )
    required: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="0"
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    options: Mapped[list[Option]] = relationship(
        back_populates="group", cascade="all, delete-orphan"
    )


class Option(Base):
    __tablename__ = "options"
    __table_args__ = (UniqueConstraint("group_id", "name", name="uq_options_group_name"),)

    option_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    group_id: Mapped[int] = mapped_column(
        ForeignKey("option_groups.group_id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    price_delta_vnd: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    group: Mapped[OptionGroup] = relationship(back_populates="options")


class ProductOption(Base):
    """Per-dish enablement: row present = option enabled for the product."""

    __tablename__ = "product_options"

    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.product_id", ondelete="CASCADE"), primary_key=True
    )
    option_id: Mapped[int] = mapped_column(
        ForeignKey("options.option_id", ondelete="CASCADE"), primary_key=True
    )


class OrderItemOption(Base):
    """Snapshot of one selected option at order time. No FK to options — admin
    deletes never touch history. Rows are inserted in (group.sort_order,
    option.sort_order) order; readers order by id."""

    __tablename__ = "order_item_options"
    __table_args__ = (Index("ix_order_item_options_order_item_id", "order_item_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_item_id: Mapped[int] = mapped_column(
        ForeignKey("order_items.order_item_id"), nullable=False
    )
    group_name: Mapped[str] = mapped_column(String(100), nullable=False)
    option_name: Mapped[str] = mapped_column(String(100), nullable=False)
    price_delta_vnd: Mapped[int] = mapped_column(Integer, nullable=False)

    order_item: Mapped[OrderItem] = relationship(back_populates="options")
```

Add to `OrderItem` relationships (keep `size`/`crust`/`toppings` until Task 7):

```python
    options: Mapped[list[OrderItemOption]] = relationship(
        back_populates="order_item",
        cascade="all, delete-orphan",
    )
```

Check imports at the top of `models.py`: `Enum` and `UniqueConstraint` must come from `sqlalchemy` (add to the existing import list if absent).

- [ ] **Step 2: Run gates**

Run: `pytest -q -x tests/test_health.py && ruff check app && lint-imports`
Expected: PASS (models import cleanly, boundaries intact)

- [ ] **Step 3: Commit**

```bash
git add app/infra/db/models.py
git commit -m "feat(A8): OptionGroup/Option/ProductOption/OrderItemOption models"
```

---

### Task 3: Admin router — option groups + options CRUD

**Files:**
- Create: `Application/backend/app/api/admin/option_groups.py`
- Modify: `Application/backend/app/main.py` (register router)
- Create: `Application/backend/tests/test_admin_option_groups.py`
- Modify: `Application/backend/tests/admin_test_utils.py` (add factories)

- [ ] **Step 1: Add factories to `admin_test_utils.py`**

Append (imports `OptionGroup`, `Option`, `ProductOption` from `app.infra.db.models` — extend the existing import block):

```python
def new_option_group(
    name: str = "Size", *, select_type: str = "single", required: bool = True, sort_order: int = 0
) -> int:
    with create_session_factory()() as db:
        g = OptionGroup(name=name, select_type=select_type, required=required, sort_order=sort_order)
        db.add(g)
        db.commit()
        db.refresh(g)
        return g.group_id


def new_option(
    group_id: int,
    name: str = "M",
    *,
    price_delta_vnd: int = 0,
    description: str | None = None,
    sort_order: int = 0,
) -> int:
    with create_session_factory()() as db:
        o = Option(
            group_id=group_id,
            name=name,
            description=description,
            price_delta_vnd=price_delta_vnd,
            sort_order=sort_order,
        )
        db.add(o)
        db.commit()
        db.refresh(o)
        return o.option_id


def enable_option(product_id: int, option_id: int) -> None:
    with create_session_factory()() as db:
        db.add(ProductOption(product_id=product_id, option_id=option_id))
        db.commit()
```

- [ ] **Step 2: Write failing router tests**

Create `tests/test_admin_option_groups.py`:

```python
from __future__ import annotations

from tests.admin_test_utils import admin_client, new_option, new_option_group


def test_group_crud_roundtrip():
    c = admin_client("og-crud")
    r = c.post(
        "/api/admin/option-groups",
        json={"name": "Size", "select_type": "single", "required": True, "sort_order": 1},
    )
    assert r.status_code == 201, r.text
    gid = r.json()["group_id"]
    assert r.json()["select_type"] == "single"

    r = c.patch(f"/api/admin/option-groups/{gid}", json={"name": "Pizza Size", "required": False})
    assert r.status_code == 200
    assert r.json()["name"] == "Pizza Size"
    assert r.json()["required"] is False

    r = c.get("/api/admin/option-groups")
    assert [g["name"] for g in r.json()] == ["Pizza Size"]

    assert c.delete(f"/api/admin/option-groups/{gid}").status_code == 204
    assert c.get("/api/admin/option-groups").json() == []


def test_duplicate_group_name_409():
    c = admin_client("og-dupe")
    assert c.post("/api/admin/option-groups", json={"name": "Size"}).status_code == 201
    r = c.post("/api/admin/option-groups", json={"name": "Size"})
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "CONFLICT"


def test_option_crud_and_dupe_within_group():
    c = admin_client("og-opt")
    gid = new_option_group("Toppings", select_type="multi", required=False)
    r = c.post(
        f"/api/admin/option-groups/{gid}/options",
        json={"name": "Extra Cheese", "price_delta_vnd": 15_000, "description": "More mozz"},
    )
    assert r.status_code == 201, r.text
    oid = r.json()["option_id"]

    # duplicate name within the same group conflicts
    r = c.post(f"/api/admin/option-groups/{gid}/options", json={"name": "Extra Cheese"})
    assert r.status_code == 409

    # same name in a different group is fine
    gid2 = new_option_group("Size")
    assert (
        c.post(f"/api/admin/option-groups/{gid2}/options", json={"name": "Extra Cheese"}).status_code
        == 201
    )

    r = c.patch(f"/api/admin/options/{oid}", json={"price_delta_vnd": 18_000})
    assert r.status_code == 200
    assert r.json()["price_delta_vnd"] == 18_000

    assert c.delete(f"/api/admin/options/{oid}").status_code == 204


def test_group_delete_cascades_options():
    c = admin_client("og-cascade")
    gid = new_option_group("Size")
    new_option(gid, "M", price_delta_vnd=30_000)
    assert c.delete(f"/api/admin/option-groups/{gid}").status_code == 204
    assert c.get("/api/admin/option-groups").json() == []


def test_requires_admin_role():
    from fastapi.testclient import TestClient

    from tests.auth_test_utils import build_test_app

    app = build_test_app("og-guard")
    r = TestClient(app).get("/api/admin/option-groups")
    assert r.status_code == 401
```

- [ ] **Step 3: Run to verify failure**

Run: `pytest tests/test_admin_option_groups.py -q`
Expected: FAIL — 404s (router not registered)

- [ ] **Step 4: Implement `app/api/admin/option_groups.py`**

```python
"""A8 – manage option groups and options (admin only).

Generic replacement for the fixed sizes/crusts/toppings routers. Order history
holds snapshots (order_item_options), so deletes need no reference guards.
Group delete cascades to its options and their product enablement rows.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.infra.auth import require_role
from app.infra.db.models import Option, OptionGroup, User, UserRole

router = APIRouter(prefix="/api/admin", tags=["admin-option-groups"])
require_admin = require_role(UserRole.ADMIN)


def _conflict(message: str) -> APIError:
    return APIError(code="CONFLICT", message=message, status_code=409)


def _not_found(message: str) -> APIError:
    return APIError(code="NOT_FOUND", message=message, status_code=404)


class GroupOut(BaseModel):
    group_id: int
    name: str
    select_type: Literal["single", "multi"]
    required: bool
    sort_order: int

    model_config = {"from_attributes": True}


class GroupIn(BaseModel):
    name: str
    select_type: Literal["single", "multi"] = "multi"
    required: bool = False
    sort_order: int = 0


class GroupPatch(BaseModel):
    name: str | None = None
    select_type: Literal["single", "multi"] | None = None
    required: bool | None = None
    sort_order: int | None = None


class OptionOut(BaseModel):
    option_id: int
    group_id: int
    name: str
    description: str | None = None
    price_delta_vnd: int
    sort_order: int

    model_config = {"from_attributes": True}


class OptionIn(BaseModel):
    name: str
    description: str | None = None
    price_delta_vnd: int = 0
    sort_order: int = 0


class OptionPatch(BaseModel):
    name: str | None = None
    description: str | None = None
    price_delta_vnd: int | None = None
    sort_order: int | None = None


@router.get("/option-groups", response_model=list[GroupOut])
def list_groups(
    db: Session = Depends(get_db), _a: User = Depends(require_admin)
) -> list[GroupOut]:
    rows = db.scalars(
        select(OptionGroup).order_by(OptionGroup.sort_order, OptionGroup.name)
    ).all()
    return [GroupOut.model_validate(g) for g in rows]


@router.post("/option-groups", response_model=GroupOut, status_code=201)
def create_group(
    body: GroupIn, db: Session = Depends(get_db), _a: User = Depends(require_admin)
) -> GroupOut:
    if db.scalar(select(OptionGroup).where(OptionGroup.name == body.name)):
        raise _conflict("An option group with this name already exists.")
    g = OptionGroup(
        name=body.name,
        select_type=body.select_type,
        required=body.required,
        sort_order=body.sort_order,
    )
    db.add(g)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise _conflict("An option group with this name already exists.") from exc
    return GroupOut.model_validate(g)


@router.patch("/option-groups/{group_id}", response_model=GroupOut)
def patch_group(
    group_id: int,
    body: GroupPatch,
    db: Session = Depends(get_db),
    _a: User = Depends(require_admin),
) -> GroupOut:
    g = db.get(OptionGroup, group_id)
    if g is None:
        raise _not_found("Option group not found.")
    if body.name is not None:
        if db.scalar(
            select(OptionGroup).where(
                OptionGroup.name == body.name, OptionGroup.group_id != group_id
            )
        ):
            raise _conflict("An option group with this name already exists.")
        g.name = body.name
    if body.select_type is not None:
        g.select_type = body.select_type
    if body.required is not None:
        g.required = body.required
    if body.sort_order is not None:
        g.sort_order = body.sort_order
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise _conflict("An option group with this name already exists.") from exc
    return GroupOut.model_validate(g)


@router.delete("/option-groups/{group_id}", status_code=204)
def delete_group(
    group_id: int, db: Session = Depends(get_db), _a: User = Depends(require_admin)
) -> None:
    g = db.get(OptionGroup, group_id)
    if g is None:
        raise _not_found("Option group not found.")
    db.delete(g)
    db.flush()


@router.post("/option-groups/{group_id}/options", response_model=OptionOut, status_code=201)
def create_option(
    group_id: int,
    body: OptionIn,
    db: Session = Depends(get_db),
    _a: User = Depends(require_admin),
) -> OptionOut:
    if db.get(OptionGroup, group_id) is None:
        raise _not_found("Option group not found.")
    if db.scalar(
        select(Option).where(Option.group_id == group_id, Option.name == body.name)
    ):
        raise _conflict("An option with this name already exists in this group.")
    o = Option(
        group_id=group_id,
        name=body.name,
        description=body.description,
        price_delta_vnd=body.price_delta_vnd,
        sort_order=body.sort_order,
    )
    db.add(o)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise _conflict("An option with this name already exists in this group.") from exc
    return OptionOut.model_validate(o)


@router.patch("/options/{option_id}", response_model=OptionOut)
def patch_option(
    option_id: int,
    body: OptionPatch,
    db: Session = Depends(get_db),
    _a: User = Depends(require_admin),
) -> OptionOut:
    o = db.get(Option, option_id)
    if o is None:
        raise _not_found("Option not found.")
    if body.name is not None:
        if db.scalar(
            select(Option).where(
                Option.group_id == o.group_id,
                Option.name == body.name,
                Option.option_id != option_id,
            )
        ):
            raise _conflict("An option with this name already exists in this group.")
        o.name = body.name
    if body.description is not None:
        o.description = body.description
    if body.price_delta_vnd is not None:
        o.price_delta_vnd = body.price_delta_vnd
    if body.sort_order is not None:
        o.sort_order = body.sort_order
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise _conflict("An option with this name already exists in this group.") from exc
    return OptionOut.model_validate(o)


@router.delete("/options/{option_id}", status_code=204)
def delete_option(
    option_id: int, db: Session = Depends(get_db), _a: User = Depends(require_admin)
) -> None:
    o = db.get(Option, option_id)
    if o is None:
        raise _not_found("Option not found.")
    db.delete(o)
    db.flush()
```

Add the missing import: `from app.infra.db.deps import get_db`.

- [ ] **Step 5: Register router in `app/main.py`**

Next to the existing admin router includes, add:

```python
from app.api.admin.option_groups import router as admin_option_groups_router
...
app.include_router(admin_option_groups_router)
```

- [ ] **Step 6: Run tests**

Run: `pytest tests/test_admin_option_groups.py -q && ruff check app tests && lint-imports`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/api/admin/option_groups.py app/main.py tests/test_admin_option_groups.py tests/admin_test_utils.py
git commit -m "feat(A8): admin option-groups and options CRUD"
```

---

### Task 4: Admin per-dish enablement — GET/PUT `/api/admin/items/{pid}/options`

**Files:**
- Modify: `Application/backend/app/api/admin/option_groups.py`
- Test: `Application/backend/tests/test_admin_option_groups.py` (append)

- [ ] **Step 1: Write failing tests**

Append to `tests/test_admin_option_groups.py`:

```python
from tests.admin_test_utils import enable_option, new_category, new_product


def test_item_options_view_and_replace():
    c = admin_client("og-item")
    cid = new_category("Pizza")
    pid = new_product(cid, "Margherita")
    gid = new_option_group("Size", select_type="single", required=True)
    m = new_option(gid, "M", price_delta_vnd=30_000)
    l_ = new_option(gid, "L", price_delta_vnd=60_000)
    enable_option(pid, m)

    r = c.get(f"/api/admin/items/{pid}/options")
    assert r.status_code == 200, r.text
    (group,) = r.json()
    assert group["name"] == "Size"
    enabled = {o["option_id"]: o["enabled"] for o in group["options"]}
    assert enabled == {m: True, l_: False}

    r = c.put(f"/api/admin/items/{pid}/options", json={"option_ids": [l_]})
    assert r.status_code == 200
    r = c.get(f"/api/admin/items/{pid}/options")
    enabled = {o["option_id"]: o["enabled"] for o in r.json()[0]["options"]}
    assert enabled == {m: False, l_: True}


def test_item_options_unknown_product_404():
    c = admin_client("og-item-404")
    assert c.get("/api/admin/items/999/options").status_code == 404


def test_item_options_put_unknown_option_404():
    c = admin_client("og-item-badopt")
    cid = new_category("Pizza")
    pid = new_product(cid, "Margherita")
    r = c.put(f"/api/admin/items/{pid}/options", json={"option_ids": [12345]})
    assert r.status_code == 404
```

- [ ] **Step 2: Run to verify failure**

Run: `pytest tests/test_admin_option_groups.py -q`
Expected: new tests FAIL with 404 (routes missing)

- [ ] **Step 3: Implement in `option_groups.py`**

Add `Product` and `ProductOption` to the models import, `delete` to the sqlalchemy import, then:

```python
class ItemOptionOut(BaseModel):
    option_id: int
    name: str
    description: str | None = None
    price_delta_vnd: int
    sort_order: int
    enabled: bool


class ItemOptionGroupOut(BaseModel):
    group_id: int
    name: str
    select_type: Literal["single", "multi"]
    required: bool
    sort_order: int
    options: list[ItemOptionOut]


class ItemOptionsPut(BaseModel):
    option_ids: list[int]


def _require_product(db: Session, product_id: int) -> Product:
    p = db.get(Product, product_id)
    if p is None:
        raise _not_found("Item not found.")
    return p


@router.get("/items/{product_id}/options", response_model=list[ItemOptionGroupOut])
def item_options(
    product_id: int, db: Session = Depends(get_db), _a: User = Depends(require_admin)
) -> list[ItemOptionGroupOut]:
    _require_product(db, product_id)
    enabled_ids = set(
        db.scalars(
            select(ProductOption.option_id).where(ProductOption.product_id == product_id)
        ).all()
    )
    groups = db.scalars(
        select(OptionGroup).order_by(OptionGroup.sort_order, OptionGroup.name)
    ).all()
    out: list[ItemOptionGroupOut] = []
    for g in groups:
        opts = sorted(g.options, key=lambda o: (o.sort_order, o.name))
        out.append(
            ItemOptionGroupOut(
                group_id=g.group_id,
                name=g.name,
                select_type=g.select_type,
                required=g.required,
                sort_order=g.sort_order,
                options=[
                    ItemOptionOut(
                        option_id=o.option_id,
                        name=o.name,
                        description=o.description,
                        price_delta_vnd=o.price_delta_vnd,
                        sort_order=o.sort_order,
                        enabled=o.option_id in enabled_ids,
                    )
                    for o in opts
                ],
            )
        )
    return out


@router.put("/items/{product_id}/options", response_model=list[ItemOptionGroupOut])
def replace_item_options(
    product_id: int,
    body: ItemOptionsPut,
    db: Session = Depends(get_db),
    _a: User = Depends(require_admin),
) -> list[ItemOptionGroupOut]:
    _require_product(db, product_id)
    wanted = list(dict.fromkeys(body.option_ids))
    if wanted:
        known = set(db.scalars(select(Option.option_id).where(Option.option_id.in_(wanted))).all())
        missing = [oid for oid in wanted if oid not in known]
        if missing:
            raise _not_found(f"Unknown option ids: {missing}.")
    db.execute(delete(ProductOption).where(ProductOption.product_id == product_id))
    for oid in wanted:
        db.add(ProductOption(product_id=product_id, option_id=oid))
    db.flush()
    return item_options(product_id, db, _a)
```

(The trailing `item_options(...)` call reuses the GET handler as a plain function — pass the same `db`/`_a` arguments.)

- [ ] **Step 4: Run tests**

Run: `pytest tests/test_admin_option_groups.py -q && ruff check app tests`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/option_groups.py tests/test_admin_option_groups.py
git commit -m "feat(A8): per-dish option enablement endpoints"
```

---

### Task 5: Public menu detail — `option_groups` replaces sizes/crusts/toppings

**Files:**
- Modify: `Application/backend/app/api/menu.py`
- Modify: `Application/backend/tests/test_menu_detail.py` (rewrite option assertions)

- [ ] **Step 1: Rewrite `tests/test_menu_detail.py` option expectations**

Replace size/crust/topping fixtures and assertions with the generic model. The shape to assert:

```python
from tests.admin_test_utils import enable_option, new_category, new_option, new_option_group, new_product
from tests.auth_test_utils import build_test_app
from fastapi.testclient import TestClient


def test_detail_returns_enabled_option_groups():
    app = build_test_app("menu-detail-groups")
    cid = new_category("Pizza")
    pid = new_product(cid, "Margherita", base_price_vnd=125_000, is_pizza=True)
    g_size = new_option_group("Size", select_type="single", required=True, sort_order=1)
    s = new_option(g_size, "S", price_delta_vnd=0, sort_order=1)
    m = new_option(g_size, "M", price_delta_vnd=30_000, sort_order=2)
    g_top = new_option_group("Toppings", select_type="multi", required=False, sort_order=2)
    cheese = new_option(g_top, "Extra Cheese", price_delta_vnd=15_000)
    g_empty = new_option_group("Sauces", select_type="multi", required=False, sort_order=3)
    new_option(g_empty, "BBQ", price_delta_vnd=5_000)  # never enabled for pid
    for oid in (s, m, cheese):
        enable_option(pid, oid)

    r = TestClient(app).get(f"/api/items/{pid}")
    assert r.status_code == 200, r.text
    groups = r.json()["option_groups"]
    assert [g["name"] for g in groups] == ["Size", "Toppings"]  # empty group omitted
    assert groups[0]["select_type"] == "single" and groups[0]["required"] is True
    assert [o["name"] for o in groups[0]["options"]] == ["S", "M"]
    assert groups[0]["options"][1]["price_delta_vnd"] == 30_000
    assert "sizes" not in r.json()


def test_detail_dish_without_options_returns_empty_list():
    app = build_test_app("menu-detail-plain")
    cid = new_category("Sides")
    pid = new_product(cid, "Garlic Bread", base_price_vnd=45_000, is_pizza=False)
    r = TestClient(app).get(f"/api/items/{pid}")
    assert r.status_code == 200
    assert r.json()["option_groups"] == []
```

Keep the existing not-found / inactive-product tests; delete tests asserting `sizes`/`crusts`/`toppings`.

- [ ] **Step 2: Run to verify failure**

Run: `pytest tests/test_menu_detail.py -q`
Expected: FAIL — response lacks `option_groups`

- [ ] **Step 3: Rewrite `app/api/menu.py` detail endpoint**

Replace `MenuSizeOut`/`MenuCrustOut`/`MenuToppingOut` and the `is_pizza` block. New schemas + query (model imports become `Category, Option, OptionGroup, Product, ProductOption`):

```python
class MenuOptionOut(BaseModel):
    option_id: int
    name: str
    description: str | None = None
    price_delta_vnd: int

    model_config = {"from_attributes": True}


class MenuOptionGroupOut(BaseModel):
    group_id: int
    name: str
    select_type: str
    required: bool
    options: list[MenuOptionOut]


class MenuItemDetailOut(BaseModel):
    product_id: int
    category_id: int
    name: str
    base_price_vnd: int
    is_pizza: bool
    image_url: str | None = None
    option_groups: list[MenuOptionGroupOut] = []

    model_config = {"from_attributes": True}
```

Detail handler body after the product lookup:

```python
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
        is_pizza=product.is_pizza,
        image_url=product.image_url,
        option_groups=list(groups.values()),
    )
```

(`dict` preserves insertion order, which follows the ORDER BY — groups stay sorted.)

- [ ] **Step 4: Run tests**

Run: `pytest tests/test_menu_detail.py tests/test_menu.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/menu.py tests/test_menu_detail.py
git commit -m "feat(A8): menu item detail serves generic option groups"
```

---

### Task 6: Cart quote rework — `item|combo`, `option_ids`, dedupe, reason details

**Files:**
- Modify: `Application/backend/app/api/cart.py`
- Modify: `Application/backend/app/domain/pricing.py` (remove `compute_pizza_unit_price`)
- Modify: `Application/backend/tests/test_cart_quote.py` (rewrite)
- Modify: `Application/backend/tests/domain/test_pricing.py` (drop old helper tests)

- [ ] **Step 1: Rewrite `tests/test_cart_quote.py`**

```python
from __future__ import annotations

from fastapi.testclient import TestClient

from tests.admin_test_utils import (
    enable_option,
    new_category,
    new_option,
    new_option_group,
    new_product,
)
from tests.auth_test_utils import build_test_app


def _pizza_fixture(slug: str):
    """Margherita 125k with Size(single,required): S+0/M+30k and
    Toppings(multi): Cheese+15k/Beef+20k — all enabled."""
    app = build_test_app(slug)
    cid = new_category("Pizza")
    pid = new_product(cid, "Margherita", base_price_vnd=125_000, is_pizza=True)
    g_size = new_option_group("Size", select_type="single", required=True, sort_order=1)
    s = new_option(g_size, "S", price_delta_vnd=0, sort_order=1)
    m = new_option(g_size, "M", price_delta_vnd=30_000, sort_order=2)
    g_top = new_option_group("Toppings", select_type="multi", required=False, sort_order=2)
    cheese = new_option(g_top, "Extra Cheese", price_delta_vnd=15_000)
    beef = new_option(g_top, "Beef", price_delta_vnd=20_000)
    for oid in (s, m, cheese, beef):
        enable_option(pid, oid)
    return app, pid, {"s": s, "m": m, "cheese": cheese, "beef": beef}


def _quote(app, lines, **extra):
    return TestClient(app).post("/api/cart/quote", json={"lines": lines, **extra})


def test_quote_item_sums_option_deltas_and_quantity():
    app, pid, o = _pizza_fixture("cart-deltas")
    r = _quote(
        app,
        [{"kind": "item", "item_id": pid, "option_ids": [o["m"], o["cheese"], o["beef"]], "quantity": 2}],
    )
    assert r.status_code == 200, r.text
    assert r.json()["subtotal_vnd"] == 2 * (125_000 + 30_000 + 15_000 + 20_000)


def test_quote_duplicate_option_ids_do_not_double_charge():
    app, pid, o = _pizza_fixture("cart-dedupe")
    r = _quote(
        app,
        [{"kind": "item", "item_id": pid, "option_ids": [o["m"], o["cheese"], o["cheese"]], "quantity": 1}],
    )
    assert r.status_code == 200, r.text
    assert r.json()["subtotal_vnd"] == 125_000 + 30_000 + 15_000


def test_quote_dish_without_options_uses_base_price():
    app = build_test_app("cart-plain")
    cid = new_category("Sides")
    pid = new_product(cid, "Garlic Bread", base_price_vnd=45_000, is_pizza=False)
    r = _quote(app, [{"kind": "item", "item_id": pid, "quantity": 3}])
    assert r.status_code == 200, r.text
    assert r.json()["subtotal_vnd"] == 135_000


def test_quote_non_pizza_with_enabled_options():
    app = build_test_app("cart-side-opts")
    cid = new_category("Sides")
    pid = new_product(cid, "Wings", base_price_vnd=80_000, is_pizza=False)
    g = new_option_group("Sauce", select_type="single", required=False)
    bbq = new_option(g, "BBQ", price_delta_vnd=5_000)
    enable_option(pid, bbq)
    r = _quote(app, [{"kind": "item", "item_id": pid, "option_ids": [bbq], "quantity": 1}])
    assert r.status_code == 200, r.text
    assert r.json()["subtotal_vnd"] == 85_000


def test_quote_option_not_enabled_for_dish_rejected():
    app, pid, o = _pizza_fixture("cart-noten")
    g = new_option_group("Sauces", select_type="multi", required=False)
    stray = new_option(g, "BBQ", price_delta_vnd=5_000)  # exists, not enabled for pid
    r = _quote(app, [{"kind": "item", "item_id": pid, "option_ids": [o["s"], stray], "quantity": 1}])
    assert r.status_code == 400
    body = r.json()["error"]
    assert body["code"] == "VALIDATION_FAILED"
    assert body["details"]["reason"] == "option_not_available"
    assert body["details"]["option_id"] == stray


def test_quote_required_group_missing_rejected():
    app, pid, o = _pizza_fixture("cart-reqmiss")
    r = _quote(app, [{"kind": "item", "item_id": pid, "option_ids": [o["cheese"]], "quantity": 1}])
    assert r.status_code == 400
    body = r.json()["error"]
    assert body["details"]["reason"] == "required_group_missing"
    assert body["details"]["group_name"] == "Size"


def test_quote_two_picks_in_single_group_rejected():
    app, pid, o = _pizza_fixture("cart-conflict")
    r = _quote(app, [{"kind": "item", "item_id": pid, "option_ids": [o["s"], o["m"]], "quantity": 1}])
    assert r.status_code == 400
    assert r.json()["error"]["details"]["reason"] == "single_group_conflict"


def test_quote_combo_still_rejected():
    app, pid, _ = _pizza_fixture("cart-combo")
    r = _quote(app, [{"kind": "combo", "combo_id": 1, "quantity": 1}])
    assert r.status_code == 400


def test_quote_in_area_address_adds_delivery_fee():
    app, pid, o = _pizza_fixture("cart-addr-ok")
    r = _quote(
        app,
        [{"kind": "item", "item_id": pid, "option_ids": [o["s"]], "quantity": 1}],
        address={"administrative_unit": "Ba Đình"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["delivery_fee_vnd"] == 22_000
    assert r.json()["total_vnd"] == 125_000 + 22_000


def test_quote_out_of_area_address_422():
    app, pid, o = _pizza_fixture("cart-addr-bad")
    r = _quote(
        app,
        [{"kind": "item", "item_id": pid, "option_ids": [o["s"]], "quantity": 1}],
        address={"administrative_unit": "Thu Duc"},
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "OUT_OF_SERVICE_AREA"
```

Preserve any loyalty/redeem-points tests from the old file, switching their lines to the new shape (`kind: "item"`, `option_ids`).

- [ ] **Step 2: Run to verify failure**

Run: `pytest tests/test_cart_quote.py -q`
Expected: FAIL (schema/resolver still v1)

- [ ] **Step 3: Rewrite `app/api/cart.py` line schema + resolver**

```python
class QuoteLineIn(BaseModel):
    kind: Literal["item", "combo"]
    item_id: int | None = None
    combo_id: int | None = None
    option_ids: list[int] = Field(default_factory=list)
    quantity: int = Field(ge=1)
```

Replace `_resolve_line` (imports: drop `PizzaCrust, PizzaSize, Topping`; add `Option, OptionGroup, ProductOption`; add `from app.domain.options import SelectableOption, validate_option_selection`; replace `compute_pizza_unit_price` import with `compute_unit_price`):

```python
def _resolve_line(db: Session, line: QuoteLineIn) -> CartLine:
    if line.kind == "combo":
        raise _bad("Combo lines are not supported yet.")
    if line.item_id is None:
        raise _bad("item_id is required.")
    product = db.scalar(
        select(Product).where(Product.product_id == line.item_id, Product.is_active.is_(True))
    )
    if product is None:
        raise _bad("Unknown or inactive product.")

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

    selected = list(dict.fromkeys(line.option_ids))  # dedupe, order-preserving
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

    unit = compute_unit_price(
        base_price_vnd=product.base_price_vnd,
        option_deltas_vnd=[deltas_by_id[oid] for oid in selected],
    )
    return CartLine(unit_price_vnd=unit, quantity=line.quantity)
```

- [ ] **Step 4: Remove `compute_pizza_unit_price`**

Delete it from `app/domain/pricing.py` and its tests from `tests/domain/test_pricing.py` (the `compute_unit_price` tests from Task 1 remain). Grep to confirm no other caller:

Run: `grep -rn "compute_pizza_unit_price" app tests`
Expected: no matches

- [ ] **Step 5: Run backend suite**

Run: `pytest -q`
Expected: PASS except tests that still build fixtures with `new_size`/`new_crust`/`new_topping` outside cart/menu (none should remain — if any fail, they belong to Task 7's removal scope; fix them there only if they reference old options).

- [ ] **Step 6: Commit**

```bash
git add app/api/cart.py app/domain/pricing.py tests/test_cart_quote.py tests/domain/test_pricing.py
git commit -m "feat(A8): cart quote prices generic options (item|combo, option_ids, dedupe)"
```

---

### Task 7: Remove the old model — routers, import route, models, factories

**Files:**
- Delete: `Application/backend/app/api/admin/options.py`
- Modify: `Application/backend/app/api/admin/bulk_import.py` (drop `/toppings` route)
- Modify: `Application/backend/app/main.py` (deregister old router)
- Modify: `Application/backend/app/infra/db/models.py` (drop `PizzaSize`, `PizzaCrust`, `Topping`, `OrderItemTopping`; drop `OrderItem.size_id/crust_id/size/crust/toppings`)
- Modify: `Application/backend/tests/admin_test_utils.py` (drop `new_size/new_crust/new_topping/reference_*`, old imports, `_new_order_item` size/crust params)
- Delete: `Application/backend/tests/test_admin_options.py`
- Modify: `Application/backend/tests/test_bulk_import.py` (drop toppings-import tests)

- [ ] **Step 1: Delete old admin options router + registration**

```bash
git rm app/api/admin/options.py
```

Remove its import/include from `app/main.py`.

- [ ] **Step 2: Drop toppings import**

In `bulk_import.py`: delete the `import_toppings` endpoint and the `Topping` import; update the module docstring to dish-CSV only. In `tests/test_bulk_import.py`: delete tests hitting `/api/admin/import/toppings`.

- [ ] **Step 3: Drop old models and columns**

In `models.py`: remove classes `PizzaSize`, `PizzaCrust`, `Topping`, `OrderItemTopping`; in `OrderItem` remove `size_id`, `crust_id` columns and `size`, `crust`, `toppings` relationships; in `Product` nothing changes.

- [ ] **Step 4: Clean test utils**

In `admin_test_utils.py`: remove `new_size`, `new_crust`, `new_topping`, `reference_size_in_order`, `reference_crust_in_order`, `reference_topping_in_order`; remove `PizzaCrust/PizzaSize/Topping/OrderItemTopping` imports; simplify `_new_order_item` to drop `size_id`/`crust_id` parameters. Delete `tests/test_admin_options.py`:

```bash
git rm tests/test_admin_options.py
```

- [ ] **Step 5: Full backend suite + gates**

Run: `pytest -q && ruff check app tests && ruff format --check app tests && mypy app/domain && lint-imports`
Expected: PASS. If any straggler test still imports removed names, rewrite it to the generic factories (`new_option_group`/`new_option`/`enable_option`).

Run: `grep -rn "PizzaSize\|PizzaCrust\|Topping\b" app tests`
Expected: no matches

- [ ] **Step 6: Commit**

```bash
git add -A app tests
git commit -m "feat(A8): remove fixed sizes/crusts/toppings model, routers, and toppings import"
```

---

### Task 8: Seeds rewrite

**Files:**
- Modify: `Application/backend/app/seeds/run.py`
- Modify: `Application/backend/tests/test_seeds.py` (assertions over new tables)

- [ ] **Step 1: Replace size/crust/topping seeding**

Remove `_upsert_size/_upsert_crust/_upsert_topping` helpers and their call sites. Add:

```python
def _upsert_option_group(
    db, name: str, *, select_type: str, required: bool, sort_order: int
) -> OptionGroup:
    g = db.scalar(select(OptionGroup).where(OptionGroup.name == name))
    if g is None:
        g = OptionGroup(name=name, select_type=select_type, required=required, sort_order=sort_order)
        db.add(g)
        db.flush()
    else:
        g.select_type, g.required, g.sort_order = select_type, required, sort_order
    return g


def _upsert_option(
    db, group: OptionGroup, name: str, *, delta: int, sort_order: int = 0
) -> Option:
    o = db.scalar(select(Option).where(Option.group_id == group.group_id, Option.name == name))
    if o is None:
        o = Option(group_id=group.group_id, name=name, price_delta_vnd=delta, sort_order=sort_order)
        db.add(o)
        db.flush()
    else:
        o.price_delta_vnd, o.sort_order = delta, sort_order
    return o


def _enable_for(db, product_ids: list[int], option: Option) -> None:
    for pid in product_ids:
        if not db.get(ProductOption, (pid, option.option_id)):
            db.add(ProductOption(product_id=pid, option_id=option.option_id))
```

Seed data block (same values as the old fixed tables; replaces the Sizes/Crusts/Toppings sections — place it **after** the pizzas are upserted so `pizza_ids` exists):

```python
    # ── Option groups (A8) ─────────────────────────────────────────
    pizza_ids = [p.product_id for p in pizza_products]
    g_size = _upsert_option_group(db, "Size", select_type="single", required=True, sort_order=1)
    g_crust = _upsert_option_group(db, "Crust", select_type="single", required=True, sort_order=2)
    g_top = _upsert_option_group(db, "Toppings", select_type="multi", required=False, sort_order=3)

    for i, (name, delta) in enumerate([("S", 0), ("M", 30_000), ("L", 60_000)], start=1):
        _enable_for(db, pizza_ids, _upsert_option(db, g_size, name, delta=delta, sort_order=i))
    for i, name in enumerate(["thin", "cheese-stuffed"], start=1):
        _enable_for(db, pizza_ids, _upsert_option(db, g_crust, name, delta=0, sort_order=i))
    toppings = [
        ("Extra Cheese", 15_000), ("Mushroom", 12_000), ("Jalapeño", 10_000),
        ("Bell Pepper", 10_000), ("Chicken", 18_000), ("Beef", 20_000),
        ("Olives", 12_000), ("Onion", 8_000), ("Pineapple", 10_000), ("Shrimp", 22_000),
    ]
    for i, (name, delta) in enumerate(toppings, start=1):
        _enable_for(db, pizza_ids, _upsert_option(db, g_top, name, delta=delta, sort_order=i))
```

Update model imports accordingly. While here: the existing `print("seeds: done")` at the end of `run.py` violates the no-print rule — replace with the module's structlog logger if one exists, otherwise leave untouched (unrelated-issue rule) and note it in `progress.md`.

- [ ] **Step 2: Update `tests/test_seeds.py`**

Replace assertions counting sizes/crusts/toppings with: 3 option groups exist by name, 15 options total, every seeded pizza has all 15 enabled, re-run is idempotent (counts unchanged after second `run()`).

- [ ] **Step 3: Run**

Run: `pytest tests/test_seeds.py -q`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/seeds/run.py tests/test_seeds.py
git commit -m "feat(A8): seed generic option groups and per-pizza enablement"
```

---

### Task 9: Migration `0005_generic_options` + schema.dbml

**Files:**
- Create: `Application/backend/app/infra/db/migrations/versions/0005_generic_options.py`
- Modify: `Application/schema.dbml`

- [ ] **Step 1: Write the migration**

`alembic revision -m "generic options"` then fill (revision ids: set `down_revision` to `0004`'s revision id — read it from `versions/0004_option_name_unique.py`):

```python
"""A8 – generic options: option_groups/options/product_options/order_item_options.

Clean cut: creates the generic tables, migrates fixed sizes/crusts/toppings data
and order history into them, then drops the old structures. Downgrade recreates
the old tables empty (lossy) — acceptable for the single-node MVP.
"""

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"  # ← replace with the actual id from 0004_option_name_unique.py
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "option_groups",
        sa.Column("group_id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column(
            "select_type",
            sa.Enum("single", "multi", name="option_select_type"),
            nullable=False,
            server_default="multi",
        ),
        sa.Column("required", sa.Boolean, nullable=False, server_default="0"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
    )
    op.create_table(
        "options",
        sa.Column("option_id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "group_id",
            sa.Integer,
            sa.ForeignKey("option_groups.group_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.String(255), nullable=True),
        sa.Column("price_delta_vnd", sa.Integer, nullable=False, server_default="0"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.UniqueConstraint("group_id", "name", name="uq_options_group_name"),
    )
    op.create_table(
        "product_options",
        sa.Column(
            "product_id",
            sa.Integer,
            sa.ForeignKey("products.product_id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "option_id",
            sa.Integer,
            sa.ForeignKey("options.option_id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )
    op.create_table(
        "order_item_options",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "order_item_id",
            sa.Integer,
            sa.ForeignKey("order_items.order_item_id"),
            nullable=False,
        ),
        sa.Column("group_name", sa.String(100), nullable=False),
        sa.Column("option_name", sa.String(100), nullable=False),
        sa.Column("price_delta_vnd", sa.Integer, nullable=False),
    )
    op.create_index(
        "ix_order_item_options_order_item_id", "order_item_options", ["order_item_id"]
    )

    conn = op.get_bind()

    # Groups: fixed ids so option transforms can reference them.
    conn.execute(
        sa.text(
            "INSERT INTO option_groups (name, select_type, required, sort_order) VALUES "
            "('Size','single',1,1), ('Crust','single',1,2), ('Toppings','multi',0,3)"
        )
    )
    gid = {
        name: conn.execute(
            sa.text("SELECT group_id FROM option_groups WHERE name = :n"), {"n": name}
        ).scalar_one()
        for name in ("Size", "Crust", "Toppings")
    }

    # Options from the fixed tables (preserve deltas; crusts delta 0).
    conn.execute(
        sa.text(
            "INSERT INTO options (group_id, name, price_delta_vnd, sort_order) "
            "SELECT :g, name, price_modifier_vnd, size_id FROM pizza_sizes"
        ),
        {"g": gid["Size"]},
    )
    conn.execute(
        sa.text(
            "INSERT INTO options (group_id, name, price_delta_vnd, sort_order) "
            "SELECT :g, name, 0, crust_id FROM pizza_crusts"
        ),
        {"g": gid["Crust"]},
    )
    conn.execute(
        sa.text(
            "INSERT INTO options (group_id, name, price_delta_vnd, sort_order) "
            "SELECT :g, name, price_vnd, topping_id FROM toppings"
        ),
        {"g": gid["Toppings"]},
    )

    # Enable every migrated option for every pizza (old model was global-for-pizzas).
    conn.execute(
        sa.text(
            "INSERT INTO product_options (product_id, option_id) "
            "SELECT p.product_id, o.option_id FROM products p CROSS JOIN options o "
            "WHERE p.is_pizza = 1"
        )
    )

    # Order-history snapshots, in stable group order: Size, Crust, Toppings.
    conn.execute(
        sa.text(
            "INSERT INTO order_item_options (order_item_id, group_name, option_name, price_delta_vnd) "
            "SELECT oi.order_item_id, 'Size', ps.name, ps.price_modifier_vnd "
            "FROM order_items oi JOIN pizza_sizes ps ON ps.size_id = oi.size_id"
        )
    )
    conn.execute(
        sa.text(
            "INSERT INTO order_item_options (order_item_id, group_name, option_name, price_delta_vnd) "
            "SELECT oi.order_item_id, 'Crust', pc.name, 0 "
            "FROM order_items oi JOIN pizza_crusts pc ON pc.crust_id = oi.crust_id"
        )
    )
    conn.execute(
        sa.text(
            "INSERT INTO order_item_options (order_item_id, group_name, option_name, price_delta_vnd) "
            "SELECT oit.order_item_id, 'Toppings', t.name, oit.price_at_time_vnd "
            "FROM order_item_toppings oit JOIN toppings t ON t.topping_id = oit.topping_id "
            "ORDER BY oit.order_item_id, oit.id"
        )
    )

    # Drop old structures (FK constraint names come from MySQL's auto-naming —
    # discover with the inspector to stay robust).
    insp = sa.inspect(conn)
    for fk in insp.get_foreign_keys("order_items"):
        if fk["referred_table"] in ("pizza_sizes", "pizza_crusts"):
            op.drop_constraint(fk["name"], "order_items", type_="foreignkey")
    op.drop_column("order_items", "size_id")
    op.drop_column("order_items", "crust_id")
    op.drop_table("order_item_toppings")
    op.drop_table("toppings")
    op.drop_table("pizza_crusts")
    op.drop_table("pizza_sizes")


def downgrade() -> None:
    # Lossy: recreates the old structures empty. Forward-only deployment.
    op.create_table(
        "pizza_sizes",
        sa.Column("size_id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(10), nullable=False, unique=True),
        sa.Column("price_modifier_vnd", sa.Integer, nullable=False, server_default="0"),
    )
    op.create_table(
        "pizza_crusts",
        sa.Column("crust_id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(50), nullable=False, unique=True),
    )
    op.create_table(
        "toppings",
        sa.Column("topping_id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("price_vnd", sa.Integer, nullable=False),
    )
    op.create_table(
        "order_item_toppings",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "order_item_id", sa.Integer, sa.ForeignKey("order_items.order_item_id"), nullable=False
        ),
        sa.Column("topping_id", sa.Integer, sa.ForeignKey("toppings.topping_id"), nullable=False),
        sa.Column("quantity", sa.Integer, nullable=False, server_default="1"),
        sa.Column("price_at_time_vnd", sa.Integer, nullable=False),
    )
    op.add_column(
        "order_items",
        sa.Column("size_id", sa.Integer, sa.ForeignKey("pizza_sizes.size_id"), nullable=True),
    )
    op.add_column(
        "order_items",
        sa.Column("crust_id", sa.Integer, sa.ForeignKey("pizza_crusts.crust_id"), nullable=True),
    )
    op.drop_table("order_item_options")
    op.drop_table("product_options")
    op.drop_table("options")
    op.drop_table("option_groups")
```

- [ ] **Step 2: Verify the migration against seeded MySQL with order history**

The backend test suite never runs migrations (SQLite via `create_all`), so verify by hand against the compose MySQL. From `Application/backend` (venv, `DATABASE_URL` pointing at `127.0.0.1:33306` as init.sh does):

```bash
git stash  # park A8 code
git checkout origin/main -- .  # old models+seeds at 0004
alembic downgrade base && alembic upgrade <0004-revision-id> && python -m app.seeds.run
# (<0004-revision-id> = the `revision =` value inside versions/0004_option_name_unique.py)
# create one historical order row exercising size/crust/topping FKs:
python - <<'EOF'
from datetime import datetime
from sqlalchemy import select
from app.infra.db.session import create_session_factory
from app.infra.db.models import Order, OrderItem, OrderItemTopping, PizzaSize, PizzaCrust, Topping, Product
with create_session_factory()() as db:
    size = db.scalars(select(PizzaSize)).first(); crust = db.scalars(select(PizzaCrust)).first()
    top = db.scalars(select(Topping)).first(); prod = db.scalars(select(Product).where(Product.is_pizza)).first()
    o = Order(order_code="PIZZ-MIGTST", recipient_name="t", recipient_phone="0", delivery_address="a",
              total_amount_vnd=1, promised_at=datetime(2026, 1, 1))
    db.add(o); db.flush()
    oi = OrderItem(order_id=o.order_id, product_id=prod.product_id, size_id=size.size_id,
                   crust_id=crust.crust_id, quantity=1, unit_price_vnd=1)
    db.add(oi); db.flush()
    db.add(OrderItemTopping(order_item_id=oi.order_item_id, topping_id=top.topping_id,
                            quantity=1, price_at_time_vnd=top.price_vnd))
    db.commit()
EOF
git checkout -- . && git stash pop   # restore A8 code
alembic upgrade head
```

Then assert the backfill:

```bash
docker compose exec mysql mysql -upizza -ppizza pizzahust -e "
  SELECT group_name, option_name, price_delta_vnd FROM order_item_options ORDER BY id;
  SELECT COUNT(*) AS groups FROM option_groups;
  SELECT COUNT(*) AS enabled FROM product_options;"
```

Expected: 3 snapshot rows for the test order (Size, Crust, Toppings in that order, deltas preserved); 3 groups; `enabled` = 15 × number of pizzas. Then re-seed the new world: `python -m app.seeds.run`.

- [ ] **Step 3: Update `Application/schema.dbml`**

Replace the `pizza_sizes`/`pizza_crusts`/`toppings`/`order_item_toppings` table blocks and the `order_items.size_id/crust_id` columns with the four new tables mirroring Step 1's DDL.

- [ ] **Step 4: Alembic check**

Run: `alembic upgrade head && alembic check`
Expected: no new operations detected (models ↔ migration parity)

- [ ] **Step 5: Commit**

```bash
git add app/infra/db/migrations/versions/0005_generic_options.py ../schema.dbml
git commit -m "feat(A8): clean-cut migration to generic options with history backfill"
```

---

### Task 10: Contract surfaces — OpenAPI, types.ts, CONTRACTS.md

**Files:**
- Modify: `Application/openapi.json` (generated)
- Modify: `Application/frontend/lib/api/types.ts` (generated)
- Modify: `Application/CONTRACTS.md`

- [ ] **Step 1: Regenerate**

From `Application/backend` (venv): `python -m app.tools.dump_openapi > ../openapi.json`
From `Application/frontend`: `npm run gen:types`

- [ ] **Step 2: Rewrite CONTRACTS.md sections**

- **Catalog (U2):** item detail now returns `option_groups[]` — include the JSON example from the spec (Size single/required with `price_delta_vnd`).
- **Cart (U3):** line shape `{kind: "item"|"combo", item_id, option_ids, quantity}`; document dedupe and the `VALIDATION_FAILED` `details.reason` values `option_not_available` / `required_group_missing` / `single_group_conflict` with an example error body.
- **Admin (A2):** replace the sizes/crusts/toppings route rows with the option-groups/options/item-options rows and payload fields (`select_type`, `required`, `sort_order`, `price_delta_vnd`, `description`); note group delete cascades and that there are no order-history guards (snapshots).
- **Bulk import:** remove the `/api/admin/import/toppings` row and its mention in the import notes (dish CSV only).

- [ ] **Step 3: Frontend gates (types must still compile)**

From `Application/frontend`: `npx tsc --noEmit`
Expected: FAILS in `app/menu/[id]/page.tsx`, selectors, `app/admin/pizza-options/page.tsx` (they consume removed schema names). That is Task 11/12's work — **do not commit yet**; proceed to Task 11 and commit contracts together with the frontend rework, or commit now only if tsc passes. Preferred: commit `openapi.json` + CONTRACTS.md now (backend truth), keep types.ts in the working tree, and let Task 11 land the compile fix:

```bash
git add ../openapi.json ../CONTRACTS.md lib/api/types.ts
git commit -m "chore(A8): regenerate contracts for generic options"
```

(One red-tsc commit window is acceptable; `verify.sh` runs at the end of the branch, not per-commit.)

---

### Task 11: Frontend — `composeLineText`, options API surface, customizer rework

**Files:**
- Create: `Application/frontend/lib/compose-line-text.ts`
- Create: `Application/frontend/lib/compose-line-text.test.ts`
- Create: `Application/frontend/components/menu/option-group-selector.tsx`
- Delete: `Application/frontend/components/menu/size-selector.tsx`, `crust-selector.tsx`, `topping-selector.tsx`
- Modify: `Application/frontend/app/menu/[id]/page.tsx`
- Modify: `Application/frontend/tests/e2e/item-detail.spec.ts`

- [ ] **Step 1: Failing Vitest for `composeLineText`**

`lib/compose-line-text.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { composeLineText } from "./compose-line-text";

describe("composeLineText", () => {
  it("returns the bare name with no selections", () => {
    expect(composeLineText("Margherita Classic", [])).toBe("Margherita Classic");
  });

  it("puts the first selection in parens and joins the rest with middots", () => {
    expect(
      composeLineText("Margherita Classic", [
        { groupName: "Size", optionName: "M" },
        { groupName: "Crust", optionName: "Regular crust" },
        { groupName: "Toppings", optionName: "Extra Cheese" },
      ]),
    ).toBe("Margherita Classic (M) · Regular crust · Extra Cheese");
  });

  it("single selection only gets parens", () => {
    expect(composeLineText("Wings", [{ groupName: "Sauce", optionName: "BBQ" }])).toBe(
      "Wings (BBQ)",
    );
  });
});
```

Run: `npx vitest run lib/compose-line-text.test.ts` — Expected: FAIL (module missing)

- [ ] **Step 2: Implement `lib/compose-line-text.ts`**

```typescript
// Composes the cart/kitchen line text from a dish name and its selected options,
// e.g. "Margherita Classic (M) · Regular crust · Extra Cheese" (DESIGN_BRIEF §4).
// Selections must already be in display order (group sort, then option sort).

export type LineSelection = { groupName: string; optionName: string };

export function composeLineText(name: string, selections: LineSelection[]): string {
  if (selections.length === 0) return name;
  const [first, ...rest] = selections;
  const head = `${name} (${first.optionName})`;
  return rest.length === 0 ? head : `${head} · ${rest.map((s) => s.optionName).join(" · ")}`;
}
```

Run: `npx vitest run lib/compose-line-text.test.ts` — Expected: PASS

- [ ] **Step 3: `OptionGroupSelector` component**

`components/menu/option-group-selector.tsx` (replaces all three selectors; chip styling copied from the old `SizeSelector`):

```typescript
import { formatVnd } from "@/lib/format";
import type { MenuItemDetail } from "@/lib/api/menu";

type Group = MenuItemDetail["option_groups"][number];

type Props = {
  group: Group;
  selectedIds: number[];
  onChange: (ids: number[]) => void;
};

export function OptionGroupSelector({ group, selectedIds, onChange }: Props) {
  const single = group.select_type === "single";

  function toggle(optionId: number) {
    if (single) {
      onChange([optionId]);
      return;
    }
    onChange(
      selectedIds.includes(optionId)
        ? selectedIds.filter((x) => x !== optionId)
        : [...selectedIds, optionId],
    );
  }

  return (
    <div
      role={single ? "radiogroup" : "group"}
      aria-label={group.name}
      className="flex flex-wrap gap-2"
    >
      {group.options.map((o) => {
        const selected = selectedIds.includes(o.option_id);
        return (
          <button
            key={o.option_id}
            type="button"
            role={single ? "radio" : "checkbox"}
            aria-checked={selected}
            onClick={() => toggle(o.option_id)}
            className={`inline-flex h-11 items-center rounded-full px-4 text-sm font-medium transition-colors ${
              selected
                ? "bg-brand text-on-brand"
                : "bg-surface-active text-fg hover:bg-surface-hover"
            }`}
          >
            {o.name}
            {o.price_delta_vnd > 0 ? ` +${formatVnd(o.price_delta_vnd)}` : ""}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Rework `app/menu/[id]/page.tsx`**

Replace selector imports with `OptionGroupSelector`; replace `sizeId/crustId/toppingIds` state with:

```typescript
const [selections, setSelections] = useState<Record<number, number[]>>({});
```

On load (replaces the `setSizeId/setCrustId/setToppingIds` block) — preselect first option of required single groups:

```typescript
const initial: Record<number, number[]> = {};
for (const g of data.option_groups) {
  initial[g.group_id] =
    g.select_type === "single" && g.required && g.options.length > 0
      ? [g.options[0].option_id]
      : [];
}
setSelections(initial);
```

The "has customizer" gate switches from `item.is_pizza` to `item.option_groups.length > 0` (estimate shows whenever the dish has groups; dishes without groups keep the static base price line). Quote effect:

```typescript
quoteCart({
  redeem_points: 0,
  lines: [
    {
      kind: "item",
      item_id: item.product_id,
      option_ids: Object.values(selections).flat(),
      quantity,
    },
  ],
})
```

Render (replaces the three labeled sections):

```tsx
{item.option_groups.map((g) => (
  <div key={g.group_id} className="space-y-2">
    <h2 className="text-sm font-semibold text-muted">
      {g.name}
      {g.select_type === "multi" ? " (Optional)" : ""}
    </h2>
    <OptionGroupSelector
      group={g}
      selectedIds={selections[g.group_id] ?? []}
      onChange={(ids) => setSelections((prev) => ({ ...prev, [g.group_id]: ids }))}
    />
  </div>
))}
```

Delete the three old selector files:

```bash
git rm components/menu/size-selector.tsx components/menu/crust-selector.tsx components/menu/topping-selector.tsx
```

- [ ] **Step 5: Rewrite `tests/e2e/item-detail.spec.ts`**

Same scenarios against seeded data (groups: Size single/required S-M-L, Crust single/required, Toppings multi):

```typescript
import { expect, test } from "@playwright/test";

test.describe("U2/U3 — item detail with generic options", () => {
  test("pizza: option chips drive the server-quoted estimate", async ({ page }) => {
    await page.goto("/menu");
    await page.getByRole("link", { name: /Margherita Classic/ }).click();

    await expect(page.getByRole("heading", { name: "Margherita Classic" })).toBeVisible();
    await expect(page.getByText("Size")).toBeVisible();
    await expect(page.getByText(/Toppings/)).toBeVisible();

    const estimate = page.getByTestId("line-estimate");
    const base = await estimate.textContent();

    const sizeL = page.getByRole("radio", { name: /^L/ });
    await sizeL.click();
    await expect(sizeL).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("radio", { name: /^S/ })).toHaveAttribute("aria-checked", "false");
    await expect(estimate).not.toHaveText(base ?? "");

    const afterSize = await estimate.textContent();
    await page.getByRole("checkbox", { name: /Extra Cheese/ }).click();
    await expect(estimate).not.toHaveText(afterSize ?? "");

    await expect(page.getByRole("button", { name: "Decrease quantity" })).toBeDisabled();
    const afterTopping = await estimate.textContent();
    await page.getByRole("button", { name: "Increase quantity" }).click();
    await expect(estimate).not.toHaveText(afterTopping ?? "");
  });

  test("dish without options: static price, no estimate", async ({ page }) => {
    await page.goto("/menu");
    await page.getByRole("link", { name: /Truffle Fries/ }).click();
    await expect(page.getByRole("heading", { name: "Truffle Fries" })).toBeVisible();
    await expect(page.getByRole("radiogroup")).toHaveCount(0);
    await expect(page.getByTestId("line-estimate")).toHaveCount(0);
  });

  test("unknown id shows not-found", async ({ page }) => {
    await page.goto("/menu/99999999");
    await expect(page.getByText("Item not found.")).toBeVisible();
  });
});
```

- [ ] **Step 6: Frontend gates**

Run from `Application/frontend`: `npx tsc --noEmit && npx eslint . && npx vitest run`
Expected: PASS except anything touching `app/admin/pizza-options` (removed in Task 12 — if tsc still fails only there, fold its deletion forward: do Task 12 Step 1 now).

- [ ] **Step 7: Commit**

```bash
git add -A ../frontend ../openapi.json ../CONTRACTS.md
git commit -m "feat(A8): generic option customizer and line-text composition"
```

---

### Task 12: Frontend — admin dish editor (full fidelity), kill pizza-options page

**Files:**
- Create: `Application/frontend/lib/api/admin-options.ts`
- Create: `Application/frontend/components/admin/options-editor.tsx`
- Create: `Application/frontend/app/admin/items/[id]/page.tsx`
- Modify: `Application/frontend/app/admin/items/page.tsx` (link each row to the editor)
- Modify: `Application/frontend/app/admin/layout.tsx` (drop Pizza Options nav entry)
- Delete: `Application/frontend/app/admin/pizza-options/page.tsx`

- [ ] **Step 1: Remove the standalone page + nav entry**

```bash
git rm -r app/admin/pizza-options
```

In `app/admin/layout.tsx` delete the line `{ href: "/admin/pizza-options", label: "Pizza Options" },`.

- [ ] **Step 2: API surface `lib/api/admin-options.ts`**

```typescript
import { apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

export type AdminGroup = components["schemas"]["GroupOut"];
export type AdminItemOptionGroup = components["schemas"]["ItemOptionGroupOut"];

export const listItemOptions = (productId: number) =>
  apiFetch<AdminItemOptionGroup[]>(`/admin/items/${productId}/options`);

export const replaceItemOptions = (productId: number, optionIds: number[]) =>
  apiFetch<AdminItemOptionGroup[]>(`/admin/items/${productId}/options`, {
    method: "PUT",
    body: JSON.stringify({ option_ids: optionIds }),
  });

export const createGroup = (body: components["schemas"]["GroupIn"]) =>
  apiFetch<AdminGroup>("/admin/option-groups", { method: "POST", body: JSON.stringify(body) });

export const patchGroup = (id: number, body: components["schemas"]["GroupPatch"]) =>
  apiFetch<AdminGroup>(`/admin/option-groups/${id}`, { method: "PATCH", body: JSON.stringify(body) });

export const deleteGroup = (id: number) =>
  apiFetch<void>(`/admin/option-groups/${id}`, { method: "DELETE" });

export const createOption = (groupId: number, body: components["schemas"]["OptionIn"]) =>
  apiFetch<components["schemas"]["OptionOut"]>(`/admin/option-groups/${groupId}/options`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const patchOption = (id: number, body: components["schemas"]["OptionPatch"]) =>
  apiFetch<components["schemas"]["OptionOut"]>(`/admin/options/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const deleteOption = (id: number) =>
  apiFetch<void>(`/admin/options/${id}`, { method: "DELETE" });
```

- [ ] **Step 3: `components/admin/options-editor.tsx`**

One client component owning the whole Options section of the dish editor. Behavior contract (full fidelity to `Design/admin-item-edit.html`):

- Loads `listItemOptions(productId)` into state; every mutation refreshes from the server.
- Category card per group: inline-editable name (text input committing `patchGroup` on blur/Enter), `single|multi` segmented control + `Required` checkbox (both `patchGroup`), delete button (confirm-then-`deleteGroup`, same confirm pattern as the old pizza-options page), "+ Add Category" footer button (`createGroup` with `{name, select_type: "multi", required: false}` from a small inline form).
- Option row per option: name + description + delta inputs committing `patchOption` on blur; a per-dish **enable toggle** (`role="switch"`) that recomputes the full enabled id set and calls `replaceItemOptions`; disabled rows get `opacity-50`; delete via `deleteOption`. "+ Add option" inline form per card → `createOption` + `replaceItemOptions` to enable it for this dish immediately.
- Edits to shared fields (name/desc/delta) show a persistent hint under the card: *"Shared across all dishes — price and name changes apply everywhere."*
- "How it appears in cart & kitchen" preview panel above the cards:

```typescript
const previewSelections = groups.flatMap((g) => {
  const first = g.options.find((o) => o.enabled);
  return first ? [{ groupName: g.name, optionName: first.name }] : [];
});
// rendered as: <p className="text-sm text-muted">{composeLineText(itemName, previewSelections)}</p>
```

Reuse the input/button/error classes from `app/admin/pizza-options/page.tsx` (copy before deleting it) and `Breadcrumb`. Keep this file under 300 lines; if the option-row form pushes it over, extract `components/admin/option-row.tsx`.

- [ ] **Step 4: Editor page `app/admin/items/[id]/page.tsx`**

Client page: loads the item via `apiFetch<AdminItemOut>(\`/admin/items/${id}\`)` (reuse the schema name from types.ts — check `components["schemas"]` for the admin item shape used by `app/admin/items/page.tsx`), renders `Breadcrumb` (Admin → Menu Items → {name}), the item's existing basics form pattern (name, price, category, active — same fields the items list page edits), then `<OptionsEditor productId={...} itemName={...} />`. Follow the structure of `app/admin/items/page.tsx` for the basics form.

- [ ] **Step 5: Link rows from the items list**

In `app/admin/items/page.tsx`, wrap each row's name cell in `<Link href={\`/admin/items/${item.product_id}\`} className="text-brand hover:underline">` (import `next/link`).

- [ ] **Step 6: Gates**

Run: `npx tsc --noEmit && npx eslint . && npm run build`
Expected: PASS, build lists `/admin/items/[id]`, no `/admin/pizza-options`

- [ ] **Step 7: Commit**

```bash
git add -A .
git commit -m "feat(A8): admin dish editor with option categories; remove pizza-options page"
```

---

### Task 13: E2E — admin editor spec + happy-path touch-up

**Files:**
- Create: `Application/frontend/tests/e2e/admin-item-editor.spec.ts`
- Modify: `Application/frontend/tests/e2e/happy-path.spec.ts` (customization step only, if it references Select Size/toppings labels)

- [ ] **Step 1: Write `admin-item-editor.spec.ts`**

Mirror the `loginAsAdmin` helper from `tests/e2e/admin-customers.spec.ts` (copy the constants + function verbatim):

```typescript
import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const API_URL = process.env.E2E_API_URL ?? "http://localhost:8000";
const ADMIN_PHONE = process.env.E2E_ADMIN_PHONE ?? "0900000001";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "admin123";

async function loginAsAdmin(page: Page) {
  const res = await page.request.post(`${API_URL}/api/auth/login`, {
    data: { phone_number: ADMIN_PHONE, password: ADMIN_PASSWORD },
  });
  expect(res.ok(), "admin seed login should succeed against a seeded stack").toBeTruthy();
}

test.describe("A8 – Admin dish editor options", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("editor shows seeded categories with enable toggles and preview", async ({ page }) => {
    await page.goto(`${BASE}/admin/items`);
    await page.getByRole("link", { name: /Margherita Classic/ }).click();
    await expect(page.getByText("Size")).toBeVisible();
    await expect(page.getByText("Toppings")).toBeVisible();
    await expect(page.getByText(/How it appears in cart & kitchen/i)).toBeVisible();
    // Seeded: every option enabled → preview composes name + first options.
    await expect(page.getByText(/Margherita Classic \(S\)/)).toBeVisible();
  });

  test("toggling an option off hides it from the customer customizer", async ({ page }) => {
    await page.goto(`${BASE}/admin/items`);
    await page.getByRole("link", { name: /Margherita Classic/ }).click();
    const shrimp = page.getByRole("switch", { name: /Shrimp/ });
    await shrimp.click();
    await expect(shrimp).toHaveAttribute("aria-checked", "false");

    await page.goto(`${BASE}/menu`);
    await page.getByRole("link", { name: /Margherita Classic/ }).click();
    await expect(page.getByRole("checkbox", { name: /Shrimp/ })).toHaveCount(0);
    // restore for idempotent re-runs
    await page.goto(`${BASE}/admin/items`);
    await page.getByRole("link", { name: /Margherita Classic/ }).click();
    await page.getByRole("switch", { name: /Shrimp/ }).click();
  });

  test("adding a category appears in the editor", async ({ page }) => {
    await page.goto(`${BASE}/admin/items`);
    await page.getByRole("link", { name: /Margherita Classic/ }).click();
    await page.getByRole("button", { name: /add category/i }).click();
    await page.getByLabel(/category name/i).fill(`Sauces-${Date.now()}`);
    await page.getByRole("button", { name: /^create$/i }).click();
    await expect(page.getByText(/Sauces-/)).toBeVisible();
  });
});
```

(Adjust selectors to the implemented markup if they drift — the roles above are the contract: `switch` for enablement, `radio`/`checkbox` chips on the customer side.)

- [ ] **Step 2: Update `happy-path.spec.ts`**

Its steps 05+ are skipped (U6+ unbuilt). If step 02/03 assert "Select Size"/topping labels, update to the new group headings ("Size", "Toppings"). No structural change.

- [ ] **Step 3: Run e2e against a freshly seeded stack**

From `Application`: `./init.sh && docker compose up -d --build backend frontend`
From `Application/frontend`: `npx playwright test`
Expected: all pass / pre-existing skips only

- [ ] **Step 4: Commit**

```bash
git add tests/e2e
git commit -m "test(A8): admin dish-editor e2e and customizer spec updates"
```

---

### Task 14: Full gate + feature bookkeeping

**Files:**
- Modify: `Application/feature_list.json` (A8 → done + evidence)
- Modify: `Application/progress.md` (append session block)
- Modify: `Application/session-handoff.md` (rewrite for A10 next)

- [ ] **Step 1: Run the full gate**

From `Application`: `./verify.sh`
Expected: `=== VERIFY OK ===`, exit 0. Fix anything red before proceeding (contract drift → re-run Task 10 Step 1; never hand-edit generated files).

- [ ] **Step 2: Record evidence**

In `feature_list.json` set A8 `status: "done"`, `evidence: "verify.sh green at <sha>, <iso-timestamp>"` (use `git rev-parse --short HEAD` after the final code commit, timestamp from `date -Iseconds`).

- [ ] **Step 3: progress.md + session-handoff.md**

Append a dated block to `progress.md` (what shipped, follow-ups: seeds `print` if left, anything deferred). Rewrite `session-handoff.md`: A8 done on `a8-generic-options`, next = **A10** (combo choice-slots; `depends_on` A4+A8 now satisfied), resume command unchanged, note that U15 consumes the new option chips.

- [ ] **Step 4: Commit + (on request) PR**

```bash
git add ../feature_list.json ../progress.md ../session-handoff.md
git commit -m "chore(A8): record completion evidence and handoff to A10"
```

PR only when the user asks: base `main`, title `feat(A8): generic options model (admin-defined groups, per-dish enablement)`.

---

## Self-review notes

- **Spec coverage:** schema+migration (T2, T9) · domain (T1, T6) · public API (T5) · cart (T6) · admin API (T3, T4) · toppings-import removal (T7) · seeds (T8) · contracts (T10) · customizer (T11) · admin editor + preview + page removal (T12) · e2e (T13) · gate/bookkeeping (T14). Snapshot **writing** into `order_item_options` has no runtime producer yet — order placement is U6; the migration backfill (T9) is the only writer today, by design.
- **Green-per-commit exception:** Task 10 leaves `types.ts` regenerated before the frontend consumes it; tsc is red between T10 and T11 commits. Flagged inline.
- **Type consistency check:** `SelectableOption`/`OptionSelectionError` (T1) match T6 usage; `GroupOut/GroupIn/GroupPatch/OptionOut/OptionIn/OptionPatch/ItemOptionGroupOut` (T3/T4) match T12's `components["schemas"]` references; `composeLineText(name, {groupName, optionName}[])` (T11) matches T12 preview usage.
