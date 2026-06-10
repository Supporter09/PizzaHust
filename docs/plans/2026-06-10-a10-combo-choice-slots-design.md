# A10 — Combo Choice-Slots and Component Picker (Design)

**Status:** approved design, pre-implementation
**Branch:** `a10-combo-choice-slots` (from `main` @ `fe8af93`, A8 merged)
**Depends on:** A4 (combos, done), A8 (generic options, done)
**Unblocks:** U15 (Customize Combo — customer UI only after this lands)

## Goal

Combos gain **choice slots**: components a customer resolves at order time
("any 2 pizzas", "any 4 drinks") alongside fixed products. Admin builds them
with a component picker; the cart quote prices resolved combos server-side.

A10 delivers the **full backend plus admin UI**. U15 is the customer
customizer page only and rides the APIs specced here — no backend work in U15.

## Decisions (locked)

| Question | Decision |
|---|---|
| Scope split | Full backend in A10 (model, admin CRUD/editor, public detail, cart quote). U15 = customizer UI only. |
| Slot pool | **Category slot**: `category_id` + `quantity`; pool = all active products in that category. |
| Pricing | **Surcharge above cheapest**: slot reference = min active base price in category; pick adds `base − reference` (≥ 0); option deltas on top. |
| Component kinds | Both: fixed product **or** category slot. Existing combos unchanged. |
| Storage | **Widen `combo_items`** (nullable `product_id` XOR new nullable `category_id`, CHECK). No data transform. |
| Combo image | In scope: `combos.image_url` column + upload, per `admin-combo-edit.html` wide image. |

## 1. Data model & migration

```text
combo_items
  combo_item_id  PK
  combo_id       FK combos        NOT NULL
  product_id     FK products      NULL      ← was NOT NULL
  category_id    FK categories    NULL      ← new
  quantity       INT NOT NULL DEFAULT 1
  CHECK ck_combo_items_kind ((product_id IS NULL) != (category_id IS NULL))

combos
  + image_url    VARCHAR(255) NULL          ← new
```

- `product_id` set → **fixed component** (every existing row, untouched).
- `category_id` set → **choice slot**: any active product in the category, × quantity.
- **Reference price** (per slot) = `MIN(base_price_vnd)` over *active* products
  in the category. Computed at read/quote time. Never stored.
- **Surcharge** (per pick) = `max(0, base_price_vnd − reference)`.
- Component display order everywhere = `combo_item_id` ascending (matches the
  existing public-combos rule).
- Order history needs no new snapshot tables: resolved picks become
  `order_items` rows (with `combo_id` already present) and options snapshot via
  `order_item_options` (A8). Checkout wiring itself is U6, out of A10.

**Migration `0006_combo_choice_slots`** (single revision):
1. `combo_items.product_id` → nullable.
2. Add `combo_items.category_id` (FK categories, nullable).
3. Add named CHECK `ck_combo_items_kind` (exactly one of the two set).
4. Add `combos.image_url` VARCHAR(255) NULL.

No data transform. Downgrade reverses (safe: downgrade requires no slot rows,
documented in the migration docstring).

## 2. API contracts

All error responses use the closed envelope: `{code, message, details?}` with
`code = "VALIDATION_FAILED"` (400) and a **closed** `details.reason` set listed
below. `NOT_FOUND` (404) / `CONFLICT` (409) as today.

### 2.1 Admin `/api/admin/combos` (existing router, extended)

Component shape gains a `kind` discriminator (mirrors the A8 cart-line style):

```jsonc
// ComboItemIn
{"kind": "product",  "product_id": 3,  "quantity": 1}
{"kind": "category", "category_id": 2, "quantity": 4}

// ComboItemOut
{"kind": "product",  "product_id": 3,  "quantity": 1, "name": "Garlic Bread"}
{"kind": "category", "category_id": 2, "quantity": 4,
 "name": "Drinks — customer's choice", "from_price_vnd": 15000}
```

- Schema: `kind` decides which id field is required; the other must be absent
  (pydantic discriminated union or validator — 400 on mismatch).
- `from_price_vnd` present only on `kind:"category"` rows.
- `ComboOut` gains `image_url: str | null`.

Validation on create/patch (replace-items semantics unchanged):
- **Rule change vs A4:** minimum is now `sum(quantity) ≥ 2` across components
  (was `len(items) ≥ 2`). "2× any pizza" as one row is a valid combo.
- Fixed component: product exists and is active (unchanged).
- Slot component: category must exist **and have ≥ 1 active product** at
  validation time. Both failures (unknown category, empty category) →
  `VALIDATION_FAILED` with reason `slot_category_empty` and
  `details.category_id`, consistent with A4's item validation (no 404s for
  body-referenced ids).
- `quantity ≥ 1` per component (unchanged).
- Components-total for the over-price warning = Σ fixed `base × qty` +
  Σ slot `reference × qty`. Over-priced combos still **accepted** (A4 rule).

**Image:** `POST /api/admin/combos/{combo_id}/image` — multipart, mirrors the
existing admin item-image endpoint (same size/type limits, same storage dir,
returns updated `ComboOut`). `DELETE /api/admin/combos/{combo_id}/image`
clears it. `image_url` is never set directly via `ComboIn`/`ComboPatch`.

### 2.2 Public `GET /api/combos` (existing, extended)

- Slot items: `{"kind": "category", "category_id", "name", "quantity",
  "from_price_vnd"}`; fixed items keep today's shape plus `kind: "product"`.
- `items_total_vnd` = Σ fixed `base × qty` + Σ slot `reference × qty`.
- Combo **skipped** when any slot's category has zero active products
  (mirrors the existing inactive-fixed-product skip).
- `PublicComboOut` gains `image_url`.

### 2.3 Public `GET /api/combos/{combo_id}` (new)

Customizer data source. 404 (`NOT_FOUND`) unless the combo is Active and
purchasable (every fixed product active, every slot category non-empty) — same
predicate as list inclusion.

```jsonc
{
  "combo_id": 7, "name": "Pick-Any Feast", "description": "...",
  "image_url": "/images/...", "combo_price_vnd": 350000,
  "items_total_vnd": 410000, "savings_vnd": 60000,
  "components": [
    {"combo_item_id": 11, "kind": "category", "name": "Pizzas — customer's choice",
     "category_id": 1, "quantity": 2, "from_price_vnd": 120000,
     "eligible_products": [
       {"product_id": 3, "name": "Margherita Classic", "image_url": null,
        "base_price_vnd": 120000, "surcharge_vnd": 0},
       {"product_id": 5, "name": "Pepperoni Passion", "image_url": null,
        "base_price_vnd": 130000, "surcharge_vnd": 10000}
     ]},
    {"combo_item_id": 12, "kind": "product", "name": "Garlic Bread",
     "product_id": 9, "quantity": 1, "base_price_vnd": 45000}
  ]
}
```

- `eligible_products` ordered by `name` asc (matches `/api/items` ordering);
  active products only.
- Option groups per pick come from the existing `GET /api/items/{product_id}`
  — this endpoint does **not** duplicate them.

### 2.4 Cart quote `POST /api/cart/quote` (combo lines implemented)

```jsonc
{"kind": "combo", "combo_id": 7, "quantity": 1, "selections": [
  {"combo_item_id": 11, "picks": [
    {"product_id": 3, "option_ids": [1, 9]},
    {"product_id": 5, "option_ids": [2]}
  ]},
  {"combo_item_id": 12, "picks": [{"product_id": 9, "option_ids": []}]}
]}
```

Semantics:
- `selections` describe **one combo unit**; line `quantity` multiplies the
  fully-configured combo.
- Exactly one selection per component; `picks` length == component `quantity`.
  Each pick is configured independently (two pizzas from one slot may differ).
- Fixed component: every pick's `product_id` must equal the component's
  product. Options still selectable.
- Slot component: each pick's product must be active and in the slot category.
- `option_ids` per pick: deduped server-side, then validated against the
  pick's product enablement via A8 `validate_option_selection` (A8 reasons
  reused: `option_not_available`, `required_group_missing`,
  `single_group_conflict`).
- `item_id`/`option_ids` at line level are invalid on combo lines (schema).

New closed `details.reason` values (with `combo_item_id` / `product_id`
context where applicable):

| reason | when |
|---|---|
| `combo_not_active` | combo unknown, outside validity window, or not purchasable (inactive fixed product / empty slot category) |
| `component_selection_missing` | a `combo_item_id` has no selection, is duplicated, or is unknown |
| `pick_count_mismatch` | `len(picks) != component.quantity` |
| `product_not_in_slot_category` | slot pick outside category or inactive |
| `product_mismatch_fixed_component` | fixed-component pick is a different product |

Pricing (domain, §3):
- `line_full_value` = reference items_total + Σ surcharges + Σ option deltas.
- `line_charged`   = `combo_price_vnd` + Σ surcharges + Σ option deltas.
- `discount_vnd`   = `max(0, line_full_value − line_charged)` (= savings; 0 for
  an over-priced combo).
- `subtotal_vnd` accumulates `(line_charged + discount_vnd) × quantity` —
  equals full value when the combo saves money and equals the charged amount
  for an over-priced combo, so `total = subtotal − discounts + fee` always
  charges `line_charged × quantity`. `discount_combo_vnd` accumulates
  `discount_vnd × quantity` and becomes non-zero for the first time;
  item-line behavior untouched.

### 2.5 Contract regen (cwd-qualified)

```sh
cd Application/backend && python -m app.tools.dump_openapi > ../openapi.json
cd Application/frontend && npm run gen:types
```

CONTRACTS.md: combo route rows updated, new detail endpoint row, cart combo
line shape + reason table, A10 scope bullet.

## 3. Domain (`app/domain/combo_slots.py`, pure, no IO)

```python
slot_reference_price(active_base_prices: Sequence[int]) -> int   # min; caller guarantees non-empty
pick_surcharge(base_price_vnd: int, reference_vnd: int) -> int   # max(0, base - reference)
validate_combo_selections(components, selections) -> ComboSelectionError | None
combo_line_pricing(combo_price_vnd, reference_total_vnd, surcharges, option_deltas)
    -> ComboLinePricing(line_full_value_vnd, line_charged_vnd, discount_vnd)
```

- `validate_combo_selections` performs the structural checks (coverage,
  pick counts, fixed match, slot membership) and returns the reason +
  context; per-pick option validation stays with A8 `validate_option_selection`
  composed in the cart resolver (`app/api/cart.py`).
- `combo_line_pricing` rejects negative inputs (`PricingError`, like
  `compute_unit_price`).
- Status/savings reuse `app/domain/combos.py` (`combo_status`,
  `combo_savings_vnd`). mypy strict + import-linter cover the module.

## 4. Admin UI

Mirrors the A8 list→editor split (`/admin/items` → `/admin/items/[id]`):

- **`/admin/combos`** → card grid per `admin-combos.html`: wide image, derived
  status chip, "Save X₫" badge (hidden when savings ≤ 0), component summary
  lines ("2× Pizzas — customer's choice"), card links to editor; dashed
  "Create New Combo" card → `/admin/combos/new`. Inline form removed.
- **`/admin/combos/[id]` and `/admin/combos/new`** per `admin-combo-edit.html`:
  - Basics: name, description, wide image upload (16:6 hint).
  - Components: rows with qty stepper + remove; slot rows labeled
    "Any {Category} — customer's choice · from X₫".
  - **Add Component picker**: search input; list headed by one special entry
    per active category with ≥ 1 active product ("Any Pizzas — customer's
    choice · from 120,000₫"), then the full active-dish list (name + price).
    Search filters both. Click appends a component row.
  - Pricing panel: components total (reference-based), combo price input,
    live savings line; price > components-total shows the warning and hides
    savings (A4 rule, now rendered per design).
  - Validity start/end + derived Scheduled/Active/Expired chip.
  - Save gated client-side on `sum(quantity) ≥ 2`; server is authoritative.
- Frontend API surface: `lib/api/admin-combos.ts` typed wrappers (pattern:
  `admin-options.ts`).

## 5. Seeds

Add one slot combo (idempotent, like existing seeds): **Pick-Any Feast** =
2× any Pizza (slot) + 1× Garlic Bread (fixed) + 2× any Drink (slot), priced
below components-total so the savings badge shows. Gives the admin editor,
public list/detail, and later U15 real data.

## 6. Testing

- **Domain unit:** reference/surcharge math, `combo_line_pricing` arithmetic +
  negative-input guards, `validate_combo_selections` matrix — one test per
  reason plus happy path.
- **Admin router:** slot CRUD round-trip, `slot_category_empty`,
  `sum(quantity) ≥ 2` boundary (1 row × qty 2 passes; single qty-1 row fails),
  kind/id mismatch 400s, image upload + clear, `from_price_vnd` correctness.
- **Public:** list shows slot items with `from_price_vnd`; combo skipped when
  slot category emptied; detail eligible-products + surcharges + 404 for
  non-Active; `image_url` passthrough.
- **Cart quote:** happy path (mixed fixed+slot, option deltas, surcharge,
  quantity > 1), every new reason, discount/subtotal arithmetic, per-pick
  option dedupe, option errors inside picks surface A8 reasons.
- **e2e (Playwright):** admin builds a slot combo via the picker UI, sees
  savings badge; hermetic — temp data via `page.request` with status asserts,
  cleanup in `finally` (A8 pattern). Public combos page still renders.
- **Gate:** contract parity, full `./verify.sh` exit 0 before "done";
  evidence recorded in `feature_list.json`.

## 7. Out of scope

- Customer customizer page (`combo-customize.html`) — U15.
- Checkout/order persistence of resolved combos — U6 (schema already suffices).
- Curated per-slot product lists (join table) — possible later extension;
  schema unaffected.
- Multi-image for combos — A9 territory; single `image_url` only.
