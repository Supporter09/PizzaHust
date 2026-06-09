# U3 — Customize Pizza Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stand up the authoritative `POST /api/cart/quote` endpoint and wire the `/menu/[id]` price preview to it, retiring the client-side `lib/pricing.ts` deviation.

**Architecture:** Add a pure `compute_pizza_unit_price` helper to `domain/pricing.py` and make `compute_order_total`'s address optional (preview mode = no fee, no service-area check). A new thin `api/cart.py` router resolves DB prices (never trusts client money) and calls the pricing pipeline. Frontend calls the endpoint (debounced) instead of recomputing.

**Tech Stack:** FastAPI + SQLAlchemy 2 + Pydantic v2 (backend), Next.js App Router + TS strict (frontend), pytest + httpx + vitest + Playwright.

**Base:** branch `u3-customize-pizza` off `main` @ `1e5263a` (U2 merged). Design: `docs/plans/2026-06-09-u3-customize-pizza-design.md`.

**Conventions to mirror:**
- Routers are thin, query the session directly (no service layer) — see `app/api/menu.py`.
- Errors via `APIError(code=..., message=..., status_code=...)` from `app.core.errors`; codes are the closed set in `CONTRACTS.md`.
- Money is integer VND. Pydantic models use `model_config = {"from_attributes": True}` where reading ORM rows.
- Backend API tests use `tests.auth_test_utils.build_test_app("<slug>")` + factories in `tests.admin_test_utils` (`new_category`, `new_product`, `new_size`, `new_crust`, `new_topping`).
- After any route change: `python -m app.tools.dump_openapi > openapi.json` then `cd frontend && npm run gen:types`; commit both (CI fails on drift).
- All backend commands run from `Application/backend` with the venv active; DATABASE_URL host rewrite is handled by `verify.sh`/`init.sh` (tests use SQLite via `build_test_app`).

---

## Task 1: `compute_pizza_unit_price` domain helper (TDD)

**Files:**
- Modify: `Application/backend/app/domain/pricing.py`
- Test: `Application/backend/tests/domain/test_pricing.py`

**Step 1: Write failing tests** — append to `test_pricing.py`:

```python
from app.domain.pricing import compute_pizza_unit_price


def test_pizza_unit_price_sums_base_size_and_toppings() -> None:
    assert (
        compute_pizza_unit_price(
            base_price_vnd=125_000,
            size_modifier_vnd=30_000,
            topping_prices_vnd=[15_000, 20_000],
        )
        == 190_000
    )


def test_pizza_unit_price_no_toppings_no_modifier() -> None:
    assert (
        compute_pizza_unit_price(
            base_price_vnd=99_000, size_modifier_vnd=0, topping_prices_vnd=[]
        )
        == 99_000
    )


def test_pizza_unit_price_rejects_negative() -> None:
    with pytest.raises(PricingError) as exc:
        compute_pizza_unit_price(
            base_price_vnd=-1, size_modifier_vnd=0, topping_prices_vnd=[]
        )
    assert exc.value.code == "VALIDATION_FAILED"
```

**Step 2: Run, expect fail**

Run: `pytest -q tests/domain/test_pricing.py -k pizza_unit_price`
Expected: FAIL (ImportError: cannot import name `compute_pizza_unit_price`).

**Step 3: Implement** — add to `pricing.py` (after `_line_subtotal`):

```python
def compute_pizza_unit_price(
    *,
    base_price_vnd: int,
    size_modifier_vnd: int,
    topping_prices_vnd: list[int],
) -> int:
    parts = [base_price_vnd, size_modifier_vnd, *topping_prices_vnd]
    if any(p < 0 for p in parts):
        raise PricingError("VALIDATION_FAILED", "Pizza price inputs must be non-negative.")
    return sum(parts)
```

**Step 4: Run, expect pass**

Run: `pytest -q tests/domain/test_pricing.py -k pizza_unit_price`
Expected: PASS (3 passed).

**Step 5: Commit**

```bash
git add Application/backend/app/domain/pricing.py Application/backend/tests/domain/test_pricing.py
git commit -m "feat(U3): add authoritative pizza unit-price helper"
```

---

## Task 2: optional address (preview mode) in `compute_order_total` (TDD)

**Files:**
- Modify: `Application/backend/app/domain/pricing.py:41-79`
- Test: `Application/backend/tests/domain/test_pricing.py`

**Step 1: Write failing tests** — append:

```python
def test_compute_order_total_preview_mode_no_address() -> None:
    quote = compute_order_total(
        lines=[CartLine(unit_price_vnd=100_000, quantity=1)],
        address_district=None,
    )
    assert quote.delivery_fee_vnd == 0
    assert quote.total_vnd == 100_000
    assert quote.subtotal_vnd == 100_000


def test_compute_order_total_default_address_is_preview() -> None:
    # Called with no address kwarg at all -> preview, no service-area error.
    quote = compute_order_total(lines=[CartLine(unit_price_vnd=50_000, quantity=2)])
    assert quote.delivery_fee_vnd == 0
    assert quote.total_vnd == 100_000
```

**Step 2: Run, expect fail**

Run: `pytest -q tests/domain/test_pricing.py -k preview`
Expected: FAIL (TypeError: missing `address_district`, or service-area error).

**Step 3: Implement** — change signature + fee logic in `compute_order_total`:

```python
def compute_order_total(
    *,
    lines: list[CartLine],
    address_district: str | None = None,
    combo_discount_vnd: int = 0,
    redeem_points: int = 0,
    current_points: int = 0,
) -> OrderQuote:
    if combo_discount_vnd < 0:
        raise PricingError("VALIDATION_FAILED", "Combo discount cannot be negative.")
    delivery_fee_vnd = 0
    if address_district is not None:
        if not is_inner_hanoi(address_district):
            raise PricingError(
                "OUT_OF_SERVICE_AREA", "Delivery address is outside inner Hanoi."
            )
        delivery_fee_vnd = DELIVERY_FEE_VND
```

Then replace the two later uses of `DELIVERY_FEE_VND` (in `total_vnd` and the `OrderQuote(delivery_fee_vnd=...)`) with `delivery_fee_vnd`.

**Step 4: Run, expect pass (full domain suite — no regressions)**

Run: `pytest -q tests/domain/test_pricing.py`
Expected: PASS (all, including the existing 5 address-bearing tests).

**Step 5: Commit**

```bash
git add Application/backend/app/domain/pricing.py Application/backend/tests/domain/test_pricing.py
git commit -m "feat(U3): make delivery address optional (preview pricing mode)"
```

---

## Task 3: `POST /api/cart/quote` router + tests (TDD)

**Files:**
- Create: `Application/backend/app/api/cart.py`
- Modify: `Application/backend/app/main.py` (register router)
- Test: `Application/backend/tests/test_cart_quote.py`

**Step 1: Write failing tests** — new file `tests/test_cart_quote.py`:

```python
from __future__ import annotations

from fastapi.testclient import TestClient

from tests.admin_test_utils import (
    new_category,
    new_crust,
    new_product,
    new_size,
    new_topping,
)
from tests.auth_test_utils import build_test_app


def _pizza_fixture(slug: str):
    app = build_test_app(slug)
    cid = new_category("Pizza")
    pid = new_product(cid, "Margherita", base_price_vnd=125_000, is_pizza=True)
    new_size("S", modifier=0)
    new_size("M", modifier=30_000)
    new_size("L", modifier=60_000)
    new_crust("thin")
    tid_cheese = new_topping("Cheese", price_vnd=15_000)
    tid_beef = new_topping("Beef", price_vnd=20_000)
    return app, pid, tid_cheese, tid_beef


def test_quote_pizza_line_sums_size_toppings_quantity():
    app, pid, tid_cheese, tid_beef = _pizza_fixture("cart-pizza")
    body = {
        "lines": [
            {
                "kind": "pizza",
                "item_id": pid,
                "size": "M",
                "crust": "thin",
                "topping_ids": [tid_cheese, tid_beef],
                "quantity": 2,
            }
        ]
    }
    r = TestClient(app).post("/api/cart/quote", json=body)
    assert r.status_code == 200, r.text
    data = r.json()
    # unit = 125000 + 30000 + 15000 + 20000 = 190000; x2 = 380000
    assert data["subtotal_vnd"] == 380_000
    assert data["delivery_fee_vnd"] == 0  # no address -> preview
    assert data["total_vnd"] == 380_000
    assert data["loyalty"] == {"balance": 0, "redeemed": 0, "max_redeemable": 0}


def test_quote_side_line_uses_base_price():
    app = build_test_app("cart-side")
    cid = new_category("Sides")
    pid = new_product(cid, "Garlic Bread", base_price_vnd=45_000, is_pizza=False)
    r = TestClient(app).post(
        "/api/cart/quote",
        json={"lines": [{"kind": "side", "item_id": pid, "quantity": 3}]},
    )
    assert r.status_code == 200, r.text
    assert r.json()["subtotal_vnd"] == 135_000


def test_quote_in_area_address_adds_delivery_fee():
    app, pid, *_ = _pizza_fixture("cart-addr-ok")
    r = TestClient(app).post(
        "/api/cart/quote",
        json={
            "lines": [{"kind": "pizza", "item_id": pid, "size": "S", "quantity": 1}],
            "address": {"administrative_unit": "Ba Đình"},
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["delivery_fee_vnd"] == 22_000
    assert data["total_vnd"] == 125_000 + 22_000


def test_quote_out_of_area_address_422():
    app, pid, *_ = _pizza_fixture("cart-addr-bad")
    r = TestClient(app).post(
        "/api/cart/quote",
        json={
            "lines": [{"kind": "pizza", "item_id": pid, "size": "S", "quantity": 1}],
            "address": {"administrative_unit": "Thu Duc"},
        },
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "OUT_OF_SERVICE_AREA"


def test_quote_unknown_product_400():
    app = build_test_app("cart-unknown")
    r = TestClient(app).post(
        "/api/cart/quote",
        json={"lines": [{"kind": "pizza", "item_id": 999999, "quantity": 1}]},
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_FAILED"


def test_quote_inactive_product_400():
    app = build_test_app("cart-inactive")
    cid = new_category("Pizza")
    pid = new_product(cid, "Hidden", is_pizza=True, is_active=False)
    r = TestClient(app).post(
        "/api/cart/quote",
        json={"lines": [{"kind": "pizza", "item_id": pid, "quantity": 1}]},
    )
    assert r.status_code == 400


def test_quote_combo_kind_rejected_400():
    app = build_test_app("cart-combo")
    r = TestClient(app).post(
        "/api/cart/quote",
        json={"lines": [{"kind": "combo", "combo_id": 1, "quantity": 1}]},
    )
    assert r.status_code in (400, 422)


def test_quote_unknown_size_name_400():
    app, pid, *_ = _pizza_fixture("cart-badsize")
    r = TestClient(app).post(
        "/api/cart/quote",
        json={"lines": [{"kind": "pizza", "item_id": pid, "size": "XXL", "quantity": 1}]},
    )
    assert r.status_code == 400


def test_quote_unknown_topping_id_400():
    app, pid, *_ = _pizza_fixture("cart-badtop")
    r = TestClient(app).post(
        "/api/cart/quote",
        json={
            "lines": [
                {"kind": "pizza", "item_id": pid, "topping_ids": [999999], "quantity": 1}
            ]
        },
    )
    assert r.status_code == 400


def test_quote_side_with_pizza_options_400():
    app = build_test_app("cart-side-opts")
    cid = new_category("Sides")
    pid = new_product(cid, "Garlic Bread", base_price_vnd=45_000, is_pizza=False)
    r = TestClient(app).post(
        "/api/cart/quote",
        json={"lines": [{"kind": "side", "item_id": pid, "size": "M", "quantity": 1}]},
    )
    assert r.status_code == 400
```

**Step 2: Run, expect fail**

Run: `pytest -q tests/test_cart_quote.py`
Expected: FAIL (404 — route not registered).

**Step 3: Implement** — create `app/api/cart.py`:

```python
"""U3 – authoritative cart quote (public, non-mutating).

Resolves real prices from the catalog and runs the domain pricing pipeline.
The client never supplies money. Address is optional: absent => preview mode
(no delivery fee, no service-area check). Combo lines are deferred (U4/U5).
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.domain.pricing import (
    CartLine,
    PricingError,
    compute_order_total,
    compute_pizza_unit_price,
)
from app.infra.db.deps import get_db
from app.infra.db.models import PizzaCrust, PizzaSize, Product, Topping

router = APIRouter(prefix="/api/cart", tags=["cart"])


class QuoteAddressIn(BaseModel):
    administrative_unit: str
    street: str | None = None


class QuoteLineIn(BaseModel):
    kind: Literal["pizza", "side", "combo"]
    item_id: int | None = None
    combo_id: int | None = None
    size: str | None = None
    crust: str | None = None
    topping_ids: list[int] = Field(default_factory=list)
    quantity: int = Field(ge=1)


class CartQuoteIn(BaseModel):
    lines: list[QuoteLineIn] = Field(min_length=1)
    address: QuoteAddressIn | None = None
    redeem_points: int = Field(default=0, ge=0)


class QuoteLoyaltyOut(BaseModel):
    balance: int
    redeemed: int
    max_redeemable: int


class CartQuoteOut(BaseModel):
    subtotal_vnd: int
    discount_combo_vnd: int
    discount_loyalty_vnd: int
    delivery_fee_vnd: int
    total_vnd: int
    loyalty: QuoteLoyaltyOut


def _bad(message: str) -> APIError:
    return APIError(code="VALIDATION_FAILED", message=message, status_code=400)


def _resolve_line(db: Session, line: QuoteLineIn) -> CartLine:
    if line.kind == "combo":
        raise _bad("Combo lines are not supported yet.")
    if line.item_id is None:
        raise _bad("item_id is required.")
    product = db.scalar(
        select(Product).where(
            Product.product_id == line.item_id, Product.is_active.is_(True)
        )
    )
    if product is None:
        raise _bad("Unknown or inactive product.")

    if line.kind == "pizza":
        if not product.is_pizza:
            raise _bad("Product is not a pizza.")
        size_modifier = 0
        if line.size is not None:
            size = db.scalar(select(PizzaSize).where(PizzaSize.name == line.size))
            if size is None:
                raise _bad("Unknown size.")
            size_modifier = size.price_modifier_vnd
        if line.crust is not None:
            crust = db.scalar(select(PizzaCrust).where(PizzaCrust.name == line.crust))
            if crust is None:
                raise _bad("Unknown crust.")
        topping_prices: list[int] = []
        for tid in line.topping_ids:
            topping = db.scalar(select(Topping).where(Topping.topping_id == tid))
            if topping is None:
                raise _bad("Unknown topping.")
            topping_prices.append(topping.price_vnd)
        unit = compute_pizza_unit_price(
            base_price_vnd=product.base_price_vnd,
            size_modifier_vnd=size_modifier,
            topping_prices_vnd=topping_prices,
        )
        return CartLine(unit_price_vnd=unit, quantity=line.quantity)

    # kind == "side"
    if product.is_pizza:
        raise _bad("Product is a pizza, not a side.")
    if line.size or line.crust or line.topping_ids:
        raise _bad("Side items do not take size, crust, or toppings.")
    return CartLine(unit_price_vnd=product.base_price_vnd, quantity=line.quantity)


@router.post("/quote", response_model=CartQuoteOut)
def quote_cart(payload: CartQuoteIn, db: Session = Depends(get_db)) -> CartQuoteOut:
    lines = [_resolve_line(db, line) for line in payload.lines]
    district = payload.address.administrative_unit if payload.address else None
    try:
        quote = compute_order_total(
            lines=lines,
            address_district=district,
            redeem_points=payload.redeem_points,
            current_points=0,
        )
    except PricingError as exc:
        status = 422 if exc.code in {"OUT_OF_SERVICE_AREA", "INSUFFICIENT_LOYALTY"} else 400
        raise APIError(code=exc.code, message=str(exc), status_code=status) from exc

    return CartQuoteOut(
        subtotal_vnd=quote.subtotal_vnd,
        discount_combo_vnd=quote.discount_combo_vnd,
        discount_loyalty_vnd=quote.discount_loyalty_vnd,
        delivery_fee_vnd=quote.delivery_fee_vnd,
        total_vnd=quote.total_vnd,
        loyalty=QuoteLoyaltyOut(
            balance=quote.loyalty_balance,
            redeemed=quote.loyalty_redeemed,
            max_redeemable=quote.loyalty_max_redeemable,
        ),
    )
```

Then in `app/main.py`: add `from app.api.cart import router as cart_router` (alongside the other `app.api.*` imports) and `app.include_router(cart_router)` (near `menu_router`).

**Step 4: Run, expect pass**

Run: `pytest -q tests/test_cart_quote.py`
Expected: PASS (all cases).

**Step 5: Commit**

```bash
git add Application/backend/app/api/cart.py Application/backend/app/main.py Application/backend/tests/test_cart_quote.py
git commit -m "feat(U3): add POST /api/cart/quote authoritative pricing endpoint"
```

---

## Task 4: regenerate OpenAPI + frontend types

**Files:**
- Modify: `Application/openapi.json`
- Modify: `Application/frontend/lib/api/types.ts`

**Step 1: Dump OpenAPI**

Run (from `Application/backend`, venv active): `python -m app.tools.dump_openapi > ../openapi.json`

**Step 2: Regenerate types**

Run (from `Application/frontend`): `npm run gen:types`

**Step 3: Sanity check**

Run: `git diff --stat Application/openapi.json Application/frontend/lib/api/types.ts`
Expected: both show additions for `CartQuoteIn` / `CartQuoteOut` / `QuoteLineIn` etc.

**Step 4: Commit**

```bash
git add Application/openapi.json Application/frontend/lib/api/types.ts
git commit -m "chore(U3): regenerate OpenAPI + frontend types for cart quote"
```

---

## Task 5: frontend cart API client + unit test (TDD)

**Files:**
- Create: `Application/frontend/lib/api/cart.ts`
- Test: `Application/frontend/lib/api/cart.test.ts`

**Step 1: Write failing test** — `lib/api/cart.test.ts` (mirror existing vitest style; mock `apiFetch`):

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

import { quoteCart } from "@/lib/api/cart";
import { apiFetch } from "@/lib/api/client";

vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn() }));

describe("quoteCart", () => {
  beforeEach(() => vi.clearAllMocks());

  it("POSTs /cart/quote with a JSON body and returns the parsed quote", async () => {
    const resp = {
      subtotal_vnd: 190000,
      discount_combo_vnd: 0,
      discount_loyalty_vnd: 0,
      delivery_fee_vnd: 0,
      total_vnd: 190000,
      loyalty: { balance: 0, redeemed: 0, max_redeemable: 0 },
    };
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue(resp);

    const body = {
      lines: [{ kind: "pizza" as const, item_id: 1, size: "M", topping_ids: [3], quantity: 1 }],
    };
    const out = await quoteCart(body);

    expect(apiFetch).toHaveBeenCalledWith("/cart/quote", {
      method: "POST",
      body: JSON.stringify(body),
    });
    expect(out).toEqual(resp);
  });
});
```

**Step 2: Run, expect fail**

Run (from `Application/frontend`): `npx vitest run lib/api/cart.test.ts`
Expected: FAIL (module `@/lib/api/cart` not found).

**Step 3: Implement** — `lib/api/cart.ts`:

```ts
import { apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

export type CartQuoteIn = components["schemas"]["CartQuoteIn"];
export type CartQuoteOut = components["schemas"]["CartQuoteOut"];

export function quoteCart(body: CartQuoteIn): Promise<CartQuoteOut> {
  return apiFetch<CartQuoteOut>("/cart/quote", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
```

**Step 4: Run, expect pass**

Run: `npx vitest run lib/api/cart.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add Application/frontend/lib/api/cart.ts Application/frontend/lib/api/cart.test.ts
git commit -m "feat(U3): frontend cart-quote API client"
```

---

## Task 6: wire `/menu/[id]` to the authoritative quote; delete deviation

**Files:**
- Modify: `Application/frontend/app/menu/[id]/page.tsx`
- Delete: `Application/frontend/lib/pricing.ts`
- Delete: `Application/frontend/lib/pricing.test.ts`
- Modify: `Application/frontend/tests/e2e/item-detail.spec.ts` (if assertions reference client preview semantics)

**Step 1: Replace the preview logic in `page.tsx`:**
- Remove `import { computePizzaLineTotal } from "@/lib/pricing";`.
- Add `import { quoteCart } from "@/lib/api/cart";`.
- Replace the `preview` `useMemo` with quote state + a debounced effect:

```tsx
const [estimate, setEstimate] = useState<number | null>(null);
const [quoting, setQuoting] = useState(false);

useEffect(() => {
  if (!item || !item.is_pizza) {
    setEstimate(null);
    return;
  }
  const size = item.sizes.find((s) => s.size_id === sizeId);
  const crust = item.crusts.find((c) => c.crust_id === crustId);
  const token = Symbol();
  latestQuote.current = token;
  setQuoting(true);
  const handle = window.setTimeout(() => {
    quoteCart({
      lines: [
        {
          kind: "pizza",
          item_id: item.product_id,
          size: size?.name,
          crust: crust?.name,
          topping_ids: toppingIds,
          quantity,
        },
      ],
    })
      .then((q) => {
        if (latestQuote.current === token) setEstimate(q.total_vnd);
      })
      .catch(() => {
        if (latestQuote.current === token) setEstimate(null);
      })
      .finally(() => {
        if (latestQuote.current === token) setQuoting(false);
      });
  }, 250);
  return () => window.clearTimeout(handle);
}, [item, sizeId, crustId, toppingIds, quantity]);
```

Add near the other hooks: `const latestQuote = useRef<symbol | null>(null);` (import `useRef`).

- In the JSX, render `estimate`: show `formatVnd(estimate)` when set, a subtle pending hint while `quoting && estimate === null`, and keep the `data-testid="line-estimate"` attribute on the price span. When `estimate === null` and not quoting, render `—`.

**Step 2: Delete the deviation files**

```bash
git rm Application/frontend/lib/pricing.ts Application/frontend/lib/pricing.test.ts
```

**Step 3: Typecheck + unit + lint**

Run (from `Application/frontend`): `npx tsc --noEmit && npx vitest run && npx eslint .`
Expected: PASS, no references to `lib/pricing` remain.

**Step 4: Update e2e if needed**

`tests/e2e/item-detail.spec.ts` asserts the estimate changes on size/topping/quantity — still true with server quotes. The estimate updates async; if flakiness appears, wrap assertions in Playwright's auto-retrying `expect(...).not.toHaveText(prev)` (already used) and allow for the debounce. No semantic change expected.

**Step 5: Commit**

```bash
git add Application/frontend/app/menu/[id]/page.tsx Application/frontend/tests/e2e/item-detail.spec.ts
git commit -m "feat(U3): quote /menu/[id] price via backend; retire client preview"
```

---

## Task 7: update CONTRACTS.md

**Files:**
- Modify: `Application/CONTRACTS.md`

**Step 1: Edits**
- In the "Cart & Checkout" section, replace the U2-deviation blockquote (lines ~70-76) with a note that U3 retired `lib/pricing.ts` and `/menu/[id]` now calls `POST /api/cart/quote`.
- Document `POST /api/cart/quote`: `address` is **optional** — absent => preview pricing (delivery_fee 0, no service-area check); present + outside whitelist => `OUT_OF_SERVICE_AREA` (422). `combo` lines are deferred (U4/U5) and return `VALIDATION_FAILED`. `redeem_points` accepted but capped to 0 until loyalty balance lands (U13/U14).
- Confirm the request/response examples already in "Schema Examples" still match (they do; nested `loyalty` object preserved).

**Step 2: Commit**

```bash
git add Application/CONTRACTS.md
git commit -m "docs(U3): document cart/quote preview mode; move deviation retirement to U3"
```

---

## Task 8: full verification gate

**Step 1: Run the gate**

Run (from `Application`): `./verify.sh`
Expected: exit 0 (static + unit + contract drift + integration + smoke + Playwright).

**Step 2: If red** — fix forward, re-run. Common: contract drift (re-dump OpenAPI + gen types, Task 4), or e2e debounce timing (Task 6 Step 4).

**Step 3: Capture evidence** — note the commit SHA and ISO timestamp from a green run.

---

## Task 9: harness closeout

**Files:**
- Modify: `Application/feature_list.json` (U3 → `done`, evidence string)
- Modify: `Application/progress.md` (append dated block, <= 20 lines)
- Modify: `Application/session-handoff.md` (rewrite: current = U3 done, next = U4 View Combo Promotions, resume command, PR block)

**Step 1: Edits per `AGENTS.md` "End of Session" + "Definition of Done".**
- Evidence format: `verify.sh green at <sha>, <iso-timestamp>`.
- `session-handoff.md` next feature: `U4` (`depends_on: U1, A4` — both done).

**Step 2: Commit**

```bash
git add Application/feature_list.json Application/progress.md Application/session-handoff.md
git commit -m "chore(U3): record completion evidence and handoff to U4"
```

**Step 3: Push + PR** (only when the user asks)

```bash
git push -u origin u3-customize-pizza
gh pr create --title "feat(U3): customize pizza (authoritative cart quote)" \
  --body "POST /api/cart/quote computes authoritative single-pizza pricing (address-optional preview mode); /menu/[id] calls it and the lib/pricing.ts deviation is removed. Domain unit-price helper added; OpenAPI + FE types regenerated; CONTRACTS updated. verify.sh green."
```

---

## Notes / risks
- **Untracked `opencode.json`** at repo root is unrelated to U3 — do not stage it.
- Leftover `*.sqlite3` test artifacts under `Application/backend/tests/` are a pre-existing
  hygiene issue (recorded as a follow-up, not fixed here — surgical edits).
- `redeem_points` is structurally supported but inert (`current_points=0`) until U13/U14;
  the cap math is already exercised by domain tests.
