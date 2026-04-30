# ARCHITECTURE.md

## Stack

- Frontend: Next.js (App Router) + Tailwind CSS, TypeScript strict.
- Backend: Python 3.12, FastAPI, SQLAlchemy 2.x + Alembic.
- Database: MySQL 8.x.
- Containers: Docker Compose for dev and CI.
- Tests: pytest + httpx (backend, contract, smoke), vitest + Testing Library (frontend), Playwright (e2e).

## Module Boundaries

```
Application/
├── backend/app/
│   ├── api/            <- FastAPI routers, thin: validate → call service → return DTO
│   ├── domain/         <- pure business logic, no IO
│   │   ├── order_state.py
│   │   ├── pricing.py
│   │   ├── loyalty.py
│   │   ├── kitchen_priority.py    (mirrors the SQL view formula)
│   │   └── service_area.py
│   ├── infra/
│   │   ├── db/         <- SQLAlchemy models, migrations, repositories
│   │   ├── auth/       <- session middleware, password hashing, role guards
│   │   └── delivery/   <- port (interface) + mock + real adapters
│   └── seeds/          <- catalog, categories, combos for dev/demo
└── frontend/
    ├── app/            <- routes (App Router)
    ├── components/     <- presentation
    ├── lib/api/        <- typed client generated from backend OpenAPI
    └── tests/          <- vitest + Playwright
```

Rule: `api/` calls `domain/` and `infra/`. `domain/` calls neither. `infra/` may not import from `api/`. Cyclic imports between layers fail CI via import-linter rule.

## Order State Machine

Single owner: `backend/app/domain/order_state.py`.

States (closed set):
- `Received`
- `Preparing`
- `ReadyForDispatch`
- `Delivering`
- `Delivered`
- `DeliveryFailed`
- `Cancelled`

Allowed transitions:

| From | To | Triggered by |
|---|---|---|
| `Received` | `Preparing` | K2 (kitchen accept) |
| `Received` | `Cancelled` | A5 (admin cancel) |
| `Preparing` | `ReadyForDispatch` | K4 (kitchen mark ready) |
| `Preparing` | `Cancelled` | A5 |
| `ReadyForDispatch` | `Delivering` | T2 webhook (`Accepted` / `PickedUp`) |
| `Delivering` | `Delivered` | T2 webhook (`Delivered`) |
| `Delivering` | `DeliveryFailed` | T2 webhook (`Failed`) |

`Delivered`, `DeliveryFailed`, `Cancelled` are terminal. K4 also triggers T1 atomically — if T1 fails, K4 reverts and surfaces the error to admin (A5).

## Kitchen Queue Priority

Single source of truth: SQL view `kitchen_queue_view`. Backend domain function `kitchen_priority.score()` mirrors the same formula for tests; the view is what the kitchen UI reads.

Formula (placeholder — confirm with team):

```
score = (now - created_at).seconds * 1.0
      + max(0, (now - promised_at).seconds) * 5.0
      + (10 if status = 'Preparing' else 0)
```

Higher score = higher priority. View definition lives in a migration and is versioned.

## Delivery Integration (Port + Adapters)

Interface: `backend/app/infra/delivery/port.py`

```python
class DeliveryPort(Protocol):
    def request(self, order: OrderForDispatch) -> DeliveryReference: ...
    def status(self, reference: str) -> DeliveryStatus: ...
```

Adapters:
- `mock.py` — default in dev, CI, demo. Implements both methods, exposes admin endpoints to advance status manually. Lives in `Application/delivery_mock/` as a separate FastAPI service container so it is reachable over the network like a real provider.
- `real.py` — placeholder until provider is selected. Importing it without `DELIVERY_PROVIDER=real` raises at startup.

Selector: `DELIVERY_PROVIDER` env var (`mock` | `real`). Default `mock`. Production value comes from infra, never from code.

T2 sync: backend exposes `POST /api/webhooks/delivery` with HMAC signature verification. Mock signs with `DELIVERY_WEBHOOK_SECRET`.

## Authentication

- httpOnly signed-cookie sessions via Starlette `SessionMiddleware`.
- Session payload: `{user_id, role, session_id, csrf}`.
- Roles: `guest` (no session), `customer`, `admin`, `kitchen`. Roles are mutually exclusive.
- Password hashing: `argon2id` via `argon2-cffi`.
- Cookie flags: `HttpOnly`, `Secure` (prod), `SameSite=Lax`.
- CSRF: double-submit token on state-changing routes (`POST`/`PUT`/`PATCH`/`DELETE`).
- Rate limit on `/api/auth/login` and `/api/auth/register` — 5 req / minute / IP.

Role guards: FastAPI dependencies in `backend/app/infra/auth/guards.py`:

```python
def require_role(*roles: Role) -> Callable: ...
```

Guest endpoints take no guard. Customer endpoints take `require_role(Role.CUSTOMER)`. Admin/kitchen analogous.

## Pricing Pipeline

Single function: `backend/app/domain/pricing.py::compute_order_total`.

Inputs: cart lines, customer (or None), redeemed points, address.
Outputs: `OrderQuote { subtotal, discount_combo, discount_loyalty, delivery_fee, total }`.

Order of operations:
1. Sum line subtotals (pizza base + size delta + crust delta + topping deltas, or side dish price, or combo bundle price).
2. Apply combo discounts (if any).
3. Apply loyalty redemption discount (cap at `LOYALTY_MAX_REDEEM_PCT * subtotal_after_combo`).
4. Add `DELIVERY_FEE_VND` (only if address passes `service_area.is_inner_hanoi(addr)`).
5. Total = max(0, sum).

Frontend never recomputes — it calls `POST /api/cart/quote` and renders the response.

## Order Code

`backend/app/domain/order_code.py::generate()` returns a ULID, displayed as 26-char Crockford base32.

Tracking lookup: `GET /api/orders/track/{code}` — rate limited 5/min/IP. Returns minimal projection (see PRODUCT.md "Tracking & Privacy").

## Configuration Surface

All knobs read from env via `backend/app/infra/config.py` (pydantic settings).

```
DATABASE_URL=mysql+pymysql://pizza:pizza@mysql:3306/pizzahust
SESSION_SECRET=...
DELIVERY_PROVIDER=mock
DELIVERY_BASE_URL=http://delivery-mock:9000
DELIVERY_API_KEY=...
DELIVERY_WEBHOOK_SECRET=...
DELIVERY_FEE_VND=22000
LOYALTY_ACCRUAL_RATE=10000
LOYALTY_REDEEM_VALUE_VND=1000
LOYALTY_MAX_REDEEM_PCT=0.5
ORDER_PROMISED_TIME_DEFAULT_MIN=45
```

Frontend reads only `NEXT_PUBLIC_API_BASE_URL`. All other config is server-side.

## Database

- Migrations: Alembic in `backend/app/infra/db/migrations/`.
- Schema source-of-truth: `Application/schema.dbml` (translated from `Week 1/ERD.pdf` by Hieu).
- `alembic check` runs in `verify.sh` to catch model/migration drift.
- Seeds: `python -m app.seeds.run` populates categories, sample pizzas, toppings, combos for dev. Idempotent.

## Deployment Topology (dev/demo)

```
docker-compose:
  mysql            <- 3306
  backend          <- 8000  (uvicorn app.main:app)
  frontend         <- 3000  (next start)
  delivery-mock    <- 9000  (tiny FastAPI, signs T2 webhooks back to backend)
```

CI runs the same compose, then `verify.sh`.

## Observability (minimal)

- Structured JSON logging via `structlog`. No `print`.
- Request ID middleware: every request gets `X-Request-ID`, propagated to logs and to delivery-mock calls.
- Error envelope: see `CONTRACTS.md`.
- No external APM. Local logs only.
