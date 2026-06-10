# U4 — View Combo Promotions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task.

**Goal:** Add a public `GET /api/combos` endpoint and a `/combos` customer page that lists currently-active combo promotions with price and server-computed savings.

**Architecture:** A pure `combo_savings_vnd` domain helper + a thin public `app/api/combos.py` router (mirrors `app/api/menu.py`) that filters to `combo_status == ACTIVE` and computes sum-of-parts/savings from eager-loaded component products. Frontend adds `lib/api/combos.ts`, `app/combos/page.tsx` (cloned from `app/menu/page.tsx`), a `combo-card` component, and a nav link. Combos are NOT added to cart/orders here — that is U5.

**Tech Stack:** FastAPI + SQLAlchemy 2 + Pydantic v2 (backend), Next.js 16 App Router + TS strict (frontend), pytest + httpx + vitest + Playwright.

**Base:** branch `u4-view-combos` off `main` @ `168c416` (U3 merged). Design: `docs/plans/2026-06-09-u4-view-combos-design.md`.

**Conventions to mirror:**
- Public routers are thin and query the session directly (no service layer) — see `app/api/menu.py`.
- Errors via `APIError(code=..., message=..., status_code=...)` from `app.core.errors`.
- Money is integer VND. Domain math lives in `app/domain/`, never duplicated in routers or frontend.
- `combo_status(validity_start, validity_end, now)` from `app.domain.combos` is the Active/Scheduled/Expired source of truth; `now` is naive UTC via the `_now_utc_naive()` convention (`datetime.now(UTC).replace(tzinfo=None)`).
- After any route change: `python -m app.tools.dump_openapi > ../openapi.json` (needs env from `.env` — replicate `verify.sh` lines 6-14, or just run `./verify.sh`), then `cd frontend && npm run gen:types`; commit both.
- Backend tests use `tests.auth_test_utils.build_test_app("<slug>")` + factories in `tests.admin_test_utils` (`new_category`, `new_product`; combos via `new_combo_with_items(name, product_ids, *, price_vnd=...)` — READ its signature, it sets quantity=1 per product).
- All backend commands run from `Application/backend` with venv active: `.venv/bin/python -m pytest -q <path>`.

---

## Task 1: `combo_savings_vnd` domain helper (TDD)

**Files:**
- Modify: `Application/backend/app/domain/combos.py`
- Test: `Application/backend/tests/domain/test_combos.py`

**Step 1: Write failing tests** — append to `test_combos.py`:

```python
from app.domain.combos import combo_savings_vnd


def test_savings_positive_when_combo_cheaper():
    assert combo_savings_vnd(200_000, 255_000) == 55_000


def test_savings_zero_when_equal():
    assert combo_savings_vnd(255_000, 255_000) == 0


def test_savings_clamped_zero_when_overpriced():
    assert combo_savings_vnd(300_000, 255_000) == 0
```

(Add `combo_savings_vnd` to the existing `from app.domain.combos import ...` line at the top.)

**Step 2: Run, expect fail**

Run: `.venv/bin/python -m pytest -q tests/domain/test_combos.py -k savings`
Expected: FAIL (ImportError: cannot import name `combo_savings_vnd`).

**Step 3: Implement** — append to `app/domain/combos.py`:

```python
def combo_savings_vnd(combo_price_vnd: int, items_total_vnd: int) -> int:
    """Savings vs buying the components separately. Clamped at 0 — an over-priced
    combo shows no savings, never a negative number."""
    return max(0, items_total_vnd - combo_price_vnd)
```

**Step 4: Run, expect pass**

Run: `.venv/bin/python -m pytest -q tests/domain/test_combos.py`
Expected: PASS (existing + 3 new).

**Step 5: Commit**

```bash
git add Application/backend/app/domain/combos.py Application/backend/tests/domain/test_combos.py
git commit -m "feat(U4): add combo savings domain helper"
```

---

## Task 2: public `GET /api/combos` endpoint + tests (TDD)

**Files:**
- Create: `Application/backend/app/api/combos.py`
- Modify: `Application/backend/app/main.py` (register router)
- Test: `Application/backend/tests/test_combos.py`

**Context:** Models — `Combo(combo_id, name, description, combo_price_vnd, target_group, validity_start, validity_end, combo_items)`, `ComboItem(combo_item_id, combo_id, product_id, quantity, product)`, `Product(product_id, name, base_price_vnd, image_url, is_pizza, is_active)`. Eager-load `combo_items -> product` to read component `name`/`image_url`/`base_price_vnd` and avoid N+1. Filter Active in Python via `combo_status`.

**Step 1: Write failing tests** — create `tests/test_combos.py`:

```python
from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.infra.db.models import Combo, ComboItem
from app.infra.db.session import create_session_factory
from tests.admin_test_utils import new_category, new_product
from tests.auth_test_utils import build_test_app


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _add_combo(name, price, items, *, start=None, end=None):
    """items: list of (product_id, quantity)."""
    with create_session_factory()() as db:
        combo = Combo(
            name=name,
            description=f"{name} desc",
            combo_price_vnd=price,
            target_group=2,
            validity_start=start,
            validity_end=end,
        )
        db.add(combo)
        db.flush()
        for pid, qty in items:
            db.add(ComboItem(combo_id=combo.combo_id, product_id=pid, quantity=qty))
        db.commit()
        db.refresh(combo)
        return combo.combo_id


def test_lists_active_combo_with_savings():
    app = build_test_app("combos-active")
    cid = new_category("Pizza")
    p1 = new_product(cid, "Margherita", base_price_vnd=125_000, is_pizza=True)
    p2 = new_product(cid, "Garlic Bread", base_price_vnd=45_000, is_pizza=False)
    # items_total = 125000*2 + 45000*1 = 295000; combo price 255000 -> savings 40000
    _add_combo("Lunch Duo", 255_000, [(p1, 2), (p2, 1)])

    r = TestClient(app).get("/api/combos")
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body) == 1
    combo = body[0]
    assert combo["name"] == "Lunch Duo"
    assert combo["combo_price_vnd"] == 255_000
    assert combo["items_total_vnd"] == 295_000
    assert combo["savings_vnd"] == 40_000
    assert combo["target_group"] == 2
    assert "validity_start" not in combo and "status" not in combo
    items = combo["items"]
    assert len(items) == 2
    assert set(items[0]) == {"product_id", "name", "quantity", "image_url", "base_price_vnd"}
    names = {i["name"]: i["quantity"] for i in items}
    assert names == {"Margherita": 2, "Garlic Bread": 1}


def test_excludes_scheduled_and_expired():
    app = build_test_app("combos-window")
    cid = new_category("Pizza")
    p1 = new_product(cid, "A", base_price_vnd=100_000, is_pizza=True)
    p2 = new_product(cid, "B", base_price_vnd=50_000, is_pizza=False)
    now = _now()
    _add_combo("Future", 100_000, [(p1, 1), (p2, 1)],
               start=now + timedelta(days=1), end=now + timedelta(days=2))
    _add_combo("Past", 100_000, [(p1, 1), (p2, 1)],
               start=now - timedelta(days=2), end=now - timedelta(days=1))
    _add_combo("LiveNow", 120_000, [(p1, 1), (p2, 1)],
               start=now - timedelta(days=1), end=now + timedelta(days=1))

    body = TestClient(app).get("/api/combos").json()
    assert [c["name"] for c in body] == ["LiveNow"]


def test_overpriced_combo_savings_zero():
    app = build_test_app("combos-overpriced")
    cid = new_category("Pizza")
    p1 = new_product(cid, "A", base_price_vnd=100_000, is_pizza=True)
    p2 = new_product(cid, "B", base_price_vnd=50_000, is_pizza=False)
    _add_combo("Pricey", 200_000, [(p1, 1), (p2, 1)])  # parts 150000 < 200000
    body = TestClient(app).get("/api/combos").json()
    assert body[0]["savings_vnd"] == 0


def test_empty_when_no_active_combos():
    app = build_test_app("combos-empty")
    r = TestClient(app).get("/api/combos")
    assert r.status_code == 200
    assert r.json() == []


def test_public_no_auth():
    app = build_test_app("combos-public")
    assert TestClient(app).get("/api/combos").status_code == 200


def test_component_image_url_surfaced():
    app = build_test_app("combos-image")
    cid = new_category("Pizza")
    p1 = new_product(cid, "WithImg", base_price_vnd=100_000, is_pizza=True)
    p2 = new_product(cid, "NoImg", base_price_vnd=50_000, is_pizza=False)
    with create_session_factory()() as db:
        from sqlalchemy import select
        from app.infra.db.models import Product
        prod = db.scalar(select(Product).where(Product.product_id == p1))
        prod.image_url = "/static/img/withimg.png"
        db.commit()
    _add_combo("ImgCombo", 120_000, [(p1, 1), (p2, 1)])
    body = TestClient(app).get("/api/combos").json()
    items = {i["name"]: i["image_url"] for i in body[0]["items"]}
    assert items["WithImg"] == "/static/img/withimg.png"
    assert items["NoImg"] is None


def test_excludes_combo_with_inactive_component():
    # Admin PATCH can deactivate a product after the combo was created (no combo guard
    # on patch). Such a combo must not surface on the public page.
    app = build_test_app("combos-inactive-part")
    cid = new_category("Pizza")
    p1 = new_product(cid, "Active", base_price_vnd=100_000, is_pizza=True)
    p2 = new_product(cid, "GoneSoon", base_price_vnd=50_000, is_pizza=False)
    _add_combo("HasInactive", 120_000, [(p1, 1), (p2, 1)])
    with create_session_factory()() as db:
        from sqlalchemy import select
        from app.infra.db.models import Product

        prod = db.scalar(select(Product).where(Product.product_id == p2))
        prod.is_active = False
        db.commit()
    r = TestClient(app).get("/api/combos")
    assert r.status_code == 200
    assert r.json() == []
```

**Step 2: Run, expect fail**

Run: `.venv/bin/python -m pytest -q tests/test_combos.py`
Expected: FAIL (404 — route not registered).

**Step 3: Implement** — create `app/api/combos.py`:

```python
"""U4 – public combo promotions (read-only, no auth).

Lists combos that are Active for the current time window (status derived via
app.domain.combos), with server-computed sum-of-parts and savings. Scheduling
windows and the derived status enum stay internal — only Active combos are
returned. Combos are not yet orderable; cart wiring is U5.
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.domain.combos import ComboStatus, combo_savings_vnd, combo_status
from app.infra.db.deps import get_db
from app.infra.db.models import Combo, ComboItem

router = APIRouter(prefix="/api", tags=["combos"])


def _now_utc_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class PublicComboItemOut(BaseModel):
    product_id: int
    name: str
    quantity: int
    image_url: str | None = None
    base_price_vnd: int


class PublicComboOut(BaseModel):
    combo_id: int
    name: str
    description: str | None = None
    combo_price_vnd: int
    target_group: int | None = None
    items_total_vnd: int
    savings_vnd: int
    items: list[PublicComboItemOut]


@router.get("/combos", response_model=list[PublicComboOut])
def list_combos(db: Session = Depends(get_db)) -> list[PublicComboOut]:
    now = _now_utc_naive()
    stmt = (
        select(Combo)
        .options(selectinload(Combo.combo_items).selectinload(ComboItem.product))
        .order_by(Combo.combo_id)
    )
    out: list[PublicComboOut] = []
    for combo in db.scalars(stmt).all():
        if combo_status(combo.validity_start, combo.validity_end, now) is not ComboStatus.ACTIVE:
            continue
        items = sorted(combo.combo_items, key=lambda ci: ci.combo_item_id)
        # A component product can be deactivated after the combo was created (admin PATCH
        # has no combo guard). Don't surface a combo whose parts aren't all orderable.
        if any(not ci.product.is_active for ci in items):
            continue
        items_total = sum(ci.product.base_price_vnd * ci.quantity for ci in items)
        out.append(
            PublicComboOut(
                combo_id=combo.combo_id,
                name=combo.name,
                description=combo.description,
                combo_price_vnd=combo.combo_price_vnd,
                target_group=combo.target_group,
                items_total_vnd=items_total,
                savings_vnd=combo_savings_vnd(combo.combo_price_vnd, items_total),
                items=[
                    PublicComboItemOut(
                        product_id=ci.product_id,
                        name=ci.product.name,
                        quantity=ci.quantity,
                        image_url=ci.product.image_url,
                        base_price_vnd=ci.product.base_price_vnd,
                    )
                    for ci in items
                ],
            )
        )
    return out
```

Verify the relationship attribute names against `app/infra/db/models.py` (`Combo.combo_items`, `ComboItem.product`) before finalizing.

Then in `app/main.py`: add `from app.api.combos import router as combos_router` (with the other `app.api.*` imports) and `app.include_router(combos_router)` near `app.include_router(menu_router)`.

**Step 4: Run, expect pass**

Run: `.venv/bin/python -m pytest -q tests/test_combos.py`
Expected: PASS (7 tests).

**Step 5: Run nearby suites for regressions**

Run: `.venv/bin/python -m pytest -q tests/test_menu.py tests/test_admin_combos.py tests/domain/test_combos.py`
Expected: PASS.

**Step 6: Commit**

```bash
git add Application/backend/app/api/combos.py Application/backend/app/main.py Application/backend/tests/test_combos.py
git commit -m "feat(U4): add public GET /api/combos with computed savings"
```

---
## Task 3: regenerate OpenAPI + frontend types

**Files:**
- Modify: `Application/openapi.json`
- Modify: `Application/frontend/lib/api/types.ts`

**Step 1: Dump OpenAPI with env.** From `Application/`, replicate the `verify.sh` env (it sources `.env` and rewrites `DATABASE_URL`). Easiest reliable path:

```bash
cd Application
set -a; source .env; set +a
MYSQL_HOST_PORT="${MYSQL_HOST_PORT:-33306}"
export DATABASE_URL="${DATABASE_URL:-mysql+pymysql://pizza:pizza@127.0.0.1:${MYSQL_HOST_PORT}/pizzahust}"
export DATABASE_URL="${DATABASE_URL/mysql:3306/127.0.0.1:${MYSQL_HOST_PORT}}"
cd backend && .venv/bin/python -m app.tools.dump_openapi > ../openapi.generated.json
```

Verify success (exit 0, file non-empty), confirm cart schemas still present and the new ones added:

```bash
grep -o '"/api/combos"' ../openapi.generated.json
grep -o 'PublicComboOut\|PublicComboItemOut' ../openapi.generated.json | sort -u
```
Then `mv ../openapi.generated.json ../openapi.json`. (Never redirect directly onto the committed `openapi.json` — a failed dump would clobber it.)

**Step 2: Regenerate types**

Run (from `Application/frontend`): `npm run gen:types`

**Step 3: Sanity check**

```bash
grep -c "PublicComboOut\|PublicComboItemOut" Application/frontend/lib/api/types.ts
git diff --stat Application/openapi.json Application/frontend/lib/api/types.ts
```
Expected: both show additions only (the new `/api/combos` path + `PublicComboOut`/`PublicComboItemOut` schemas); no churn to existing entries.

**Step 4: Commit**

```bash
git add Application/openapi.json Application/frontend/lib/api/types.ts
git commit -m "chore(U4): regenerate OpenAPI + frontend types for public combos"
```

---

## Task 4: frontend combos API client + unit test (TDD)

**Files:**
- Create: `Application/frontend/lib/api/combos.ts`
- Test: `Application/frontend/lib/api/combos.test.ts`

Run frontend commands from `Application/frontend`.

**Step 1: Write failing test** — `lib/api/combos.test.ts` (mirror `lib/api/cart.test.ts` partial-mock style):

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

import { fetchCombos } from "@/lib/api/combos";
import { apiFetch } from "@/lib/api/client";

vi.mock("@/lib/api/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/client")>()),
  apiFetch: vi.fn(),
}));

describe("fetchCombos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GETs /combos and returns the parsed list", async () => {
    const resp = [
      {
        combo_id: 1,
        name: "Lunch Duo",
        description: "desc",
        combo_price_vnd: 255000,
        target_group: 2,
        items_total_vnd: 295000,
        savings_vnd: 40000,
        items: [
          { product_id: 1, name: "Margherita", quantity: 2, image_url: null, base_price_vnd: 125000 },
        ],
      },
    ];
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue(resp);

    const out = await fetchCombos();

    expect(apiFetch).toHaveBeenCalledWith("/combos");
    expect(out).toEqual(resp);
  });
});
```

**Step 2: Run, expect fail**

Run: `npx vitest run lib/api/combos.test.ts`
Expected: FAIL (module `@/lib/api/combos` not found).

**Step 3: Implement** — `lib/api/combos.ts`:

```ts
import { apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

export type PublicCombo = components["schemas"]["PublicComboOut"];
export type PublicComboItem = components["schemas"]["PublicComboItemOut"];

export function fetchCombos(): Promise<PublicCombo[]> {
  return apiFetch<PublicCombo[]>("/combos");
}
```

**Step 4: Run, expect pass**

Run: `npx vitest run lib/api/combos.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add Application/frontend/lib/api/combos.ts Application/frontend/lib/api/combos.test.ts
git commit -m "feat(U4): frontend combos API client"
```

---
## Task 5: combo card component + `/combos` page + nav link

**Files:**
- Create: `Application/frontend/components/combos/combo-card.tsx`
- Create: `Application/frontend/app/combos/page.tsx`
- Modify: `Application/frontend/components/top-nav.tsx`

Run frontend commands from `Application/frontend`.

**Step 1: Create `components/combos/combo-card.tsx`** (clones `pizza-card.tsx` visual language; uses the first component's image as the card image, lists components, shows price + savings badge):

```tsx
import { formatVnd } from "@/lib/format";
import type { PublicCombo } from "@/lib/api/combos";

export function ComboCard({ combo }: { combo: PublicCombo }) {
  const cover = combo.items.find((i) => i.image_url)?.image_url ?? null;
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-line bg-card">
      {cover ? (
        <img src={cover} alt={combo.name} loading="lazy" className="h-48 w-full object-cover" />
      ) : (
        <div className="flex h-48 w-full items-center justify-center bg-surface-active text-sm text-muted">
          No image
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-fg">{combo.name}</h3>
          {combo.savings_vnd > 0 ? (
            <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
              Save {formatVnd(combo.savings_vnd)}
            </span>
          ) : null}
        </div>
        {combo.description ? <p className="text-sm text-muted">{combo.description}</p> : null}
        <ul className="text-sm text-muted">
          {combo.items.map((i) => (
            <li key={i.product_id}>
              {i.quantity}× {i.name}
            </li>
          ))}
        </ul>
        <div className="mt-auto flex items-baseline gap-2 pt-2">
          <span className="text-lg font-bold text-brand">{formatVnd(combo.combo_price_vnd)}</span>
          {combo.savings_vnd > 0 ? (
            <span className="text-sm text-muted line-through">{formatVnd(combo.items_total_vnd)}</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
```

**Step 2: Create `app/combos/page.tsx`** (clone the `app/menu/page.tsx` state machine; no category filter):

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";

import { ComboCard } from "@/components/combos/combo-card";
import { fetchCombos, type PublicCombo } from "@/lib/api/combos";

type Status = "loading" | "ready" | "error";

export default function CombosPage() {
  const [combos, setCombos] = useState<PublicCombo[]>([]);
  const [status, setStatus] = useState<Status>("loading");

  const load = useCallback(() => {
    setStatus("loading");
    fetchCombos()
      .then((list) => {
        setCombos(list);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold text-fg">Combo Promotions</h1>

      {status === "error" ? (
        <div className="rounded-md border border-danger bg-danger-subtle px-4 py-3 text-sm text-fg">
          <p>Couldn&apos;t load combos.</p>
          <button type="button" className="btn-primary mt-3 px-5 py-2.5" onClick={load}>
            Try again
          </button>
        </div>
      ) : null}

      {status === "loading" ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-80 animate-pulse rounded-2xl bg-surface-active" />
          ))}
        </div>
      ) : null}

      {status === "ready" && combos.length === 0 ? (
        <p className="py-12 text-center text-muted">No combos available right now.</p>
      ) : null}

      {status === "ready" && combos.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {combos.map((combo) => (
            <ComboCard key={combo.combo_id} combo={combo} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
```

**Step 3: Add a "Combos" nav link** in `components/top-nav.tsx`. It is a public link, so put it in the always-shown nav next to "Home" (NOT the auth-conditional `links` array) — in BOTH the desktop `<nav>` (after the Home `<Link>`, line ~46-48) and the mobile `<nav>` (after the Home `<Link>`, line ~85-91). Desktop:

```tsx
<Link href="/combos" className={navClass(pathname === "/combos")}>
  Combos
</Link>
```

Mobile (match the `py-3` + onClick pattern of the other mobile links):

```tsx
<Link
  href="/combos"
  className={`${navClass(pathname === "/combos")} py-3`}
  onClick={() => setMenuOpen(false)}
>
  Combos
</Link>
```

**Step 4: Typecheck + unit + lint**

Run: `npx tsc --noEmit && npx vitest run --exclude 'tests/e2e/**' && npx eslint .`
Expected: PASS (the pre-existing `<img>` ESLint *warning* is acceptable — 0 errors).

**Step 5: Commit**

```bash
git add Application/frontend/components/combos/combo-card.tsx Application/frontend/app/combos/page.tsx Application/frontend/components/top-nav.tsx
git commit -m "feat(U4): combos page, combo card, and nav link"
```

---

## Task 6: Playwright e2e

**Files:**
- Create: `Application/frontend/tests/e2e/combos.spec.ts`

**Context:** Seeds (`app/seeds/run.py`) create two Active combos: "Lunch Duo for 2" (255.000₫) and "Family Feast 4" (480.000₫), both priced below their parts (so each shows a "Save …" badge). `verify.sh` seeds before the browser run. Mirror the assertion style of `tests/e2e/item-detail.spec.ts`. The core U4 value prop is that each card shows a price AND server-computed savings — assert both so a card that drops the savings badge cannot pass.

> Check `lib/format.ts::formatVnd` for the exact currency string (grouping separator + `₫`). If it renders `255.000₫`, the price assertions below match; adjust the expected substrings if the format differs. Don't assert an exact savings amount (it depends on seed component prices) — assert the "Save " affordance is present.

**Step 1: Write `tests/e2e/combos.spec.ts`:**

```ts
import { expect, test } from "@playwright/test";

test.describe("U4 — View Combo Promotions", () => {
  test("lists active combos with price and savings", async ({ page }) => {
    await page.goto("/combos");
    await expect(page.getByRole("heading", { name: "Combo Promotions" })).toBeVisible();

    // Scope to the "Lunch Duo for 2" card and prove price + savings are rendered.
    const card = page
      .locator("article")
      .filter({ has: page.getByRole("heading", { name: "Lunch Duo for 2" }) });
    await expect(card).toBeVisible();
    await expect(card.getByText("255.000₫")).toBeVisible();
    await expect(card.getByText(/Save\s/)).toBeVisible();

    await expect(page.getByRole("heading", { name: "Family Feast 4" })).toBeVisible();
  });

  test("combos reachable from the nav", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Combos" }).first().click();
    await expect(page).toHaveURL(/\/combos$/);
    await expect(page.getByRole("heading", { name: "Combo Promotions" })).toBeVisible();
  });
});
```

**Step 2: Do NOT run Playwright here** (needs the full compose stack + seeds). It runs inside `./verify.sh` (Task 7). If you want a local check first, `./verify.sh` is the supported path.

**Step 3: Commit**

```bash
git add Application/frontend/tests/e2e/combos.spec.ts
git commit -m "test(U4): e2e for combos listing and nav"
```

---

## Task 7: update CONTRACTS.md

**Files:**
- Modify: `Application/CONTRACTS.md`

**Step 1: Edits**
- The Catalog table already has the `GET /api/combos` row ("List active combos for current time window") — keep it.
- Add a "Schema Examples" entry for `GET /api/combos` documenting: returns Active-only combos; each carries `combo_price_vnd`, server-computed `items_total_vnd` + `savings_vnd` (savings clamped at 0), `target_group`, and `items[]` (`product_id`, `name`, `quantity`, `image_url`, `base_price_vnd`); `validity_*` and `status` are intentionally omitted (Active-only). Example response:

```json
[
  {
    "combo_id": 1,
    "name": "Lunch Duo for 2",
    "description": "2 Medium pizzas + 2 Garlic Breads",
    "combo_price_vnd": 255000,
    "target_group": 2,
    "items_total_vnd": 295000,
    "savings_vnd": 40000,
    "items": [
      { "product_id": 5, "name": "Margherita", "quantity": 2, "image_url": null, "base_price_vnd": 125000 }
    ]
  }
]
```
- Note that cart/order support for combos remains deferred to U5 (the existing deferral note stays accurate).

**Step 2: Commit**

```bash
git add Application/CONTRACTS.md
git commit -m "docs(U4): document public GET /api/combos response"
```

---

## Task 8: full verification gate

**Step 1: Run** (from `Application`, redirect to a log, capture exit):

```bash
cd Application && ./verify.sh > /tmp/u4-verify.log 2>&1; echo "exit=$?"
```
Expected: `exit=0`, log ends with `=== VERIFY OK ===`. Confirm steps include backend tests, OpenAPI drift (clean), frontend types drift (clean), build, and Playwright.

**Step 2: If red** — diagnose from the log. Likely culprits: ruff line-length/format on the new files (run `ruff check --fix` + `ruff format` in `backend`, recommit), contract drift (re-run Task 3), or e2e timing.

**Step 3: Capture evidence** — note HEAD SHA + an ISO-8601 UTC timestamp from the green run.

---

## Task 9: harness closeout

**Files:**
- Modify: `Application/feature_list.json` (U4 → `done` + evidence)
- Modify: `Application/progress.md` (append dated block, <= 20 lines)
- Modify: `Application/session-handoff.md` (rewrite: current = U4 done; next = U5 Manage Cart)

**Step 1: Edits** per `AGENTS.md` "End of Session" + "Definition of Done". Evidence format: `verify.sh green at <sha>, <iso-timestamp>`. `session-handoff.md` next feature `U5` (`depends_on: U3, U4` — both done); note the natural extension point: wiring `kind="combo"` into `POST /api/cart/quote` (resolve combo by id, apply `combo_discount_vnd` via the already-present `compute_order_total` param).

**Step 2: Commit**

```bash
git add Application/feature_list.json Application/progress.md Application/session-handoff.md
git commit -m "chore(U4): record completion evidence and handoff to U5"
```

**Step 3: Push + PR** (only when the user asks)

```bash
git push -u origin u4-view-combos
gh pr create --base main --title "feat(U4): view combo promotions (public combos API + /combos page)" \
  --body "GET /api/combos lists Active combos with server-computed savings; /combos page + combo card + nav link. Domain savings helper added; OpenAPI + FE types regenerated; CONTRACTS updated. Cart/order combo support deferred to U5. verify.sh green."
```

---

## Notes / risks
- **Untracked `opencode.json`** at repo root is unrelated — never stage it.
- Combos have **no image column**; the card uses the first component product's `image_url` (or the "No image" fallback). This is intentional.
- `target_group` is an integer party-size (2, 4), not a customer segment — display as-is or ignore in the card (the provided card omits it; fine).
- Do NOT touch `cart.py`/pricing for combos — orderable combos are U5. Keep the diff to the public read path.
- Pre-existing: leftover `*.sqlite3` artifacts under `backend/tests/`; two seed tests need `ADMIN_SEED_PASSWORD`/`KITCHEN_SEED_PASSWORD` env (green under `verify.sh` env).
