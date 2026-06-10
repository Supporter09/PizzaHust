# A8 — Generic Options Model (design)

**Date:** 2026-06-10 · **Feature:** `A8` (feature_list.json) · **Depends on:** A2 (done)
**Source:** `DESIGN_BRIEF.md` §5 (options model redefined), §4 (line-text composition), `Design/admin-item-edit.html`

## Goal

Replace the fixed `pizza_sizes` / `pizza_crusts` / `toppings` tables with admin-defined
**option groups** and **options**. Option price deltas are shared across dishes; enablement is
per-dish. The same option chips later power the combo customizer (U15). Full vertical:
schema + domain + APIs + U3 customizer rework + admin dish-editor UI; the standalone
`/admin/pizza-options` page is removed.

## Decisions (from brainstorm)

| Decision | Choice |
|---|---|
| Scope | Full vertical in one `verify.sh` gate |
| Order history | Snapshot rows, no FK to options — admin deletes never blocked by history |
| Group selection rule | `select_type` enum `single`/`multi` + `required` bool |
| Enable/disable toggle | Per-dish enablement only (`product_options` membership). No global `is_active` column — brief defines exactly one toggle concept |
| Admin editor fidelity | Full fidelity to `Design/admin-item-edit.html`, **minus** A9 multi-image (single image field stays) |
| Per-dish price overrides | None — deltas shared (brief-explicit; rejected alternative) |
| Migration style | Single clean-cut Alembic revision; single-node MVP, downtime acceptable |

## Data model

```
option_groups
  group_id      int PK
  name          varchar(100) unique
  select_type   enum('single','multi')
  required      bool        -- single+required → customizer preselects first enabled option
  sort_order    int

options
  option_id        int PK
  group_id         FK option_groups ON DELETE CASCADE
  name             varchar(100), unique per group
  description      varchar(255) NULL
  price_delta_vnd  int >= 0
  sort_order       int

product_options                  -- per-dish enablement; row present = enabled
  product_id  FK products ON DELETE CASCADE
  option_id   FK options  ON DELETE CASCADE
  PK (product_id, option_id)

order_item_options               -- snapshot at order time; replaces size/crust FKs + order_item_toppings
  id               int PK
  order_item_id    FK order_items ON DELETE CASCADE
  group_name       varchar(100)
  option_name      varchar(100)
  price_delta_vnd  int
```

Snapshot ordering contract: rows are inserted in `(group.sort_order, option.sort_order)`
order at write time; all readers (cart lines, kitchen cards, line-text composition) order by
`id`. Display stays stable after later group/option renames or deletes — no extra columns.

`order_items.size_id`, `order_items.crust_id`, and table `order_item_toppings` are dropped.

### Migration `0005_generic_options` (one revision)

1. Create the four tables.
2. Transform data: `pizza_sizes` → group **Size** (single, required, deltas = `price_modifier_vnd`);
   `pizza_crusts` → **Crust** (single, required, delta 0); `toppings` → **Toppings** (multi,
   optional, deltas = `price_vnd`). Enable every migrated option for every `is_pizza=1` product.
3. Backfill `order_item_options` from `order_items.size_id/crust_id` and
   `order_item_toppings.price_at_time_vnd`.
4. Drop `order_item_toppings`, the two `order_items` FK columns, and the three old tables.
   Downgrade recreates old structures best-effort (lossy; documented in revision docstring).
5. `schema.dbml` updated to match. Seeds rewritten to upsert groups/options/enablement.

## Domain (`backend/app/domain/`)

- `compute_pizza_unit_price(base, size_modifier, toppings)` → replaced by
  `compute_unit_price(base_price_vnd: int, option_deltas_vnd: Sequence[int]) -> int`
  (= base + sum of deltas). Pure, in `pricing.py`.
- New `validate_option_selection(groups, selected_option_ids)` in domain: required-single
  satisfied, no two picks in a single group, every id within the dish's enabled set.
  Cart router stays thin: validate → price → DTO.

## API contracts

**Public `GET /api/items/{product_id}`** — `sizes`/`crusts`/`toppings` removed, replaced by:

```json
"option_groups": [
  { "group_id": 1, "name": "Size", "select_type": "single", "required": true,
    "options": [ { "option_id": 1, "name": "M", "description": null, "price_delta_vnd": 30000 } ] }
]
```

Only options enabled for the dish; groups with zero enabled options omitted. Any dish may
have options — `is_pizza` no longer gates the options query.

**`POST /api/cart/quote`** line becomes `{kind, product_id, qty, option_ids: [int]}`
(drops `size`/`crust`/`topping_ids`; breaking is acceptable — U5 unbuilt). The server
**dedupes** `option_ids` before validation and pricing (duplicates can never double-charge).
422 error-envelope codes: `option_not_available`, `required_group_missing`,
`single_group_conflict`.

**Admin** — `/api/admin/sizes|crusts|toppings` routers removed. New:

| Route | Purpose |
|---|---|
| `GET/POST /api/admin/option-groups` · `PATCH/DELETE /api/admin/option-groups/{gid}` | category CRUD; delete cascades options |
| `POST /api/admin/option-groups/{gid}/options` · `PATCH/DELETE /api/admin/options/{oid}` | option rows (name, desc, delta) |
| `GET /api/admin/items/{pid}/options` | all groups+options with per-dish `enabled` flags (editor view) |
| `PUT /api/admin/items/{pid}/options` | replace enabled set `{option_ids: []}` |

Group payloads: `POST /api/admin/option-groups` takes
`{name, select_type: "single"|"multi", required: bool, sort_order?: int}`;
`PATCH` accepts any subset of the same fields. Option payloads:
`{name, description?, price_delta_vnd, sort_order?}` (create), partial on `PATCH`.

`POST /api/admin/import/toppings` is **removed** along with the `Topping` model
(`bulk_import.py` keeps only the dish import — the v2 `Design/admin-import.html` is
dish-CSV only). Its CONTRACTS.md rows and tests go with it.

409 on duplicate names within scope (mirrors current options router). No delete guards
against order history (snapshot). After route changes, from `Application/backend` (venv):
`python -m app.tools.dump_openapi > ../openapi.json`; then from `Application/frontend`:
`npm run gen:types`. Rewrite CONTRACTS.md A2 + item-detail + cart-quote + bulk-import sections.

## Frontend (Next.js App Router + Tailwind 4 + generated types — existing stack only)

**Customer customizer** (`app/menu/[id]/page.tsx`):
- `size-selector.tsx` / `crust-selector.tsx` / `topping-selector.tsx` → one
  `OptionGroupSelector` (radio chips for `single`, toggle chips for `multi`).
  Selection state `Record<group_id, option_id[]>`; required-single preselects first option.
- Quote effect flattens selections to `option_ids`. Server remains sole price authority.
- Current page layout/styling kept; v2 `product.html` redesign is separate later work.

**Admin dish editor** — new `app/admin/items/[id]/page.tsx`, full fidelity to
`Design/admin-item-edit.html` minus multi-image:
- Dish basics + Options section: categories with inline rename, "+ Add Category", delete;
  option rows name/desc/delta editable (edits warn: shared across all dishes);
  per-dish enable toggle dims disabled rows.
- Category header carries a `single`/`multi` segmented control + `required` checkbox
  (set at create, editable after). Small extension beyond the mock — the mock shows only
  rename, but the model needs these to render radio vs checkbox chips.
- "How it appears in cart & kitchen" preview via `composeLineText(name, selections)` in
  `frontend/lib/` (e.g. `Margherita Classic (M) · Regular crust · Extra Cheese`) — reused by
  cart in U5.
- `/admin/pizza-options` page and its nav link deleted.

## Testing

- **Domain unit:** `compute_unit_price`; `validate_option_selection` (required-single missing,
  two picks in single group, id outside enabled set, valid multi).
- **Backend integration:** item detail group shape (enabled-only, empty groups omitted, dish
  without options → `[]`); cart quote delta pricing + each 422 code; admin CRUD + 409 dupes;
  `PUT items/{pid}/options` replaces set; group delete cascades and detaches dishes.
- **Migration:** pre-migration fixed-option order survives as `order_item_options` snapshots.
- **Frontend unit (Vitest):** `composeLineText`, `OptionGroupSelector` selection logic.
- **Playwright:** `item-detail.spec.ts` rewritten for generic chips; new
  `admin-item-editor.spec.ts` (add category/option, toggle enablement, customizer reflects it);
  `happy-path.spec.ts` customization step updated.
- **Gate:** `./verify.sh` exit 0 (contract parity, lint-imports, mypy domain included);
  evidence in `feature_list.json` A8; `progress.md` + `session-handoff.md` per AGENTS.md.

## Out of scope

A9 multi-image · A10 choice-slots · U15 combo customizer · U5 cart persistence ·
v2 restyle of customer product page · per-dish price overrides.
