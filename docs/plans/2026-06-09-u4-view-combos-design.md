# U4 — View Combo Promotions: design

**Feature:** `U4` View Combo Promotions (`depends_on: U1, A4` — both done). Owner: Hoang.
**Branch:** `u4-view-combos` (off `main` @ `168c416`, U3 merged via #16).
**Date:** 2026-06-09.

## Problem

Customers need a public page that shows currently-running combo promotions with their
price and how much they save versus buying the components separately. A4 already provides
admin CRUD for combos, the `Combo`/`ComboItem` models, the `combo_status` domain helper,
and seeded sample combos. U4 is the read-only customer-facing view on top of that.

`GET /api/combos` is listed in `CONTRACTS.md` ("List active combos for current time
window") but is **not yet implemented**; there is no `frontend/app/combos/` route. Both
are built here.

## Scope (confirmed)

- Public, read-only combo listing. Active combos only.
- Server computes savings (combos store an absolute `combo_price_vnd`; there is no stored
  discount).
- **Out of scope (deferred):** adding combos to `POST /api/cart/quote` and orders — that is
  **U5** (cart still rejects `kind="combo"` with `VALIDATION_FAILED`). Also out: scheduled/
  "coming soon" combos, a combo detail page.

## Backend domain

Add one pure helper to `app/domain/combos.py` (keeps money math in the domain layer):

```python
def combo_savings_vnd(combo_price_vnd: int, items_total_vnd: int) -> int:
    """Savings vs buying parts separately. Clamped at 0 (an over-priced combo shows no
    savings, never a negative)."""
    return max(0, items_total_vnd - combo_price_vnd)
```

`items_total_vnd` = `Σ (component.base_price_vnd × quantity)`, computed in the router from
the eager-loaded component products. Unit-tested in `tests/domain/test_combos.py`
(positive savings, zero when equal, zero when over-priced).

The existing `combo_status` helper is reused unchanged for the Active filter; boundaries
are inclusive (at-start/at-end = Active), and a combo with no window is Active.

## Backend endpoint

New `app/api/combos.py`, public (no auth guard), registered in `app/main.py` near
`menu_router`. Mirrors the thin style of `app/api/menu.py`.

`GET /api/combos`:
- Query `Combo` with `combo_items.product` eager-loaded (`selectinload`/`joinedload`) to
  avoid N+1 and to read each component's `name`, `image_url`, `base_price_vnd`.
- Filter in Python to `combo_status(c.validity_start, c.validity_end, now) == ACTIVE`,
  where `now` is naive UTC (matching the `DateTime(timezone=False)` columns — same
  `_now_utc_naive()` convention the admin router uses).
- Order combos by `combo_id` (stable; mirrors admin). Component items emitted in
  `combo_item_id` order.

Response model `PublicComboOut` (list):
```json
combo_id: int
name: str
description: str | None
combo_price_vnd: int
target_group: int | None
items_total_vnd: int          # Σ base_price × qty
savings_vnd: int              # combo_savings_vnd(...)
items: list[PublicComboItemOut]
```
`PublicComboItemOut`: `product_id, name, quantity, image_url (str|None), base_price_vnd`.

**Deliberately omitted** from the public payload: `validity_start`, `validity_end`,
`status`. The endpoint returns Active-only, so status is implied and the scheduling window
stays an internal detail.

Integration tests `tests/test_combos.py` (mirror `tests/test_menu.py`, public no-auth):
- active combo returned with correct `items_total_vnd` + `savings_vnd`;
- scheduled (future start) and expired (past end) combos excluded;
- empty list when none active (200, `[]`);
- over-priced combo → `savings_vnd == 0`;
- item detail shape (image_url surfaced from component product);
- public / no auth required.

## Contract parity

- Regenerate `openapi.json` (`python -m app.tools.dump_openapi`) and
  `frontend/lib/api/types.ts` (`npm run gen:types`). CI enforces drift.
- `CONTRACTS.md`: expand the `GET /api/combos` row and add a request/response example for
  the public combos payload.

## Frontend

- `lib/api/combos.ts`: `export type PublicCombo = components["schemas"]["PublicComboOut"]`
  and `fetchCombos(): Promise<PublicCombo[]>` → `apiFetch("/combos")`. Mirrors
  `lib/api/menu.ts`. Vitest in `lib/api/combos.test.ts`.
- `app/combos/page.tsx`: `"use client"`, the `loading | ready | error` state-machine
  pattern cloned from `app/menu/page.tsx` (deferred mount fetch, skeleton grid, empty
  state, error block with "Try again"). Confirmed via Next 16.1.x docs that the existing
   `useState`+`useEffect` client-fetch pattern is current/idiomatic on Next 16.2.x — no SWR
   introduced (not a project dependency; YAGNI).
- `components/combos/combo-card.tsx`: combo name, description, component list with
  thumbnails (component `image_url`, "No image" fallback like `pizza-card`), prominent
  `combo_price_vnd` via `formatVnd`, and a **"Save {formatVnd(savings_vnd)}"** badge shown
  only when `savings_vnd > 0`.
- `components/top-nav.tsx`: add a "Combos" link to `/combos`.
- Playwright `tests/e2e/combos.spec.ts`: page lists the seeded combos and shows price +
  savings.

## Error handling

- Backend: standard error envelope. The endpoint is a simple read; no 4xx beyond the
  framework default. Empty result is `200 []`, not 404.
- Frontend: network/fetch failure → error state with retry, matching `menu/page.tsx`.

## Verification / Definition of Done

- `./verify.sh` exits 0 (lint, types, unit, contract drift, integration, smoke, e2e).
- `CONTRACTS.md` updated; `openapi.json` + `frontend/lib/api/types.ts` regenerated and
  committed.
- `feature_list.json` U4 → `done` with evidence; `progress.md` appended;
  `session-handoff.md` rewritten to point at U5 (Manage Cart).
- Conventional commits `feat(U4): ...`.
