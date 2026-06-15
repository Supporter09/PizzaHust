# session-handoff.md

**Current state:** `U14` Redeem Points for Discount is **done and verify-green** on `feat/u14-redeem-points`. A logged-in customer can spend loyalty points for a checkout discount; points are reserved at placement and released on Cancel / Delivery-Failed. This branch sits on top of `main` (post-U12/U13 merge).

**Next feature:** `T1` Request Delivery Service (mock-first) and `T2` Synchronize Delivery Status (webhook) — the only remaining `todo` entries. Per prior notes the delivery loop is already implemented/tested via infra-005/K3/A5/K4/U7, so T1/T2 are largely **verify + formalize** (the parked smoke test and T2 logging), not net-new build.

**What shipped (U14):**
- Backend: `orders.loyalty_points_redeemed` (migration `0022`); customer balance wired into `checkout_quote` → `quote_session_cart`/`quote_cart_for_placement` → `compute_redemption`; points reserved & netted at placement; `release_reserved_points` (`infra/loyalty_service.py`) on admin Cancel + Delivery-Failed webhook (row-locked); `/api/loyalty/me/history` emits `kind:"redeem"` rows. `compute_redemption` raises **422 INSUFFICIENT_LOYALTY** on over-balance AND over-cap (no clamp).
- Frontend: `app/checkout/page.tsx` redeem panel + price breakdown; pure `lib/checkout-redeem.ts` (`effectiveMaxRedeem` + `parseRedeemEntry`); inline over-redeem error; Playwright `checkout-redeem.spec.ts`.
- Contracts: `openapi.json`, `frontend/lib/api/types.ts`, `CONTRACTS.md` regenerated for the widened history `kind`.

**Deviations:** over-redeem errors instead of clamping (user-directed); the "max 50% of subtotal" note was removed and the panel redesigned (user-directed); accrual is credited at placement (not Delivered); only Cancel / Delivery-Failed reverse earned + release reserved.

**Fidelity:** `docs/superpowers/design-fidelity/U14-FIDELITY.md` (screenshots local-only, not committed).

**Verification:** `./verify.sh` green at `c54414c`, `2026-06-15T13:47:38Z` — backend pytest + frontend tsc/eslint/vitest/build + OpenAPI↔types parity, smoke 1 passed/1 skipped, Playwright 50 passed/4 skipped/0 failed.

**Resume:** `git checkout feat/u14-redeem-points && cd Application && ./init.sh && ./verify.sh` (or start T1/T2 from `main` after this PR merges).

**Top blocker for T1/T2:** None known — scope is verifying the existing delivery loop and unparking the delivery smoke test; confirm `DELIVERY_WEBHOOK_SECRET` HMAC path end-to-end.
