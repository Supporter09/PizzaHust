# CONTRACTS.md

REST API contract for PizzaHUST. Backend exports OpenAPI at `/api/openapi.json`; `frontend/lib/api/types.ts` is generated from it. CI fails on drift.

## Conventions

- Base URL: `/api`
- All bodies are JSON. `Content-Type: application/json`.
- Authentication: httpOnly cookie set by `/api/auth/login`. CSRF token in `X-CSRF-Token` header on state-changing routes.
- Money values: integer VND (e.g., `22000`). No floats anywhere.
- Timestamps: ISO 8601 UTC (`2026-04-28T10:00:00Z`).
- IDs: integer surrogate keys for internal entities; ULID strings for order codes.

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
| GET | `/api/config/delivery` | Returns `{ fee_vnd, service_area: ["Ba Đình", ...] }` |
| GET | `/api/config/loyalty` | Returns `{ accrual_rate, redeem_value_vnd, max_redeem_pct }` |

### Catalog (U1, U2, U4)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/categories` | List active categories |
| GET | `/api/items` | List items, filterable by `category`, `vegetarian`, `kids` |
| GET | `/api/items/{id}` | Item detail (includes sizes/crusts/toppings if pizza) |
| GET | `/api/combos` | List active combos for current time window |

### Cart & Checkout (U3, U5, U6, U13)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/cart/quote` | Compute pricing for a candidate cart + address |
| POST | `/api/orders` | Place COD order. Returns `{ order_code, total_vnd, status }`. Rejects with `OUT_OF_SERVICE_AREA` if address invalid |

### Order tracking (U7, U10)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/orders/track/{code}` | Public, rate-limited. Returns minimal projection |
| GET | `/api/orders/me` | Customer order history (auth required) |
| GET | `/api/orders/me/{id}` | Customer order detail (auth required) |

### Auth & profile (U8, U9, U11, U12)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Create customer account |
| POST | `/api/auth/login` | Login, sets cookie |
| POST | `/api/auth/logout` | Clear session |
| GET | `/api/auth/me` | Current session profile |
| PATCH | `/api/auth/me` | Update profile |
| GET | `/api/loyalty/me` | Balance + recent transactions |

### Admin (A1–A7)

All under `/api/admin/`, role=`admin` required.

| Method | Path | Purpose |
|---|---|---|
| GET/POST/PATCH/DELETE | `/api/admin/items` | A1, A2 |
| GET/POST/PATCH/DELETE | `/api/admin/categories` | A3 |
| GET/POST/PATCH/DELETE | `/api/admin/combos` | A4 |
| GET/PATCH | `/api/admin/orders` | A5 (list, cancel, retry delivery) |
| GET | `/api/admin/customers` | A6 |
| GET | `/api/admin/reports/sales` | A7, query params: `from`, `to` |

### Kitchen (K1–K4)

All under `/api/kitchen/`, role=`kitchen` required.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/kitchen/queue` | Ordered queue (reads `kitchen_queue_view`) |
| POST | `/api/kitchen/orders/{id}/accept` | K2: Received → Preparing |
| PATCH | `/api/kitchen/orders/{id}/status` | K3: update sub-stage |
| POST | `/api/kitchen/orders/{id}/ready` | K4: Preparing → ReadyForDispatch + T1 |

### Delivery webhook (T2)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/webhooks/delivery` | HMAC-signed status callback. Verifies signature with `DELIVERY_WEBHOOK_SECRET` |

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
    { "kind": "side", "item_id": 21, "quantity": 2 },
    { "kind": "combo", "combo_id": 4, "quantity": 1 }
  ],
  "address": { "district": "Ba Đình", "ward": "...", "street": "..." },
  "redeem_points": 10
}
```

### `POST /api/cart/quote` — response

```json
{
  "subtotal_vnd": 295000,
  "discount_combo_vnd": 30000,
  "discount_loyalty_vnd": 10000,
  "delivery_fee_vnd": 22000,
  "total_vnd": 277000,
  "loyalty": { "balance": 42, "redeemed": 10, "max_redeemable": 132 }
}
```

### `POST /api/orders` — response

```json
{
  "order_code": "01J9X4QYXZK7T9P5N3M0H8B2QW",
  "total_vnd": 277000,
  "status": "Received",
  "promised_at": "2026-04-28T11:15:00Z"
}
```

### `GET /api/orders/track/{code}` — response

```json
{
  "order_code": "01J9X4QYXZK7T9P5N3M0H8B2QW",
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
