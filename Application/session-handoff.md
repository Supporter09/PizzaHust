# session-handoff.md

**Current state:** `U12` Manage Profile and `U13` View Loyalty Points are **done and verify-green** on `feat/u12-u13-profile-loyalty`. Customer `/account` is now a dashboard, `/account/edit` manages profile/avatar/password, and `/account/loyalty` shows balance + earn history.

**Next feature:** `U14` Redeem Points for Discount.

**What shipped (U12/U13):**
- Backend: `users.avatar_url` migration `0021`; `POST/DELETE /api/auth/me/avatar`; `POST /api/auth/me/password`; `GET /api/loyalty/me` includes `redeemable_value_vnd`; `GET /api/loyalty/me/history` returns order-derived earn rows.
- Frontend: `auth-provider` avatar/password actions, `lib/api/loyalty.ts`, `Avatar`, `/account`, `/account/edit`, `/account/loyalty`, and Playwright `account-profile-loyalty.spec.ts`.
- Contract parity: `openapi.json`, `frontend/lib/api/types.ts`, and `CONTRACTS.md` regenerated/updated.
- Compatibility fix: `auth-register.spec.ts` now asserts the dashboard name after register instead of the old profile form input.

**Fidelity:** Documented at `docs/superpowers/design-fidelity/U12-U13-FIDELITY.md` (screenshots local-only, not committed).

**Verification:** `./verify.sh` green at `578d43d`, `2026-06-15T01:39:29Z` — backend 437 passed/1 skipped, frontend 128 vitest + build, smoke, e2e 49 passed/4 skipped.

**Resume:** `git checkout feat/u12-u13-profile-loyalty && cd Application && ./init.sh && ./verify.sh`

**Top blocker for U14:** None known; implement redemption against backend-configured loyalty values and extend history with redeem rows.
