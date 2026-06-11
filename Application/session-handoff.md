# session-handoff.md

**Current state:** `U15` Customize Combo — **done** on branch `u15-customize-combo` (PR to
`main`; `./verify.sh` green).

**Resume command:**

```bash
cd Application && ./init.sh && docker compose up -d backend frontend && ./verify.sh
```

**State:** Customer combo customizer at `/combos/[id]` uses `GET /api/combos/{id}`, slot
picker with surcharges, per-pick `OptionGroupSelector` (cached dish detail), live
`POST /api/cart/quote` (250 ms debounce), `combo_not_active` / selection-rule errors.
`buildComboLine` matches `ComboQuoteLineIn`; add-to-cart deferred to U5 (same as U3).

**Next feature:** `U5` Manage Cart (`depends_on`: U3 ✅, U4 ✅) — first consumer of
`buildComboLine` / combo line persistence in the cart.

**U6 follow-up:** `POST /api/orders` must persist resolved combo picks; `order_items` XOR
product/combo may need extension.

**Known follow-ups (non-blocking):**
- `redeem_points` inert until U13/U14.
- Docker `backend` image: rebuild after code changes (`docker compose build backend`).
- A9 multi-image deferred.