# session-handoff.md

**Current state:** U8 + U9 + U5 **merged to `main`** (PRs #26, #29 — #27/#28 merged into wrong bases, #29 forwarded them; merge `9847fb9`). All CI green. Feature branches deleted.

**Next feature:** `U6` Place COD Order (+U16 delivery note) — plan Branch 4, Tasks 4.1–4.x in
`docs/superpowers/plans/2026-06-12-u5-u9-ordering-spine.md`.

**Resume command:**

```bash
cd Application && ./init.sh && docker compose up -d backend frontend
git checkout main && git pull && git checkout -b u6-place-order
# Mark U6 in_progress in feature_list.json; start plan Task 4.1 (order_code domain, TDD)
```

**State:** Server cart at `/api/cart` (note clear via PATCH `null`, quantity capped 99 via `MAX_LINE_QUANTITY`), guest merge on login (cap-clamped), GC pinned by tests, `CartProvider` + `/cart` + add-to-cart on menu/combo, cart in mobile nav. Dish note on product page (U16 partial). Checkout page is U6.

**Blockers:** Run `alembic upgrade head` (0007 carts) on any env predating U5.

**U6 carry-overs:**
- `quote_session_cart` skips stale lines (preview semantics); order placement must fail per-line with `details.line_id` — don't reuse blind.
- Fold `CHECK (quantity BETWEEN 1 AND 99)` on `cart_lines` into migration 0008 (deferred from PR28 review).
- First `verify.sh` e2e run right after a frontend container rebuild can flake while Next warms — retry once before debugging.
