# session-handoff.md

**Current state:** `U11` View Order History & Reorder is **done and verify-green** on `feat/u11-order-history`. Customer `/account/orders` lists owned orders, expands detail/timeline, and Reorder appends resolvable lines into the session cart.

**Next feature:** `U12` Manage Profile.

**What shipped (U11):**
- `GET /api/orders/me`, `GET /api/orders/me/{order_code}`, `POST /api/orders/me/{order_code}/reorder` in `backend/app/api/order_history.py` (separate from place/track in `orders.py`).
- Cart reuse: reorder calls **`append_line_to_cart`** (`carts.py`) so validation/persist matches `POST /api/cart/lines` — always append, never merge duplicate payloads.
- Reorder matching is **best-effort**: inactive/changed menu, lapsed combos/options, or validation errors surface in `unavailable[]`; `added_count` reflects only successful appends.
- Frontend `lib/api/orders.ts` + `app/account/orders/*`; partial reorder banner via `orders-reorder-banner` on the list page.

**Fidelity:** Documented at `docs/superpowers/design-fidelity/U11-FIDELITY.md` (no screenshot commit).

**Verification:** `./verify.sh` green at `d3b3797`, `2026-06-14T18:42:25Z` — see U11 `evidence` in `feature_list.json`.

**Resume:** `git checkout feat/u11-order-history && cd Application && ./init.sh && ./verify.sh`

**Blockers:** None.