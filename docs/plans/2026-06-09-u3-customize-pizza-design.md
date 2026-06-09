# U3 — Customize Pizza: design

**Feature:** `U3` Customize Pizza (`depends_on: U2`). Owner: Hoang.
**Branch:** `u3-customize-pizza` (off `main` @ `1e5263a`, U2 merged via #15).
**Date:** 2026-06-09.

## Problem

U2 shipped the `/menu/[id]` detail page with working size/crust/topping selectors,
a quantity stepper, and a **client-side, non-authoritative** price preview
(`frontend/lib/pricing.ts::computePizzaLineTotal`) — a sanctioned deviation from the
"frontend never recomputes" rule in `ARCHITECTURE.md`.

U3's job (per `session-handoff.md`) is to retire that deviation by standing up the
authoritative backend `POST /api/cart/quote` and wiring the `/menu/[id]` price preview
to it. This is the single source of truth for pizza unit pricing and the endpoint U5
(Manage Cart) will reuse for the full cart.

`CONTRACTS.md` currently attributes the deviation-replacement to U5; the team decision
(this session) is to do it in U3. `CONTRACTS.md` is updated accordingly.

## Key constraint: no address at item-detail time

`compute_order_total` in `domain/pricing.py` currently **requires** a deliverable
`address_district` and **always** adds `DELIVERY_FEE_VND`. But `/menu/[id]` runs before
checkout (U6), so there is no address. A single-item preview cannot reuse the pipeline
as-is.

Resolution: make the address optional. `address_district=None` → "preview mode": skip
the service-area check and set `delivery_fee_vnd = 0`. Existing callers/tests pass an
address and are unaffected (backward compatible).

## Backend

### `backend/app/domain/pricing.py`
- Add pure helper `compute_pizza_unit_price(*, base_price_vnd, size_modifier_vnd, topping_prices_vnd) -> int`
  = `base + size_modifier + sum(toppings)`. Validates non-negative inputs; raises
  `PricingError("VALIDATION_FAILED", ...)` otherwise. This is the authoritative
  replacement for the frontend `computePizzaLineTotal` math.
- Change `compute_order_total(address_district: str | None = None, ...)`:
  - `None` → skip `is_inner_hanoi` check, `delivery_fee_vnd = 0`.
  - non-`None` → unchanged behavior (service-area check + `DELIVERY_FEE_VND`).

### `backend/app/api/cart.py` (new router)
- `POST /api/cart/quote`, public (no role guard). Non-mutating compute endpoint — no
  CSRF (it writes nothing; mirrors the GET-like config/menu calculators).
- Request body `CartQuoteIn`:
  ```
  lines: [ { kind: "pizza"|"side", item_id: int, size?: str, crust?: str,
             topping_ids?: [int], quantity: int } ]   # >= 1 line, quantity >= 1
  address?: { administrative_unit: str, street?: str }   # optional
  redeem_points?: int = 0
  ```
- Resolution (the "authoritative" part — prices come from DB, never the client):
  - Product: active, exists → else `VALIDATION_FAILED` 400.
  - `kind="pizza"`: only valid for `is_pizza` products. `size` resolved by name against
    `PizzaSize` (modifier applied); `crust` resolved by name (no price effect, validated
    if provided); `topping_ids` resolved against `Topping` (must all exist). Unit price =
    `compute_pizza_unit_price(...)`.
  - `kind="side"`: only valid for non-pizza products; unit price = `base_price_vnd`;
    size/crust/toppings rejected if supplied.
  - `kind="combo"`: **rejected** as `VALIDATION_FAILED` — combo quoting is U4/U5 scope.
  - Unknown size/crust/topping name/id → `VALIDATION_FAILED` 400.
- Pricing: build `CartLine(unit_price_vnd, quantity)` per line, call
  `compute_order_total(address_district = address.administrative_unit if address else None,
  redeem_points=..., current_points=0)`. (Loyalty balance is U13/U14; `current_points=0`
  here, so `redeem_points` is effectively capped to 0 until then — accepted.)
  - `address` present + invalid → `OUT_OF_SERVICE_AREA` 422.
- Response `CartQuoteOut` (matches `CONTRACTS.md` example exactly):
  ```
  { subtotal_vnd, discount_combo_vnd, discount_loyalty_vnd, delivery_fee_vnd, total_vnd,
    loyalty: { balance, redeemed, max_redeemable } }
  ```

### `backend/app/main.py`
- Register `cart_router`.

## Contract parity
- `python -m app.tools.dump_openapi > openapi.json`, then `cd frontend && npm run gen:types`.
  Commit both.
- `CONTRACTS.md`: update the deviation note (U5 → U3), document `address`-optional preview
  behavior on `POST /api/cart/quote`, and that `combo` lines are deferred.

## Frontend

### `frontend/lib/api/cart.ts` (new)
- Types from generated `components["schemas"]`. `quoteCart(body): Promise<CartQuoteOut>`
  posting to `/cart/quote` via `apiFetch`.

### `frontend/app/menu/[id]/page.tsx`
- Remove `computePizzaLineTotal` import + `preview` `useMemo`.
- On size/crust/topping/quantity change, call `quoteCart` for the single configured pizza
  line (debounced ~250ms; ignore stale responses via a request token/AbortController).
- Render the server `total_vnd` in the existing `data-testid="line-estimate"` slot.
  Show a subtle pending state while quoting; on error, show last good value or a dash.
- Non-pizza items unchanged (static base price).

### Delete (deviation retired)
- `frontend/lib/pricing.ts`
- `frontend/lib/pricing.test.ts`

## Tests

### Backend
- `tests/domain/test_pricing.py`: add cases for `compute_pizza_unit_price` (sum, zero
  toppings, negative input rejected) and `compute_order_total(address_district=None)`
  (no fee, no area check).
- `tests/test_cart_quote.py` (new, follows `test_menu_detail.py` pattern with
  `build_test_app` + factories): pizza line with size+toppings+quantity; side line;
  unknown product 400; inactive product 400; combo kind 400; size/topping mismatch 400;
  no-address preview (fee 0); address out-of-area 422; in-area address adds 22.000₫.

### Frontend
- `frontend/lib/api/cart.test.ts` (vitest): builds correct request, parses response,
  surfaces `ApiClientError`.
- Update `frontend/tests/e2e/item-detail.spec.ts`: estimate now reflects server quote
  (still keyed on `data-testid="line-estimate"`; assertions that it changes on
  size/topping/quantity remain valid).

## Verification / Definition of Done
- `./verify.sh` exits 0 (lint, types, unit, contract drift, integration, smoke, e2e).
- `CONTRACTS.md` updated; `openapi.json` + `frontend/lib/api/types.ts` regenerated and
  committed.
- `feature_list.json` U3 → `done` with evidence; `progress.md` appended;
  `session-handoff.md` rewritten to point at U4.
- Conventional commit `feat(U3): ...`.

## Out of scope (deferred)
- Combo line quoting (U4/U5). Cart persistence / multi-line cart UI (U5). Real loyalty
  balance + redemption UI (U13/U14). Address entry UI (U6). APG roving-tabindex keyboard
  nav on the radiogroups (recorded U2 follow-up).
