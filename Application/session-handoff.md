# session-handoff.md

**Current state:** `U5` Manage Cart — **done** on branch `u5-manage-cart` (ready for review; PR to `main`).

**Resume command (after merge — start U6):**

```bash
cd Application && ./init.sh && docker compose up -d backend frontend && alembic upgrade head
git checkout main && git pull && git checkout -b u6-place-order
# Mark U6 in-progress; plan Task 4.1 order_code domain
```

**State:** Server cart at `/api/cart`, guest merge on login, `CartProvider` + `/cart` + add-to-cart on menu/combo. Dish note on product page (U16 partial). Checkout page still U6.

**Next feature:** `U6` Place COD Order — **pause for U5 review** before starting U6.

**Blockers:** Run `alembic upgrade head` (0007 carts) on any env that predates this branch.

**PR note:** CONTRACTS.md cart endpoints — Minh + Hung review.