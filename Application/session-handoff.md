# session-handoff.md

**Current state:** `U5` Manage Cart — **done + review fixes applied**; stacked PRs open:
`u8-register` → `main`, `u9-login` → `u8-register`, `u5-manage-cart` → `u9-login`.
Merge top-down (U8 first, retarget the next PR after each merge).

**Resume command (after all three merge — start U6):**

```bash
cd Application && ./init.sh && docker compose up -d backend frontend
git checkout main && git pull && git checkout -b u6-place-order
# Mark U6 in-progress; plan Task 4.1 order_code domain
```

**State:** Server cart at `/api/cart` (note clear via PATCH `null`, quantity capped 99), guest merge on login, GC pinned by tests, `CartProvider` + `/cart` + add-to-cart on menu/combo, cart in mobile nav. Dish note on product page (U16 partial). Checkout page still U6.

**Next feature:** `U6` Place COD Order — blocked on PR merges.

**Blockers:** Run `alembic upgrade head` (0007 carts) on any env that predates these branches.

**U6 carry-over:** `quote_session_cart` skips stale lines (preview semantics); order placement must fail per-line with `details.line_id` — don't reuse blind.

**PR note:** CONTRACTS.md cart endpoints — Minh + Hung review.
