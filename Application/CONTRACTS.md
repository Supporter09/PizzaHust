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
| GET | `/api/config/delivery` | Returns `{ fee_vnd, service_area: ["Ba Dinh", ...] }` for the 51 post-2025 Hanoi wards |
| GET | `/api/config/loyalty` | Returns `{ accrual_rate, redeem_value_vnd, max_redeem_pct }` |

### Catalog (U1, U2, U4)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/categories` | List active categories |
| GET | `/api/items` | List active items, filterable by `category` (`category_id`). `vegetarian`/`kids` filters and item `description` are deferred — no schema columns yet. |
| GET | `/api/items/{id}` | Item detail (includes sizes/crusts/toppings if pizza) |
| GET | `/api/combos` | List active combos for current time window |

### Cart & Checkout (U3, U5, U6, U13)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/cart/quote` | Compute pricing for a candidate cart + address |
| POST | `/api/orders` | Place COD order. Returns `{ order_code, total_vnd, status }`. Rejects with `OUT_OF_SERVICE_AREA` if address invalid |

> **Authoritative pricing (U3).** `POST /api/cart/quote` is the single source of
> truth for line and cart pricing. The former U2 client-side preview
> (`frontend/lib/pricing.ts` `computePizzaLineTotal`) has been **removed** in U3; the
> `/menu/[id]` item page now calls `POST /api/cart/quote` for a single customized
> pizza line and renders `total_vnd`. `address` is **optional**: when absent the quote
> runs in preview mode (`delivery_fee_vnd: 0`, no service-area check); when present and
> outside the inner-Hanoi whitelist it returns `OUT_OF_SERVICE_AREA` (422). `combo`
> lines are deferred (U4/U5) and currently return `VALIDATION_FAILED` (400).
> `redeem_points` is accepted for forward-compatibility with U14, but because the
> loyalty balance is 0 until U13/U14, any `redeem_points > 0` returns
> `INSUFFICIENT_LOYALTY` (422); U3 callers send `redeem_points: 0`.

### Order tracking (U7, U11)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/orders/track/{code}` | Public, rate-limited. Returns minimal projection |
| GET | `/api/orders/me` | Customer order history (auth required) |
| GET | `/api/orders/me/{id}` | Customer order detail (auth required) |

### Auth & profile (U8, U9, U12, U13)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Create customer account |
| POST | `/api/auth/login` | Login, sets session cookie + CSRF cookie |
| POST | `/api/auth/logout` | Clear session |
| GET | `/api/auth/me` | Current session profile + CSRF token |
| PATCH | `/api/auth/me` | Update profile (`full_name`, `address`) |
| GET | `/api/loyalty/me` | Loyalty balance summary |

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
| GET/POST/PATCH/DELETE | `/api/admin/sizes` | A2 — pizza sizes |
| GET/POST/PATCH/DELETE | `/api/admin/crusts` | A2 — pizza crusts |
| GET/POST/PATCH/DELETE | `/api/admin/toppings` | A2 — pizza toppings |
| GET/POST/PATCH/DELETE | `/api/admin/categories` | A3 |
| GET/POST/PATCH/DELETE | `/api/admin/combos` | A4 — response includes derived `status` |
| POST | `/api/admin/import/pizzas` | A1 — CSV upsert (multipart field `file`) |
| POST | `/api/admin/import/toppings` | A1 — CSV upsert (multipart field `file`) |
| GET | `/api/admin/orders` | A5 list, query param `status` |
| GET | `/api/admin/orders/{id}` | A5 get order detail |
| POST | `/api/admin/orders/{id}/cancel` | A5 cancel order |
| POST | `/api/admin/orders/{id}/retry-dispatch` | infra-005 — hand a `DispatchPending` order to the delivery provider. Success → stores `delivery_reference`, status → `Delivering`, 204. Wrong state → 409. Provider failure → 502 `DELIVERY_UPSTREAM_ERROR`, order stays `DispatchPending` (retryable) |
| GET | `/api/admin/customers` | A6 list, query params: `q` (search), `page`, `page_size` |
| GET | `/api/admin/customers/{id}` | A6 customer detail |
| POST | `/api/admin/customers/{id}/lock` | A6 lock account, body `{ "reason": string \| null }` |
| POST | `/api/admin/customers/{id}/unlock` | A6 unlock account |
| GET | `/api/admin/reports/sales` | A7, query params: `from`, `to` |

#### A1–A4 Catalog management — scope

> ⚠️ **Contract change — pending Minh + Hung review** (per the versioning rule
> at the bottom of this file). These admin catalog routes were added/extended
> when integrating the A1–A4 work.

- **A1/A2 items** (`/api/admin/items`): one unified surface for pizzas **and**
  side dishes; bodies are JSON with `kind` (`pizza`/`side`, maps to `is_pizza`).
  `category_id` on create/PATCH must reference an **existing, active** category
  (else `VALIDATION_FAILED`). `DELETE` is a **soft-deactivate** (`is_active=false`);
  if a pizza is still referenced by a combo it returns `409 CONFLICT` with
  `error.details.combos` listing the blocking combo names.
- **Image upload** (`POST /api/admin/items/{id}/image`): the documented exception
  to JSON-only — `multipart/form-data`, field `image`. Extension allowlist
  (`png`/`jpg`/`jpeg`/`webp`) + size cap (`IMAGE_MAX_BYTES`); returns `{ "image_url" }`
  and sets the item's `image_url`. Files are served read-only at `IMAGE_BASE_URL`.
- **A2 options** (`/api/admin/sizes|crusts|toppings`): full CRUD each. Each `name`
  is **unique** (DB-enforced); a duplicate on create/rename → `409 CONFLICT`. `DELETE`
  is guarded against historical order data (a size/crust/topping referenced by an
  existing order item → `409 CONFLICT`, never an FK/500).
- **A4 combos** (`/api/admin/combos`): a combo needs **≥ 2 component items**, each
  referencing an existing, active product. Response carries a derived `status`
  (`Scheduled` / `Active` / `Expired`) computed from the validity window at
  read-time. An **over-priced** combo (price > sum of parts) is **accepted** —
  the frontend warns but the API does not reject. Validity rejects only
  `validity_end < validity_start` (equality allowed).
- **Bulk import** (`/api/admin/import/{pizzas,toppings}`): `multipart/form-data`,
  field `file`. Upsert by name (re-import is idempotent). An unknown **or inactive**
  `category_name` is reported as a per-row error and skipped — categories are
  **never** auto-created. A non-boolean `is_pizza` value is likewise a per-row error. Pizzas CSV columns: `name, category_name,
  base_price_vnd, is_pizza`. Toppings CSV columns: `name, price_vnd`.

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

### Kitchen (K1–K3)

All under `/api/kitchen/`, role=`kitchen` required.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/kitchen/queue` | Ordered queue (reads `kitchen_queue_view`) |
| POST | `/api/kitchen/orders/{id}/accept` | K2 flow: Received → Preparing |
| PATCH | `/api/kitchen/orders/{id}/status` | K2: update preparation sub-stage |
| POST | `/api/kitchen/orders/{id}/ready` | K3: T1 handoff; success → ReadyForDispatch, timeout/fail → DispatchPending |

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

### `POST /api/cart/quote` — request

```json
{
  "lines": [
    {
      "kind": "pizza",
      "item_id": 12,
      "size": "M",
      "crust": "thin",
      "topping_ids": [3, 7],
      "quantity": 1
    },
    { "kind": "side", "item_id": 21, "quantity": 2 }
  ],
  "address": { "administrative_unit": "Ba Đình", "street": "..." },
  "redeem_points": 0
}
```

> `combo` lines are deferred (U4/U5) — a combo example will land with those features.
> Omit `address` to receive a preview quote (`delivery_fee_vnd: 0`, no service-area check).

### `POST /api/cart/quote` — response

Pizza line 190.000 (base 125.000 + size M 30.000 + toppings 15.000 + 20.000) plus side
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
    "role": "customer"
  },
  "csrf_token": "<token>"
}
```

### `GET /api/loyalty/me` — response

```json
{
  "current_points": 0,
  "total_points_earned": 0
}
```

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
  "address_masked": "***, Ba Đình, Hà Nội"
}
```

## OpenAPI Generation

- Backend serves OpenAPI at `/api/openapi.json`.
- `verify.sh` step: dump OpenAPI to `Application/openapi.json` (committed), compare to working tree, fail on diff.
- `frontend/lib/api/types.ts` is regenerated by `npm run gen:types` (pinned to `openapi-typescript`).
- CI fails if `types.ts` is stale.

## Versioning

MVP is `v0`. No `/v1` prefix yet. Breaking changes require a `CONTRACTS.md` PR review by Minh + Hung before backend changes land.
