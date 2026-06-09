# session-handoff.md

**Current feature:** `U3` Customize Pizza — **done** on branch `u3-customize-pizza` @ `f93e6ea` (PR pending).

**Resume command:**

```bash
cd Application && ./init.sh && docker compose up -d --build backend frontend && ./verify.sh
```

> Note: the compose `frontend` service serves a built bundle — rebuild it (`--build`) to pick up the `/menu/[id]` quote wiring.

**State:** `POST /api/cart/quote` is the authoritative single-source pricing endpoint (public, non-mutating). It resolves prices from the catalog (pizza: base + size-by-name modifier + topping ids; side: base price), rejects `combo` lines (deferred U4/U5), `is_pizza`/kind mismatches, and side-with-options as `VALIDATION_FAILED` (400); out-of-area address and `redeem_points`-without-balance return 422. `address` is optional (absent ⇒ preview, `delivery_fee_vnd: 0`, no service-area check). The U2 client-side `computePizzaLineTotal` deviation is **removed**: `/menu/[id]` now renders the server `total_vnd` via a 250ms-debounced `quoteCart` call (`active`-flag stale/unmount guard, `aria-live` on the estimate). Domain gained pure `compute_pizza_unit_price`; `compute_order_total` address is now optional. `openapi.json` + `frontend/lib/api/types.ts` regenerated; `CONTRACTS.md` updated. `verify.sh` green at `f93e6ea`.

**Next feature:** `U4` View Combo Promotions (`depends_on`: `U1`, `A4` — both done).

> U4's natural extension point: implement `combo` line quoting in `POST /api/cart/quote` (currently rejected). Combos already have admin CRUD (A4) with a derived `Scheduled/Active/Expired` status and a `combo_price_vnd`; the public surface is `GET /api/combos` (list active combos for the current time window — see CONTRACTS.md).

**Known follow-ups (non-blocking, recorded in `progress.md`):**
- `redeem_points` is wired through `cart/quote` but inert until U13/U14 (loyalty balance is 0, so any `> 0` is `INSUFFICIENT_LOYALTY`).
- Multi-line cart + cart persistence are U5.
- Pre-existing: leftover `*.sqlite3` artifacts under `backend/tests/`; two seed tests need `ADMIN_SEED_PASSWORD`/`KITCHEN_SEED_PASSWORD` env.
- `/menu/[id]` + `/menu` still fetch on mount without an in-flight cancel guard on the item *load* (the new quote effect is guarded; the initial fetch mirrors the U1 pattern).

**PR:**

```bash
git push -u origin u3-customize-pizza
gh pr create --title "feat(U3): customize pizza (authoritative cart quote)" \
  --body "POST /api/cart/quote computes authoritative single-pizza pricing (address-optional preview mode); /menu/[id] calls it and the lib/pricing.ts deviation is removed. Domain unit-price helper added; compute_order_total address now optional; OpenAPI + FE types regenerated; CONTRACTS updated. verify.sh green at f93e6ea."
```
