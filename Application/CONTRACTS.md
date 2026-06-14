# CONTRACTS.md

REST API contract for PizzaHUST. Backend exports OpenAPI at `/api/openapi.json`; `frontend/lib/api/types.ts` is generated from it. CI fails on drift.

## Conventions

- Base URL: `/api`
- All bodies are JSON. `Content-Type: application/json`.
- Authentication: httpOnly cookie set by `/api/auth/login`. CSRF token in `X-CSRF-Token` header on state-changing routes.
- Money values: integer VND (e.g., `22000`). No floats anywhere.
- Timestamps: ISO 8601 UTC (`2026-04-28T10:00:00Z`).
- IDs: integer surrogate keys for internal entities; `PIZZ-XXXXXX` strings for order codes (6 uppercase alphanumeric chars, e.g. `PIZZ-7K2M9Q`).
- AI features (`U10`, AI Recommendation Service) are **out-of-scope** for this 3-week sprint.

## Error Envelope

All non-2xx responses use this shape:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Human-readable message.",
    "details": { "field": "phone", "reason": "format" }
  },
  "request_id": "01J..."
}
```

Error codes (closed set, extend in this doc only):

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Input failed schema validation |
| `UNAUTHENTICATED` | 401 | Missing or expired session |
| `FORBIDDEN` | 403 | Authenticated but role insufficient |
| `NOT_FOUND` | 404 | Resource missing |
| `CONFLICT` | 409 | State violates invariant (e.g., illegal order transition) |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `OUT_OF_SERVICE_AREA` | 422 | Address outside inner-Hanoi whitelist |
| `INSUFFICIENT_LOYALTY` | 422 | Redeem amount exceeds balance or cap |
| `DELIVERY_UPSTREAM_ERROR` | 502 | Delivery provider failed |
| `INTERNAL_ERROR` | 500 | Unexpected |

## Endpoints (MVP cut)

### Public config

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/config/delivery` | Returns `{ ward_fees: [{ ward, fee_vnd }], service_area: ["Ba Dinh", ...] }` (per-ward delivery fee map; `service_area` is the ward names). Served from the settings store (admin-editable, A13); defaults to the 51 post-2025 Hanoi wards @ 22000 |
| GET | `/api/config/loyalty` | Returns `{ accrual_rate, redeem_value_vnd, max_redeem_pct }`. Served from the settings store (admin-editable, A13) |
| GET | `/api/config/business` | Returns `{ timezone }` (IANA business timezone; admin-editable, A13). Used by the admin "today" order/report windows |

### Catalog (U1, U2, U4)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/categories` | List active categories |
| GET | `/api/items` | List active items, filterable by `category` (`category_id`). `vegetarian`/`kids` filters and item `description` are deferred — no schema columns yet. |
| GET | `/api/items/{id}` | Item detail (includes `option_groups[]` — options enabled for this dish) |
| GET | `/api/combos` | List active combos for current time window |
| GET | `/api/combos/{combo_id}` | Combo detail for customizer (components, eligible slot products, surcharges) |

### Cart & Checkout (U3, U5, U6, U13)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/cart` | Session cart + per-line display + preview quote + `csrf_token`. Never creates a cart row. |
| POST | `/api/cart/lines` | Add line `{kind…, quantity, note?}` (CSRF). Creates cart + session claim if absent. Returns full cart. |
| PATCH | `/api/cart/lines/{line_id}` | `{quantity?, note?}` (CSRF). Returns full cart. |
| DELETE | `/api/cart/lines/{line_id}` | Remove line (CSRF). Returns full cart. |
| DELETE | `/api/cart` | Clear all lines; cart row remains (CSRF). Returns full cart. |
| POST | `/api/cart/checkout-quote` | Quote the session cart with `{address?, redeem_points?=0}` (CSRF). Empty cart → `VALIDATION_FAILED`. |
| POST | `/api/cart/quote` | Compute pricing for a candidate cart + address (customizer preview; unchanged) |
| POST | `/api/orders` | Place COD order from session cart (CSRF). Body: recipient, `address`, optional `delivery_note`, `redeem_points`. Returns `{ order_code, total_vnd, status, promised_at }`. Empty cart → `VALIDATION_FAILED` (400). Stale/unresolvable line → `VALIDATION_FAILED` with `details.line_id`. `OUT_OF_SERVICE_AREA` (422). Clears cart on success. |

**`GET /api/cart` response (U5):** `{ lines: CartLineOut[], quote: CartQuoteOut, csrf_token }` where each line includes `line_id`, `kind`, `quantity`, `note`, `payload`, `name`, `image_url`, `descriptor` or `picks`, `unit_price_vnd`, `line_total_vnd`, `unavailable`. Preview quote uses `delivery_fee_vnd: 0` until checkout-quote.

> **Authoritative pricing (U3).** `POST /api/cart/quote` is the single source of
> truth for line and cart pricing. The former U2 client-side preview
> (`frontend/lib/pricing.ts` `computePizzaLineTotal`) has been **removed** in U3; the
> `/menu/[id]` item page now calls `POST /api/cart/quote` for a single customized
> pizza line and renders `total_vnd`. `address` is **optional**: when absent the quote
> runs in preview mode (`delivery_fee_vnd: 0`, no service-area check); when present and
> outside the inner-Hanoi whitelist it returns `OUT_OF_SERVICE_AREA` (422).
>
> **Cart lines (A8/A10).** `lines[]` is a discriminated union on `kind` (`extra` forbidden
> on line objects). **Item:** `{kind:"item", item_id, option_ids, quantity}`.
> **Combo (A10):** `{kind:"combo", combo_id, selections[], quantity}` where each selection is
> `{combo_item_id, picks[]}` and each pick is `{product_id, option_ids}` (one configured pick
> per unit of component `quantity`; selections describe one combo unit, line `quantity`
> multiplies the fully configured combo). Wrong fields for the declared `kind` are
> Pydantic/schema failures → `details.errors`, not a closed semantic reason.
>
> **Generic options (A8).** Item lines and combo picks both carry `option_ids`.
> The server **dedupes** `option_ids` before validation and pricing (duplicates never
> double-charge), then enforces group rules against the dish's enabled set. Rule
> violations return `VALIDATION_FAILED` (400) with a machine-readable
> `details.reason`: `option_not_available` (+`option_id`), `required_group_missing`
> (+`group_name`), or `single_group_conflict` (+`group_name`). Combo lines add closed
> reasons (often with `combo_item_id` / `product_id`): `combo_not_active`,
> `component_selection_missing`, `pick_count_mismatch`, `product_not_in_slot_category`,
> `product_mismatch_fixed_component`. Combo pricing: `subtotal_vnd` accumulates full
> line value (reference + surcharges + option deltas); `discount_combo_vnd` accumulates
> combo savings (`max(0, full_value − charged)` per unit × quantity); `total_vnd` charges
> `combo_price_vnd` + surcharges + option deltas per unit. Item-line behavior unchanged.
> `redeem_points` is accepted for forward-compatibility with U14, but because the
> loyalty balance is 0 until U13/U14, any `redeem_points > 0` returns
> `INSUFFICIENT_LOYALTY` (422); U3 callers send `redeem_points: 0`.

### Order tracking (U7, U11)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/orders/track/{code}` | Public, rate-limited. Returns minimal projection |
| GET | `/api/orders/me` | Customer order history (auth). Query `page` (default 1), `page_size` (default 20, max 50). `200` → `MyOrderSummaryOut[]` (newest first) |
| GET | `/api/orders/me/{order_code}` | Owner order detail (auth). `200` → `MyOrderDetailOut`; `404 NOT_FOUND` if missing or not owned by caller |
| POST | `/api/orders/me/{order_code}/reorder` | Best-effort append resolvable lines into session cart (CSRF). `200` → `ReorderResultOut` `{ cart, added_count, unavailable[] }`; `404` if not owned |

### Auth & profile (U8, U9, U12, U13)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Create customer account |
| POST | `/api/auth/login` | Login, sets session cookie + CSRF cookie |
| POST | `/api/auth/logout` | Clear session |
| GET | `/api/auth/me` | Current session profile + CSRF token |
| PATCH | `/api/auth/me` | Update profile (`full_name`, `address`) |
| POST | `/api/auth/me/avatar` | U12 — multipart field `image` (png/jpg/jpeg/webp, size-capped); replaces avatar, returns `AuthUserDTO` |
| DELETE | `/api/auth/me/avatar` | U12 — clear avatar, returns `AuthUserDTO` (idempotent) |
| POST | `/api/auth/me/password` | U12 — body `{current_password, new_password}`; wrong current → 400 `VALIDATION_FAILED`; rate-limited; session kept |
| GET | `/api/loyalty/me` | Loyalty balance summary + `redeemable_value_vnd` |
| GET | `/api/loyalty/me/history` | U13 — `[{label, date, points_delta, kind}]` (earn rows only; redeem rows arrive with U14) |

> **`AuthUserDTO`** (login, `/me`, avatar routes) includes `avatar_url: string | null`.
>
> **`email` field.** `User.email` exists (nullable, unique) and is returned by
> admin endpoints (A6). It is **not** collected at registration and **not**
> editable via `PATCH /api/auth/me` in this sprint — registration takes only
> `full_name`, `phone_number`, `password`, `address`. Email-based signup/login is
> deferred; the column is reserved for future use and admin-side display.

### Admin (A1–A7)

All under `/api/admin/`, role=`admin` required.

| Method | Path | Purpose |
|---|---|---|
| GET/POST/PATCH/DELETE | `/api/admin/items` | A1, A2 — pizzas + side dishes; GET filters `kind=pizza\|side`, `category_id`, `active` |
| POST | `/api/admin/items/{id}/image` | A1 — multipart image upload (field `image`); returns `{ "image_url": string }` |
| POST/DELETE | `/api/admin/items/{id}/images[/{image_id}[/cover]]` | A9 — add image / delete image / set cover |
| GET/POST/PATCH/DELETE | `/api/admin/option-groups` | A2/A8 — option groups owned by a category (`category_id`, `name`, `select_type: single\|multi`, `required`, `sort_order`). GET takes optional `?category_id=` filter; POST requires `category_id` (`404` if unknown) |
| POST | `/api/admin/option-groups/{gid}/options` | A2/A8 — add option (`name`, `description?`, `price_delta_vnd ≥ 0`, `sort_order`) |
| PATCH/DELETE | `/api/admin/options/{oid}` | A2/A8 — edit/delete one option |
| GET/PUT | `/api/admin/items/{id}/options` | A2/A8 — per-dish enablement; PUT body `{ "option_ids": [] }` replaces the enabled set |
| GET | `/api/admin/categories/{category_id}/preset` *(removed)* | superseded by per-category option ownership — manage a category's groups directly via `/api/admin/option-groups?category_id=` |
| GET | `/api/admin/categories/{category_id}/option-groups` | A3 — the category's owned option groups, each with its `options` (`200 [CategoryOptionGroupOut]`); `404` unknown category. A category's groups ARE its preset: dishes created in it seed all those options |
| GET/POST/PATCH/DELETE | `/api/admin/categories` | A3 |
| GET/POST/PATCH/DELETE | `/api/admin/combos` | A4/A10 — response includes derived `status` |
| POST | `/api/admin/combos/{id}/image` | A10 — multipart image upload (field `image`); returns `{ "image_url": string }` |
| DELETE | `/api/admin/combos/{id}/image` | A10 — clear combo image, 204 |
| POST/DELETE | `/api/admin/combos/{id}/images[/{image_id}[/cover]]` | A9 — add image / delete image / set cover |
| POST | `/api/admin/import/pizzas` | A1 — CSV upsert (multipart field `file`) |
| GET | `/api/admin/orders` | A5 list, query param `status` |
| GET | `/api/admin/orders/{id}` | A5 get order detail |
| POST | `/api/admin/orders/{id}/cancel` | A5 cancel order |
| POST | `/api/admin/orders/{id}/retry-dispatch` | infra-005 — hand a `DispatchPending` order to the delivery provider. Success → stores `delivery_reference`, status → `Delivering`, 204. Wrong state → 409. Provider failure → 502 `DELIVERY_UPSTREAM_ERROR`, order stays `DispatchPending` (retryable) |
| GET | `/api/admin/customers` | A6 list, query params: `q` (search), `page`, `page_size` |
| GET | `/api/admin/customers/{id}` | A6 customer detail |
| POST | `/api/admin/customers/{id}/lock` | A6 lock account, body `{ "reason": string \| null }` |
| POST | `/api/admin/customers/{id}/unlock` | A6 unlock account |
| GET | `/api/admin/reports/sales` | A7, query params: `from`, `to` |
| GET/PUT | `/api/admin/settings` | A13 — business settings. GET returns `{ timezone, loyalty_accrual_rate, loyalty_redeem_value_vnd, loyalty_max_redeem_pct }`. PUT replaces them (body same shape): `timezone` must be a valid IANA zone, loyalty rates `> 0`, `loyalty_max_redeem_pct` in `(0, 1]`; invalid → `VALIDATION_FAILED` (400) |
| GET/PUT | `/api/admin/settings/ward-fees` | A13 — per-ward delivery fee map (= the service area). GET/PUT body `{ wards: [{ ward, fee_vnd }] }`; PUT replaces the whole set. `fee_vnd ≥ 0`, `wards` non-empty (empty → 400), duplicate folded ward name → `CONFLICT` (409) |

#### A1–A4 Catalog management — scope

> ⚠️ **Contract change — pending Minh + Hung review** (per the versioning rule
> at the bottom of this file). These admin catalog routes were added/extended
> when integrating the A1–A4 work.

- **A1/A2 items** (`/api/admin/items`): one unified surface for pizzas **and**
  side dishes; bodies are JSON with `kind` (`pizza`/`side`, maps to `is_pizza`).
  `category_id` on create/PATCH must reference an **existing, active** category
  (else `VALIDATION_FAILED`). `DELETE /api/admin/items/{product_id}` accepts an
  optional `hard` query param (bool, default `false`): default = **soft-deactivate**
  (`is_active=false`), `204` on success, `409` if used by combos; `hard=true` =
  **permanent delete**, `409` if referenced by past orders or combos, `204` on success.
- **A3 category preset** (`GET /api/admin/categories/{category_id}/option-groups`): each option
  group is **owned by a category** (`OptionGroup.category_id`), so a category's groups ARE its
  preset — there is no separate selection. `GET` → `200 [CategoryOptionGroupOut]` (groups ordered
  by `sort_order,name`, each with its `options`); `404` on unknown category. Manage the groups
  themselves via the option-groups CRUD scoped with `?category_id=`. On dish creation, **all**
  options of the dish's category's groups are auto-enabled (per-dish toggles can then opt out).
  The old `GET/PUT .../preset` (group-id selection) routes are **removed**.
- **Image upload** (`POST /api/admin/items/{id}/image`): the documented exception
  to JSON-only — `multipart/form-data`, field `image`. Extension allowlist
  (`png`/`jpg`/`jpeg`/`webp`) + size cap (`IMAGE_MAX_BYTES`); returns `{ "image_url" }`
  and sets the item's `image_url`. Files are served read-only at `IMAGE_BASE_URL`.
- **A2/A8 options** (`/api/admin/option-groups`, `/api/admin/options`): admin-defined
  option categories with options. Group `name` unique **per category** (DB-enforced composite
  `uq_option_groups_category_name`); option `name` unique **per group** — duplicates → `409 CONFLICT`. `price_delta_vnd` must be
  ≥ 0 (negative → `VALIDATION_FAILED`). Group `DELETE` **cascades** to its options and
  their per-dish enablement. There are **no** order-history delete guards: orders hold
  snapshots in `order_item_options` (group/option names + delta at order time; readers
  order by `id`), so catalog deletes never orphan history.
- **A4/A10 combos** (`/api/admin/combos`): `POST`/`PATCH` `items[]` are kind-discriminated:
  `{kind:"product", product_id, quantity}` or `{kind:"category", category_id, quantity}`
  (customer's-choice **slot**). Rule: **`sum(quantity) ≥ 2`** across components. Fixed products
  must be existing and active; slot categories must be **available** (active category with ≥
  one active product) or `VALIDATION_FAILED` with `details.reason: slot_category_unavailable`
  (+`category_id`). Response carries derived `status` (`Scheduled` / `Active` / `Expired`) and
  `image_url`. Combo image upload mirrors items (`POST`/`DELETE` `.../image`). An **over-priced**
  combo (price > sum of reference parts) is **accepted** — frontend warns, API does not reject.
  Validity rejects only `validity_end < validity_start` (equality allowed).
- **A10 combo choice-slots (backend).** Slots are **category-scoped**; reference price for a
  slot = **minimum** active product `base_price_vnd` in that category; each pick pays
  `surcharge_vnd = max(0, pick_base − reference)`. Public list/detail and cart quote resolve
  picks server-side. **Order persistence** of resolved combo configs is **U6/U15**, not A10.
- **Bulk import** (`/api/admin/import/pizzas`): `multipart/form-data`, field `file`.
  Upsert by name (re-import is idempotent). An unknown **or inactive** `category_name`
  is reported as a per-row error and skipped — categories are **never** auto-created.
  A non-boolean `is_pizza` value is likewise a per-row error. CSV columns:
  `name, category_name, base_price_vnd, is_pizza`. The v1 toppings import was
  **removed** with the fixed-toppings model (A8); the v2 import screen is dish-CSV only.

#### A5 Monitor Orders — scope
- Lists all orders (any status). Client-side polling every 15s.
- Filter by `status` enum value (including `DispatchPending`).
- Alert banner when `DispatchPending` count > 0.
- Retry dispatch re-attempts the provider handoff for a `DispatchPending` order (see endpoint row above): success advances to `Delivering`, provider failure 502s and leaves it `DispatchPending` to retry.
- AI Recommendation Service (`U10`) is **out-of-scope** for this sprint.

#### A6 Customer Accounts — scope
- Admin can search customers by `full_name`, `phone_number`, or `email`.
- Lock/unlock: locked customer → subsequent login → `403 FORBIDDEN`.
- Locking does **not** cancel in-progress orders automatically; Kitchen continues.

#### A7 Sales Reports — scope (Week 3)
- Aggregated by day/week.
- Fields: `date`, `order_count`, `revenue_vnd`, `top_items[{name, count}]`.
- CSV export via `?format=csv`.

### Kitchen (K1–K4)

All under `/api/kitchen/`, role=`kitchen` required.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/kitchen/orders` | K1 incoming-orders queue (reads `kitchen_queue_view`) |
| POST | `/api/kitchen/orders/{id}/accept` | K2 flow: Received → Preparing |
| POST | `/api/kitchen/orders/{id}/mark-ready` | K3: T1 handoff; success → ReadyForDispatch, provider fail → DispatchPending |
| POST | `/api/kitchen/orders/{id}/pickup` | K4 manual fallback: ReadyForDispatch → Delivering (kitchen actor), 204 |

### POST /api/kitchen/orders/{order_id}/accept  (kitchen)
Accept an incoming order: `Received → Preparing`. 204 on success.
- 409 if the order is not in `Received`. 404 if unknown. 403/401 if not kitchen.

### POST /api/kitchen/orders/{order_id}/mark-ready  (kitchen)
Mark a Preparing order ready and request a courier (delivery port).
- 200 `{ "status": "ReadyForDispatch" }` on dispatch success (stores delivery_reference).
- 200 `{ "status": "DispatchPending" }` if the provider errors — order is handed
  to admin retry (A5), not rolled back.
- 409 if not in `Preparing`. 404 if unknown. 403/401 if not kitchen.

### POST /api/kitchen/orders/{order_id}/pickup  (kitchen)
Manually confirm courier pickup when the T2 scan is unavailable:
`ReadyForDispatch → Delivering`, attributed to the kitchen actor. Pure local
state advance — no delivery-port call. 204 on success.
- 409 if not in `ReadyForDispatch`. 404 if unknown. 403/401 if not kitchen.

### Delivery webhook (T2)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/webhooks/delivery` | HMAC-signed status callback. Verifies signature with `DELIVERY_WEBHOOK_SECRET` |

#### Webhook payload
```json
{ "reference": "mock-abc123", "state": "Delivered", "event_id": "unique-id" }
```
- `X-Signature` header: `hmac-sha256(body, DELIVERY_WEBHOOK_SECRET)` hex digest.
- Idempotent: duplicate `event_id` (or `reference:state` if no `event_id`) is silently ignored.
- State → order status mapping: `Accepted/PickedUp/Delivering → Delivering`, `Delivered → Delivered`, `Failed → DeliveryFailed`.
- An unset/empty `DELIVERY_WEBHOOK_SECRET` fails closed (rejects every callback).

#### Delivery provider (infra-005)
- Outbound handoff goes through `DeliveryPort` (`backend/app/infra/delivery/port.py`); `get_delivery_port()` selects the adapter by `DELIVERY_PROVIDER` (`mock` is the default and only MVP provider). Config: `DELIVERY_BASE_URL`, `DELIVERY_TIMEOUT_SECONDS`, `DELIVERY_PICKUP_ADDRESS`.
- Adapters raise `DeliveryError` on an unreachable/erroring provider; callers map it to a retryable `502`.

## Schema Examples

### `GET /api/items/{id}` — `option_groups` (A8)

Only options **enabled for this dish**; groups with zero enabled options are omitted.
Any dish may carry options — `is_pizza` no longer gates the query.

```json
"option_groups": [
  {
    "group_id": 1,
    "name": "Size",
    "select_type": "single",
    "required": true,
    "options": [
      { "option_id": 1, "name": "S", "description": null, "price_delta_vnd": 0 },
      { "option_id": 2, "name": "M", "description": null, "price_delta_vnd": 30000 }
    ]
  }
]
```

### `POST /api/cart/quote` — request

```json
{
  "lines": [
    { "kind": "item", "item_id": 12, "option_ids": [2, 7, 9], "quantity": 1 },
    {
      "kind": "combo",
      "combo_id": 1,
      "quantity": 1,
      "selections": [
        { "combo_item_id": 10, "picks": [{ "product_id": 8, "option_ids": [] }] },
        {
          "combo_item_id": 11,
          "picks": [
            { "product_id": 5, "option_ids": [9] },
            { "product_id": 6, "option_ids": [] }
          ]
        }
      ]
    }
  ],
  "address": { "administrative_unit": "Ba Đình", "street": "..." },
  "redeem_points": 0
}
```

> `option_ids` on item lines and combo picks are validated against the pick product's enabled
> set (A8 reasons). Combo structural violations use the closed reason table in the cart note
> above. Omit `address` for preview quote (`delivery_fee_vnd: 0`, no service-area check).

### `GET /api/combos` — response

Returns **Active-only**, purchasable combos for the current time window (inactive fixed
components or unavailable slots exclude the combo). Each entry includes `combo_price_vnd`,
`image_url`, server-computed `items_total_vnd` and `savings_vnd` (clamped at 0), `target_group`,
and `items[]`. Each item has `kind` (`product` | `category`), `name`, `quantity`, and either
`product_id` + `base_price_vnd` + `image_url` (fixed) or `category_id` + `from_price_vnd` (slot
reference = min active base in category). Derived `status` is omitted on the public list.

```json
[
  {
    "combo_id": 1,
    "name": "Lunch Duo for 2",
    "description": "2 pizzas + garlic bread",
    "combo_price_vnd": 255000,
    "image_url": null,
    "target_group": 2,
    "items_total_vnd": 295000,
    "savings_vnd": 40000,
    "items": [
      {
        "kind": "category",
        "category_id": 2,
        "name": "Pizza",
        "quantity": 2,
        "from_price_vnd": 125000
      },
      {
        "kind": "product",
        "product_id": 8,
        "name": "Garlic Bread",
        "quantity": 1,
        "image_url": null,
        "base_price_vnd": 45000
      }
    ]
  }
]
```

### `GET /api/combos/{combo_id}` — response

**404** unless the combo is **Active** and purchasable (same guards as the list). Body is
customizer-oriented: `components[]` with `combo_item_id`, `kind`, fixed/slot fields, and for
slots `eligible_products[]` (`product_id`, `name`, `base_price_vnd`, `surcharge_vnd`, `image_url`).
Fixed components omit `eligible_products`. Includes `items_total_vnd`, `savings_vnd`, `image_url`.

### `POST /api/cart/quote` — response

Pizza line 190.000 (base 125.000 + option deltas: size M 30.000, toppings 15.000 + 20.000) plus side
2 × 30.000 = 60.000 gives a 250.000 subtotal; the in-area address adds the 22.000
delivery fee. No combo discount and (in this sprint) no loyalty redemption.
`max_redeemable` is derived from 50% of the post-combo subtotal (125.000 ÷ 1.000 = 125).

```json
{
  "subtotal_vnd": 250000,
  "discount_combo_vnd": 0,
  "discount_loyalty_vnd": 0,
  "delivery_fee_vnd": 22000,
  "total_vnd": 272000,
  "loyalty": { "balance": 0, "redeemed": 0, "max_redeemable": 125 }
}
```

### `POST /api/orders` — response

```json
{
  "order_code": "PIZZ-7K2M9Q",
  "total_vnd": 277000,
  "status": "Received",
  "promised_at": "2026-04-28T11:15:00Z"
}
```

### `POST /api/auth/login` — response

```json
{
  "user": {
    "user_id": 12,
    "full_name": "Minh Nguyen",
    "phone_number": "0901234567",
    "address": "Hanoi",
    "avatar_url": null,
    "role": "customer"
  },
  "csrf_token": "<token>"
}
```

### `GET /api/loyalty/me` — response

```json
{
  "current_points": 0,
  "total_points_earned": 0,
  "redeemable_value_vnd": 0
}
```

### U11 — `GET /api/orders/me` — response item (`MyOrderSummaryOut`)

```json
{
  "order_code": "PIZZ-7K2M9Q",
  "created_at": "2026-04-28T10:00:00Z",
  "status": "Delivered",
  "total_vnd": 277000,
  "item_summary": ["1× Margherita (M)", "1× Family Feast"]
}
```

### U11 — `GET /api/orders/me/{order_code}` — response (`MyOrderDetailOut`)

Wrong or another user's code → `404 NOT_FOUND`.

| Field | Type | Notes |
|---|---|---|
| `order_code` | string | `PIZZ-…` |
| `created_at` | datetime (ISO 8601 UTC) | |
| `status` | string | Order status enum value |
| `recipient_name` | string | |
| `delivery_address` | string | |
| `delivery_note` | string \| null | |
| `promised_at` | datetime (ISO 8601 UTC) | |
| `lines` | `MyOrderLineOut[]` | Top-level cart lines only; combo components nested under `children` |
| `subtotal_vnd` | int | Sum of line totals before delivery (from persisted `unit_price_vnd` × qty per line, including combo children) |
| `delivery_fee_vnd` | int | Persisted on the order |
| `savings_vnd` | int | **Derived at read time:** `max(0, subtotal_vnd + delivery_fee_vnd - total_vnd)` from persisted order totals. Not a stored combo/loyalty breakdown. Loyalty earned/redeemed line items are **U13/U14** (not on this payload). |
| `total_vnd` | int | Charged total (persisted) |
| `timeline` | `TrackTimelineEntry[]` | Same shape as public track: `{ status, at }` |

#### `MyOrderLineOut` (recursive)

| Field | Type | Notes |
|---|---|---|
| `kind` | `"item"` \| `"combo"` | |
| `display_name` | string | Resolved at read time from the order line’s `product` / `combo` relation when the catalog row still exists; otherwise a fallback label (`"Item"` / `"Combo"`). Line economics use **historical** persisted `unit_price_vnd`; names are not snapshotted on the line. |
| `quantity` | int | |
| `line_total_vnd` | int | Includes nested `children` for combos |
| `options` | string[] | Human labels, e.g. `"Size: M"` |
| `note` | string \| null | Per-line note (items) |
| `children` | `MyOrderLineOut[]` | Combo component lines; empty for `kind: "item"` |

### U11 — `POST /api/orders/me/{order_code}/reorder` — response (`ReorderResultOut`)

Best-effort: resolvable top-level lines are **appended** to the session cart; failures are listed in `unavailable` (request still `200`).

| Field | Type | Notes |
|---|---|---|
| `cart` | `CartOut` | Full session cart after reorder — same as `GET /api/cart` (`lines`, `quote`, `csrf_token`) |
| `added_count` | int | Number of top-level lines successfully appended |
| `unavailable` | `UnavailableLineOut[]` | Lines that could not be rebuilt |

#### `UnavailableLineOut`

| Field | Type | Notes |
|---|---|---|
| `description` | string | Short line label (e.g. `"1× Margherita (M)"`) |
| `reason` | enum | `item_unavailable` \| `option_changed` \| `combo_unavailable` \| `combo_changed` |

### `GET /api/orders/track/{code}` — response

```json
{
  "order_code": "PIZZ-7K2M9Q",
  "status": "Delivering",
  "timeline": [
    { "status": "Received",         "at": "2026-04-28T10:00:00Z" },
    { "status": "Preparing",        "at": "2026-04-28T10:05:00Z" },
    { "status": "ReadyForDispatch", "at": "2026-04-28T10:25:00Z" },
    { "status": "Delivering",       "at": "2026-04-28T10:30:00Z" }
  ],
  "recipient_first_name": "Lan",
  "phone_last4": "1234",
  "address_masked": "***, Ba Đình, Hà Nội",
  "delivery_note": "Ring doorbell twice",
  "promised_at": "2026-04-28T11:15:00Z"
}
```

## v2 Planned Deltas

Tracked work from `DESIGN_BRIEF.md` (v2). This section is **direction**, not final contract —
detailed payloads are designed per feature as each is built and land with their own
`CONTRACTS.md` + OpenAPI update:

- **Generic options (A8).** New `/api/admin/option-groups` + nested options CRUD (`name`,
  `description`, `price_delta_vnd`, `enabled`) replacing `/api/admin/{sizes,crusts,toppings}`.
  Item detail (`GET /api/items/{id}`) and the customizer surface option groups instead of fixed
  size/crust/topping lists. `POST /api/cart/quote` resolves option deltas generically.
- **Multi-image dishes & combos (A9).** `POST /api/admin/items/{id}/images` (add),
  `DELETE …/images/{image_id}`, `POST …/images/{image_id}/cover`; same trio under
  `/api/admin/combos/{id}/images`. Item/combo **detail** reads gain `images[]`
  (`{ image_id, url, is_cover }`, cover first). The legacy singular
  `POST …/{id}/image` now replaces the cover in place; `DELETE …/{combo_id}/image`
  removes the cover. List/menu/cart reads still expose the single `image_url` cover.
- **Combo choice-slots (A10).** Shipped on admin/public/cart quote (see A10 scope under admin
  combos and cart notes). **U15** adds the customer customizer UI; **U6** persists resolved combo
  lines on `POST /api/orders` (not in A10).
- **Order notes (U16).** Per-line `note` on cart/order lines (reuses `OrderItem.notes`); per-order
  `delivery_note` on `POST /api/orders`, surfaced to kitchen at Ready-for-Dispatch and to the
  customer's tracking view.
- **Profile (U12).** Avatar via dedicated `POST`/`DELETE /api/auth/me/avatar` (multipart field
  `image` on POST — same allowlist/size rules as admin images); password change via
  `POST /api/auth/me/password`. `PATCH /api/auth/me` remains JSON-only (`full_name`, `address`).
- **Confirm pickup (K4).** `POST /api/kitchen/orders/{id}/pickup` — kitchen fallback driving the
  existing `ReadyForDispatch → Delivering` transition when the courier scan (T2) is unavailable.

## OpenAPI Generation

- Backend serves OpenAPI at `/api/openapi.json`.
- `verify.sh` step: dump OpenAPI to `Application/openapi.json` (committed), compare to working tree, fail on diff.
- `frontend/lib/api/types.ts` is regenerated by `npm run gen:types` (pinned to `openapi-typescript`).
- CI fails if `types.ts` is stale.

## Versioning

MVP is `v0`. No `/v1` prefix yet. Breaking changes require a `CONTRACTS.md` PR review by Minh + Hung before backend changes land.
